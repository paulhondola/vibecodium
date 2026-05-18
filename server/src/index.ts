import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serveStatic } from "hono/bun";
import Docker from "dockerode";

const docker = new Docker();

import gitRoutes from "./routes/git";
import projectsRoutes from "./routes/projects";
import sessionsRoutes from "./routes/sessions";
import reelsRoutes from "./routes/reels";
import agentRoutes from "./routes/agent";
import githubRoutes from "./routes/github";
import usersRouter from "./routes/users";
import deployRoutes from "./routes/deploy";
import helpRoutes from "./routes/help";
import timelineRoutes from "./routes/timeline";
import { syncProjectFilesToDisk } from "./utils/sync";
import { supabase } from "./db/supabase";
import * as nodePath from "node:path";
import llmRoutes from "./routes/llm";
import executeRoutes from "./routes/execute";



export const app = new Hono()
    .onError((err, c) => {
        console.error("Unhandled error:", err);
        return c.json({ success: false, error: "Internal server error" }, 500);
    })
    .use(logger())
    .use(cors({
        origin: "*",
        allowHeaders: ["*"],
        allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        credentials: false,
    }))
    .route("/api/git", gitRoutes)
    .route("/api/projects", projectsRoutes)
    .route("/api/sessions", sessionsRoutes)
    .route("/api/reels", reelsRoutes)
    .route("/api/agent", agentRoutes)
    .route("/api/github", githubRoutes)
    .route("/api/users", usersRouter)
    .route("/api/deploy", deployRoutes)
    .route("/api/help", helpRoutes)
    .route("/api/timeline", timelineRoutes)
    .route("/api", llmRoutes)
    .route("/execute", executeRoutes)
    // Serve static assets from the client dist folder
    .use("/assets/*", serveStatic({ root: "../client/dist" }))
    .use("/favicon.ico", serveStatic({ path: "../client/dist/favicon.ico" }))
    .use("/vibecodium_icon.svg", serveStatic({ path: "../client/dist/vibecodium_icon.svg" }))
    .use("/vite.svg", serveStatic({ path: "../client/dist/vite.svg" }))
    .get("/hello", async (c) => c.json({ message: "Hello BHVR!", success: true }, 200))


    .get("*", serveStatic({ path: "../client/dist/index.html" }));

// ──────────────────────────────────────────
// Docker Terminal Engine
// ──────────────────────────────────────────

// Extension → Docker image mapping (uses local custom images)
const EXT_TO_IMAGE: Record<string, string> = {
    ".py": "vibecodium-python:latest",
    ".rs": "vibecodium-rust:latest",
    ".cpp": "vibecodium-cpp:latest",
    ".cc": "vibecodium-cpp:latest",
    ".c": "vibecodium-cpp:latest",
    ".go": "vibecodium-go:latest",
};

function detectTerminalImage(filePaths: string[]): string {
    for (const fp of filePaths) {
        const ext = nodePath.extname(fp).toLowerCase();
        if (EXT_TO_IMAGE[ext]) return EXT_TO_IMAGE[ext]!;
    }
    return "vibecodium-node:latest"; // default for JS/TS projects
}

// Per-room state for the collaborative Docker terminal
interface TerminalRoom {
    container: Docker.Container;
    proc: ReturnType<typeof Bun.spawn>;
    sink: import("bun").FileSink; // typed stdin pipe
}

const termClients = new Map<string, Set<import("bun").ServerWebSocket<WSData>>>();
const termRooms = new Map<string, TerminalRoom>();
const termLineBuffers = new Map<string, string>(); // per-room line edit buffer

export function broadcastToTerminal(roomId: string, message: string) {
    termClients.get(roomId)?.forEach(c => { try { c.send(message); } catch (_) { } });
}

// Per project+file event counter for checkpoint marking.
// NOTE: resets on server restart — checkpoints are cosmetic anchors, not exact.
const timelineEventCounters = new Map<string, number>(); // key: `${projectId}::${filePath}`

async function stopTerminal(roomId: string): Promise<void> {
    const room = termRooms.get(roomId);
    const clients = termClients.get(roomId);
    termRooms.delete(roomId);
    termClients.delete(roomId);
    termLineBuffers.delete(roomId);

    clients?.forEach(c => {
        try { c.send("\r\n\x1b[33m[Container stopped]\x1b[0m\r\n"); } catch (_) { }
    });

    if (room) {
        try { room.proc?.kill(); } catch (_) { }
        try { await room.container.stop({ t: 5 }); } catch (_) { }
        try { await room.container.remove(); } catch (_) { }
        console.log(`[Terminal] Cleaned up container for room ${roomId}`);
    }
}

// ──────────────────────────────────────────
// Bun.serve Engine
// ──────────────────────────────────────────
const COLORS = ["#A855F7", "#3B82F6", "#10B981", "#F59E0B", "#EC4899", "#EF4444", "#14B8A6", "#F97316"];

// Fire-and-forget Supabase timeline logger.
// Saves every Nth code_update to avoid flooding. agent_accepted events always saved.
const TIMELINE_SAVE_INTERVAL = 7;

function logTimelineEvent(
    projectId: string,
    filePath: string,
    content: string,
    eventType: "code_update" | "agent_accepted",
    userId: string,
    userName: string,
    userColor: string,
): void {
    if (content.length > 500_000) return;
    (async () => {
        try {
            const key = `${projectId}::${filePath}`;
            const count = (timelineEventCounters.get(key) ?? 0) + 1;
            timelineEventCounters.set(key, count);

            if (eventType === "code_update" && count % TIMELINE_SAVE_INTERVAL !== 0) return;

            await supabase.from("timeline_events").insert({
                project_id: projectId,
                file_path: filePath,
                event_type: eventType,
                user_id: userId,
                user_name: userName,
                user_color: userColor,
                content,
                is_checkpoint: count % 50 === 0,
                created_at: new Date().toISOString(),
            });
        } catch (e) {
            console.error("[Timeline log error]:", e);
        }
    })();
}

interface WSData {
    projectId: string;
    clientId: string;
    userName: string;
    isHost: boolean;
    color: string;
    type: "collab" | "terminal";
}

// Room tracking for host resolution
const roomHosts = new Map<string, string>(); // projectId -> hostClientId
const activeClients = new Map<string, WSData>(); // clientId -> WSData

export default {
    port: process.env.PORT || 3000,

    // Manual routing wrapper around Hono to sniff WS connections instantly
    async fetch(req: Request, server: import("bun").Server<WSData>) {
        const url = new URL(req.url);

        // Terminals — Docker-backed collaborative sandbox
        if (url.pathname === "/ws/terminal") {
            const roomId = url.searchParams.get("roomId") || "default";
            if (server.upgrade(req, {
                data: { type: "terminal", projectId: roomId, clientId: crypto.randomUUID(), userName: "terminal", color: "", isHost: false }
            })) return;
            return new Response("Upgrade failed", { status: 500 });
        }

        // Collaboration
        if (url.pathname.startsWith("/ws/collab/")) {
            const projectId = url.pathname.split("/").pop();
            if (!projectId) return new Response("Bad Request", { status: 400 });

            // Reject connections to non-existent projects before promoting to WS
            const { data: proj } = await supabase
                .from("projects")
                .select("id")
                .eq("id", projectId)
                .maybeSingle();
            if (!proj) return new Response("Project not found", { status: 404 });

            const clientId = url.searchParams.get("userId") || "anon";
            const userName = url.searchParams.get("userName") || "Anonymous";

            if (server.upgrade(req, {
                data: { type: "collab", projectId, clientId, userName, isHost: false, color: "" }
            })) {
                return;
            }
            return new Response("Upgrade failed", { status: 500 });
        }

        // Standard Hono API
        return app.fetch(req, server);
    },

    // Raw Bun WS Interface
    websocket: {
        open(ws: import("bun").ServerWebSocket<WSData>) {
            const data = ws.data;
            if (data.type === "terminal") {
                ws.subscribe(`term_${data.projectId}`);
                const roomId = data.projectId;

                // Register client
                if (!termClients.has(roomId)) termClients.set(roomId, new Set());
                termClients.get(roomId)!.add(ws);

                // If room already running, just attach to the broadcast stream
                if (termRooms.has(roomId)) {
                    ws.send("\x1b[90m[Joined existing terminal session]\x1b[0m\r\n");
                    return;
                }

                // ── First client: bootstrap Docker container ──
                (async () => {
                    const broadcastToRoom = (msg: string) =>
                        termClients.get(roomId)?.forEach(c => { try { c.send(msg); } catch (_) { } });

                    let container: Docker.Container | null = null;
                    try {
                        broadcastToRoom("\x1b[1;36m[VibeCodium]\x1b[0m Syncing project files...\r\n");
                        const hostDir = await syncProjectFilesToDisk(roomId);

                        // Load file list for language detection
                        const { data: projectFiles } = await supabase
                            .from("files")
                            .select("path, content")
                            .eq("project_id", roomId);


                        // Pick image from file extensions
                        const image = detectTerminalImage((projectFiles ?? []).map(f => f.path));
                        broadcastToRoom(`\x1b[90mImage: ${image}  |  ${hostDir} → /usr/src/app\x1b[0m\r\n`);

                        // Pull image (instant if already cached)
                        // NOTE: docker.modem.followProgress hangs in Bun — drain raw stream events instead
                        if (!image.startsWith("vibecodium-")) {
                            broadcastToRoom("\x1b[90mPulling image...\x1b[0m\r\n");
                            await new Promise<void>((res, rej) => {
                                docker.pull(image, (err: Error | null, pullStream: any) => {
                                    if (err) return rej(err);
                                    pullStream.on("data", () => { }); // drain
                                    pullStream.on("end", res);
                                    pullStream.on("error", rej);
                                });
                            });
                        }

                        // Create container — sleep infinity as PID 1 (keeps it alive for docker exec)
                        // NOTE: container.attach({hijack:true}) hangs in Bun — use Bun.spawn docker exec instead
                        container = await docker.createContainer({
                            Image: image,
                            Cmd: ["sleep", "infinity"],
                            Tty: false,
                            WorkingDir: "/usr/src/app",
                            HostConfig: {
                                Memory: 2048 * 1024 * 1024,
                                MemorySwap: 2048 * 1024 * 1024,
                                CpuQuota: 50000,
                                CpuPeriod: 100000,
                                PidsLimit: 50,
                                Binds: [`${hostDir}:/usr/src/app`],
                                AutoRemove: false,
                            },
                        });
                        await container.start();

                        // Spawn interactive shell via docker exec (Bun-compatible approach)
                        const proc = Bun.spawn(
                            ["docker", "exec", "-i", container.id, "/bin/sh", "-i"],
                            { stdin: "pipe", stdout: "pipe", stderr: "pipe" }
                        );

                        const sink = proc.stdin as import("bun").FileSink;
                        termRooms.set(roomId, { container, proc, sink });

                        // Pipe stdout → clients (normalize bare LF → CRLF for xterm)
                        (async () => {
                            const reader = proc.stdout.getReader();
                            const dec = new TextDecoder();
                            while (true) {
                                const { done, value } = await reader.read();
                                if (done) break;
                                broadcastToRoom(dec.decode(value).replace(/\r?\n/g, "\r\n"));
                            }
                            broadcastToRoom("\r\n\x1b[33m[Shell exited]\x1b[0m\r\n");
                            stopTerminal(roomId);
                        })();

                        // Pipe stderr → clients
                        (async () => {
                            const reader = proc.stderr.getReader();
                            const dec = new TextDecoder();
                            while (true) {
                                const { done, value } = await reader.read();
                                if (done) break;
                                broadcastToRoom(dec.decode(value).replace(/\r?\n/g, "\r\n"));
                            }
                        })();

                        broadcastToRoom("\x1b[1;32m[Ready]\x1b[0m Sandbox started. Working dir: \x1b[33m/usr/src/app\x1b[0m\r\n\r\n");

                    } catch (e: any) {
                        // Cleanup partially-created container on error
                        if (container) {
                            try { await container.stop({ t: 0 }); } catch (_) { }
                            try { await container.remove(); } catch (_) { }
                        }
                        termClients.get(roomId)?.forEach(c => {
                            try { c.send(`\x1b[1;31m[Error]\x1b[0m ${e.message}\r\n`); } catch (_) { }
                            c.close(1011, e.message);
                        });
                        console.error("[Terminal] Container start failed:", e.message);
                    }
                })();
                return;
            }

            // Collab handling
            ws.subscribe(data.projectId);
            activeClients.set(data.clientId, data);

            // Host Assignment Logic
            if (!roomHosts.has(data.projectId)) {
                roomHosts.set(data.projectId, data.clientId);
                data.isHost = true;
            } else {
                data.isHost = (roomHosts.get(data.projectId) === data.clientId);
            }
            data.color = COLORS[activeClients.size % COLORS.length]!;

            // Send standard connect ACK
            ws.send(JSON.stringify({
                type: "connected",
                clientId: data.clientId,
                color: data.color,
                isHost: data.isHost,
                hostId: roomHosts.get(data.projectId),
                users: Array.from(activeClients.values()).filter(c => c.projectId === data.projectId).map(c => ({
                    id: c.clientId, name: c.userName, color: c.color, isHost: c.isHost
                }))
            }));

            // Tell others
            ws.publish(data.projectId, JSON.stringify({
                type: "user_joined",
                user: { id: data.clientId, name: data.userName, color: data.color, isHost: data.isHost }
            }));

            console.log(`[WS] ${data.userName} joined ${data.projectId} (Host: ${data.isHost})`);
        },

        message(ws: import("bun").ServerWebSocket<WSData>, message: string) {
            if (ws.data.type === "terminal") {
                const room = termRooms.get(ws.data.projectId);
                if (!room) return;
                // JSON control messages
                try {
                    const msg = JSON.parse(message);
                    if (msg.type === "resize") {
                        // No PTY — resize is a no-op; ignore silently
                        return;
                    }
                    if (msg.type === "stop") {
                        stopTerminal(ws.data.projectId);
                        return;
                    }
                } catch { /* not JSON — treat as raw stdin */ }

                // Server-side line buffering (no PTY = no kernel line discipline)
                // We echo characters locally and only flush the line to the shell on Enter.
                const broadcastAll = (msg: string) =>
                    termClients.get(ws.data.projectId)?.forEach(c => { try { c.send(msg); } catch (_) { } });

                const roomId = ws.data.projectId;

                if (message === "\r" || message === "\n") {
                    // Enter — flush buffered line to shell
                    const line = (termLineBuffers.get(roomId) ?? "") + "\n";
                    termLineBuffers.set(roomId, "");
                    broadcastAll("\r\n");
                    try { room.sink.write(line); } catch (_) { }
                } else if (message === "\x7f" || message === "\b") {
                    // Backspace — pop last char from buffer, erase on screen
                    const buf = termLineBuffers.get(roomId) ?? "";
                    if (buf.length > 0) {
                        termLineBuffers.set(roomId, buf.slice(0, -1));
                        broadcastAll("\b \b");
                    }
                } else if (message.startsWith("\x1b")) {
                    // Escape sequences (arrow keys, etc.) — forward directly, don't buffer
                    try { room.sink.write(message); } catch (_) { }
                } else if (message.length === 1 && message.charCodeAt(0) < 32) {
                    // Other control chars (Ctrl+C, Ctrl+D, etc.) — forward directly
                    try { room.sink.write(message); } catch (_) { }
                } else {
                    // Printable chars — append to buffer and echo
                    const buf = termLineBuffers.get(roomId) ?? "";
                    termLineBuffers.set(roomId, buf + message);
                    broadcastAll(message);
                }
                return;
            }

            try {
                const payload = JSON.parse(message);
                const data = ws.data;

                // Host Permission Overrides
                if (payload.type === "JOIN_REQUEST") {
                    console.log(`[WS] Client ${data.clientId} requesting join to ${data.projectId}`);
                    ws.publish(data.projectId, JSON.stringify({ ...payload, fromClient: data.clientId }));
                    return;
                }
                if (payload.type === "JOIN_RESPONSE") {
                    if (data.isHost) {
                        ws.publish(data.projectId, JSON.stringify(payload)); // Send approval
                    }
                    return;
                }

                // emoji_reaction: broadcast to all peers in the room
                if (payload.type === "emoji_reaction") {
                    ws.publish(data.projectId, JSON.stringify({
                        type: "emoji_reaction",
                        emoji: payload.emoji,
                        sender: payload.sender || data.userName,
                        clientId: data.clientId,
                    }));
                    return;
                }

                // agent_accepted: one client accepted a suggestion — atomically broadcast to all
                if (payload.type === "agent_accepted") {
                    const broadcast = {
                        type: "agent_accepted",
                        filePath: payload.filePath,
                        content: payload.content,
                        appliedBy: data.clientId,
                        updateId: payload.updateId,
                    };
                    ws.publish(data.projectId, JSON.stringify(broadcast));

                    // Also persist as a normal code_update in Supabase
                    if (payload.filePath && payload.content !== undefined) {
                        setImmediate(() => {
                            (async () => {
                                try {
                                    await supabase
                                        .from("files")
                                        .upsert({
                                            project_id: data.projectId,
                                            path: payload.filePath,
                                            content: payload.content,
                                            updated_at: new Date().toISOString(),
                                        }, { onConflict: "project_id,path" });

                                    await supabase
                                        .from("snapshots")
                                        .insert({
                                            project_id: data.projectId,
                                            path: payload.filePath,
                                            content: payload.content,
                                            timestamp: new Date().toISOString(),
                                        });

                                    // Log rich event to Supabase for timeline feature
                                    logTimelineEvent(
                                        data.projectId, payload.filePath, payload.content,
                                        "agent_accepted", data.clientId, data.userName, data.color
                                    );
                                } catch (e) {
                                    console.error("[WS AgentAccept DB Error]:", e);
                                }
                            })();
                        });
                    }
                    return;
                }

                // Standard pub/sub forward
                if (
                    payload.type === "code_change" ||
                    payload.type === "cursor_move" ||
                    payload.type === "file_focus" ||
                    payload.type === "file_created" ||
                    payload.type === "file_deleted" ||
                    payload.type === "file_renamed"
                ) {
                    // Normalize standard schema implicitly replacing "data.type" to "_update" pattern exactly as UI expects
                    const outType = payload.type === "code_change" ? "code_update" : payload.type === "cursor_move" ? "cursor_update" : "file_focus_update";
                    const outbound = {
                        type: outType,
                        clientId: data.clientId,
                        userName: data.userName,
                        color: data.color,
                        ...payload
                    };
                    delete outbound.type; // strip generic type
                    outbound.type = outType;

                    ws.publish(data.projectId, JSON.stringify(outbound));

                    // Async auto-save to DB
                    if (outbound.type === "code_update" && payload.filePath && payload.content !== undefined) {
                        setImmediate(() => {
                            (async () => {
                                try {
                                    await supabase
                                        .from("files")
                                        .upsert({
                                            project_id: data.projectId,
                                            path: payload.filePath,
                                            content: payload.content,
                                            updated_at: new Date().toISOString()
                                        }, { onConflict: "project_id, path" });

                                    await supabase
                                        .from("snapshots")
                                        .insert({
                                            project_id: data.projectId,
                                            path: payload.filePath,
                                            content: payload.content,
                                            timestamp: new Date().toISOString(),
                                        });

                                    // Log rich event to Supabase for timeline feature
                                    logTimelineEvent(
                                        data.projectId, payload.filePath, payload.content,
                                        "code_update", data.clientId, data.userName, data.color
                                    );
                                } catch (e) {
                                    console.error("[WS AutoSave Error]:", e);
                                }
                            })();
                        });
                    }
                }

            } catch (err) {
                console.error("[WS] JSON Parse Error or Unhandled Message:", err);
            }
        },

        close(ws: import("bun").ServerWebSocket<WSData>) {
            if (ws.data.type === "terminal") {
                ws.unsubscribe(`term_${ws.data.projectId}`);
                const roomId = ws.data.projectId;
                const clients = termClients.get(roomId);
                if (clients) {
                    clients.delete(ws);
                    // Stop container when the last client disconnects
                    if (clients.size === 0) stopTerminal(roomId);
                }
                return;
            }

            const data = ws.data;
            ws.unsubscribe(data.projectId);
            activeClients.delete(data.clientId);

            ws.publish(data.projectId, JSON.stringify({
                type: "user_left",
                clientId: data.clientId
            }));

            const remaining = Array.from(activeClients.values()).filter(c => c.projectId === data.projectId);

            if (data.isHost) {
                // Determine new host if old host left
                if (remaining.length > 0) {
                    const newHost = remaining[0];
                    if (newHost) {
                        newHost.isHost = true;
                        roomHosts.set(data.projectId, newHost.clientId);
                        // Broadcast host change
                        ws.publish(data.projectId, JSON.stringify({ type: "host_changed", defaultApproved: true, hostId: newHost.clientId }));
                    }
                } else {
                    roomHosts.delete(data.projectId);
                }
            }

            // When the last collaborator exits the project, purge timeline events from Supabase
            if (remaining.length === 0) {
                // Clear in-memory counters for this project
                for (const key of timelineEventCounters.keys()) {
                    if (key.startsWith(`${data.projectId}::`)) timelineEventCounters.delete(key);
                }
                // Fire-and-forget Supabase cleanup
                void supabase
                    .from("timeline_events")
                    .delete()
                    .eq("project_id", data.projectId)
                    .then(({ error }) => {
                        if (error) console.error("[Timeline purge error]:", error);
                        else console.log(`[Timeline] Purged events for project ${data.projectId}`);
                    });

            }


            console.log(`[WS] ${data.userName} left ${data.projectId}`);
        }
    }
};

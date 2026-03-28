import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import Docker from "dockerode";
import { Writable } from "stream";
import type { ApiResponse, ExecuteRequest, ExecuteResponse } from "shared";
import gitRoutes from "./routes/git";
import projectsRoutes from "./routes/projects";
import sessionsRoutes from "./routes/sessions";
import reelsRoutes from "./routes/reels";
import agentRoutes from "./routes/agent";
import githubRoutes from "./routes/github";
import { syncProjectFilesToDisk } from "./utils/sync";
import { db } from "./db";
import { files, snapshots } from "./db/schema";
import * as nodePath from "node:path";
import { eq } from "drizzle-orm";

const LLM_BASE_URL = process.env.LLM_BASE_URL ?? "https://api.deepseek.com/v1";
const LLM_KEY = process.env.LLM_KEY ?? "";
const LLM_MODEL = process.env.LLM_MODEL ?? "deepseek-chat";

const LOCAL_BASE_URL = "http://localhost:1234/v1";
const LOCAL_MODEL = process.env.LOCAL_MODEL ?? "qwen2.5-coder-32b-instruct";

async function pingProvider(baseURL: string, apiKey: string, model: string) {
	const res = await fetch(`${baseURL}/chat/completions`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model,
			messages: [{ role: "user", content: "Reply with exactly: pong" }],
			max_tokens: 10,
		}),
		signal: AbortSignal.timeout(8_000),
	});

	if (!res.ok) throw new Error(await res.text());

	const data = await res.json() as { choices: { message: { content: string } }[] };
	return data.choices[0]?.message?.content?.trim();
}

const docker = new Docker();

const LANGUAGE_IMAGES: Record<string, string> = {
	python: "python:3.10-alpine",
	node: "node:20-alpine",
	"c++": "gcc:10.2.0",
	rust: "rust:1.68.2-alpine"
};

const EXEC_COMMANDS: Record<string, () => string[]> = {
	python: () => ["python", "-c", "import os\nexec(os.environ.get('USER_CODE', ''))"],
	node: () => ["node", "-e", "eval(process.env.USER_CODE)"],
	"c++": () => ["sh", "-c", "printenv USER_CODE > main.cpp && g++ main.cpp && ./a.out"],
	rust: () => ["sh", "-c", "printenv USER_CODE > main.rs && rustc main.rs && ./main"] 
};

export const app = new Hono()
	.use(logger())
	.use(cors({
		origin: (origin) => origin ?? "http://localhost:5173",
		allowHeaders: ["Content-Type", "Authorization"],
		allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
		credentials: true,
	}))
	.route("/api/git", gitRoutes)
	.route("/api/projects", projectsRoutes)
	.route("/api/sessions", sessionsRoutes)
	.route("/api/reels", reelsRoutes)
	.route("/api/agent", agentRoutes)
	.route("/api/github", githubRoutes)
	.get("/", c => c.text("Hello Hono!"))
	.get("/hello", async (c) => c.json({ message: "Hello BHVR!", success: true }, 200))
    .get("/api/ping-llm", async (c) => {
        if (!LLM_KEY) return c.json({ success: false, error: "LLM_KEY is not set" }, 500);
        const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${LLM_KEY}` },
            body: JSON.stringify({ model: LLM_MODEL, messages: [{ role: "user", content: "Reply with exactly: pong" }], max_tokens: 10 }),
            signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) {
            const error = await res.text();
            return c.json({ success: false, error }, res.status as any);
        }
        const data = await res.json() as { choices: { message: { content: string } }[] };
        return c.json({ success: true, model: LLM_MODEL, reply: data.choices[0]?.message?.content?.trim() });
    })
    .get("/api/ping-llm/auto", async (c) => {
        try {
            const reply = await pingProvider(LOCAL_BASE_URL, "lm-studio", LOCAL_MODEL);
            return c.json({ success: true, provider: "local", model: LOCAL_MODEL, reply });
        } catch (localErr) {
            if (!LLM_KEY) return c.json({ success: false, error: "Local LM Studio unreachable and LLM_KEY is not set" }, 503);
            try {
                const reply = await pingProvider(LLM_BASE_URL, LLM_KEY, LLM_MODEL);
                return c.json({ success: true, provider: "deepseek", model: LLM_MODEL, reply });
            } catch (remoteErr) {
                return c.json({ success: false, error: "Both providers failed", local: String(localErr), deepseek: String(remoteErr) }, 503);
            }
        }
    })
    .post("/execute", async (c) => {
        // [Docker Execute Code Redacted for brevity but identical]
        try {
            const body = await c.req.json<ExecuteRequest>();
            if (!body.language || !body.version || !body.code) return c.json<ExecuteResponse>({ success: false, stdout: "", stderr: "", error: "Missing language, version, or code." }, 400);
            
            const imageName = LANGUAGE_IMAGES[body.language];
            const getCmd = EXEC_COMMANDS[body.language];
            if (!imageName || !getCmd) return c.json<ExecuteResponse>({ success: false, stdout: "", stderr: "", error: `Unsupported language: ${body.language}` }, 400);

            let cmd = getCmd();
            let hostConfig: any = { Memory: 256 * 1024 * 1024, NetworkMode: "none" };
            const reqBody = body as any;
            
            if (reqBody.projectId && reqBody.entryFile) {
                const targetDir = await syncProjectFilesToDisk(reqBody.projectId);
                hostConfig.Binds = [`${targetDir}:/app`];
                if (body.language === "node") cmd = ["node", `/app/${reqBody.entryFile}`];
                if (body.language === "python") cmd = ["python", `/app/${reqBody.entryFile}`];
                if (body.language === "c++") cmd = ["sh", "-c", `cd /app && g++ ${reqBody.entryFile} && ./a.out`];
                if (body.language === "rust") cmd = ["sh", "-c", `cd /app && rustc ${reqBody.entryFile} && ./main`];
            }

            const container = await docker.createContainer({
                Image: imageName, Cmd: cmd, Env: [`USER_CODE=${body.code}`],
                HostConfig: hostConfig, Tty: false
            });

            try {
                const stream = await container.attach({ stream: true, stdout: true, stderr: true });
                let stdoutData = ""; let stderrData = "";
                container.modem.demuxStream(stream, new Writable({ write(c, e, n) { stdoutData += c.toString(); n(); } }), new Writable({ write(c, e, n) { stderrData += c.toString(); n(); } }));
                await container.start();

                const waitPromise = container.wait();
                let timeoutTrigged = false;
                const timeoutPromise = new Promise<{ StatusCode: number }>((resolve) => setTimeout(() => { timeoutTrigged = true; resolve({ StatusCode: 137 }); }, 3000));
                
                const waitResult = await Promise.race([waitPromise, timeoutPromise]);
                if (timeoutTrigged) {
                    await container.kill().catch(() => {});
                    return c.json<ExecuteResponse>({ success: false, stdout: stdoutData, stderr: stderrData, error: "Execution Timeout: Killed." });
                }
                return c.json<ExecuteResponse>({ success: waitResult.StatusCode === 0, stdout: stdoutData, stderr: stderrData, compileOutput: "" });
            } finally {
                await container.remove({ force: true }).catch(() => {});
            }
        } catch (err: any) {
            console.error(err);
            if (err.statusCode === 404) return c.json<ExecuteResponse>({ success: false, stdout: "", stderr: "", error: "Docker image missing!" }, 500);
            return c.json<ExecuteResponse>({ success: false, stdout: "", stderr: "", error: "Internal Error executing code." }, 500);
        }
    });

// ──────────────────────────────────────────
// Docker Terminal Engine
// ──────────────────────────────────────────

// Extension → Docker image mapping (reuses existing batch images where possible)
const EXT_TO_IMAGE: Record<string, string> = {
    ".py":  "python:3.10-alpine",
    ".rs":  "rust:1.68.2-alpine",
    ".cpp": "gcc:10.2.0",
    ".cc":  "gcc:10.2.0",
    ".c":   "gcc:10.2.0",
    ".go":  "golang:1.21-alpine",
};

function detectTerminalImage(filePaths: string[]): string {
    for (const fp of filePaths) {
        const ext = nodePath.extname(fp).toLowerCase();
        if (EXT_TO_IMAGE[ext]) return EXT_TO_IMAGE[ext]!;
    }
    return "node:20-alpine"; // default for JS/TS projects
}

// Heuristic security scan — blocks obvious destructive patterns before container start
const VULN_PATTERNS: RegExp[] = [
    /rm\s+-rf\s+[/~]/,
    /:\(\)\s*\{\s*:\s*\|\s*:.*\}/,         // fork bomb
    /dd\s+if=\/dev\/(zero|urandom|mem)/,
    />\s*\/dev\/sd[a-z]/,
    /mkfs\s/,
    /shred\s/,
];

function hasVulnerability(content: string): boolean {
    return VULN_PATTERNS.some(re => re.test(content));
}

// Per-room state for the collaborative Docker terminal
interface TerminalRoom {
    container: Docker.Container;
    proc: ReturnType<typeof Bun.spawn>;
    sink: import("bun").FileSink; // typed stdin pipe
}

const termClients     = new Map<string, Set<import("bun").ServerWebSocket<WSData>>>();
const termRooms       = new Map<string, TerminalRoom>();
const termLineBuffers = new Map<string, string>(); // per-room line edit buffer

async function stopTerminal(roomId: string): Promise<void> {
    const room    = termRooms.get(roomId);
    const clients = termClients.get(roomId);
    termRooms.delete(roomId);
    termClients.delete(roomId);
    termLineBuffers.delete(roomId);

    clients?.forEach(c => {
        try { c.send("\r\n\x1b[33m[Container stopped]\x1b[0m\r\n"); } catch (_) {}
    });

    if (room) {
        try { room.proc?.kill(); } catch (_) {}
        try { await room.container.stop({ t: 5 }); } catch (_) {}
        try { await room.container.remove(); } catch (_) {}
        console.log(`[Terminal] Cleaned up container for room ${roomId}`);
    }
}

// ──────────────────────────────────────────
// Bun.serve Engine
// ──────────────────────────────────────────
const COLORS = ["#A855F7", "#3B82F6", "#10B981", "#F59E0B", "#EC4899", "#EF4444", "#14B8A6", "#F97316"];

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
            const clientId = url.searchParams.get("userId") || "anon";
            const userName = url.searchParams.get("userName") || "Anonymous";

            if (!projectId) return new Response("Bad Request", { status: 400 });

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
                        termClients.get(roomId)?.forEach(c => { try { c.send(msg); } catch (_) {} });

                    let container: Docker.Container | null = null;
                    try {
                        broadcastToRoom("\x1b[1;36m[iTECify]\x1b[0m Syncing project files...\r\n");
                        const hostDir = await syncProjectFilesToDisk(roomId);

                        // Load file list for language detection + security scan
                        const projectFiles = await db
                            .select({ path: files.path, content: files.content })
                            .from(files)
                            .where(eq(files.projectId, roomId));

                        // Security scan — block before any container starts
                        for (const f of projectFiles) {
                            if (f.content && hasVulnerability(f.content)) {
                                broadcastToRoom("\x1b[1;31m[SECURITY BLOCK]\x1b[0m Dangerous pattern detected in project files. Execution refused.\r\n");
                                termClients.get(roomId)?.forEach(c => c.close(1008, "Security policy violation"));
                                return;
                            }
                        }

                        // Pick image from file extensions
                        const image = detectTerminalImage(projectFiles.map(f => f.path));
                        broadcastToRoom(`\x1b[90mImage: ${image}  |  ${hostDir} → /usr/src/app\x1b[0m\r\n`);

                        // Pull image (instant if already cached)
                        // NOTE: docker.modem.followProgress hangs in Bun — drain raw stream events instead
                        broadcastToRoom("\x1b[90mPulling image...\x1b[0m\r\n");
                        await new Promise<void>((res, rej) => {
                            docker.pull(image, (err: Error | null, pullStream: any) => {
                                if (err) return rej(err);
                                pullStream.on("data", () => {}); // drain
                                pullStream.on("end", res);
                                pullStream.on("error", rej);
                            });
                        });

                        // Create container — sleep infinity as PID 1 (keeps it alive for docker exec)
                        // NOTE: container.attach({hijack:true}) hangs in Bun — use Bun.spawn docker exec instead
                        container = await docker.createContainer({
                            Image: image,
                            Cmd: ["sleep", "infinity"],
                            Tty: false,
                            WorkingDir: "/usr/src/app",
                            HostConfig: {
                                Memory: 512 * 1024 * 1024,
                                MemorySwap: 512 * 1024 * 1024,
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
                            try { await container.stop({ t: 0 }); } catch (_) {}
                            try { await container.remove(); } catch (_) {}
                        }
                        termClients.get(roomId)?.forEach(c => {
                            try { c.send(`\x1b[1;31m[Error]\x1b[0m ${e.message}\r\n`); } catch (_) {}
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
                    termClients.get(ws.data.projectId)?.forEach(c => { try { c.send(msg); } catch (_) {} });

                const roomId = ws.data.projectId;

                if (message === "\r" || message === "\n") {
                    // Enter — flush buffered line to shell
                    const line = (termLineBuffers.get(roomId) ?? "") + "\n";
                    termLineBuffers.set(roomId, "");
                    broadcastAll("\r\n");
                    try { room.sink.write(line); } catch (_) {}
                } else if (message === "\x7f" || message === "\b") {
                    // Backspace — pop last char from buffer, erase on screen
                    const buf = termLineBuffers.get(roomId) ?? "";
                    if (buf.length > 0) {
                        termLineBuffers.set(roomId, buf.slice(0, -1));
                        broadcastAll("\b \b");
                    }
                } else if (message.startsWith("\x1b")) {
                    // Escape sequences (arrow keys, etc.) — forward directly, don't buffer
                    try { room.sink.write(message); } catch (_) {}
                } else if (message.length === 1 && message.charCodeAt(0) < 32) {
                    // Other control chars (Ctrl+C, Ctrl+D, etc.) — forward directly
                    try { room.sink.write(message); } catch (_) {}
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

                    // Also persist as a normal code_update in SQLite
                    if (payload.filePath && payload.content !== undefined) {
                        setImmediate(() => {
                            (async () => {
                                try {
                                    const timestamp = Date.now();
                                    await db.insert(files).values({
                                        id: crypto.randomUUID(),
                                        projectId: data.projectId,
                                        path: payload.filePath,
                                        content: payload.content,
                                        updatedAt: timestamp
                                    }).onConflictDoUpdate({
                                        target: [files.projectId, files.path],
                                        set: { content: payload.content, updatedAt: Math.floor(timestamp / 1000) }
                                    });
                                    await db.insert(snapshots).values({
                                        id: crypto.randomUUID(),
                                        projectId: data.projectId,
                                        path: payload.filePath,
                                        content: payload.content,
                                        timestamp
                                    });
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
                                    const timestamp = Date.now();
                                    await db.insert(files).values({
                                        id: crypto.randomUUID(),
                                        projectId: data.projectId,
                                        path: payload.filePath,
                                        content: payload.content,
                                        updatedAt: timestamp
                                    }).onConflictDoUpdate({
                                        target: [files.projectId, files.path],
                                        set: { content: payload.content, updatedAt: Math.floor(timestamp / 1000) }
                                    });

                                    // Insert snapshot for time-travel feature
                                    await db.insert(snapshots).values({
                                        id: crypto.randomUUID(),
                                        projectId: data.projectId,
                                        path: payload.filePath,
                                        content: payload.content,
                                        timestamp
                                    });
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

            if (data.isHost) {
                // Determine new host if old host left
                const remaining = Array.from(activeClients.values()).filter(c => c.projectId === data.projectId);
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
            console.log(`[WS] ${data.userName} left ${data.projectId}`);
        }
    }
};
import { Hono } from "hono";
import { createBunWebSocket } from "hono/bun";

const { upgradeWebSocket, websocket } = createBunWebSocket();

// ──────────────────────────────────────────
// Types
// ──────────────────────────────────────────

interface Client {
    id: string;
    name: string;
    color: string;
    currentFile: string | null;
    ws: any;
    connectionId: string;
}

interface Room {
    clients: Map<string, Client>;
}

// ──────────────────────────────────────────
// State
// ──────────────────────────────────────────

const rooms = new Map<string, Room>();
const COLORS = ["#A855F7", "#3B82F6", "#10B981", "#F59E0B", "#EC4899", "#EF4444", "#14B8A6", "#F97316"];

// ──────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────

function broadcast(room: Room, msg: object, excludeId?: string) {
    const json = JSON.stringify(msg);
    for (const [id, client] of room.clients) {
        if (id !== excludeId) {
            try { client.ws.send(json); } catch (_) {}
        }
    }
}

// ──────────────────────────────────────────
// WebSocket Handler
// ──────────────────────────────────────────

export function attachCollaborationWS(app: Hono) {

    app.get("/ws/collab/:projectId", upgradeWebSocket((c) => {
        const projectId = c.req.param("projectId")!;
        const clientId = c.req.query("userId") || c.req.query("clientId") || "anon";
        const userName = c.req.query("userName") || "Anonymous";
        // Unique per physical WS connection — survives across handler calls for this connection.
        // Used instead of ws-object comparison (Hono creates a new wrapper on each handler call).
        const myConnectionId = crypto.randomUUID();

        return {
            onOpen(_event, ws) {
                let room = rooms.get(projectId);
                if (!room) {
                    room = { clients: new Map() };
                    rooms.set(projectId, room);
                }

                const existing = room.clients.get(clientId);
                if (existing) {
                    // StrictMode remount: same clientId reconnected. Update ws + connectionId
                    // without re-announcing to the room.
                    existing.ws = ws;
                    existing.connectionId = myConnectionId;
                    ws.send(JSON.stringify({
                        type: "connected",
                        clientId,
                        color: existing.color,
                        users: Array.from(room.clients.values())
                            .filter(c => c.id !== clientId)
                            .map(c => ({ id: c.id, name: c.name, color: c.color, currentFile: c.currentFile }))
                    }));
                    console.log(`[WS] ${userName} reconnected to room ${projectId} (${room.clients.size} users)`);
                    return;
                }

                const color = COLORS[room.clients.size % COLORS.length]!;
                const client: Client = { id: clientId, name: userName, color, currentFile: null, ws, connectionId: myConnectionId };
                room.clients.set(clientId, client);

                // Tell this client their info
                ws.send(JSON.stringify({
                    type: "connected",
                    clientId,
                    color,
                    users: Array.from(room.clients.values())
                        .filter(c => c.id !== clientId)
                        .map(c => ({ id: c.id, name: c.name, color: c.color, currentFile: c.currentFile }))
                }));

                // Tell everyone else a new user joined
                broadcast(room, {
                    type: "user_joined",
                    user: { id: clientId, name: userName, color }
                }, clientId);

                console.log(`[WS] ${userName} joined room ${projectId} (${room.clients.size} users)`);
            },

            onMessage(event, _ws) {
                try {
                    const data = JSON.parse(event.data as string);
                    const room = rooms.get(projectId);
                    if (!room) return;

                    // ── CODE CHANGE ──
                    if (data.type === "code_change") {
                        broadcast(room, {
                            type: "code_update",
                            clientId,
                            filePath: data.filePath,
                            content: data.content
                        }, clientId);
                        return;
                    }

                    const sender = room.clients.get(clientId);
                    if (!sender) return;

                    // ── CURSOR MOVE ──
                    if (data.type === "cursor_move") {
                        broadcast(room, {
                            type: "cursor_update",
                            clientId,
                            userName: sender.name,
                            color: sender.color,
                            filePath: data.filePath,
                            position: data.position
                        }, clientId);
                        return;
                    }

                    // ── FILE FOCUS ──
                    if (data.type === "file_focus") {
                        sender.currentFile = data.filePath;
                        broadcast(room, {
                            type: "file_focus_update",
                            clientId,
                            filePath: data.filePath
                        }, clientId);
                        return;
                    }

                } catch (e) {
                    console.error("[WS] Parse error:", e);
                }
            },

            onClose(_event, _ws) {
                const room = rooms.get(projectId);
                if (!room) return;

                // If a newer connection already took over this clientId, don't evict it.
                const existing = room.clients.get(clientId);
                if (existing && existing.connectionId !== myConnectionId) return;

                room.clients.delete(clientId);
                broadcast(room, { type: "user_left", clientId });
                console.log(`[WS] ${userName} left room ${projectId} (${room.clients.size} remaining)`);

                if (room.clients.size === 0) {
                    rooms.delete(projectId);
                    console.log(`[WS] Room ${projectId} destroyed`);
                }
            }
        };
    }));

    // ── Terminal WS (Bun.spawn — no native addons needed) ──
    interface TerminalRoom { proc: ReturnType<typeof Bun.spawn>; clients: Set<any> }
    const terminals = new Map<string, TerminalRoom>();

    app.get("/ws/terminal", upgradeWebSocket((c) => {
        const roomId = c.req.query("roomId") || "default";
        return {
            async onOpen(_event, ws) {
                let room = terminals.get(roomId);
                if (!room) {
                    const shells = [process.env.SHELL, "/bin/zsh", "/bin/bash", "/bin/sh"].filter(Boolean) as string[];
                    let proc: ReturnType<typeof Bun.spawn> | null = null;

                    for (const shell of shells) {
                        try {
                            proc = Bun.spawn([shell, "-i"], {
                                stdin: "pipe",
                                stdout: "pipe",
                                stderr: "pipe",
                                env: { ...process.env, TERM: "xterm-256color" },
                                cwd: process.cwd(),
                            });
                            break;
                        } catch (_) {}
                    }

                    if (!proc) {
                        ws.send("\x1b[31mTerminal unavailable: could not spawn shell.\x1b[0m\r\n");
                        ws.close(1011, "No shell available");
                        return;
                    }

                    room = { proc, clients: new Set() };
                    terminals.set(roomId, room);

                    const broadcast = (text: string) =>
                        room!.clients.forEach(c => { try { c.send(text); } catch (_) {} });

                    // Pipe stdout → all clients
                    (async () => {
                        try {
                            for await (const chunk of proc!.stdout as AsyncIterable<Uint8Array>) {
                                broadcast(new TextDecoder().decode(chunk));
                            }
                        } catch (_) {}
                        broadcast("\x1b[33m[shell exited]\x1b[0m\r\n");
                        terminals.delete(roomId);
                    })();

                    // Pipe stderr → all clients
                    (async () => {
                        try {
                            for await (const chunk of proc!.stderr as AsyncIterable<Uint8Array>) {
                                broadcast(new TextDecoder().decode(chunk));
                            }
                        } catch (_) {}
                    })();
                }

                room.clients.add(ws);
                (ws as any).roomId = roomId;
            },

            onMessage(event, ws) {
                const room = terminals.get((ws as any).roomId);
                if (!room || typeof event.data !== "string") return;
                try {
                    const sink = room.proc.stdin as import("bun").FileSink;
                    sink.write(event.data);
                    sink.flush();
                } catch (_) {}
            },

            onClose(_event, ws) {
                const rid = (ws as any).roomId;
                const room = terminals.get(rid);
                if (!room) return;
                room.clients.delete(ws);
                if (room.clients.size === 0) {
                    try { room.proc.kill(); } catch (_) {}
                    terminals.delete(rid);
                }
            }
        };
    }));

    return websocket;
}

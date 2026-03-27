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

        return {
            onOpen(_event, ws) {
                let room = rooms.get(projectId);
                if (!room) {
                    room = { clients: new Map() };
                    rooms.set(projectId, room);
                }

                const color = COLORS[room.clients.size % COLORS.length]!;
                const client: Client = { id: clientId, name: userName, color, currentFile: null, ws };
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
                    const sender = room.clients.get(clientId);
                    if (!sender) return;

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

    // ── Terminal WS (node-pty) ──
    let pty: any = null;
    try { pty = require("node-pty"); } catch (_) { console.warn("[WS] node-pty not available"); }

    const terminals = new Map<string, { pty: any, clients: Set<any> }>();

    if (pty) {
        app.get("/ws/terminal", upgradeWebSocket((c) => {
            const roomId = c.req.query("roomId") || "default";
            return {
                onOpen(_event, ws) {
                    let room = terminals.get(roomId);
                    if (!room) {
                        const ptyProcess = pty.spawn(process.env.SHELL || "bash", [], {
                            name: "xterm-color", cols: 80, rows: 30,
                            cwd: process.cwd(), env: process.env as any
                        });
                        room = { pty: ptyProcess, clients: new Set() };
                        terminals.set(roomId, room);
                        ptyProcess.onData((data: string) => {
                            room!.clients.forEach((c: any) => { try { c.send(data); } catch (_) {} });
                        });
                    }
                    room.clients.add(ws);
                    (ws as any).roomId = roomId;
                },
                onMessage(event, ws) {
                    const room = terminals.get((ws as any).roomId);
                    if (room && typeof event.data === "string") room.pty.write(event.data);
                },
                onClose(_event, ws) {
                    const rid = (ws as any).roomId;
                    const room = terminals.get(rid);
                    if (room) {
                        room.clients.delete(ws);
                        if (room.clients.size === 0) { room.pty.kill(); terminals.delete(rid); }
                    }
                }
            };
        }));
    }

    return websocket;
}

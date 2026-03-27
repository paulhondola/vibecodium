import { Hono } from "hono";
import { createBunWebSocket } from "hono/bun";
import { db } from "../db";
import { files } from "../db/schema";
import { eq } from "drizzle-orm";

const { upgradeWebSocket, websocket } = createBunWebSocket();

// ──────────────────────────────────────────
// Types
// ──────────────────────────────────────────

type Permission = 'pending' | 'edit' | 'readonly';
type Role = 'host' | 'guest';

interface CollabClient {
    clientId: string;
    userName: string;
    role: Role;
    permission: Permission;
    color: string;
    currentFile: string | null;
    ws: any; // Hono WSContext
}

interface Room {
    projectId: string;
    clients: Map<string, CollabClient>;
    hostId: string | null;
}

// ──────────────────────────────────────────
// State
// ──────────────────────────────────────────

const rooms = new Map<string, Room>();
const CURSOR_COLORS = ["#A855F7", "#3B82F6", "#10B981", "#F59E0B", "#EC4899", "#EF4444", "#14B8A6", "#F97316"];

// ──────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────

function broadcast(room: Room, message: object, excludeClientId?: string) {
    const json = JSON.stringify(message);
    for (const [cid, client] of room.clients.entries()) {
        if (cid === excludeClientId) continue;
        if (client.permission === 'pending') continue;
        try { client.ws.send(json); } catch (_) { /* dead socket */ }
    }
}

function sendTo(client: CollabClient, message: object) {
    try { client.ws.send(JSON.stringify(message)); } catch (_) { /* dead socket */ }
}

function getAcceptedUsers(room: Room): { id: string; name: string; color: string; currentFile: string | null }[] {
    return Array.from(room.clients.values())
        .filter(c => c.permission !== 'pending')
        .map(c => ({ id: c.clientId, name: c.userName, color: c.color, currentFile: c.currentFile }));
}

async function getProjectFiles(projectId: string) {
    return db.select({ id: files.id, path: files.path, content: files.content })
        .from(files)
        .where(eq(files.projectId, projectId));
}

// ──────────────────────────────────────────
// WebSocket Handler
// ──────────────────────────────────────────

export function attachCollaborationWS(app: Hono) {
    app.get("/ws/collab/:projectId", upgradeWebSocket((c) => {
        const rawProjectId = c.req.param("projectId");
        const rawClientId = c.req.query("clientId");
        const rawUserName = c.req.query("userName");

        if (!rawProjectId || !rawClientId || !rawUserName) {
            console.error("[WS] Missing metadata for WebSocket connection");
            return {};
        }

        const projectId: string = rawProjectId;
        const clientId: string = rawClientId;
        const userName: string = rawUserName;

        return {
            onOpen(_event, ws) {
                let room = rooms.get(projectId);
                if (!room) {
                    room = { projectId, clients: new Map(), hostId: null };
                    rooms.set(projectId, room);
                }

                const isFirstOrNoHost = room.clients.size === 0 || !room.hostId;
                const role: Role = isFirstOrNoHost ? 'host' : 'guest';
                const permission: Permission = isFirstOrNoHost ? 'edit' : 'pending';
                const color = CURSOR_COLORS[room.clients.size % CURSOR_COLORS.length]!;

                const client: CollabClient = { clientId, userName, role, permission, color, currentFile: null, ws };
                room.clients.set(clientId, client);

                if (role === 'host') {
                    room.hostId = clientId;
                    // Host is automatically accepted — send room_status
                    sendTo(client, { type: "room_status", status: "host", clientId, color });
                    console.log(`[WS] Host ${userName} (${clientId}) created room ${projectId}`);
                } else {
                    // Guest in pending state — notify the Host
                    sendTo(client, { type: "room_status", status: "pending" });

                    const host = room.hostId ? room.clients.get(room.hostId) : null;
                    if (host) {
                        sendTo(host, {
                            type: "join_request",
                            user: { id: clientId, name: userName }
                        });
                    }
                    console.log(`[WS] Guest ${userName} (${clientId}) waiting in room ${projectId}`);
                }
            },

            onMessage(event, _ws) {
                try {
                    const data = JSON.parse(event.data as string);
                    const room = rooms.get(projectId);
                    if (!room) return;

                    const sender = room.clients.get(clientId);
                    if (!sender) return;

                    // ── 1. HOST PERMISSION RESPONSE ──
                    if (data.type === "join_response" && sender.role === 'host') {
                        const target = room.clients.get(data.targetUserId);
                        if (!target || target.permission !== 'pending') return;

                        if (data.permission === 'reject') {
                            sendTo(target, { type: "join_rejected" });
                            target.ws.close();
                            room.clients.delete(data.targetUserId);
                            console.log(`[WS] Host rejected ${data.targetUserId}`);
                        } else {
                            const grantedPermission: Permission = data.permission === 'edit' ? 'edit' : 'readonly';
                            target.permission = grantedPermission;

                            // Send sync_workspace to the newly accepted guest
                            getProjectFiles(projectId).then(projectFiles => {
                                sendTo(target, {
                                    type: "join_granted",
                                    permission: grantedPermission,
                                    currentUsers: getAcceptedUsers(room!),
                                    files: projectFiles
                                });

                                // Broadcast to everyone else that a new user joined
                                broadcast(room!, {
                                    type: "user_joined",
                                    user: { id: target.clientId, name: target.userName, color: target.color }
                                }, target.clientId);
                            });

                            console.log(`[WS] Host granted '${grantedPermission}' to ${target.userName}`);
                        }
                        return;
                    }

                    // ── 2. BLOCK PENDING USERS ──
                    if (sender.permission === 'pending') return;

                    // ── 3. FILE FOCUS EVENT ──
                    if (data.type === "file_focus") {
                        sender.currentFile = data.filePath;
                        broadcast(room, {
                            type: "file_focus_update",
                            clientId: sender.clientId,
                            filePath: data.filePath
                        }, sender.clientId);
                        return;
                    }

                    // ── 4. CURSOR MOVE ──
                    if (data.type === "cursor_move") {
                        broadcast(room, {
                            type: "cursor_update",
                            clientId: sender.clientId,
                            userName: sender.userName,
                            color: sender.color,
                            position: data.position,
                            filePath: data.filePath
                        }, sender.clientId);
                        return;
                    }

                    // ── 5. CODE CHANGE (BACKEND ENFORCEMENT) ──
                    if (data.type === "code_change") {
                        // SILENTLY DROP if sender is readonly
                        if (sender.permission === 'readonly') {
                            console.log(`[WS] Dropped code_change from readonly user ${sender.userName}`);
                            return;
                        }

                        broadcast(room, {
                            type: "code_update",
                            clientId: sender.clientId,
                            filePath: data.filePath,
                            content: data.content
                        }, sender.clientId);
                        return;
                    }

                } catch (e) {
                    console.error("[WS] Message parse error:", e);
                }
            },

            onClose(_event, ws) {
                const room = rooms.get(projectId);
                if (!room) return;

                // Find which client disconnected by matching ws reference
                let disconnectedId: string | null = null;
                for (const [cid, client] of room.clients.entries()) {
                    if (client.ws === ws) { disconnectedId = cid; break; }
                }

                if (!disconnectedId) return;

                room.clients.delete(disconnectedId);
                broadcast(room, { type: "user_left", clientId: disconnectedId });
                console.log(`[WS] Client ${disconnectedId} left room ${projectId}`);

                // Re-assign host if host leaves
                if (room.hostId === disconnectedId) {
                    const nextHost = Array.from(room.clients.values()).find(c => c.permission === 'edit');
                    if (nextHost) {
                        room.hostId = nextHost.clientId;
                        nextHost.role = 'host';
                        sendTo(nextHost, { type: "room_status", status: "host", clientId: nextHost.clientId, color: nextHost.color });
                        broadcast(room, { type: "host_changed", clientId: nextHost.clientId, userName: nextHost.userName });
                        console.log(`[WS] Host reassigned to ${nextHost.userName}`);
                    } else {
                        room.hostId = null;
                    }
                }

                if (room.clients.size === 0) {
                    rooms.delete(projectId);
                    console.log(`[WS] Room ${projectId} destroyed (empty)`);
                }
            }
        };
    }));

    return websocket;
}

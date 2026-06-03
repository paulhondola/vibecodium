import { supabase } from "../db/supabase";
import type { WSData } from "./terminal";
import * as Y from "yjs";

// ──────────────────────────────────────────
// Collaboration WebSocket Handler & Yjs Sync
// ──────────────────────────────────────────

export const COLORS = [
	"#A855F7",
	"#3B82F6",
	"#10B981",
	"#F59E0B",
	"#EC4899",
	"#EF4444",
	"#14B8A6",
	"#F97316",
];

/** Room tracking for host resolution */
export const roomHosts = new Map<string, string>(); // projectId -> hostClientId
export const activeClients = new Map<string, WSData>(); // clientId -> WSData

// In-memory room file state cache for quick loading & delta merging
export const roomFileStates = new Map<string, Map<string, string>>(); // projectId -> filePath -> content
export const activeClientSockets = new Map<
	string,
	import("bun").ServerWebSocket<WSData>
>(); // clientId -> ws
export const clientLastPong = new Map<string, number>(); // clientId -> last pong timestamp

// Yjs CRDT documents — one Y.Doc per (projectId, filePath)
export const roomYDocs = new Map<string, Map<string, Y.Doc>>(); // projectId -> filePath -> Y.Doc

/**
 * Gets or creates the Y.Doc instance for a given file in a project.
 * Initializes with content if it's new and content is provided.
 */
export function getYDoc(
	projectId: string,
	filePath: string,
	initialContent?: string,
): Y.Doc {
	if (!roomYDocs.has(projectId)) {
		roomYDocs.set(projectId, new Map());
	}
	const projectDocs = roomYDocs.get(projectId)!;
	if (!projectDocs.has(filePath)) {
		const doc = new Y.Doc();
		if (initialContent !== undefined && initialContent !== "") {
			doc.transact(() => {
				doc.getText("content").insert(0, initialContent);
			}, "init");
		}
		projectDocs.set(filePath, doc);
	}
	return projectDocs.get(filePath)!;
}

// Heartbeat Interval to detect and disconnect dead clients
const HEARTBEAT_INTERVAL_MS = 25_000;
const ZOMBIE_TIMEOUT_MS = 55_000; // 2 missed pings + margin

setInterval(() => {
	const now = Date.now();
	for (const [clientId, sock] of activeClientSockets) {
		const lastPong = clientLastPong.get(clientId) ?? now;
		if (now - lastPong > ZOMBIE_TIMEOUT_MS) {
			console.log(
				`[WS Heartbeat] Terminating zombie collaborator client ${clientId}`,
			);
			activeClientSockets.delete(clientId);
			clientLastPong.delete(clientId);
			try {
				sock.terminate();
			} catch (_) {}
		} else {
			try {
				sock.send(JSON.stringify({ type: "ping" }));
			} catch (_) {}
		}
	}
}, HEARTBEAT_INTERVAL_MS);

// ──────────────────────────────────────────
// WebSocket Handlers
// ──────────────────────────────────────────

export function handleCollabOpen(ws: import("bun").ServerWebSocket<WSData>) {
	const data = ws.data;
	ws.subscribe(data.projectId);
	activeClients.set(data.clientId, data);

	// Host Assignment Logic
	if (!roomHosts.has(data.projectId)) {
		roomHosts.set(data.projectId, data.clientId);
		data.isHost = true;
	} else {
		data.isHost = roomHosts.get(data.projectId) === data.clientId;
	}
	data.color = COLORS[activeClients.size % COLORS.length]!;

	// Track connection for heartbeat ping-pong
	activeClientSockets.set(data.clientId, ws);
	clientLastPong.set(data.clientId, Date.now());

	// Send standard connect ACK
	ws.send(
		JSON.stringify({
			type: "connected",
			clientId: data.clientId,
			color: data.color,
			isHost: data.isHost,
			hostId: roomHosts.get(data.projectId),
			users: Array.from(activeClients.values())
				.filter((c) => c.projectId === data.projectId)
				.map((c) => ({
					id: c.clientId,
					name: c.userName,
					color: c.color,
					isHost: c.isHost,
				})),
		}),
	);

	// Tell others
	ws.publish(
		data.projectId,
		JSON.stringify({
			type: "user_joined",
			user: {
				id: data.clientId,
				name: data.userName,
				color: data.color,
				isHost: data.isHost,
			},
		}),
	);

	// Send current cached room state directly if exists
	const roomState = roomFileStates.get(data.projectId);
	if (roomState && roomState.size > 0) {
		ws.send(
			JSON.stringify({
				type: "room_state",
				files: Object.fromEntries(roomState),
			}),
		);
	}

	console.log(
		`[WS] ${data.userName} joined ${data.projectId} (Host: ${data.isHost})`,
	);
}

export function handleCollabMessage(
	ws: import("bun").ServerWebSocket<WSData>,
	message: string,
) {
	try {
		const payload = JSON.parse(message);
		const data = ws.data;

		// Heartbeat pong
		if (payload.type === "pong") {
			clientLastPong.set(data.clientId, Date.now());
			return;
		}

		// Host Permission Overrides
		if (payload.type === "JOIN_REQUEST") {
			console.log(
				`[WS] Client ${data.clientId} requesting join to ${data.projectId}`,
			);
			ws.publish(
				data.projectId,
				JSON.stringify({ ...payload, fromClient: data.clientId }),
			);
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
			ws.publish(
				data.projectId,
				JSON.stringify({
					type: "emoji_reaction",
					emoji: payload.emoji,
					sender: payload.sender || data.userName,
					clientId: data.clientId,
				}),
			);
			return;
		}

		// Sync request — send current room state + Y.Doc states to requesting client
		if (payload.type === "sync_request") {
			const roomState = roomFileStates.get(data.projectId);
			if (roomState && roomState.size > 0) {
				ws.send(
					JSON.stringify({
						type: "room_state",
						files: Object.fromEntries(roomState),
					}),
				);
			}
			const projectDocs = roomYDocs.get(data.projectId);
			if (projectDocs) {
				for (const [filePath, doc] of projectDocs) {
					const stateUpdate = Y.encodeStateAsUpdate(doc);
					ws.send(
						JSON.stringify({
							type: "yjs_sync",
							filePath,
							update: Buffer.from(stateUpdate).toString("base64"),
						}),
					);
				}
			}
			return;
		}

		// Yjs update — apply CRDT delta, broadcast update to other clients, cache in-memory & save to db
		if (payload.type === "yjs_update") {
			const { filePath, update: updateB64 } = payload;
			if (!filePath || !updateB64) return;

			// Grab cached state (or undefined if not loaded)
			const existingContent = roomFileStates.get(data.projectId)?.get(filePath);
			const doc = getYDoc(data.projectId, filePath, existingContent);

			const updateBytes = new Uint8Array(Buffer.from(updateB64, "base64"));
			Y.applyUpdate(doc, updateBytes, "remote");

			const mergedContent = doc.getText("content").toString();

			// Keep roomFileStates in sync
			if (!roomFileStates.has(data.projectId)) {
				roomFileStates.set(data.projectId, new Map());
			}
			roomFileStates.get(data.projectId)!.set(filePath, mergedContent);

			// Broadcast raw Yjs delta to all other clients
			ws.publish(
				data.projectId,
				JSON.stringify({
					type: "yjs_update",
					filePath,
					update: updateB64,
					clientId: data.clientId,
				}),
			);

			// Asynchronously update file and checkpoint snapshot in Supabase DB
			queueMicrotask(() => {
				(async () => {
					try {
						await supabase.from("files").upsert(
							{
								project_id: data.projectId,
								path: filePath,
								content: mergedContent,
								updated_at: new Date().toISOString(),
							},
							{ onConflict: "project_id, path" },
						);

						await supabase.from("snapshots").insert({
							project_id: data.projectId,
							path: filePath,
							content: mergedContent,
							timestamp: new Date().toISOString(),
						});
					} catch (e) {
						console.error("[WS AutoSave Error]:", e);
					}
				})();
			});
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

			// Sync server's in-memory Y.Doc
			if (payload.filePath && payload.content !== undefined) {
				const doc = getYDoc(data.projectId, payload.filePath);
				doc.transact(() => {
					const ytext = doc.getText("content");
					ytext.delete(0, ytext.length);
					ytext.insert(0, payload.content);
				}, "server_agent_accept");

				if (!roomFileStates.has(data.projectId)) {
					roomFileStates.set(data.projectId, new Map());
				}
				roomFileStates
					.get(data.projectId)!
					.set(payload.filePath, payload.content);

				// Persist as code_update in Supabase
				queueMicrotask(() => {
					(async () => {
						try {
							await supabase.from("files").upsert(
								{
									project_id: data.projectId,
									path: payload.filePath,
									content: payload.content,
									updated_at: new Date().toISOString(),
								},
								{ onConflict: "project_id,path" },
							);

							await supabase.from("snapshots").insert({
								project_id: data.projectId,
								path: payload.filePath,
								content: payload.content,
								timestamp: new Date().toISOString(),
							});
						} catch (e) {
							console.error("[WS AgentAccept DB Error]:", e);
						}
					})();
				});
			}
			return;
		}

		// Standard legacy pub/sub forward
		if (
			payload.type === "code_change" ||
			payload.type === "cursor_move" ||
			payload.type === "file_focus" ||
			payload.type === "file_created" ||
			payload.type === "file_deleted" ||
			payload.type === "file_renamed"
		) {
			const outType =
				payload.type === "code_change"
					? "code_update"
					: payload.type === "cursor_move"
						? "cursor_update"
						: "file_focus_update";
			const outbound = {
				type: outType,
				clientId: data.clientId,
				userName: data.userName,
				color: data.color,
				...payload,
			};
			delete outbound.type;
			outbound.type = outType;

			ws.publish(data.projectId, JSON.stringify(outbound));

			// Legacy auto-save to DB if standard code_change used
			if (
				outbound.type === "code_update" &&
				payload.filePath &&
				payload.content !== undefined
			) {
				if (!roomFileStates.has(data.projectId)) {
					roomFileStates.set(data.projectId, new Map());
				}
				roomFileStates
					.get(data.projectId)!
					.set(payload.filePath, payload.content);

				queueMicrotask(() => {
					(async () => {
						try {
							await supabase.from("files").upsert(
								{
									project_id: data.projectId,
									path: payload.filePath,
									content: payload.content,
									updated_at: new Date().toISOString(),
								},
								{ onConflict: "project_id, path" },
							);

							await supabase.from("snapshots").insert({
								project_id: data.projectId,
								path: payload.filePath,
								content: payload.content,
								timestamp: new Date().toISOString(),
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
}

export function handleCollabClose(ws: import("bun").ServerWebSocket<WSData>) {
	const data = ws.data;
	ws.unsubscribe(data.projectId);
	activeClients.delete(data.clientId);
	activeClientSockets.delete(data.clientId);
	clientLastPong.delete(data.clientId);

	ws.publish(
		data.projectId,
		JSON.stringify({
			type: "user_left",
			clientId: data.clientId,
		}),
	);

	const remaining = Array.from(activeClients.values()).filter(
		(c) => c.projectId === data.projectId,
	);

	if (data.isHost) {
		// Determine new host if old host left
		if (remaining.length > 0) {
			const newHost = remaining[0];
			if (newHost) {
				newHost.isHost = true;
				roomHosts.set(data.projectId, newHost.clientId);
				// Broadcast host change
				ws.publish(
					data.projectId,
					JSON.stringify({
						type: "host_changed",
						defaultApproved: true,
						hostId: newHost.clientId,
					}),
				);
			}
		} else {
			roomHosts.delete(data.projectId);
		}
	}

	// When the last collaborator exits, flush all in-memory cache states to DB and purge
	if (remaining.length === 0) {
		const finalStates = roomFileStates.get(data.projectId);
		if (finalStates && finalStates.size > 0) {
			void (async () => {
				for (const [filePath, content] of finalStates) {
					try {
						await supabase.from("files").upsert(
							{
								project_id: data.projectId,
								path: filePath,
								content,
								updated_at: new Date().toISOString(),
							},
							{ onConflict: "project_id,path" },
						);
					} catch (e) {
						console.error("[WS Flush Error]:", e);
					}
				}
				console.log(
					`[WS] Flushed ${finalStates.size} file(s) to Supabase for project ${data.projectId}`,
				);
			})();
		}

		roomFileStates.delete(data.projectId);
		roomYDocs.delete(data.projectId);
	}

	console.log(`[WS] ${data.userName} left ${data.projectId}`);
}

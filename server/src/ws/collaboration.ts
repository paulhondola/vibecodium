import { supabase } from "../db/supabase";
import { logTimelineEvent, timelineEventCounters } from "../utils/timeline";
import type { WSData } from "./terminal";

// ──────────────────────────────────────────
// Collaboration WebSocket Handler
// ──────────────────────────────────────────

export const COLORS = ["#A855F7", "#3B82F6", "#10B981", "#F59E0B", "#EC4899", "#EF4444", "#14B8A6", "#F97316"];

/** Room tracking for host resolution */
export const roomHosts = new Map<string, string>(); // projectId -> hostClientId
export const activeClients = new Map<string, WSData>(); // clientId -> WSData

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
}

export function handleCollabMessage(ws: import("bun").ServerWebSocket<WSData>, message: string) {
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
				queueMicrotask(() => {
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
				queueMicrotask(() => {
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
}

export function handleCollabClose(ws: import("bun").ServerWebSocket<WSData>) {
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

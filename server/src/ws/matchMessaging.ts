// In-memory registry of WebSocket clients subscribed to a match chat room.
// Used by the HTTP message POST handler to fan-out new messages in real-time.
const matchClients = new Map<string, Set<any>>();

export function addMatchClient(matchId: string, ws: any): void {
	if (!matchClients.has(matchId)) {
		matchClients.set(matchId, new Set());
	}
	matchClients.get(matchId)!.add(ws);
}

export function removeMatchClient(matchId: string, ws: any): void {
	const clients = matchClients.get(matchId);
	if (!clients) return;
	clients.delete(ws);
	if (clients.size === 0) matchClients.delete(matchId);
}

export function broadcastToMatch(matchId: string, message: object): void {
	const clients = matchClients.get(matchId);
	if (!clients) return;
	const json = JSON.stringify(message);
	for (const client of clients) {
		try {
			client.send(json);
		} catch (_) {}
	}
}

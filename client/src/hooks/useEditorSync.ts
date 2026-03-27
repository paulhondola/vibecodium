import { useEffect, useRef, useState, useCallback } from "react";

// Stable client ID for this browser session
const LOCAL_USER_ID = crypto.randomUUID();

export function useEditorSync(roomId: string | null, sessionToken?: string | null) {
    const wsRef = useRef<WebSocket | null>(null);
    // fileId → latest remote content received
    const [remoteUpdates, setRemoteUpdates] = useState<Map<string, string>>(new Map());

    useEffect(() => {
        if (!roomId) return;

        // Guests connect via ?session=TOKEN — server validates and resolves the room.
        // Owners connect via ?roomId=PROJECT_ID (no session token).
        const params = new URLSearchParams({ clientId: LOCAL_USER_ID });
        if (sessionToken) {
            params.set("session", sessionToken);
        } else {
            params.set("roomId", roomId);
        }

        const ws = new WebSocket(`ws://localhost:3000/ws/editor?${params}`);
        wsRef.current = ws;

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data as string);
                if (
                    data.type === "update" &&
                    typeof data.fileId === "string" &&
                    typeof data.content === "string" &&
                    // senderId "__init__" is server-side initial sync — apply it too
                    data.senderId !== LOCAL_USER_ID
                ) {
                    setRemoteUpdates((prev) => new Map(prev).set(data.fileId, data.content));
                }
            } catch (e) {
                console.error("Editor WS parse error", e);
            }
        };

        ws.onerror = (e) => console.error("Editor WS error", e);

        return () => {
            ws.close();
            wsRef.current = null;
        };
    }, [roomId, sessionToken]);

    const sendUpdate = useCallback((fileId: string, content: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "update", fileId, content }));
        }
    }, []);

    return { remoteUpdates, sendUpdate, localUserId: LOCAL_USER_ID };
}

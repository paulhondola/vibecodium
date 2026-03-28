import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";

interface SocketContextData {
    socket: WebSocket | null;
    isConnected: boolean;
    send: (msg: any) => void;
    lastMessage: any;
}

const SocketContext = createContext<SocketContextData | null>(null);

export function SocketProvider({ children, projectId }: { children: React.ReactNode; projectId: string | null }) {
    const { user, isAuthenticated } = useAuth0();
    const ws = useRef<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState<any>(null);
    const sessionIdRef = useRef(Math.random().toString(36).substring(2, 10));

    useEffect(() => {
        if (!projectId || !isAuthenticated) return;
        
        let reconnectTimeout: ReturnType<typeof setTimeout>;
        let isCleaningUp = false;
        
        const userId = `${user?.sub || "anon"}_${sessionIdRef.current}`;
        const userName = user?.name || user?.nickname || "Anonymous";
        const url = `ws://localhost:3000/ws/collab/${projectId}?userId=${encodeURIComponent(userId)}&userName=${encodeURIComponent(userName)}`;

        const connect = () => {
            if (isCleaningUp) return;
            const socket = new WebSocket(url);
            ws.current = socket;

            socket.onopen = () => setIsConnected(true);

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    setLastMessage(data);
                } catch {
                    console.error("[Socket] Failed to parse message");
                }
            };

            socket.onclose = () => {
                setIsConnected(false);
                ws.current = null;
                if (!isCleaningUp) {
                    console.log("[Socket] Reconnecting in 3 seconds...");
                    reconnectTimeout = setTimeout(connect, 3000);
                }
            };
        };

        connect();

        return () => {
            isCleaningUp = true;
            clearTimeout(reconnectTimeout);
            if (ws.current) {
                if (ws.current.readyState === WebSocket.CONNECTING) {
                    ws.current.addEventListener("open", () => ws.current?.close());
                } else {
                    ws.current.close();
                }
            }
        };
    }, [projectId, isAuthenticated, user]);

    const send = (msg: any) => {
        if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify(msg));
        }
    };

    return (
        <SocketContext.Provider value={{ socket: ws.current, isConnected, send, lastMessage }}>
            {children}
        </SocketContext.Provider>
    );
}

export function useSocket() {
    const context = useContext(SocketContext);
    if (!context) throw new Error("useSocket must be used within a SocketProvider");
    return context;
}

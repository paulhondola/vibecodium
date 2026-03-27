import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import type { ProjectFile } from "../components/Workspace";

// ──────────────────────────────────────────
// Types
// ──────────────────────────────────────────

type ConnectionState = 'connecting' | 'waiting_approval' | 'connected' | 'rejected' | 'disconnected';
type UserPermission = 'edit' | 'readonly';

interface RemoteUser {
    id: string;
    name: string;
    color: string;
    currentFile: string | null;
}

interface JoinRequest {
    id: string;
    name: string;
}

interface WebSocketContextValue {
    ws: WebSocket | null;
    connectionState: ConnectionState;
    myPermission: UserPermission;
    isHost: boolean;
    myClientId: string;
    myColor: string;
    connectedUsers: RemoteUser[];
    joinRequests: JoinRequest[];
    syncedFiles: ProjectFile[] | null;  // Files received via sync_workspace on join_granted
    respondToJoin: (targetUserId: string, permission: 'edit' | 'readonly' | 'reject') => void;
    sendMessage: (msg: object) => void;
}

// ──────────────────────────────────────────
// Context
// ──────────────────────────────────────────

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function useCollabSocket() {
    const ctx = useContext(WebSocketContext);
    if (!ctx) throw new Error("useCollabSocket must be inside <WebSocketProvider>");
    return ctx;
}

// ──────────────────────────────────────────
// Provider
// ──────────────────────────────────────────

export function WebSocketProvider({ projectId, children }: { projectId: string; children: ReactNode }) {
    const { user } = useAuth0();
    const wsRef = useRef<WebSocket | null>(null);
    const sessionIdRef = useRef(Math.random().toString(36).substring(2, 10));

    const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
    const [myPermission, setMyPermission] = useState<UserPermission>('edit');
    const [isHost, setIsHost] = useState(false);
    const [myColor, setMyColor] = useState("#A855F7");
    const [connectedUsers, setConnectedUsers] = useState<RemoteUser[]>([]);
    const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
    const [syncedFiles, setSyncedFiles] = useState<ProjectFile[] | null>(null);
    const [wsReady, setWsReady] = useState(false); // Used to trigger re-renders when WS opens

    const myClientId = `${user?.sub || "anon"}_${sessionIdRef.current}`;

    const sendMessage = useCallback((msg: object) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(msg));
        }
    }, []);

    const respondToJoin = useCallback((targetUserId: string, permission: 'edit' | 'readonly' | 'reject') => {
        sendMessage({
            type: "join_response",
            targetUserId,
            permission
        });
        setJoinRequests(prev => prev.filter(r => r.id !== targetUserId));
    }, [sendMessage]);

    useEffect(() => {
        if (!projectId || !user?.sub) return;

        const url = new URL(`ws://localhost:3000/ws/collab/${projectId}`);
        url.searchParams.set("clientId", myClientId);
        url.searchParams.set("userName", user.name || user.nickname || "Anonymous");

        const ws = new WebSocket(url.toString());
        wsRef.current = ws;

        ws.onopen = () => {
            console.log("[WS] Connected to collab server");
            setWsReady(true); // Trigger re-render so ws propagates to context consumers
        };

        ws.onmessage = (e) => {
            const data = JSON.parse(e.data);

            switch (data.type) {
                case "room_status":
                    if (data.status === "host") {
                        setIsHost(true);
                        setConnectionState('connected');
                        setMyPermission('edit');
                        if (data.color) setMyColor(data.color);
                    } else if (data.status === "pending") {
                        setConnectionState('waiting_approval');
                    }
                    break;

                case "join_request":
                    setJoinRequests(prev => [...prev, data.user]);
                    break;

                case "join_granted":
                    setConnectionState('connected');
                    setMyPermission(data.permission as UserPermission);
                    setConnectedUsers(data.currentUsers || []);
                    if (data.files) {
                        setSyncedFiles(data.files);
                    }
                    break;

                case "join_rejected":
                    setConnectionState('rejected');
                    break;

                case "user_joined":
                    setConnectedUsers(prev => [...prev, data.user]);
                    break;

                case "user_left":
                    setConnectedUsers(prev => prev.filter(u => u.id !== data.clientId));
                    break;

                case "host_changed":
                    // If we were promoted to host, room_status already handled it
                    break;

                case "file_focus_update":
                    setConnectedUsers(prev => prev.map(u =>
                        u.id === data.clientId ? { ...u, currentFile: data.filePath } : u
                    ));
                    break;

                // code_update, cursor_update — these are handled by EditorArea directly
                // We still need them to pass through the ws, so no default handler needed
            }
        };

        ws.onclose = () => {
            console.log("[WS] Disconnected");
            if (connectionState !== 'rejected') {
                setConnectionState('disconnected');
            }
        };

        return () => {
            ws.close();
            wsRef.current = null;
            setWsReady(false);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId, user?.sub]);

    const value: WebSocketContextValue = {
        ws: wsReady ? wsRef.current : null,
        connectionState,
        myPermission,
        isHost,
        myClientId,
        myColor,
        connectedUsers,
        joinRequests,
        syncedFiles,
        respondToJoin,
        sendMessage
    };

    return (
        <WebSocketContext.Provider value={value}>
            {children}
        </WebSocketContext.Provider>
    );
}

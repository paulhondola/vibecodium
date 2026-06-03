import React, {
	createContext,
	useContext,
	useEffect,
	useRef,
	useState,
	useCallback,
} from "react";
import { useAuth } from "@/contexts/AuthProvider";
import { WS_BASE } from "@/lib/config";

type MessageHandler = (msg: any) => void;

interface SocketContextData {
	socket: WebSocket | null;
	isConnected: boolean;
	send: (msg: any) => void;
	lastMessage: any;
	onMessage: (handler: MessageHandler) => () => void;
}

const SocketContext = createContext<SocketContextData | null>(null);

const BACKOFF_SCHEDULE = [1000, 2000, 4000, 8000, 16000, 30000];
const MAX_QUEUE_SIZE = 50;

function jitter(ms: number) {
	return Math.round(ms * (0.8 + Math.random() * 0.4));
}

export function SocketProvider({
	children,
	projectId,
}: {
	children: React.ReactNode;
	projectId: string | null;
}) {
	const { user, isAuthenticated } = useAuth();
	const ws = useRef<WebSocket | null>(null);
	const [isConnected, setIsConnected] = useState(false);
	const [lastMessage, setLastMessage] = useState<any>(null);
	const sessionIdRef = useRef(Math.random().toString(36).substring(2, 10));
	const pendingQueueRef = useRef<string[]>([]);
	const connectionAttemptRef = useRef(0);
	const handlersRef = useRef<Set<MessageHandler>>(new Set());

	useEffect(() => {
		if (!projectId || !isAuthenticated) return;

		let reconnectTimeout: ReturnType<typeof setTimeout>;
		let isCleaningUp = false;

		const userId = `${user?._raw.id || "anon"}_${sessionIdRef.current}`;
		const userName = user?.name || user?.nickname || "Anonymous";
		const url = `${WS_BASE}/ws/collab/${projectId}?userId=${encodeURIComponent(userId)}&userName=${encodeURIComponent(userName)}`;

		const connect = () => {
			if (isCleaningUp) return;
			const socket = new WebSocket(url);
			ws.current = socket;

			socket.onopen = () => {
				setIsConnected(true);
				connectionAttemptRef.current = 0;

				const queued = pendingQueueRef.current.splice(0);
				for (const msg of queued) {
					try {
						socket.send(msg);
					} catch (_) {}
				}

				socket.send(JSON.stringify({ type: "sync_request" }));
			};

			socket.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					if (data.type === "ping") {
						socket.send(JSON.stringify({ type: "pong" }));
						return;
					}
					// Notify all direct handlers immediately (no React batching)
					for (const handler of handlersRef.current) {
						handler(data);
					}
					// Also update state for components that use lastMessage
					setLastMessage(data);
				} catch {
					console.error("[Socket] Failed to parse message");
				}
			};

			socket.onclose = () => {
				setIsConnected(false);
				ws.current = null;
				if (!isCleaningUp) {
					const attempt = connectionAttemptRef.current;
					const base =
						BACKOFF_SCHEDULE[Math.min(attempt, BACKOFF_SCHEDULE.length - 1)]!;
					const delay = jitter(base);
					connectionAttemptRef.current = attempt + 1;
					console.log(
						`[Socket] Reconnecting in ${delay}ms (attempt ${attempt + 1})...`,
					);
					reconnectTimeout = setTimeout(connect, delay);
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
		const raw = JSON.stringify(msg);
		if (ws.current?.readyState === WebSocket.OPEN) {
			ws.current.send(raw);
		} else {
			if (pendingQueueRef.current.length < MAX_QUEUE_SIZE) {
				pendingQueueRef.current.push(raw);
			}
		}
	};

	const onMessage = useCallback((handler: MessageHandler) => {
		handlersRef.current.add(handler);
		return () => {
			handlersRef.current.delete(handler);
		};
	}, []);

	return (
		<SocketContext.Provider
			value={{ socket: ws.current, isConnected, send, lastMessage, onMessage }}
		>
			{children}
		</SocketContext.Provider>
	);
}

export function useSocket() {
	const context = useContext(SocketContext);
	if (!context)
		throw new Error("useSocket must be used within a SocketProvider");
	return context;
}

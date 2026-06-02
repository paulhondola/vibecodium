import {
	Heart,
	X,
	Flame,
	MapPin,
	Code2,
	Loader2,
	RotateCcw,
	MessageCircle,
	ChevronLeft,
	Send,
	UserX,
	Github,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthProvider";
import { API_BASE, WS_BASE } from "@/lib/config";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MatchUser {
	id: string;
	name: string;
	email: string;
	picture: string;
	bio: string;
	language: string;
	location: string;
	github_username: string | null;
}

interface MatchEntry {
	id: string;
	partner: { id: string; name: string; picture: string } | null;
	lastMessage: { body: string; sender_id: string; created_at: string } | null;
	unreadCount: number;
	createdAt: string;
}

interface Message {
	id: string;
	sender_id: string;
	body: string;
	created_at: string;
}

type OrderMode = "random" | "language" | "location" | "active" | "new";
type Screen = "swipe" | "matches";

const ORDER_LABELS: Record<OrderMode, string> = {
	random: "Hot right now",
	language: "Same stack",
	location: "Nearby",
	active: "Most active",
	new: "Just joined",
};

const ICEBREAKERS = [
	"Do you also push to main on Fridays or is that just me?",
	"Tab or spaces? (This could make or break us.)",
	"What's your longest-running TODO comment?",
	"Have you ever shipped a bug on purpose and called it a 'feature'?",
	"Coffee before or after you read the error logs?",
];

// ── Main component ────────────────────────────────────────────────────────────

export default function CoderMatchModal({ onClose }: { onClose: () => void }) {
	const { user, getAccessTokenSilently } = useAuth();

	// Navigation
	const [screen, setScreen] = useState<Screen>("swipe");

	// Swipe screen state
	const [order, setOrder] = useState<OrderMode>("random");
	const [users, setUsers] = useState<MatchUser[]>([]);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [isLoadingUsers, setIsLoadingUsers] = useState(true);
	const [matchAnimation, setMatchAnimation] = useState<{ user: MatchUser; matchId: string } | null>(null);
	const [rewound, setRewound] = useState(false);
	const [lastSwipedUser, setLastSwipedUser] = useState<MatchUser | null>(null);

	// Matches screen state
	const [matches, setMatches] = useState<MatchEntry[]>([]);
	const [isLoadingMatches, setIsLoadingMatches] = useState(false);

	// Chat state
	const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
	const [messages, setMessages] = useState<Message[]>([]);
	const [isLoadingMessages, setIsLoadingMessages] = useState(false);
	const [messageInput, setMessageInput] = useState("");
	const [isSending, setIsSending] = useState(false);
	const wsRef = useRef<WebSocket | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// ── Fetch swipe candidates ─────────────────────────────────────────────────

	const fetchUsers = useCallback(async (orderMode: OrderMode) => {
		setIsLoadingUsers(true);
		setCurrentIndex(0);
		try {
			const token = await getAccessTokenSilently();
			const res = await fetch(`${API_BASE}/api/users/match?order=${orderMode}`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			const data = await res.json();
			if (data.success) setUsers(data.users ?? []);
		} catch (err) {
			console.error("Failed to fetch match users:", err);
		} finally {
			setIsLoadingUsers(false);
		}
	}, [getAccessTokenSilently]);

	useEffect(() => {
		fetchUsers(order);
	}, [order, fetchUsers]);

	// ── Fetch matches ──────────────────────────────────────────────────────────

	const fetchMatches = useCallback(async () => {
		setIsLoadingMatches(true);
		try {
			const token = await getAccessTokenSilently();
			const res = await fetch(`${API_BASE}/api/match/matches`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			const data = await res.json();
			if (data.success) setMatches(data.matches ?? []);
		} catch (err) {
			console.error("Failed to fetch matches:", err);
		} finally {
			setIsLoadingMatches(false);
		}
	}, [getAccessTokenSilently]);

	useEffect(() => {
		if (screen === "matches") fetchMatches();
	}, [screen, fetchMatches]);

	// ── Swipe handler ──────────────────────────────────────────────────────────

	const handleSwipe = async (direction: "left" | "right") => {
		if (currentIndex >= users.length) return;
		const swiped = users[currentIndex];
		if (!swiped) return;

		setLastSwipedUser(swiped);
		setCurrentIndex((prev) => prev + 1);

		try {
			const token = await getAccessTokenSilently();
			const res = await fetch(`${API_BASE}/api/match/swipe`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
				body: JSON.stringify({ swipedId: swiped.id, direction }),
			});
			const data = await res.json();

			if (data.matched && data.matchId) {
				setMatchAnimation({ user: swiped, matchId: data.matchId });
				setTimeout(() => setMatchAnimation(null), 2500);
			}
		} catch (err) {
			console.error("Swipe error:", err);
		}
	};

	// ── Rewind handler ─────────────────────────────────────────────────────────

	const handleRewind = async () => {
		if (rewound || currentIndex === 0 || !lastSwipedUser) return;
		setRewound(true);
		setCurrentIndex((prev) => prev - 1);
		try {
			const token = await getAccessTokenSilently();
			await fetch(`${API_BASE}/api/match/swipe/last`, {
				method: "DELETE",
				headers: { Authorization: `Bearer ${token}` },
			});
		} catch (err) {
			console.error("Rewind error:", err);
		}
	};

	// ── Keyboard shortcuts ─────────────────────────────────────────────────────

	useEffect(() => {
		if (screen !== "swipe") return;
		const handler = (e: KeyboardEvent) => {
			if (e.key === "ArrowLeft") handleSwipe("left");
			else if (e.key === "ArrowRight") handleSwipe("right");
			else if (e.key === "z" || e.key === "Z") handleRewind();
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [screen, currentIndex, rewound, lastSwipedUser]);

	// ── Chat ───────────────────────────────────────────────────────────────────

	const openChat = async (matchId: string) => {
		setActiveMatchId(matchId);
		setMessages([]);
		setMessageInput(ICEBREAKERS[Math.floor(Math.random() * ICEBREAKERS.length)] ?? "");
		setIsLoadingMessages(true);

		try {
			const token = await getAccessTokenSilently();
			const res = await fetch(`${API_BASE}/api/match/${matchId}/messages`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			const data = await res.json();
			if (data.success) {
				setMessages(data.messages ?? []);
				// Clear icebreaker if there are already messages
				if ((data.messages ?? []).length > 0) setMessageInput("");
			}
		} catch (err) {
			console.error("Load messages error:", err);
		} finally {
			setIsLoadingMessages(false);
		}

		// Open WS for real-time delivery
		if (wsRef.current) wsRef.current.close();
		const ws = new WebSocket(`${WS_BASE}/ws/match?matchId=${matchId}&userId=${user?._raw?.id ?? ""}`);
		ws.onmessage = (event) => {
			try {
				const payload = JSON.parse(event.data);
				if (payload.type === "new_message" && payload.message) {
					setMessages((prev) =>
						prev.some((m) => m.id === payload.message.id)
							? prev
							: [...prev, payload.message],
					);
				}
			} catch (_) {}
		};
		wsRef.current = ws;
	};

	const closeChat = () => {
		setActiveMatchId(null);
		setMessages([]);
		if (wsRef.current) {
			wsRef.current.close();
			wsRef.current = null;
		}
		fetchMatches();
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: intentional – close WS on unmount only
	useEffect(() => {
		return () => {
			wsRef.current?.close();
		};
	}, []);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	const sendMessage = async () => {
		if (!messageInput.trim() || !activeMatchId || isSending) return;
		const body = messageInput.trim();
		setMessageInput("");
		setIsSending(true);
		try {
			const token = await getAccessTokenSilently();
			const res = await fetch(`${API_BASE}/api/match/${activeMatchId}/messages`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
				body: JSON.stringify({ body }),
			});
			// Don't manually add to state — WS broadcast delivers the message to
			// all clients in the room including the sender, avoiding duplicates.
			if (!res.ok) throw new Error("Send failed");
		} catch (err) {
			console.error("Send message error:", err);
			setMessageInput(body);
		} finally {
			setIsSending(false);
		}
	};

	const handleUnmatch = async (matchId: string) => {
		try {
			const token = await getAccessTokenSilently();
			await fetch(`${API_BASE}/api/match/${matchId}`, {
				method: "DELETE",
				headers: { Authorization: `Bearer ${token}` },
			});
			if (activeMatchId === matchId) closeChat();
			setMatches((prev) => prev.filter((m) => m.id !== matchId));
		} catch (err) {
			console.error("Unmatch error:", err);
		}
	};

	// ── Loading state ──────────────────────────────────────────────────────────

	if (isLoadingUsers && screen === "swipe") {
		return (
			<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
				<div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-8 flex flex-col items-center">
					<Loader2 size={32} className="animate-spin text-pink-500 mb-4" />
					<p className="text-white font-medium">Finding hot coders in your area...</p>
				</div>
			</div>
		);
	}

	const profile = users[currentIndex];
	const pseudoAge = profile ? 20 + (profile.id ? (profile.id.length % 15) : 4) : 0;
	const activeMatch = matches.find((m) => m.id === activeMatchId);

	return (
		<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
			<div className="bg-[#09090b] border border-[#27272a] rounded-3xl overflow-hidden max-w-sm w-full relative shadow-[0_0_50px_rgba(236,72,153,0.15)] flex flex-col h-[640px]">

				{/* Match animation overlay */}
				{matchAnimation && (
					<div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-6 text-center">
						<h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-rose-500 italic mb-4 -rotate-12">
							IT'S A MATCH!
						</h2>
						<p className="text-white mb-8 text-lg font-medium">
							You and {matchAnimation.user.name} both love avoiding documentation.
						</p>
						<div className="flex gap-4">
							<img
								src={matchAnimation.user.picture}
								alt={matchAnimation.user.name}
								className="w-24 h-24 rounded-full border-4 border-pink-500 bg-white"
							/>
							<div className="w-24 h-24 rounded-full border-4 border-pink-500 flex items-center justify-center bg-gradient-to-br from-cyan-400 to-blue-600 font-bold text-2xl text-black">
								{user?.name?.[0] ?? "V"}
							</div>
						</div>
						<button
							type="button"
							onClick={() => {
								setMatchAnimation(null);
								setScreen("matches");
								fetchMatches();
							}}
							className="mt-6 px-6 py-2 rounded-full bg-pink-500 text-white font-bold text-sm hover:bg-pink-600 transition-colors"
						>
							Send a message
						</button>
					</div>
				)}

				{/* Header */}
				<div className="p-4 border-b border-[#27272a] flex justify-between items-center bg-[#18181b] shrink-0">
					<div className="flex items-center gap-2 text-pink-500 font-bold text-xl tracking-tight">
						<Flame size={24} className="fill-pink-500" />
						<div>Vibe<span className="text-white">Match</span></div>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="p-2 rounded-full hover:bg-[#27272a] text-gray-400 transition-colors"
					>
						<X size={20} />
					</button>
				</div>

				{/* Tab row */}
				<div className="flex border-b border-[#27272a] bg-[#18181b] shrink-0">
					<button
						type="button"
						onClick={() => setScreen("swipe")}
						className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors ${
							screen === "swipe"
								? "text-pink-500 border-b-2 border-pink-500"
								: "text-gray-500 hover:text-gray-300"
						}`}
					>
						Swipe
					</button>
					<button
						type="button"
						onClick={() => setScreen("matches")}
						className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors relative ${
							screen === "matches"
								? "text-pink-500 border-b-2 border-pink-500"
								: "text-gray-500 hover:text-gray-300"
						}`}
					>
						Matches
						{matches.reduce((acc, m) => acc + m.unreadCount, 0) > 0 && (
							<span className="absolute top-1.5 right-6 w-2 h-2 bg-pink-500 rounded-full" />
						)}
					</button>
				</div>

				{/* ── SWIPE SCREEN ────────────────────────────────────────────────────── */}
				{screen === "swipe" && (
					<>
						{/* Order picker */}
						<div className="px-4 pt-3 pb-1 shrink-0">
							<select
								value={order}
								onChange={(e) => setOrder(e.target.value as OrderMode)}
								className="w-full bg-[#18181b] border border-[#27272a] text-gray-300 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-pink-500 transition-colors"
							>
								{(Object.keys(ORDER_LABELS) as OrderMode[]).map((key) => (
									<option key={key} value={key}>
										{ORDER_LABELS[key]}
									</option>
								))}
							</select>
						</div>

						{/* Card stack */}
						<div className="flex-1 px-4 py-2 relative overflow-hidden flex flex-col">
							{currentIndex >= users.length ? (
								<div className="flex-1 flex flex-col items-center justify-center text-center">
									<Flame className="w-12 h-12 text-pink-500 mx-auto mb-3" />
									<h3 className="text-white font-bold text-lg mb-1">No more coders!</h3>
									<p className="text-gray-400 text-sm mb-4">
										You've seen everyone. Go back to coding.
									</p>
									<button
										type="button"
										onClick={() => fetchUsers(order)}
										className="px-4 py-2 rounded-full border border-pink-500 text-pink-500 text-xs font-bold hover:bg-pink-500/10 transition-colors"
									>
										Refresh
									</button>
								</div>
							) : profile ? (
								<div className="flex-1 bg-white rounded-2xl overflow-hidden relative shadow-md flex flex-col border border-gray-200">
									<div className="h-52 bg-gradient-to-br from-pink-100 to-purple-200 flex items-center justify-center shrink-0">
										<img
											src={profile.picture}
											alt={profile.name}
											className="w-40 h-40 drop-shadow-xl rounded-2xl object-cover"
										/>
									</div>
									<div className="flex-1 p-4 flex flex-col bg-white text-black overflow-auto">
										<h3 className="text-xl font-black flex items-baseline gap-2">
											{profile.name}
											<span className="text-base font-normal text-gray-500">{pseudoAge}</span>
											{profile.language && (
												<span className="ml-auto text-xs bg-pink-50 text-pink-500 border border-pink-100 px-2 py-0.5 rounded font-bold flex items-center gap-1">
													<Code2 size={11} /> {profile.language}
												</span>
											)}
										</h3>
										{profile.location && (
											<div className="flex items-center gap-1 text-gray-500 mt-1 text-xs font-medium">
												<MapPin size={11} /> {profile.location}
											</div>
										)}
										{profile.bio && (
											<p className="text-gray-700 text-sm leading-snug mt-2 break-words">
												"{profile.bio}"
											</p>
										)}
										{profile.github_username && (
											<a
												href={`https://github.com/${profile.github_username}`}
												target="_blank"
												rel="noopener noreferrer"
												onClick={(e) => e.stopPropagation()}
												className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors w-fit"
											>
												<Github size={13} />
												@{profile.github_username}
											</a>
										)}
									</div>
								</div>
							) : null}
						</div>

						{/* Action buttons */}
						<div className="p-5 bg-[#18181b] flex justify-center gap-6 border-t border-[#27272a] shrink-0">
							<button
								type="button"
								onClick={() => handleSwipe("left")}
								className="w-14 h-14 rounded-full bg-[#09090b] flex items-center justify-center border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)] hover:scale-110"
							>
								<X size={24} strokeWidth={3} />
							</button>
							<button
								type="button"
								onClick={handleRewind}
								disabled={rewound || currentIndex === 0}
								title={rewound ? "Rewind used this session" : "Undo last swipe (Z)"}
								className="w-14 h-14 rounded-full bg-[#09090b] flex items-center justify-center border-2 border-amber-400 text-amber-400 hover:bg-amber-400 hover:text-black transition-all shadow-[0_0_15px_rgba(251,191,36,0.2)] hover:scale-110 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:bg-[#09090b] disabled:hover:text-amber-400"
							>
								<RotateCcw size={20} strokeWidth={2.5} />
							</button>
							<button
								type="button"
								onClick={() => handleSwipe("right")}
								className="w-14 h-14 rounded-full bg-[#09090b] flex items-center justify-center border-2 border-green-500 text-green-500 hover:bg-green-500 hover:text-white transition-all shadow-[0_0_15px_rgba(34,197,94,0.2)] hover:scale-110"
							>
								<Heart size={24} strokeWidth={3} />
							</button>
						</div>
					</>
				)}

				{/* ── MATCHES SCREEN ───────────────────────────────────────────────────── */}
				{screen === "matches" && !activeMatchId && (
					<div className="flex-1 overflow-y-auto">
						{isLoadingMatches ? (
							<div className="flex items-center justify-center h-full">
								<Loader2 size={24} className="animate-spin text-pink-500" />
							</div>
						) : matches.length === 0 ? (
							<div className="flex flex-col items-center justify-center h-full text-center px-6">
								<Heart size={40} className="text-gray-600 mb-3" />
								<p className="text-gray-400 text-sm">No matches yet. Start swiping!</p>
							</div>
						) : (
							<ul>
								{matches.map((match) => (
									<li key={match.id}>
										<button
											type="button"
											onClick={() => openChat(match.id)}
											className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#18181b] transition-colors text-left"
										>
											<div className="relative shrink-0">
												{match.partner?.picture ? (
													<img
														src={match.partner.picture}
														alt={match.partner.name ?? "Match"}
														className="w-12 h-12 rounded-full object-cover border-2 border-[#27272a]"
													/>
												) : (
													<div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-purple-600 border-2 border-[#27272a]" />
												)}
												{match.unreadCount > 0 && (
													<span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-pink-500 rounded-full text-white text-[10px] flex items-center justify-center font-bold">
														{match.unreadCount > 9 ? "9+" : match.unreadCount}
													</span>
												)}
											</div>
											<div className="flex-1 min-w-0">
												<div className="flex items-center justify-between">
													<span className="text-white font-semibold text-sm truncate">
														{match.partner?.name ?? "Unknown"}
													</span>
													{match.lastMessage && (
														<span className="text-gray-600 text-[10px] shrink-0 ml-2">
															{new Date(match.lastMessage.created_at).toLocaleDateString()}
														</span>
													)}
												</div>
												<p className="text-gray-500 text-xs truncate mt-0.5">
													{match.lastMessage
														? match.lastMessage.body
														: "Say hello!"}
												</p>
											</div>
											<MessageCircle size={16} className="text-gray-600 shrink-0" />
										</button>
									</li>
								))}
							</ul>
						)}
					</div>
				)}

				{/* ── CHAT SCREEN ─────────────────────────────────────────────────────── */}
				{screen === "matches" && activeMatchId && (
					<>
						{/* Chat header */}
						<div className="px-4 py-3 bg-[#18181b] border-b border-[#27272a] flex items-center gap-3 shrink-0">
							<button
								type="button"
								onClick={closeChat}
								className="p-1 rounded text-gray-400 hover:text-white transition-colors"
							>
								<ChevronLeft size={20} />
							</button>
							{activeMatch?.partner?.picture && (
								<img
									src={activeMatch.partner.picture}
									alt={activeMatch.partner.name ?? "Match"}
									className="w-8 h-8 rounded-full object-cover border border-[#27272a]"
								/>
							)}
							<span className="text-white font-semibold text-sm flex-1 truncate">
								{activeMatch?.partner?.name ?? "Chat"}
							</span>
							<button
								type="button"
								onClick={() => activeMatchId && handleUnmatch(activeMatchId)}
								title="Unmatch"
								className="p-1.5 rounded text-gray-600 hover:text-red-500 transition-colors"
							>
								<UserX size={16} />
							</button>
						</div>

						{/* Messages */}
						<div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
							{isLoadingMessages ? (
								<div className="flex items-center justify-center h-full">
									<Loader2 size={20} className="animate-spin text-pink-500" />
								</div>
							) : messages.length === 0 ? (
								<div className="flex flex-col items-center justify-center h-full text-center">
									<p className="text-gray-500 text-xs">No messages yet. Break the ice!</p>
								</div>
							) : (
								messages.map((msg) => {
									const isMe = msg.sender_id === user?._raw?.id;
									return (
										<div
											key={msg.id}
											className={`flex items-end gap-2 ${isMe ? "justify-end" : "justify-start"}`}
										>
											{!isMe && activeMatch?.partner?.picture && (
												<img
													src={activeMatch.partner.picture}
													alt=""
													className="w-6 h-6 rounded-full object-cover shrink-0 mb-0.5"
												/>
											)}
											<div
												className={`max-w-[75%] px-3 py-2 text-sm leading-snug break-words ${
													isMe
														? "bg-pink-500 text-white rounded-2xl rounded-br-none"
														: "bg-[#27272a] text-gray-100 rounded-2xl rounded-bl-none"
												}`}
											>
												{msg.body}
											</div>
										</div>
									);
								})
							)}
							<div ref={messagesEndRef} />
						</div>

						{/* Message input */}
						<div className="px-4 py-3 bg-[#18181b] border-t border-[#27272a] flex gap-2 shrink-0">
							<input
								type="text"
								value={messageInput}
								onChange={(e) => setMessageInput(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter" && !e.shiftKey) {
										e.preventDefault();
										sendMessage();
									}
								}}
								placeholder="Type a message..."
								className="flex-1 bg-[#09090b] border border-[#27272a] text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-pink-500 transition-colors placeholder:text-gray-600"
							/>
							<button
								type="button"
								onClick={sendMessage}
								disabled={!messageInput.trim() || isSending}
								className="w-9 h-9 rounded-xl bg-pink-500 flex items-center justify-center text-white hover:bg-pink-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
							>
								{isSending ? (
									<Loader2 size={14} className="animate-spin" />
								) : (
									<Send size={14} />
								)}
							</button>
						</div>
					</>
				)}
			</div>
		</div>
	);
}

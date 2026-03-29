import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Loader2, X, Zap, Radio, RotateCcw, Sparkles } from "lucide-react";

export interface TimelineEvent {
    _id: string;
    projectId: string;
    filePath: string;
    eventType: "code_update" | "agent_accepted";
    userId: string;
    userName: string;
    userColor: string;
    content: string;
    isCheckpoint: boolean;
    createdAt: string; // ISO 8601
}

interface TimelineBarProps {
    events: TimelineEvent[];
    currentIndex: number;
    onScrub: (index: number) => void;
    onRestore: () => void;
    onClose: () => void;
    onLive: () => void;
    onAnalyze: (eventIds: string[]) => Promise<void>;
    isLoading: boolean;
    analysisResult?: string | null;
    isAnalyzing: boolean;
}

function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function TimelineBar({
    events,
    currentIndex,
    onScrub,
    onRestore,
    onClose,
    onLive,
    onAnalyze,
    isLoading,
    analysisResult,
    isAnalyzing,
}: TimelineBarProps) {
    const current = events[currentIndex];

    // Build a CSS gradient string that colour-codes each event segment.
    // Purple = agent_accepted, per-user colour = code_update.
    const trackGradient = useMemo(() => {
        if (events.length === 0) return "transparent";
        if (events.length === 1) {
            const c = events[0].eventType === "agent_accepted" ? "#A855F7" : events[0].userColor;
            return c;
        }
        const stops = events.map((ev, i) => {
            const color = ev.eventType === "agent_accepted" ? "#A855F7" : ev.userColor;
            const pct = (i / (events.length - 1)) * 100;
            return `${color} ${pct.toFixed(2)}%`;
        });
        return `linear-gradient(to right, ${stops.join(", ")})`;
    }, [events]);

    // Unique authors up to and including currentIndex (for presence row)
    const activeUsers = useMemo(() => {
        const seen = new Map<string, TimelineEvent>();
        for (let i = 0; i <= currentIndex && i < events.length; i++) {
            seen.set(events[i].userId, events[i]);
        }
        return Array.from(seen.values());
    }, [events, currentIndex]);

    const pct = events.length > 1 ? (currentIndex / (events.length - 1)) * 100 : 0;

    return (
        <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="absolute inset-x-0 bottom-0 z-30 bg-[#0d0d10] border-t border-[#27272a] shadow-[0_-8px_30px_rgba(0,0,0,0.6)] select-none"
        >
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#1f1f24]">
                <div className="flex items-center gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-[#A855F7]/20 border border-[#A855F7]/30 flex items-center justify-center shrink-0">
                        <Radio size={10} className="text-[#A855F7]" />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-gray-300">
                        History Timeline
                    </span>
                    {current && (
                        <span className="text-[10px] text-gray-500 font-mono">
                            {formatDate(current.createdAt)} · {formatTime(current.createdAt)}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Author presence avatars */}
                    <div className="flex -space-x-1.5 mr-1">
                        {activeUsers.slice(0, 5).map(u => (
                            <div
                                key={u.userId}
                                title={u.eventType === "agent_accepted" ? "AI Agent" : u.userName}
                                className="w-5 h-5 rounded-full border border-[#0d0d10] flex items-center justify-center text-[8px] font-black text-white shadow-sm shrink-0"
                                style={{ backgroundColor: u.eventType === "agent_accepted" ? "#A855F7" : u.userColor }}
                            >
                                {u.eventType === "agent_accepted" ? <Bot size={9} /> : u.userName.substring(0, 2).toUpperCase()}
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={onLive}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 hover:border-green-500/40 transition-all"
                    >
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        Live
                    </button>

                    <button onClick={onClose} className="p-1 rounded text-gray-500 hover:text-white hover:bg-white/10 transition-colors">
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* ── Scrubber area ── */}
            <div className="px-4 pt-4 pb-2">
                {isLoading ? (
                    <div className="flex items-center justify-center gap-2 py-4 text-gray-500">
                        <Loader2 size={14} className="animate-spin text-[#A855F7]" />
                        <span className="text-xs">Loading timeline…</span>
                    </div>
                ) : events.length === 0 ? (
                    <div className="flex items-center justify-center py-4 text-gray-600 text-xs">
                        No history yet for this file. Start editing to build a timeline.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {/* Current event info pill */}
                        <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="text-gray-400 font-mono">
                                Revision <span className="text-white font-bold">{currentIndex + 1}</span>
                                <span className="text-gray-600"> / {events.length}</span>
                            </span>
                            {current && (
                                <span
                                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                                    style={{
                                        backgroundColor: current.eventType === "agent_accepted" ? "#A855F720" : `${current.userColor}20`,
                                        color: current.eventType === "agent_accepted" ? "#A855F7" : current.userColor,
                                        border: `1px solid ${current.eventType === "agent_accepted" ? "#A855F730" : `${current.userColor}30`}`,
                                    }}
                                >
                                    {current.eventType === "agent_accepted" ? <Bot size={10} /> : null}
                                    {current.eventType === "agent_accepted" ? "AI Agent" : current.userName}
                                </span>
                            )}
                        </div>

                        {/* ── The slider ── */}
                        <div className="relative">
                            {/*
                              Colour-coded track rendered behind the range input.
                              The range input sits on top with a transparent track so
                              only the custom thumb is visible — giving full drag control.
                            */}
                            <div className="relative h-6 flex items-center">
                                {/* Coloured background bar */}
                                <div
                                    className="absolute inset-x-0 h-2 rounded-full overflow-hidden"
                                    style={{ background: trackGradient, opacity: 0.35 }}
                                />
                                {/* Filled progress bar (solid, up to currentIndex) */}
                                <div
                                    className="absolute left-0 h-2 rounded-full transition-all duration-75"
                                    style={{
                                        width: `${pct}%`,
                                        background: trackGradient,
                                        opacity: 0.85,
                                    }}
                                />
                                {/* The actual range input — transparent track, custom thumb via CSS */}
                                <input
                                    type="range"
                                    min={0}
                                    max={Math.max(0, events.length - 1)}
                                    value={currentIndex}
                                    onChange={e => onScrub(parseInt(e.target.value, 10))}
                                    className="absolute inset-x-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    style={{ margin: 0 }}
                                    aria-label="Timeline scrubber"
                                />
                                {/* Custom thumb rendered at the right position */}
                                <div
                                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white border-2 border-[#A855F7] shadow-[0_0_10px_rgba(168,85,247,0.7)] z-20 pointer-events-none transition-all duration-75"
                                    style={{ left: `${pct}%` }}
                                />
                            </div>
                        </div>

                        {/* Time labels */}
                        <div className="flex justify-between text-[10px] text-gray-600 font-mono px-0.5">
                            {events[0] && <span>{formatTime(events[0].createdAt)}</span>}
                            {events.length > 1 && <span>{formatTime(events[events.length - 1].createdAt)}</span>}
                        </div>

                        {/* Legend */}
                        <div className="flex items-center gap-3 text-[10px] text-gray-500 pt-0.5">
                            <span className="flex items-center gap-1">
                                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: "#A855F7" }} />
                                AI Agent
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-2.5 h-2.5 rounded-sm inline-block bg-cyan-400" />
                                Human edit
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Actions ── */}
            {events.length > 0 && (
                <div className="flex items-center justify-between px-4 pb-3 pt-1 gap-3">
                    <button
                        onClick={onRestore}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 hover:border-cyan-500/40 transition-all"
                    >
                        <RotateCcw size={12} />
                        Restore This Version
                    </button>

                    <button
                        onClick={() => onAnalyze(events.slice(-10).map(e => e._id))}
                        disabled={isAnalyzing}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-[#A855F7]/10 hover:bg-[#A855F7]/20 text-[#A855F7] border border-[#A855F7]/20 hover:border-[#A855F7]/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isAnalyzing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                        {isAnalyzing ? "Analyzing…" : "Analyze with AI"}
                    </button>
                </div>
            )}

            {/* ── AI analysis result ── */}
            <AnimatePresence>
                {analysisResult && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden border-t border-[#1f1f24]"
                    >
                        <div className="px-4 py-3">
                            <div className="flex items-center gap-2 mb-2">
                                <Zap size={12} className="text-[#A855F7]" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-[#A855F7]">AI Analysis</span>
                            </div>
                            <div className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto font-mono bg-[#09090b] rounded-lg p-3 border border-[#27272a]">
                                {analysisResult}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

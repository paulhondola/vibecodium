import { useEffect, useState, useRef } from "react";

interface FloatingEmoji {
    id: string;
    emoji: string;
    x: number;
    startTime: number;
    sender?: string;
}

const REACTION_EMOJIS = ["🚀", "🔥", "💥", "😂", "👏", "🤯", "💀", "✨", "🍄", "🎉", "😎", "🤙", "🦄", "💯", "👾"];

interface ReactionOverlayProps {
    lastMessage: any;
    onSendReaction: (emoji: string) => void;
}

export default function ReactionOverlay({ lastMessage, onSendReaction }: ReactionOverlayProps) {
    const [floating, setFloating] = useState<FloatingEmoji[]>([]);
    const [showPicker, setShowPicker] = useState(false);
    const timeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    // Listen for incoming emoji reactions from WebSocket
    useEffect(() => {
        if (!lastMessage || lastMessage.type !== "emoji_reaction") return;
        spawnEmoji(lastMessage.emoji, lastMessage.sender);
    }, [lastMessage]);

    const spawnEmoji = (emoji: string, sender?: string) => {
        const id = crypto.randomUUID();
        const x = 10 + Math.random() * 80; // 10–90% from left
        setFloating(prev => [...prev, { id, emoji, x, startTime: Date.now(), sender }]);

        // Remove after animation completes (3s)
        const t = setTimeout(() => {
            setFloating(prev => prev.filter(e => e.id !== id));
            timeouts.current.delete(id);
        }, 3200);
        timeouts.current.set(id, t);
    };

    const handleSend = (emoji: string) => {
        onSendReaction(emoji);
        spawnEmoji(emoji, "You");
        setShowPicker(false);
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => timeouts.current.forEach(t => clearTimeout(t));
    }, []);

    return (
        <>
            {/* Floating emojis */}
            <div className="fixed inset-0 pointer-events-none z-[999] overflow-hidden">
                {floating.map(item => (
                    <div
                        key={item.id}
                        className="absolute bottom-16 text-4xl select-none"
                        style={{
                            left: `${item.x}%`,
                            animation: "floatUp 3s ease-out forwards",
                        }}
                    >
                        {item.emoji}
                        {item.sender && (
                            <div className="text-[9px] text-white/60 font-mono text-center mt-1">{item.sender}</div>
                        )}
                    </div>
                ))}
            </div>

            {/* Emoji Picker Button */}
            <div className="relative">
                <button
                    onClick={() => setShowPicker(p => !p)}
                    className="text-xs px-3 py-1.5 rounded flex items-center gap-2 transition-all font-semibold shadow-sm bg-purple-900/30 text-purple-400 border border-purple-500/30 hover:bg-purple-500/20 hover:scale-105"
                    title="Send a reaction to all collaborators"
                >
                    <span className="text-base leading-none">🎯</span>
                    React
                </button>

                {showPicker && (
                    <div className="absolute bottom-full mb-2 right-0 bg-[#18181b] border border-[#3f3f46] rounded-xl p-3 shadow-2xl shadow-black/60 grid grid-cols-5 gap-2 z-50 min-w-[200px]">
                        <div className="col-span-5 text-[9px] uppercase tracking-widest text-gray-500 font-semibold mb-1">
                            React to everyone 📡
                        </div>
                        {REACTION_EMOJIS.map(emoji => (
                            <button
                                key={emoji}
                                onClick={() => handleSend(emoji)}
                                className="text-2xl hover:scale-125 transition-transform p-1 rounded hover:bg-white/10"
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <style>{`
                @keyframes floatUp {
                    0% { transform: translateY(0) scale(1); opacity: 1; }
                    70% { opacity: 1; }
                    100% { transform: translateY(-70vh) scale(1.5); opacity: 0; }
                }
            `}</style>
        </>
    );
}

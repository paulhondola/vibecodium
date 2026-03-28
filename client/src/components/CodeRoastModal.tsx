import { useState, useRef } from "react";
import { Loader2, X, Flame } from "lucide-react";

interface CodeRoastModalProps {
    code: string;
    fileName: string;
    onClose: () => void;
}

const ROAST_OPENERS = [
    "🔥 The AI has reviewed your code and it is NOT impressed:",
    "💀 Senior Dev AI has opinions. Brace yourself:",
    "😂 This was sent to AI for review. This was the response:",
    "🤡 ChatGPT couldn't do this. Our AI stepped up. Results:",
];

export default function CodeRoastModal({ code, fileName, onClose }: CodeRoastModalProps) {
    const [roast, setRoast] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const openerRef = useRef(ROAST_OPENERS[Math.floor(Math.random() * ROAST_OPENERS.length)]);

    // Fetch roast immediately on mount
    useRef<boolean>(false); // prevent double-fire
    useState(() => {
        const ctrl = new AbortController();
        (async () => {
            try {
                const res = await fetch("http://localhost:3000/api/roast", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ code, fileName }),
                    signal: ctrl.signal,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Roast failed");
                setRoast(data.roast);
            } catch (e: any) {
                if (e.name !== "AbortError") setError(e.message);
            } finally {
                setIsLoading(false);
            }
        })();
        return () => ctrl.abort();
    });

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-[#09090b] border border-orange-500/30 rounded-2xl max-w-xl w-full shadow-[0_0_60px_rgba(249,115,22,0.2)] overflow-hidden flex flex-col max-h-[80vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-orange-500/10 to-red-500/10 border-b border-orange-500/20 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg">
                            <Flame size={20} className="text-white" />
                        </div>
                        <div>
                            <h2 className="font-bold text-white text-base tracking-tight">Roast My Code</h2>
                            <p className="text-[10px] text-orange-400/70 font-mono uppercase tracking-widest">{fileName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-gray-400 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Opener */}
                <div className="px-5 py-3 border-b border-white/5 bg-orange-500/5 text-xs text-orange-300 italic shrink-0">
                    {openerRef.current}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5">
                    {isLoading && (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                            <Loader2 size={32} className="animate-spin text-orange-500" />
                            <p className="text-sm text-gray-400 font-medium">AI is reading your code and judging you...</p>
                            <div className="flex gap-1 mt-1">
                                {["😬", "🤔", "💀"].map((e, i) => (
                                    <span key={i} className="text-2xl animate-bounce" style={{ animationDelay: `${i * 0.2}s` }}>{e}</span>
                                ))}
                            </div>
                        </div>
                    )}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
                            <strong>Error:</strong> {error}
                        </div>
                    )}
                    {roast && (
                        <div className="space-y-4">
                            <div className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap font-['JetBrains_Mono'] bg-[#18181b] rounded-xl p-4 border border-white/5">
                                {roast}
                            </div>
                            <div className="flex justify-end">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-black font-bold text-xs uppercase tracking-widest rounded-lg transition-colors"
                                >
                                    I'll fix it... eventually 😤
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

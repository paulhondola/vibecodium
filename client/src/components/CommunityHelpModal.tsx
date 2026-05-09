import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2, MessageSquareQuote } from "lucide-react";
import { useAuth } from "@/contexts/AuthProvider";
import { API_BASE } from "@/lib/config";

interface CommunityHelpModalProps {
    isOpen: boolean;
    onClose: () => void;
    repoUrl: string;
}

export default function CommunityHelpModal({ isOpen, onClose, repoUrl }: CommunityHelpModalProps) {
    const { getAccessTokenSilently } = useAuth();
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !description) return;

        setIsSubmitting(true);
        setError(null);

        try {
            const token = await getAccessTokenSilently();
            const res = await fetch(`${API_BASE}/api/help`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ title, description, repoUrl, difficulty }),
            });

            const data = await res.json();
            if (data.success) {
                onClose();
                setTitle("");
                setDescription("");
                setDifficulty("medium");
            } else {
                setError(data.error || "Failed to post help request.");
            }
        } catch (err: any) {
            setError(err.message || "An unexpected error occurred.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="bg-[#18181b] border border-[#A855F7]/30 rounded-2xl p-8 max-w-lg w-full shadow-[0_0_50px_rgba(168,85,247,0.2)] relative overflow-hidden"
                    >
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 via-[#A855F7] to-blue-600" />
                        
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                <MessageSquareQuote size={24} className="text-[#A855F7]" />
                                Request Community Help
                            </h2>
                            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Problem Title</label>
                                <input
                                    autoFocus
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g., WebSocket connection failing in production"
                                    className="w-full bg-[#02040a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-[#A855F7]/50 focus:ring-1 focus:ring-[#A855F7]/50 outline-none transition-all placeholder:text-gray-600"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Detailed Description</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Describe your issue in detail so others can help you debug..."
                                    rows={5}
                                    className="w-full bg-[#02040a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-[#A855F7]/50 focus:ring-1 focus:ring-[#A855F7]/50 outline-none transition-all resize-none placeholder:text-gray-600"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Task Difficulty</label>
                                <div className="flex gap-3">
                                    {(["easy", "medium", "hard"] as const).map((level) => {
                                        const styles = {
                                            easy:   { active: "bg-emerald-500/20 border-emerald-500/60 text-emerald-400", idle: "border-white/10 text-slate-500 hover:border-emerald-500/30 hover:text-emerald-400" },
                                            medium: { active: "bg-yellow-500/20 border-yellow-500/60 text-yellow-400",   idle: "border-white/10 text-slate-500 hover:border-yellow-500/30 hover:text-yellow-400" },
                                            hard:   { active: "bg-red-500/20 border-red-500/60 text-red-400",             idle: "border-white/10 text-slate-500 hover:border-red-500/30 hover:text-red-400" },
                                        };
                                        const isActive = difficulty === level;
                                        return (
                                            <button
                                                key={level}
                                                type="button"
                                                onClick={() => setDifficulty(level)}
                                                className={`flex-1 py-2.5 rounded-xl border text-xs font-bold uppercase tracking-widest transition-all ${isActive ? styles[level].active : styles[level].idle}`}
                                            >
                                                {level}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="p-4 bg-[#02040a] border border-white/5 rounded-xl">
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Attached Workspace</div>
                                <div className="text-xs text-cyan-400 font-mono truncate opacity-70">{repoUrl}</div>
                            </div>

                            {error && (
                                <p className="text-red-400 text-xs font-bold text-center animate-shake">{error}</p>
                            )}

                            <button
                                type="submit"
                                disabled={isSubmitting || !title || !description}
                                className="w-full py-4 bg-[#A855F7] hover:bg-[#9333ea] text-[#02040a] font-bold rounded-xl transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(168,85,247,0.3)] disabled:opacity-50 disabled:cursor-not-allowed group"
                            >
                                {isSubmitting ? (
                                    <Loader2 size={20} className="animate-spin" />
                                ) : (
                                    <>
                                        Post to Community <Send size={18} className="group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

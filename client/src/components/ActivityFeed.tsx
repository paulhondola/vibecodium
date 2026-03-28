import { useState, useEffect } from "react";
import { History, Loader2, RefreshCw, GitCommit } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth0 } from "@auth0/auth0-react";
import { API_BASE } from "@/lib/config";

interface GitHubCommit {
    sha: string;
    message: string;
    author: {
        name: string;
        avatar: string | null;
    };
    date: string;
}

export default function ActivityFeed({ projectId }: { projectId: string | null }) {
    const [commits, setCommits] = useState<GitHubCommit[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { getAccessTokenSilently } = useAuth0();

    const fetchCommits = async () => {
        if (!projectId) return;

        setIsLoading(true);
        setError(null);

        try {
            const token = await getAccessTokenSilently();
            const res = await fetch(`${API_BASE}/api/projects/${projectId}/commits`, {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Failed to fetch GitHub commits");
            }

            const data = await res.json();
            if (data.success && data.commits) {
                setCommits(data.commits);
            } else {
                setCommits([]);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCommits();
    }, [projectId, getAccessTokenSilently]);

    return (
        <div className="flex flex-col h-full bg-[#09090b] text-[#c9d1d9] text-sm font-sans relative">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-[#27272a] shrink-0 sticky top-0 bg-[#09090b]/95 backdrop-blur z-20">
                <div className="flex items-center gap-2">
                    <History size={15} className="text-purple-400" />
                    <h2 className="font-semibold text-xs tracking-widest uppercase text-gray-300">Activity Timeline</h2>
                </div>
                <button
                    onClick={fetchCommits}
                    disabled={isLoading || !projectId}
                    className="p-1 text-gray-400 hover:text-white bg-transparent hover:bg-[#27272a] rounded transition-colors"
                    title="Refresh Activity"
                >
                    <RefreshCw size={14} className={`${isLoading ? "animate-spin text-purple-400" : ""}`} />
                </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto relative no-scrollbar pb-6 p-4">
                {isLoading && commits.length === 0 && (
                    <div className="flex justify-center items-center mt-10 text-gray-500 gap-2">
                        <Loader2 size={16} className="animate-spin text-purple-400" />
                        <span className="text-xs">Syncing with GitHub...</span>
                    </div>
                )}

                {!isLoading && error && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-md mx-auto text-center font-mono">
                        {error}
                    </div>
                )}

                {!isLoading && !error && commits.length === 0 && (
                    <div className="text-center mt-10 text-xs text-gray-500">
                        No recent activity found.
                    </div>
                )}

                {commits.length > 0 && (
                    <div className="relative flex flex-col pt-2">
                        {/* Timeline tracking line */}
                        <div className="absolute top-0 bottom-0 left-[19px] w-px bg-gradient-to-b from-purple-500/40 to-transparent pointer-events-none" />

                        <AnimatePresence>
                            {commits.map((commit, index) => (
                                <motion.div
                                    key={commit.sha}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="flex gap-4 group mb-6 relative"
                                >
                                    {/* Timeline Node */}
                                    <div className="relative flex-none mt-1">
                                        <div className="w-10 h-10 rounded-full border-4 border-[#09090b] bg-[#18181b] flex items-center justify-center shrink-0 z-10 relative overflow-hidden shadow-sm shadow-purple-900/20">
                                            {commit.author.avatar ? (
                                                <img src={commit.author.avatar} alt={commit.author.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <GitCommit size={14} className="text-purple-400/80" />
                                            )}
                                        </div>
                                    </div>

                                    {/* Commit Card */}
                                    <div className="flex-1 min-w-0 bg-[#18181b] border border-[#27272a] rounded-lg p-3 hover:border-purple-500/40 transition-colors cursor-default shadow-sm relative before:absolute before:content-[''] before:top-4 before:-left-[5px] before:w-[9px] before:h-[9px] before:bg-[#18181b] before:border-l before:border-b before:border-[#27272a] before:rotate-45 group-hover:before:border-purple-500/40 before:transition-colors">
                                        <div className="text-[13px] font-semibold text-gray-200 truncate pr-2">
                                            {commit.message}
                                        </div>
                                        <div className="flex items-center justify-between text-[11px] text-gray-500 mt-2 font-mono">
                                            <div className="flex items-center gap-1.5 truncate">
                                                <span className="text-gray-400">{commit.author.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-purple-300 bg-purple-500/10 px-1.5 rounded">{commit.sha.substring(0, 7)}</span>
                                                <span className="text-gray-500 shrink-0">
                                                    {formatDistanceToNow(new Date(commit.date), { addSuffix: true })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
}

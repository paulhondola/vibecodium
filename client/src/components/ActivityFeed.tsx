import { useState, useEffect, useCallback } from "react";
import { History, Loader2, RefreshCw, GitCommit, ChevronDown, ChevronRight, FilePlus, FileMinus, FileEdit } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthProvider";
import { API_BASE } from "@/lib/config";

interface CommitFile {
    filename: string;
    status: "added" | "removed" | "modified" | "renamed" | "copied" | string;
    additions: number;
    deletions: number;
}

interface CommitDetail {
    files: CommitFile[];
    stats: { additions: number; deletions: number; total: number };
}

interface GitHubCommit {
    sha: string;
    message: string;
    author: {
        name: string;
        avatar: string | null;
    };
    date: string;
}

function FileStatusIcon({ status }: { status: string }) {
    if (status === "added") return <FilePlus size={10} className="text-green-400 shrink-0" />;
    if (status === "removed") return <FileMinus size={10} className="text-red-400 shrink-0" />;
    return <FileEdit size={10} className="text-blue-400 shrink-0" />;
}

function FileStatusBadge({ status }: { status: string }) {
    const map: Record<string, { label: string; cls: string }> = {
        added: { label: "A", cls: "text-green-400 bg-green-500/10" },
        removed: { label: "D", cls: "text-red-400 bg-red-500/10" },
        modified: { label: "M", cls: "text-blue-400 bg-blue-500/10" },
        renamed: { label: "R", cls: "text-yellow-400 bg-yellow-500/10" },
    };
    const s = map[status] ?? { label: "?", cls: "text-zinc-400 bg-zinc-500/10" };
    return (
        <span className={`text-[9px] font-bold px-1 rounded font-mono ${s.cls}`}>{s.label}</span>
    );
}

function CommitCard({
    commit,
    projectId,
    getToken,
}: {
    commit: GitHubCommit;
    projectId: string;
    getToken: () => Promise<string>;
}) {
    const [expanded, setExpanded] = useState(false);
    const [detail, setDetail] = useState<CommitDetail | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    const loadDetail = useCallback(async () => {
        if (detail) return;
        setLoadingDetail(true);
        try {
            const token = await getToken();
            const res = await fetch(`${API_BASE}/api/projects/${projectId}/commits/${commit.sha}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                if (data.success) setDetail(data);
            }
        } finally {
            setLoadingDetail(false);
        }
    }, [detail, commit.sha, projectId, getToken]);

    const toggle = () => {
        if (!expanded) loadDetail();
        setExpanded(p => !p);
    };

    return (
        <div className="flex gap-3 group mb-4 relative">
            {/* Avatar */}
            <div className="relative flex-none mt-0.5">
                <div className="w-8 h-8 rounded-full border-2 border-[#09090b] bg-[#18181b] flex items-center justify-center shrink-0 z-10 relative overflow-hidden">
                    {commit.author.avatar ? (
                        <img src={commit.author.avatar} alt={commit.author.name} className="w-full h-full object-cover" />
                    ) : (
                        <GitCommit size={12} className="text-purple-400/80" />
                    )}
                </div>
            </div>

            {/* Card */}
            <div className="flex-1 min-w-0 bg-[#18181b] border border-[#27272a] rounded-lg hover:border-purple-500/30 transition-colors shadow-sm">
                {/* Header row — click to expand */}
                <button
                    onClick={toggle}
                    className="w-full flex items-start gap-2 p-2.5 text-left"
                >
                    <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-gray-200 truncate leading-snug">
                            {commit.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-[10px] text-gray-500">{commit.author.name}</span>
                            <span className="text-purple-300 bg-purple-500/10 px-1.5 rounded text-[10px] font-mono">
                                {commit.sha.substring(0, 7)}
                            </span>
                            <span className="text-[10px] text-gray-600">
                                {formatDistanceToNow(new Date(commit.date), { addSuffix: true })}
                            </span>
                        </div>
                    </div>
                    <div className="shrink-0 mt-0.5 text-zinc-600">
                        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </div>
                </button>

                {/* Expanded: file list */}
                <AnimatePresence>
                    {expanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="overflow-hidden border-t border-[#27272a]"
                        >
                            {loadingDetail ? (
                                <div className="flex items-center gap-2 p-2.5 text-zinc-600 text-[10px]">
                                    <Loader2 size={10} className="animate-spin" /> Loading changes…
                                </div>
                            ) : detail ? (
                                <div className="p-2 space-y-px">
                                    {/* Stats summary */}
                                    <div className="flex items-center gap-2 px-1 pb-1.5 border-b border-[#27272a] mb-1">
                                        <span className="text-[10px] text-green-400 font-mono">+{detail.stats.additions}</span>
                                        <span className="text-[10px] text-red-400 font-mono">-{detail.stats.deletions}</span>
                                        <span className="text-[10px] text-zinc-600">{detail.files.length} file{detail.files.length !== 1 ? "s" : ""}</span>
                                    </div>
                                    {detail.files.map(f => (
                                        <div key={f.filename} className="flex items-center gap-1.5 px-1 py-0.5 rounded hover:bg-[#27272a] transition-colors">
                                            <FileStatusIcon status={f.status} />
                                            <span className="text-[10px] font-mono text-zinc-400 truncate flex-1 min-w-0">
                                                {f.filename}
                                            </span>
                                            <FileStatusBadge status={f.status} />
                                            <span className="text-[9px] font-mono text-green-400/70 shrink-0">+{f.additions}</span>
                                            <span className="text-[9px] font-mono text-red-400/70 shrink-0">-{f.deletions}</span>
                                        </div>
                                    ))}
                                    {detail.files.length === 0 && (
                                        <p className="text-[10px] text-zinc-600 px-1">No file changes recorded.</p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-[10px] text-zinc-600 p-2.5">Could not load changes.</p>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

export default function ActivityFeed({ projectId }: { projectId: string | null }) {
    const [commits, setCommits] = useState<GitHubCommit[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { getAccessTokenSilently } = useAuth();
    const getToken = useCallback(() => getAccessTokenSilently(), [getAccessTokenSilently]);

    const fetchCommits = useCallback(async () => {
        if (!projectId) return;
        setIsLoading(true);
        setError(null);
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch(`${API_BASE}/api/projects/${projectId}/commits`, {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Failed to fetch GitHub commits");
            }
            const data = await res.json();
            setCommits(data.success && data.commits ? data.commits : []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [projectId, getAccessTokenSilently]);

    useEffect(() => {
        fetchCommits();
    }, [fetchCommits]);

    return (
        <div className="flex flex-col h-full bg-[#09090b] text-[#c9d1d9] text-sm font-sans relative">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-[#27272a] shrink-0 sticky top-0 bg-[#09090b] z-20">
                <div className="flex items-center gap-2">
                    <History size={15} className="text-purple-400" />
                    <h2 className="font-semibold text-xs tracking-widest uppercase text-gray-300">Commit History</h2>
                </div>
                <button
                    onClick={fetchCommits}
                    disabled={isLoading || !projectId}
                    className="p-1 text-gray-400 hover:text-white bg-transparent hover:bg-[#27272a] rounded transition-colors"
                    title="Refresh"
                >
                    <RefreshCw size={14} className={isLoading ? "animate-spin text-purple-400" : ""} />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-3 pb-6">
                {isLoading && commits.length === 0 && (
                    <div className="flex justify-center items-center mt-10 text-gray-500 gap-2">
                        <Loader2 size={16} className="animate-spin text-purple-400" />
                        <span className="text-xs">Syncing with GitHub…</span>
                    </div>
                )}

                {!isLoading && error && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-md font-mono">
                        {error}
                    </div>
                )}

                {!isLoading && !error && commits.length === 0 && (
                    <div className="text-center mt-10 text-xs text-gray-500">No commits found.</div>
                )}

                {commits.length > 0 && (
                    <div className="relative pt-1">
                        {/* Timeline line */}
                        <div className="absolute top-0 bottom-0 left-[15px] w-px bg-gradient-to-b from-purple-500/30 to-transparent pointer-events-none" />
                        {commits.map(commit => (
                            <CommitCard
                                key={commit.sha}
                                commit={commit}
                                projectId={projectId!}
                                getToken={getToken}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

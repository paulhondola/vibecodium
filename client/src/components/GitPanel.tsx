import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import {
    GitBranch, GitCommit, ChevronDown, ChevronRight,
    Plus, Minus, RotateCcw, RefreshCw, Loader2, X,
    GitMerge, AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE } from "@/lib/config";
import ActivityFeed from "./ActivityFeed";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChangedFile {
    path: string;
    stagedStatus: string;   // M | A | D | R | ''
    unstagedStatus: string; // M | A | D | U | ''
    additions?: number;
    deletions?: number;
}

export interface GitPanelProps {
    projectId: string | null;
    getToken: () => Promise<string>;
    onBranchChange?: (branch: string) => void;
    onTokenRequired?: (type: "GITHUB", message: string) => void;
    onDiffOpen?: (filePath: string, status: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseGitStatus(output: string): ChangedFile[] {
    const result: ChangedFile[] = [];
    for (const line of output.split("\n")) {
        if (line.length < 3) continue;
        const X = line[0];
        const Y = line[1];
        const filePath = line.slice(3).trim();
        if (!filePath) continue;
        result.push({
            path: filePath,
            stagedStatus: X !== " " && X !== "?" ? X : "",
            unstagedStatus: X === "?" && Y === "?" ? "U" : Y !== " " ? Y : "",
        });
    }
    return result;
}

function parseNumstat(output: string): Map<string, { add: number; del: number }> {
    const map = new Map<string, { add: number; del: number }>();
    for (const line of output.split("\n").filter(Boolean)) {
        const parts = line.split("\t");
        if (parts.length < 3) continue;
        const add = parseInt(parts[0]) || 0;
        const del = parseInt(parts[1]) || 0;
        map.set(parts[2].trim(), { add, del });
    }
    return map;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
    M: { label: "M", color: "text-blue-400"   },
    A: { label: "A", color: "text-green-400"  },
    D: { label: "D", color: "text-red-400"    },
    R: { label: "R", color: "text-orange-400" },
    U: { label: "U", color: "text-yellow-400" },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({
    label, count, open, onToggle, extra,
}: {
    label: string; count?: number; open: boolean;
    onToggle: () => void; extra?: ReactNode;
}) {
    return (
        <button
            onClick={onToggle}
            className="w-full flex items-center gap-1.5 px-2 py-1.5 hover:bg-[#1a1a1e] transition-colors text-left select-none"
        >
            {open
                ? <ChevronDown size={10} className="text-zinc-600 shrink-0" />
                : <ChevronRight size={10} className="text-zinc-600 shrink-0" />
            }
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold flex-1">
                {label}
                {count !== undefined && count > 0 && (
                    <span className="ml-1.5 text-[#A855F7] font-bold normal-case tracking-normal">{count}</span>
                )}
            </span>
            {extra && <span onClick={e => e.stopPropagation()}>{extra}</span>}
        </button>
    );
}

function SubHeader({
    label, count, open, onToggle, action,
}: {
    label: string; count?: number; open: boolean;
    onToggle: () => void; action?: ReactNode;
}) {
    return (
        <div className="flex items-center gap-1 pl-4 pr-2 py-[3px] hover:bg-[#1a1a1e] transition-colors">
            <button onClick={onToggle} className="flex items-center gap-1 flex-1 min-w-0">
                {open
                    ? <ChevronDown size={9} className="text-zinc-600 shrink-0" />
                    : <ChevronRight size={9} className="text-zinc-600 shrink-0" />
                }
                <span className="text-[10px] text-zinc-500 font-medium">
                    {label}
                    {count !== undefined && (
                        <span className={`ml-1 ${count > 0 ? "text-zinc-400" : "text-zinc-600"}`}>{count}</span>
                    )}
                </span>
            </button>
            {action && <span onClick={e => e.stopPropagation()}>{action}</span>}
        </div>
    );
}

function FileRow({
    file, staged, loading,
    onStage, onUnstage, onRevert, onClick,
}: {
    file: ChangedFile; staged: boolean; loading?: boolean;
    onStage?: () => void; onUnstage?: () => void;
    onRevert?: () => void; onClick?: () => void;
}) {
    const [confirmRevert, setConfirmRevert] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const status = staged ? file.stagedStatus : file.unstagedStatus;
    const meta = STATUS_META[status] ?? { label: "?", color: "text-zinc-500" };

    const parts = file.path.split("/");
    const fileName = parts[parts.length - 1];
    const dir = parts.length > 1 ? parts.slice(0, -1).join("/") + "/" : "";

    const startRevert = (e: React.MouseEvent) => {
        e.stopPropagation();
        setConfirmRevert(true);
        timerRef.current = setTimeout(() => setConfirmRevert(false), 3000);
    };
    const doRevert = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (timerRef.current) clearTimeout(timerRef.current);
        setConfirmRevert(false);
        onRevert?.();
    };

    return (
        <div
            onClick={onClick}
            title={file.path}
            className="group flex items-center gap-1.5 pl-5 pr-2 py-[3px] hover:bg-[#1e1e24] transition-colors cursor-pointer"
        >
            {/* Status letter */}
            {loading
                ? <Loader2 size={9} className="shrink-0 animate-spin text-zinc-500" />
                : <span className={`shrink-0 text-[10px] font-bold font-mono w-3 text-center ${meta.color}`}>{meta.label}</span>
            }

            {/* Filename + dir */}
            <span className="flex-1 min-w-0 text-[11px] font-mono truncate">
                <span className="text-zinc-200">{fileName}</span>
                {dir && <span className="text-zinc-600">{dir}</span>}
            </span>

            {/* Diff stats */}
            {(file.additions !== undefined || file.deletions !== undefined) && !loading && (
                <span className="text-[9px] font-mono shrink-0 opacity-60 group-hover:opacity-0 transition-opacity">
                    {file.additions !== undefined && <span className="text-green-500">+{file.additions}</span>}
                    {file.deletions !== undefined && <span className="text-red-500 ml-0.5">-{file.deletions}</span>}
                </span>
            )}

            {/* Action buttons — visible on hover */}
            <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {staged
                    ? onUnstage && (
                        <button onClick={e => { e.stopPropagation(); onUnstage(); }}
                            className="p-0.5 rounded hover:bg-amber-500/20 hover:text-amber-400 text-zinc-600 transition-colors"
                            title="Unstage">
                            <Minus size={11} />
                        </button>
                    )
                    : onStage && (
                        <button onClick={e => { e.stopPropagation(); onStage(); }}
                            className="p-0.5 rounded hover:bg-green-500/20 hover:text-green-400 text-zinc-600 transition-colors"
                            title="Stage">
                            <Plus size={11} />
                        </button>
                    )
                }
                {onRevert && status !== "U" && (
                    confirmRevert
                        ? <button onClick={doRevert}
                            className="px-1 py-0.5 rounded bg-red-500/20 text-red-400 text-[9px] font-bold"
                            title="Confirm discard">
                            ✓
                          </button>
                        : <button onClick={startRevert}
                            className="p-0.5 rounded hover:bg-red-500/20 hover:text-red-400 text-zinc-600 transition-colors"
                            title="Discard changes">
                            <RotateCcw size={10} />
                          </button>
                )}
            </div>
        </div>
    );
}

const slide = {
    open:   { height: "auto" as const, opacity: 1 },
    closed: { height: 0,              opacity: 0 },
};

// ── Main component ────────────────────────────────────────────────────────────

export default function GitPanel({ projectId, getToken, onBranchChange, onTokenRequired, onDiffOpen }: GitPanelProps) {
    const [files, setFiles]                     = useState<ChangedFile[]>([]);
    const [isRefreshing, setIsRefreshing]       = useState(false);
    const [globalError, setGlobalError]         = useState<string | null>(null);
    const [loadingFiles, setLoadingFiles]       = useState<Set<string>>(new Set());

    const [commitMessage, setCommitMessage]     = useState("");
    const [isSaving, setIsSaving]               = useState(false);
    const [commitError, setCommitError]         = useState<string | null>(null);

    const [currentBranch, setCurrentBranch]     = useState("main");
    const [branches, setBranches]               = useState<string[]>([]);
    const [isLoadingBranches, setIsLoadingBranches] = useState(false);
    const [newBranchName, setNewBranchName]     = useState("");
    const [showNewBranchForm, setShowNewBranchForm] = useState(false);
    const [branchError, setBranchError]         = useState<string | null>(null);

    const [sourceOpen, setSourceOpen]           = useState(true);
    const [stagedOpen, setStagedOpen]           = useState(true);
    const [changesOpen, setChangesOpen]         = useState(true);
    const [historyOpen, setHistoryOpen]         = useState(false);
    const [branchesOpen, setBranchesOpen]       = useState(true);

    const getTokenRef = useRef(getToken);
    useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

    // ── Core git helper ───────────────────────────────────────────────────────

    const git = useCallback(async (args: string[]): Promise<{ success: boolean; output: string }> => {
        if (!projectId) return { success: false, output: "No project" };
        const token = await getTokenRef.current();
        const res = await fetch(`${API_BASE}/api/git`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ args, projectId }),
        });
        const data = await res.json();
        if (data.error) return { success: false, output: data.error };
        return data as { success: boolean; output: string };
    }, [projectId]);

    // ── Status + diff stats ───────────────────────────────────────────────────

    const refreshStatus = useCallback(async () => {
        if (!projectId) return;
        setIsRefreshing(true);
        setGlobalError(null);
        try {
            // Run status + numstat in parallel (status triggers sync, numstat reuses warm dir)
            const [statusRes, numstatRes, cachedNumstatRes] = await Promise.all([
                git(["git", "status", "--porcelain"]),
                git(["git", "diff", "--numstat"]),
                git(["git", "diff", "--cached", "--numstat"]),
            ]);

            if (!statusRes.success && statusRes.output) {
                setGlobalError(statusRes.output);
                setIsRefreshing(false);
                return;
            }

            const parsed = parseGitStatus(statusRes.output);
            const unstaged = parseNumstat(numstatRes.output);
            const staged   = parseNumstat(cachedNumstatRes.output);

            const enriched = parsed.map(f => {
                const us = unstaged.get(f.path);
                const st = staged.get(f.path);
                const stats = st ?? us;
                return stats ? { ...f, additions: stats.add, deletions: stats.del } : f;
            });

            setFiles(enriched);
        } catch (e: any) {
            setGlobalError(e.message);
        }
        setIsRefreshing(false);
    }, [projectId, git]);

    const fetchBranches = useCallback(async () => {
        if (!projectId) return;
        setIsLoadingBranches(true);
        const [branchRes, currentRes] = await Promise.all([
            git(["git", "branch"]),
            git(["git", "branch", "--show-current"]),
        ]);
        if (branchRes.success) {
            setBranches(branchRes.output.split("\n").map(b => b.replace(/^\*?\s+/, "").trim()).filter(Boolean));
        }
        if (currentRes.success && currentRes.output) {
            const b = currentRes.output.trim();
            setCurrentBranch(b);
            onBranchChange?.(b);
        }
        setIsLoadingBranches(false);
    }, [projectId, git, onBranchChange]);

    useEffect(() => {
        if (!projectId) return;
        refreshStatus();
        fetchBranches();
    }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── File actions ──────────────────────────────────────────────────────────

    const withFileLoading = async (path: string, fn: () => Promise<void>) => {
        setLoadingFiles(prev => new Set(prev).add(path));
        try { await fn(); } finally {
            setLoadingFiles(prev => { const s = new Set(prev); s.delete(path); return s; });
        }
    };

    const stageFile = (filePath: string) =>
        withFileLoading(filePath, async () => {
            const res = await git(["git", "add", "--", filePath]);
            if (res.success) await refreshStatus();
            else setGlobalError(res.output);
        });

    const unstageFile = (filePath: string) =>
        withFileLoading(filePath, async () => {
            // Try git restore --staged first, fall back to git reset HEAD
            let res = await git(["git", "restore", "--staged", "--", filePath]);
            if (!res.success) res = await git(["git", "reset", "HEAD", "--", filePath]);
            if (res.success) await refreshStatus();
            else setGlobalError(res.output);
        });

    const revertFile = (filePath: string) =>
        withFileLoading(filePath, async () => {
            const res = await git(["git", "checkout", "--", filePath]);
            if (res.success) await refreshStatus();
            else setGlobalError(res.output);
        });

    const stageAll = async () => {
        setIsRefreshing(true);
        const res = await git(["git", "add", "."]);
        if (!res.success) setGlobalError(res.output);
        await refreshStatus();
    };

    const unstageAll = async () => {
        setIsRefreshing(true);
        let res = await git(["git", "restore", "--staged", "."]);
        if (!res.success) res = await git(["git", "reset", "HEAD"]);
        if (!res.success) setGlobalError(res.output);
        await refreshStatus();
    };

    // ── Branch actions ────────────────────────────────────────────────────────

    const handleCheckout = async (branch: string) => {
        if (branch === currentBranch) return;
        setBranchError(null);
        const res = await git(["git", "checkout", branch]);
        if (res.success) {
            setCurrentBranch(branch);
            onBranchChange?.(branch);
            await refreshStatus();
        } else {
            setBranchError(res.output || "Checkout failed");
        }
    };

    const handleCreateBranch = async () => {
        const name = newBranchName.trim();
        if (!name || !projectId) return;
        setBranchError(null);
        const token = await getTokenRef.current();
        const res = await fetch(`${API_BASE}/api/projects/${projectId}/branches`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ name }),
        });
        const data = await res.json();
        if (data.success) {
            setNewBranchName("");
            setShowNewBranchForm(false);
            setCurrentBranch(name);
            onBranchChange?.(name);
            await fetchBranches();
        } else {
            setBranchError(data.error || "Failed to create branch");
        }
    };

    const handleDeleteBranch = async (branch: string) => {
        if (branch === currentBranch) return;
        const res = await git(["git", "branch", "-d", branch]);
        if (res.success) await fetchBranches();
        else setBranchError(res.output || "Delete failed");
    };

    // ── Commit & Push ─────────────────────────────────────────────────────────

    const handleCommitPush = async () => {
        if (!projectId) return;
        setIsSaving(true);
        setCommitError(null);
        const token = await getTokenRef.current();
        const payload: Record<string, string> = { branch: currentBranch };
        if (commitMessage.trim()) payload.message = commitMessage.trim();
        const res = await fetch(`${API_BASE}/api/projects/${projectId}/push`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success) {
            setCommitMessage("");
            await refreshStatus();
        } else if (data.error === "GITHUB_TOKEN_REQUIRED") {
            onTokenRequired?.("GITHUB", data.message);
        } else {
            setCommitError(data.error || "Push failed");
        }
        setIsSaving(false);
    };

    // ── Derived ───────────────────────────────────────────────────────────────

    const staged   = files.filter(f => f.stagedStatus   !== "");
    const unstaged = files.filter(f => f.unstagedStatus !== "");

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col h-full overflow-y-auto no-scrollbar">

            {/* ══ SOURCE CONTROL ══════════════════════════════════════════ */}
            <div className="border-b border-[#27272a]">
                <SectionHeader
                    label="Source Control"
                    count={files.length}
                    open={sourceOpen}
                    onToggle={() => setSourceOpen(p => !p)}
                    extra={
                        <button onClick={refreshStatus} disabled={isRefreshing}
                            className="p-1 rounded text-zinc-600 hover:text-zinc-300 hover:bg-[#27272a] transition-colors"
                            title="Refresh">
                            <RefreshCw size={11} className={isRefreshing ? "animate-spin" : ""} />
                        </button>
                    }
                />

                <AnimatePresence initial={false}>
                {sourceOpen && (
                    <motion.div key="sc" initial="closed" animate="open" exit="closed"
                        variants={slide} transition={{ duration: 0.15 }} className="overflow-hidden">

                        {/* Commit input */}
                        <div className="px-3 pt-2 pb-3 space-y-2">
                            <textarea
                                value={commitMessage}
                                onChange={e => setCommitMessage(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                        e.preventDefault();
                                        handleCommitPush();
                                    }
                                }}
                                placeholder="Commit message (Ctrl+↵ to push)…"
                                rows={3}
                                className="w-full bg-[#111113] border border-[#27272a] focus:border-[#A855F7]/40 rounded-[5px] px-2.5 py-2 text-xs text-zinc-300 placeholder:text-zinc-600 resize-none focus:outline-none transition-colors"
                            />
                            {commitError && (
                                <div className="flex items-start gap-1.5 text-[10px] text-red-400 font-mono bg-red-500/10 border border-red-500/20 rounded px-2 py-1.5">
                                    <AlertCircle size={10} className="shrink-0 mt-0.5" />{commitError}
                                </div>
                            )}
                            <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
                                <GitBranch size={9} className="text-[#A855F7] shrink-0" />
                                <span>→ <span className="text-[#A855F7] font-mono">{currentBranch}</span></span>
                            </div>
                            <button className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#27272a] hover:bg-[#3f3f46] text-zinc-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={handleCommitPush} disabled={isSaving}>
                                {isSaving ? <Loader2 size={12} className="animate-spin" /> : <GitCommit size={12} />} Commit &amp; Push
                            </button>
                        </div>

                        {/* Global git error */}
                        {globalError && (
                            <div className="mx-3 mb-2 flex items-start gap-1.5 text-[10px] text-red-400 font-mono bg-red-500/10 border border-red-500/20 rounded px-2 py-1.5">
                                <AlertCircle size={10} className="shrink-0 mt-0.5" />
                                <span className="break-all">{globalError}</span>
                                <button onClick={() => setGlobalError(null)} className="ml-auto shrink-0"><X size={9} /></button>
                            </div>
                        )}

                        {/* ── Staged Changes ── */}
                        <div className="border-t border-[#27272a]">
                            <SubHeader
                                label="Staged Changes" count={staged.length}
                                open={stagedOpen} onToggle={() => setStagedOpen(p => !p)}
                                action={staged.length > 0 && (
                                    <button onClick={unstageAll}
                                        className="p-0.5 rounded text-zinc-600 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                                        title="Unstage all">
                                        <Minus size={10} />
                                    </button>
                                )}
                            />
                            <AnimatePresence initial={false}>
                            {stagedOpen && (
                                <motion.div key="staged" initial="closed" animate="open" exit="closed"
                                    variants={slide} transition={{ duration: 0.1 }} className="overflow-hidden">
                                    {staged.length === 0
                                        ? <p className="pl-8 py-1 text-[10px] text-zinc-600 italic">Nothing staged</p>
                                        : staged.map(f => (
                                            <FileRow key={`s-${f.path}`} file={f} staged
                                                loading={loadingFiles.has(f.path)}
                                                onUnstage={() => unstageFile(f.path)}
                                                onRevert={() => revertFile(f.path)}
                                                onClick={() => onDiffOpen?.(f.path, f.stagedStatus)}
                                            />
                                        ))
                                    }
                                </motion.div>
                            )}
                            </AnimatePresence>
                        </div>

                        {/* ── Changes (unstaged) ── */}
                        <div className="border-t border-[#27272a]">
                            <SubHeader
                                label="Changes" count={unstaged.length}
                                open={changesOpen} onToggle={() => setChangesOpen(p => !p)}
                                action={unstaged.length > 0 && (
                                    <button onClick={stageAll}
                                        className="p-0.5 rounded text-zinc-600 hover:text-green-400 hover:bg-green-500/10 transition-colors"
                                        title="Stage all">
                                        <Plus size={10} />
                                    </button>
                                )}
                            />
                            <AnimatePresence initial={false}>
                            {changesOpen && (
                                <motion.div key="unstaged" initial="closed" animate="open" exit="closed"
                                    variants={slide} transition={{ duration: 0.1 }} className="overflow-hidden">
                                    {isRefreshing && unstaged.length === 0 && files.length === 0
                                        ? <div className="pl-8 py-1.5 flex items-center gap-1.5 text-[10px] text-zinc-600">
                                            <Loader2 size={9} className="animate-spin" /> Scanning…
                                          </div>
                                        : unstaged.length === 0
                                            ? <p className="pl-8 py-1 text-[10px] text-zinc-600 italic">No changes</p>
                                            : unstaged.map(f => (
                                                <FileRow key={`u-${f.path}`} file={f} staged={false}
                                                    loading={loadingFiles.has(f.path)}
                                                    onStage={() => stageFile(f.path)}
                                                    onRevert={f.unstagedStatus !== "U" ? () => revertFile(f.path) : undefined}
                                                    onClick={() => onDiffOpen?.(f.path, f.unstagedStatus)}
                                                />
                                            ))
                                    }
                                </motion.div>
                            )}
                            </AnimatePresence>
                        </div>

                    </motion.div>
                )}
                </AnimatePresence>
            </div>

            {/* ══ BRANCHES ════════════════════════════════════════════════ */}
            <div className="border-b border-[#27272a]">
                <SectionHeader
                    label="Branches"
                    open={branchesOpen}
                    onToggle={() => setBranchesOpen(p => !p)}
                    extra={
                        <div className="flex items-center gap-0.5">
                            <button onClick={() => fetchBranches()} disabled={isLoadingBranches}
                                className="p-1 rounded text-zinc-600 hover:text-zinc-300 hover:bg-[#27272a] transition-colors"
                                title="Refresh">
                                <RefreshCw size={10} className={isLoadingBranches ? "animate-spin" : ""} />
                            </button>
                            <button onClick={() => { setShowNewBranchForm(p => !p); setBranchError(null); setNewBranchName(""); }}
                                className="p-1 rounded text-zinc-600 hover:text-zinc-300 hover:bg-[#27272a] transition-colors"
                                title="New branch">
                                <Plus size={10} />
                            </button>
                        </div>
                    }
                />

                <AnimatePresence initial={false}>
                {branchesOpen && (
                    <motion.div key="br" initial="closed" animate="open" exit="closed"
                        variants={slide} transition={{ duration: 0.15 }} className="overflow-hidden">
                        <div className="px-3 pb-3 pt-1 space-y-2">

                            {/* Dropdown */}
                            <div className="relative">
                                <GitBranch size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#A855F7] pointer-events-none z-10" />
                                <select value={currentBranch} onChange={e => handleCheckout(e.target.value)}
                                    disabled={isLoadingBranches}
                                    className="w-full appearance-none bg-[#111113] border border-[#A855F7]/30 hover:border-[#A855F7]/50 focus:border-[#A855F7]/60 rounded-[5px] pl-7 pr-7 py-1.5 text-[11px] text-[#A855F7] font-mono focus:outline-none transition-colors cursor-pointer disabled:opacity-50">
                                    {branches.length > 0
                                        ? branches.map(b => <option key={b} value={b}>{b}</option>)
                                        : <option value={currentBranch}>{currentBranch}</option>
                                    }
                                </select>
                                <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                            </div>

                            {/* New branch form */}
                            <AnimatePresence>
                            {showNewBranchForm && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.12 }}
                                    className="overflow-hidden space-y-1.5">
                                    <input autoFocus value={newBranchName}
                                        onChange={e => setNewBranchName(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === "Enter") handleCreateBranch();
                                            if (e.key === "Escape") { setShowNewBranchForm(false); setNewBranchName(""); }
                                        }}
                                        placeholder="new-branch-name"
                                        className="w-full bg-[#111113] border border-[#27272a] focus:border-purple-500/40 rounded-[5px] px-2.5 py-1.5 text-xs text-zinc-300 placeholder:text-zinc-600 font-mono focus:outline-none transition-colors"
                                    />
                                    <div className="flex gap-1.5">
                                        <button className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-medium bg-[#A855F7]/20 hover:bg-[#A855F7]/30 text-purple-300 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            onClick={handleCreateBranch} disabled={!newBranchName.trim()}>
                                            <GitMerge size={10} /> Create &amp; Push
                                        </button>
                                        <button onClick={() => { setShowNewBranchForm(false); setNewBranchName(""); }}
                                            className="px-2 py-1 text-zinc-500 hover:text-zinc-300 hover:bg-[#27272a] rounded text-[10px] transition-colors">
                                            <X size={11} />
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                            </AnimatePresence>

                            {branchError && (
                                <p className="text-[10px] text-red-400 font-mono bg-red-500/10 border border-red-500/20 px-2 py-1.5 rounded break-all">
                                    {branchError}
                                </p>
                            )}

                            {/* Branch list */}
                            {isLoadingBranches
                                ? <div className="flex items-center gap-1.5 text-zinc-600 text-[10px]">
                                    <Loader2 size={9} className="animate-spin" /> Loading…
                                  </div>
                                : <div className="space-y-px">
                                    {branches.map(branch => (
                                        <div key={branch}
                                            className="group flex items-center gap-1.5 px-1 py-[3px] rounded hover:bg-[#1e1e24] transition-colors">
                                            <GitBranch size={10} className={`shrink-0 ${branch === currentBranch ? "text-[#A855F7]" : "text-zinc-600"}`} />
                                            <span className={`text-[11px] font-mono truncate flex-1 ${branch === currentBranch ? "text-[#A855F7]" : "text-zinc-400"}`}>
                                                {branch}
                                            </span>
                                            {branch !== currentBranch && (
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                    <button onClick={() => handleCheckout(branch)}
                                                        className="text-[9px] px-1.5 py-0.5 rounded bg-[#27272a] hover:bg-[#3f3f46] text-zinc-300 transition-colors">
                                                        checkout
                                                    </button>
                                                    <button onClick={() => handleDeleteBranch(branch)}
                                                        className="p-0.5 rounded hover:bg-red-500/20 text-zinc-600 hover:text-red-400 transition-colors"
                                                        title="Delete">
                                                        <X size={9} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                  </div>
                            }
                        </div>
                    </motion.div>
                )}
                </AnimatePresence>
            </div>

            {/* ══ COMMIT HISTORY ══════════════════════════════════════════ */}
            <div className="border-b border-[#27272a]">
                <SectionHeader label="Commit History" open={historyOpen} onToggle={() => setHistoryOpen(p => !p)} />
                <AnimatePresence initial={false}>
                {historyOpen && (
                    <motion.div key="hist" initial="closed" animate="open" exit="closed"
                        variants={slide} transition={{ duration: 0.15 }} className="overflow-hidden">
                        <div className="max-h-96 overflow-hidden">
                            <ActivityFeed projectId={projectId} />
                        </div>
                    </motion.div>
                )}
                </AnimatePresence>
            </div>

        </div>
    );
}

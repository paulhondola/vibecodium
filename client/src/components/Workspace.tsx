import FileExplorer from "./FileExplorer";
import ActivityFeed from "./ActivityFeed";
import EditorArea from "./EditorArea";
import TerminalArea from "./TerminalArea";
import VibeChat from "./VibeChat";
import ReelsWidget from "./ReelsWidget";
import SecurityScanModal from "./SecurityScanModal";
import CommunityHelpModal from "./CommunityHelpModal";
import RubberDuck from "./RubberDuck";
import WhiteboardArea from "./WhiteboardArea";
import SpotifyPlayer from "./SpotifyPlayer";
import MatrixRain from "./MatrixRain";
import ReactionOverlay from "./ReactionOverlay";
import CodeRoastModal from "./CodeRoastModal";
import { API_BASE } from "@/lib/config";
import { ArrowLeft, Loader2, Users, Check, Flame, GitCommit, PanelLeft, TerminalSquare, PanelRight, Shield, Terminal, Wrench, Key, Rocket, ExternalLink, X, FolderOpen, GitBranch, HelpCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from "react-resizable-panels";
import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthProvider";
import { useNavigate } from "@tanstack/react-router";
import { SocketProvider, useSocket } from "../contexts/SocketProvider";
import type { PendingUpdate, AgentFileAction } from "../hooks/useAgentStream";
import { motion, AnimatePresence } from "framer-motion";

export interface ProjectFile {
    id: string;
    path: string;
    content: string | null;
}

function SidebarTabBtn({ icon, label, active, onClick }: {
    icon: ReactNode; label: string; active: boolean; onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            title={label}
            className={`w-full h-10 flex items-center justify-center transition-colors ${
                active
                    ? 'text-[#fafafa] border-l-2 border-l-[#A855F7]'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-[#1e1e24] border-l-2 border-l-transparent'
            }`}
        >
            {icon}
        </button>
    );
}

function WorkspaceInner({ onBack, projectId }: { onBack: () => void, projectId: string | null }) {
    const navigate = useNavigate();
    const [files, setFiles] = useState<ProjectFile[]>([]);
    const [openFiles, setOpenFiles] = useState<ProjectFile[]>([]);
    const [activeFile, setActiveFile] = useState<ProjectFile | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [projectName, setProjectName] = useState<string | null>(null);
    const [projectRepoUrl, setProjectRepoUrl] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [showCommunityHelp, setShowCommunityHelp] = useState(false);
    const [showReels, setShowReels] = useState(false);
    const [showMatrix, setShowMatrix] = useState(false);
    const [showRoast, setShowRoast] = useState(false);
    const [showPowerMode, setShowPowerMode] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showSecurityScan, setShowSecurityScan] = useState(false);
    const [activeSidebarTab, setActiveSidebarTab] = useState<'explorer' | 'git' | 'tools' | 'fun' | 'help'>('explorer');
    const [commitMessage, setCommitMessage] = useState("");
    const [isTimeTravelOpen, setIsTimeTravelOpen] = useState(false);
    const [showEditorGame, setShowEditorGame] = useState(false);

    // Deployment State
    const [isDeploying, setIsDeploying] = useState(false);
    const [deploySuccess, setDeploySuccess] = useState<{ url: string } | null>(null);
    const [showConfetti, setShowConfetti] = useState(false);
    const [tokenPrompt, setTokenPrompt] = useState<{ type: 'GITHUB' | 'VERCEL'; message: string } | null>(null);

    // Panel toggles
    const [showSidebar, setShowSidebar] = useState(true);
    const [showTerminal, setShowTerminal] = useState(true);
    const [showChat, setShowChat] = useState(true);
    const [showWhiteboard, setShowWhiteboard] = useState(false);

    // Collab
    const { isConnected, lastMessage, send } = useSocket();
    const [collabUsers, setCollabUsers] = useState<{id: string, name: string, color: string, isHost?: boolean}[]>([]);
    const [, setMyColor] = useState("#A855F7");
    const [isHost, setIsHost] = useState(false);

    // Remote editor events — set in onmessage, consumed by EditorArea via props
    const [remoteCodeUpdate, setRemoteCodeUpdate] = useState<{ filePath: string; content: string; clientId: string } | null>(null);
    const [remoteCursorUpdate, setRemoteCursorUpdate] = useState<{ filePath: string; clientId: string; color: string; userName: string; position: { lineNumber: number; column: number } } | null>(null);

    // Agent diff state
    const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate | null>(null);
    const [agentToken, setAgentToken] = useState<string | null>(null);

    const { user, getAccessTokenSilently, isAuthenticated, loginWithRedirect } = useAuth();
    const getTokenRef = useRef(getAccessTokenSilently);
    useEffect(() => { getTokenRef.current = getAccessTokenSilently; }, [getAccessTokenSilently]);

    // 1. Fetch project files from API + store token for agent
    useEffect(() => {
        if (!projectId || !isAuthenticated) return;
        setIsLoading(true);
        let cancelled = false;

        getAccessTokenSilently()
            .then(token => {
                if (cancelled) return;
                setAgentToken(token);
                return fetch(`${API_BASE}/api/projects/${projectId}/files`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            })
            .then(res => res?.json())
            .then(data => {
                if (cancelled || !data) return;
                if (data.success) {
                    setFiles(data.files || []);
                    if (data.files?.length > 0) setActiveFile(data.files[0]);
                    if (data.projectName) setProjectName(data.projectName);
                    if (data.repoUrl) setProjectRepoUrl(data.repoUrl);
                }
                setIsLoading(false);
            })
            .catch(err => {
                if (cancelled) return;
                console.error("Fetch files error:", err);
                setIsLoading(false);
                if (err?.error === 'consent_required' || err?.message?.includes('Consent required')) {
                    loginWithRedirect();
                }
            });

        return () => { cancelled = true; };
    }, [projectId, isAuthenticated, getAccessTokenSilently, loginWithRedirect]);

    // 2. Consume parsed WebSocket messages from SocketProvider
    useEffect(() => {
        const data = lastMessage;
        if (!data) return;

        if (data.type === "connected") {
            setMyColor(data.color);
            setCollabUsers(data.users || []);
            setIsHost(!!data.isHost);
        } else if (data.type === "user_joined") {
            setCollabUsers(prev => prev.some(u => u.id === data.user.id) ? prev : [...prev, data.user]);
        } else if (data.type === "user_left") {
            setCollabUsers(prev => prev.filter(u => u.id !== data.clientId));
        } else if (data.type === "code_update") {
            setRemoteCodeUpdate({ filePath: data.filePath, content: data.content, clientId: data.clientId });
        } else if (data.type === "cursor_update") {
            setRemoteCursorUpdate({ filePath: data.filePath, clientId: data.clientId, color: data.color, userName: data.userName, position: data.position });
        } else if (data.type === "agent_accepted") {
            // Another client accepted a suggestion — apply the change to our local file state
            setFiles(prev => prev.map(f =>
                f.path === data.filePath ? { ...f, content: data.content } : f
            ));
            setRemoteCodeUpdate({ filePath: data.filePath, content: data.content, clientId: data.appliedBy ?? "agent" });
            setPendingUpdate(null);
        } else if (data.type === "host_changed") {
            // New host assignment from backend
        }
        // emoji_reaction: handled directly in ReactionOverlay via lastMessage prop
    }, [lastMessage]);

    // Keyboard shortcuts for panel toggles & Zen mode
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if (e.metaKey || e.ctrlKey) {
                if (e.key.toLowerCase() === 'e') {
                    e.preventDefault();
                    setShowSidebar(prev => !prev);
                } else if (e.key.toLowerCase() === 'j') {
                    e.preventDefault();
                    setShowTerminal(prev => !prev);
                } else if (e.key.toLowerCase() === 'b') {
                    e.preventDefault();
                    setShowChat(prev => !prev);
                } else if (e.key.toLowerCase() === 'k') {
                    e.preventDefault();
                    // Zen Mode / Focus Mode
                    const isZen = !showSidebar && !showTerminal && !showChat;
                    setShowSidebar(isZen);
                    setShowTerminal(isZen);
                    setShowChat(isZen);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showSidebar, showTerminal, showChat]);

    const handlePendingUpdate = useCallback((update: PendingUpdate) => {
        setPendingUpdate(update);
    }, []);

    const handleFileAction = useCallback(async (action: AgentFileAction) => {
        if (!projectId || !agentToken) return;

        const base = `${API_BASE}/api/projects/${projectId}`;
        const headers = { "Content-Type": "application/json", Authorization: `Bearer ${agentToken}` };

        if (action.type === "create_file") {
            const res = await fetch(`${base}/files/create`, {
                method: "POST",
                headers,
                body: JSON.stringify({ path: action.filePath, content: action.content ?? "" }),
            });
            if (res.ok) {
                const newFile: ProjectFile = { id: crypto.randomUUID(), path: action.filePath, content: action.content ?? "" };
                setFiles(prev => {
                    if (prev.find(f => f.path === action.filePath)) {
                        return prev.map(f => f.path === action.filePath ? { ...f, content: action.content ?? "" } : f);
                    }
                    return [...prev, newFile];
                });
            }
        } else if (action.type === "delete_file") {
            const res = await fetch(`${base}/files`, {
                method: "DELETE",
                headers,
                body: JSON.stringify({ path: action.filePath }),
            });
            if (res.ok) {
                setFiles(prev => prev.filter(f => f.path !== action.filePath && !f.path.startsWith(action.filePath + "/")));
                setOpenFiles(prev => prev.filter(f => f.path !== action.filePath && !f.path.startsWith(action.filePath + "/")));
                setActiveFile(prev => {
                    if (!prev) return null;
                    if (prev.path === action.filePath || prev.path.startsWith(action.filePath + "/")) return null;
                    return prev;
                });
            }
        } else if (action.type === "rename_file" && action.newPath) {
            const res = await fetch(`${base}/files/rename`, {
                method: "PATCH",
                headers,
                body: JSON.stringify({ oldPath: action.filePath, newPath: action.newPath }),
            });
            if (res.ok) {
                setFiles(prev => prev.map(f => {
                    if (f.path === action.filePath) return { ...f, path: action.newPath! };
                    if (f.path.startsWith(action.filePath + "/")) return { ...f, path: action.newPath! + f.path.slice(action.filePath.length) };
                    return f;
                }));
                setOpenFiles(prev => prev.map(f => {
                    if (f.path === action.filePath) return { ...f, path: action.newPath! };
                    if (f.path.startsWith(action.filePath + "/")) return { ...f, path: action.newPath! + f.path.slice(action.filePath.length) };
                    return f;
                }));
                setActiveFile(prev => {
                    if (!prev) return null;
                    if (prev.path === action.filePath) return { ...prev, path: action.newPath! };
                    if (prev.path.startsWith(action.filePath + "/")) return { ...prev, path: action.newPath! + prev.path.slice(action.filePath.length) };
                    return prev;
                });
            }
        }
    }, [projectId, agentToken]);

    const copyCollabLink = () => {
        const url = `${window.location.origin}/?w=${projectId}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSave = async (message?: string) => {
        if (!projectId || !isAuthenticated) return;
        setIsSaving(true);
        try {
            const token = await getAccessTokenSilently();
            const body = message?.trim() ? JSON.stringify({ message: message.trim() }) : undefined;
            const res = await fetch(`${API_BASE}/api/projects/${projectId}/push`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
                ...(body ? { body } : {}),
            });
            const data = await res.json();
            if (data.success) {
                setCommitMessage("");
            } else {
                if (data.error === "GITHUB_TOKEN_REQUIRED") {
                    setTokenPrompt({ type: 'GITHUB', message: data.message });
                } else {
                    console.error("Save failed:", data.error);
                }
            }
        } catch (e) {
            console.error("Save error:", e);
        }
        setIsSaving(false);
    };

    const handleDeploy = async () => {
        if (!projectId || !isAuthenticated) return;
        setIsDeploying(true);
        setShowTerminal(true); // Show terminal to see logs
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch(`${API_BASE}/api/deploy/${projectId}`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            const data = await res.json();
            if (data.success) {
                setDeploySuccess({ url: data.url });
                setShowConfetti(true);
                setTimeout(() => setShowConfetti(false), 5000);
            } else {
                if (data.error === "VERCEL_TOKEN_REQUIRED") {
                    setTokenPrompt({ type: 'VERCEL', message: data.message });
                } else {
                    console.error("Deploy failed:", data.error);
                }
            }
        } catch (e) {
            console.error("Deploy error:", e);
        }
        setIsDeploying(false);
    };

    const handleSelectFile = (file: ProjectFile) => {
        setOpenFiles(prev => {
            if (!prev.find(f => f.path === file.path)) {
                return [...prev, file];
            }
            return prev;
        });
        setActiveFile(file);
    };

    const handleCloseFile = (file: ProjectFile, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setOpenFiles(prev => {
            const next = prev.filter(f => f.path !== file.path);
            if (activeFile?.path === file.path) {
                if (next.length === 0) {
                    setActiveFile(null);
                } else {
                    const closedIndex = prev.findIndex(f => f.path === file.path);
                    const defaultIndex = Math.max(0, closedIndex - 1);
                    setActiveFile(next[defaultIndex]);
                }
            }
            return next;
        });
    };

    if (isLoading) {
        return (
            <div className="h-screen w-full bg-[#09090b] flex flex-col items-center justify-center gap-4">
                <Loader2 size={32} className="animate-spin text-[#A855F7]" />
                <span className="text-sm text-[#71717a] tracking-[0.15em] uppercase font-medium">Parsing Repository Data...</span>
            </div>
        );
    }

	return (
		<div className="h-screen w-full bg-[#09090b] text-[#c9d1d9] font-sans flex flex-col overflow-hidden selection:bg-cyan-500/30">
			{/* Top Bar */}
			<div className="h-12 bg-[#111113] border-b border-[#27272a] flex items-center justify-between px-4 shrink-0 relative z-20">
				<div className="flex items-center gap-4">
					<button onClick={onBack} className="text-zinc-500 hover:text-zinc-200 transition-colors flex items-center gap-1.5 text-sm">
						<ArrowLeft size={16} /> <span className="hidden sm:block">Back to Home</span>
					</button>
					<div className="w-[1px] h-4 bg-[#27272a]"></div>
					<div className="flex items-center gap-2">
						<span className="font-semibold text-sm text-gray-200">{projectName ?? (projectId ? `Project ${projectId.slice(0, 8)}` : "itec-project")}</span>
                        
                        <div className="ml-6 flex items-center bg-[#09090b] rounded-lg p-0.5 border border-[#27272a]">
                            <button
                                onClick={() => setShowWhiteboard(false)}
                                className={`px-3 py-1 flex items-center gap-2 rounded-md text-xs font-semibold transition-all ${!showWhiteboard ? "bg-[#27272a] text-[#A855F7]" : "text-zinc-500 hover:text-zinc-300"}`}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                                Code
                            </button>
                            <button
                                onClick={() => setShowWhiteboard(true)}
                                className={`px-3 py-1 flex items-center gap-2 rounded-md text-xs font-semibold transition-all ${showWhiteboard ? "bg-[#27272a] text-yellow-400" : "text-zinc-500 hover:text-zinc-300"}`}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                                Whiteboard
                            </button>
                        </div>
					</div>
                        {/* Panel Toggles */}
                        <div className="flex items-center gap-0.5 ml-4 bg-[#09090b] p-0.5 rounded-[5px] border border-[#27272a]">
                            <button onClick={() => setShowSidebar(!showSidebar)} className={`p-1 rounded hover:bg-[#1e1e24] ${showSidebar ? "text-[#A855F7]" : "text-zinc-500"} transition-colors`} title="Toggle Sidebar (⌘E)">
                                <PanelLeft size={14} />
                            </button>
                            <button onClick={() => setShowTerminal(!showTerminal)} className={`p-1 rounded hover:bg-[#1e1e24] ${showTerminal ? "text-[#A855F7]" : "text-zinc-500"} transition-colors`} title="Toggle Terminal (⌘J)">
                                <TerminalSquare size={14} />
                            </button>
                            <button onClick={() => setShowChat(!showChat)} className={`p-1 rounded hover:bg-[#1e1e24] ${showChat ? "text-[#A855F7]" : "text-zinc-500"} transition-colors`} title="Toggle Chat (⌘B)">
                                <PanelRight size={14} />
                            </button>
                        </div>
                        {isHost && (
                            <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                                HOST
                            </span>
                        )}
                        {!isConnected && (
                            <span className="ml-2 flex items-center text-[10px] font-bold text-red-400">
                                <Loader2 size={10} className="animate-spin mr-1" /> Reconnecting...
                            </span>
                        )}
					</div>

				<div className="flex items-center gap-2">
                    {/* Ship to Cloud */}
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={handleDeploy}
                        loading={isDeploying}
                    >
                        <Rocket />
                        Ship to Cloud
                    </Button>

                    {/* Collaborate */}
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={copyCollabLink}
                        className={copied ? "border-emerald-500/40 text-emerald-400 hover:border-emerald-500/60 hover:text-emerald-300" : ""}
                    >
                        {copied ? <Check /> : <Users />}
                        {copied ? "Copied!" : "Collaborate"}
                    </Button>

                    {/* Connected users */}
                    {collabUsers.length > 0 && (
                        <div className="flex -space-x-2">
                            {collabUsers.map(u => (
                                <div key={u.id} title={`${u.name}${u.isHost ? ' (Host)' : ''}`} className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-bold text-white ${u.isHost ? 'border-yellow-400 z-10' : 'border-[#18181b]'}`} style={{ backgroundColor: u.color }}>
                                    {u.name.substring(0, 2).toUpperCase()}
                                </div>
                            ))}
                        </div>
                    )}
				</div>
			</div>

			<div className="flex-1 flex overflow-hidden">
                <PanelGroup orientation="horizontal" className="w-full h-full">
                    {/* Left Sidebar */}
                    {showSidebar && (
                        <>
                            <Panel defaultSize={22} minSize={16} className="flex bg-[#09090b] relative z-10 border-r border-[#27272a]">
                                {/* Activity Bar — VS Code-style icon strip */}
                                <div className="w-10 flex flex-col shrink-0 border-r border-[#27272a] select-none py-1">
                                    <SidebarTabBtn icon={<FolderOpen size={17} />} label="Explorer" active={activeSidebarTab === 'explorer'} onClick={() => setActiveSidebarTab('explorer')} />
                                    <SidebarTabBtn icon={<GitBranch size={17} />} label="Git" active={activeSidebarTab === 'git'} onClick={() => setActiveSidebarTab('git')} />
                                    <SidebarTabBtn icon={<Wrench size={17} />} label="Tools" active={activeSidebarTab === 'tools'} onClick={() => setActiveSidebarTab('tools')} />
                                    <SidebarTabBtn icon={<Sparkles size={17} />} label="Fun" active={activeSidebarTab === 'fun'} onClick={() => setActiveSidebarTab('fun')} />
                                    <SidebarTabBtn icon={<HelpCircle size={17} />} label="Help" active={activeSidebarTab === 'help'} onClick={() => setActiveSidebarTab('help')} />
                                    <div className="flex-1" />
                                </div>
                                {/* Tab Content */}
                                <div className="flex-1 overflow-hidden flex flex-col">
                                    {activeSidebarTab === 'explorer' && (
                                        <FileExplorer files={files} activeFile={activeFile} onSelect={handleSelectFile} projectId={projectId} token={agentToken} onFilesChange={setFiles} />
                                    )}
                                    {activeSidebarTab === 'git' && (
                                        <div className="flex flex-col h-full overflow-hidden">
                                            {/* Commit section */}
                                            <div className="px-3 pt-3 pb-3 border-b border-[#27272a] shrink-0 space-y-2">
                                                <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Source Control</p>
                                                <textarea
                                                    value={commitMessage}
                                                    onChange={e => setCommitMessage(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                                            e.preventDefault();
                                                            handleSave(commitMessage);
                                                        }
                                                    }}
                                                    placeholder="Message (⌘Enter to commit)..."
                                                    rows={2}
                                                    className="w-full bg-[#111113] border border-[#27272a] focus:border-purple-500/40 rounded-[5px] px-2.5 py-2 text-xs text-zinc-300 placeholder:text-zinc-600 resize-none focus:outline-none transition-colors"
                                                />
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    className="w-full"
                                                    onClick={() => handleSave(commitMessage)}
                                                    loading={isSaving}
                                                >
                                                    <GitCommit />
                                                    Commit &amp; Push
                                                </Button>
                                            </div>
                                            {/* Commit history */}
                                            <div className="flex-1 overflow-hidden">
                                                <ActivityFeed projectId={projectId} />
                                            </div>
                                        </div>
                                    )}
                                    {activeSidebarTab === 'tools' && (
                                        <div className="flex flex-col h-full">
                                            <div className="px-3 py-2 border-b border-[#27272a] shrink-0">
                                                <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Developer Tools</p>
                                            </div>
                                            <div className="flex-1 overflow-y-auto p-2 space-y-px">
                                                <button
                                                    onClick={() => setIsTimeTravelOpen(p => !p)}
                                                    className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-[5px] text-left hover:bg-[#1e1e24] transition-colors group ${isTimeTravelOpen ? 'bg-purple-500/10' : ''}`}
                                                >
                                                    <svg className={`shrink-0 mt-0.5 ${isTimeTravelOpen ? 'text-purple-400' : 'text-zinc-500 group-hover:text-zinc-300'}`} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                                    <div>
                                                        <div className={`text-xs font-medium ${isTimeTravelOpen ? 'text-purple-400' : 'text-zinc-300'}`}>Time Travel</div>
                                                        <div className="text-[10px] text-zinc-600 mt-0.5">Scrub file edit history</div>
                                                    </div>
                                                </button>
                                                <button onClick={() => setShowSecurityScan(true)} className="w-full flex items-start gap-2.5 px-3 py-2.5 rounded-[5px] text-left hover:bg-[#1e1e24] transition-colors group">
                                                    <Shield size={13} className="text-zinc-500 shrink-0 mt-0.5 group-hover:text-zinc-300" />
                                                    <div>
                                                        <div className="text-xs font-medium text-zinc-300">Security Scan</div>
                                                        <div className="text-[10px] text-zinc-600 mt-0.5">Analyze for vulnerabilities</div>
                                                    </div>
                                                </button>
                                                <div className="pt-3 px-1 pb-1">
                                                    <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2 px-2">Reactions</p>
                                                    <ReactionOverlay
                                                        lastMessage={lastMessage}
                                                        onSendReaction={(emoji) => send({ type: "emoji_reaction", emoji, sender: user?.name || "Someone" })}
                                                        buttonClassName="w-full text-left text-xs py-2 px-3 flex items-center gap-2 text-purple-400 hover:bg-[#1e1e24] hover:text-purple-300 transition-colors rounded-[5px]"
                                                        pickerPosition="below"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {activeSidebarTab === 'fun' && (
                                        <div className="flex flex-col h-full">
                                            <div className="px-3 py-2 border-b border-[#27272a] shrink-0">
                                                <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Fun &amp; Easter Eggs</p>
                                            </div>
                                            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                                <div className="flex items-center justify-between px-3 py-2.5 rounded-[5px] hover:bg-[#1e1e24] transition-colors cursor-pointer" onClick={() => setShowPowerMode(p => !p)}>
                                                    <div className="flex items-center gap-2.5">
                                                        <span className="text-sm leading-none">⚡</span>
                                                        <div>
                                                            <div className="text-xs font-medium text-zinc-300">Power Mode</div>
                                                            <div className="text-[10px] text-zinc-600">Keystroke sparks</div>
                                                        </div>
                                                    </div>
                                                    <div className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-150 ${showPowerMode ? 'bg-orange-500' : 'bg-[#3f3f46]'}`}>
                                                        <span className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow-sm transition-transform duration-150 ${showPowerMode ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between px-3 py-2.5 rounded-[5px] hover:bg-[#1e1e24] transition-colors cursor-pointer" onClick={() => setShowMatrix(p => !p)}>
                                                    <div className="flex items-center gap-2.5">
                                                        <Terminal size={13} className="text-green-500 shrink-0" />
                                                        <div>
                                                            <div className="text-xs font-medium text-zinc-300">Hacker Mode</div>
                                                            <div className="text-[10px] text-zinc-600">Matrix rain overlay</div>
                                                        </div>
                                                    </div>
                                                    <div className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-150 ${showMatrix ? 'bg-green-500' : 'bg-[#3f3f46]'}`}>
                                                        <span className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow-sm transition-transform duration-150 ${showMatrix ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => setShowEditorGame(p => !p)}
                                                    className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-[5px] text-left hover:bg-[#1e1e24] transition-colors ${showEditorGame ? 'bg-orange-500/10' : ''}`}
                                                >
                                                    <span className="text-sm leading-none shrink-0">🎮</span>
                                                    <div>
                                                        <div className={`text-xs font-medium ${showEditorGame ? 'text-orange-400' : 'text-zinc-300'}`}>Code Runner Game</div>
                                                        <div className="text-[10px] text-zinc-600 mt-0.5">Play in a PIP window</div>
                                                    </div>
                                                </button>
                                                {activeFile && (
                                                    <button onClick={() => setShowRoast(true)} className="w-full flex items-start gap-2.5 px-3 py-2.5 rounded-[5px] text-left hover:bg-[#1e1e24] transition-colors">
                                                        <span className="text-sm leading-none shrink-0">🔥</span>
                                                        <div>
                                                            <div className="text-xs font-medium text-orange-400">Roast My Code</div>
                                                            <div className="text-[10px] text-zinc-600 mt-0.5">Brutal AI code review</div>
                                                        </div>
                                                    </button>
                                                )}
                                                <button onClick={() => setShowReels(true)} className="w-full flex items-start gap-2.5 px-3 py-2.5 rounded-[5px] text-left hover:bg-[#1e1e24] transition-colors">
                                                    <Flame size={13} className="text-pink-400 shrink-0 mt-0.5" />
                                                    <div>
                                                        <div className="text-xs font-medium text-pink-400">Vibe Reels</div>
                                                        <div className="text-[10px] text-zinc-600 mt-0.5">Watch dev content</div>
                                                    </div>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    {activeSidebarTab === 'help' && (
                                        <div className="flex flex-col h-full">
                                            <div className="px-3 py-2 border-b border-[#27272a] shrink-0">
                                                <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Community Help</p>
                                            </div>
                                            <div className="p-3 space-y-3">
                                                <p className="text-[11px] text-zinc-500 leading-relaxed">Post your issue to the community and get help from other developers.</p>
                                                <Button variant="primary" className="w-full" onClick={() => setShowCommunityHelp(true)}>
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                                                    Request Help
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </Panel>
                            <PanelResizeHandle className="w-1 hover:bg-purple-500/30 transition-colors z-50 cursor-col-resize" />
                        </>
                    )}

                    {/* Center Area */}
                    <Panel defaultSize={55} className="flex flex-col min-w-0 bg-[#09090b] relative">
                        <PanelGroup orientation="vertical" className="w-full h-full">
                            <Panel defaultSize={showTerminal ? 70 : 100} minSize={30} className="relative overflow-hidden">
                                {showWhiteboard ? (
                                    <div className="w-full h-full bg-[#1e1e24] overflow-hidden flex flex-col">
                                        <WhiteboardArea projectId={projectId} />
                                    </div>
                                ) : (
                                    <EditorArea
                                        openFiles={openFiles}
                                        activeFile={activeFile}
                                        onSelectFile={handleSelectFile}
                                        onCloseFile={handleCloseFile}
                                        userId={user?._raw.id ? `${user._raw.id}_local` : "anon_local"}
                                        remoteCodeUpdate={remoteCodeUpdate}
                                        remoteCursorUpdate={remoteCursorUpdate}
                                        pendingUpdate={pendingUpdate}
                                        onPendingResolved={() => setPendingUpdate(null)}
                                        projectId={projectId}
                                        agentToken={agentToken}
                                        powerModeEnabled={showPowerMode}
                                        timeTravelOpen={isTimeTravelOpen}
                                        onTimeTravelChange={setIsTimeTravelOpen}
                                        gameOpen={showEditorGame}
                                        onGameChange={setShowEditorGame}
                                    />
                                )}
                            </Panel>
                            
                            {showTerminal && (
                                <>
                                    <PanelResizeHandle className="h-1 bg-[#27272a] hover:bg-purple-500/30 transition-colors z-50 cursor-row-resize" />
                                    <Panel defaultSize={30} minSize={15} className="relative bg-[#09090b] overflow-hidden">
                                        <TerminalArea projectId={projectId} />
                                    </Panel>
                                </>
                            )}
                        </PanelGroup>
                    </Panel>

                    {/* Right Sidebar */}
                    {showChat && (
                        <>
                            <PanelResizeHandle className="w-1 hover:bg-purple-500/30 transition-colors z-50 cursor-col-resize border-l border-[#27272a]" />
                            <Panel defaultSize={25} minSize={20} className="flex flex-col bg-[#18181b] relative z-10 shadow-[-5px_0_15px_rgba(0,0,0,0.5)]">
                                <VibeChat
                                    activeFile={activeFile}
                                    projectId={projectId}
                                    token={agentToken}
                                    onPendingUpdate={handlePendingUpdate}
                                    onFileAction={handleFileAction}
                                />
                            </Panel>
                        </>
                    )}
                </PanelGroup>
			</div>
            
            <RubberDuck />

            {/* Token Requirement Prompt */}
            <AnimatePresence>
                {tokenPrompt && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 px-4">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-[#18181b] border border-[#3f3f46] rounded-[14px] p-8 max-w-md w-full text-center relative"
                        >
                            <div className="flex justify-center mb-6">
                                <div className="w-16 h-16 rounded-full bg-[#A855F7]/10 flex items-center justify-center border border-[#A855F7]/20">
                                    <Key size={32} className="text-[#A855F7]" />
                                </div>
                            </div>
                            <h2 className="text-xl font-bold text-white mb-3">Integrations Required</h2>
                            <p className="text-gray-400 text-sm mb-8 leading-relaxed">
                                {tokenPrompt.message}
                            </p>

                            <div className="flex flex-col gap-3">
                                <Button
                                    variant="primary"
                                    className="w-full"
                                    onClick={() => navigate({ to: "/profile" })}
                                >
                                    Go to Profile to Register
                                </Button>
                                <Button
                                    variant="ghost"
                                    className="w-full"
                                    onClick={() => setTokenPrompt(null)}
                                >
                                    Maybe Later
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Deployment Success Modal */}

            <AnimatePresence>
                {deploySuccess && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 px-4">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-[#18181b] border border-[#3f3f46] rounded-[14px] p-8 max-w-md w-full text-center relative overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-full h-1 bg-green-500" />
                            <div className="flex justify-center mb-6">
                                <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20">
                                    <Rocket size={40} className="text-green-500" />
                                </div>
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">Deployed Successfully!</h2>
                            <p className="text-gray-400 text-sm mb-6">Your project is now live on Railway with zero downtime.</p>
                            
                            <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-4 flex items-center justify-between mb-8 group hover:border-green-500/30 transition-colors">
                                <div className="flex flex-col items-start overflow-hidden">
                                    <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Production URL</span>
                                    <span className="text-sm text-green-400 font-mono truncate w-full">{deploySuccess.url}</span>
                                </div>
                                <a 
                                    href={deploySuccess.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="p-2 rounded-lg bg-[#27272a] hover:bg-green-600 text-white transition-all ml-4"
                                >
                                    <ExternalLink size={18} />
                                </a>
                            </div>

                            <Button
                                variant="secondary"
                                className="w-full"
                                onClick={() => setDeploySuccess(null)}
                            >
                                Back to Editor
                            </Button>

                            <button 
                                onClick={() => setDeploySuccess(null)}
                                className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Confetti Overlay */}
            {showConfetti && (
                <div className="fixed inset-0 pointer-events-none z-[110] overflow-hidden">
                    {Array.from({ length: 50 }).map((_, i) => (
                        <motion.div
                            key={i}
                            initial={{ 
                                top: -20, 
                                left: `${Math.random() * 100}%`,
                                rotate: 0,
                                scale: Math.random() * 0.5 + 0.5
                            }}
                            animate={{ 
                                top: "110%",
                                rotate: 360 * (Math.random() > 0.5 ? 1 : -1),
                                left: `${(Math.random() - 0.5) * 20 + i * 2}%`
                            }}
                            transition={{ 
                                duration: Math.random() * 2 + 2,
                                ease: "linear",
                                repeat: 0
                            }}
                            className="absolute w-2 h-2 rounded-sm"
                            style={{ 
                                backgroundColor: ['#22c55e', '#3b82f6', '#eab308', '#ec4899', '#a855f7'][Math.floor(Math.random() * 5)] 
                            }}
                        />
                    ))}
                </div>
            )}

			{/* Reels Widget Overlay */}
			{showReels && (
				<ReelsWidget
					onClose={() => setShowReels(false)}
					onMinimize={() => setShowReels(false)}
					isAgentLoading={isLoading}
				/>
			)}

			{/* Security Scan Modal */}
			{showSecurityScan && (
				<SecurityScanModal
					onClose={() => setShowSecurityScan(false)}
					projectId={projectId}
					token={agentToken}
				/>
			)}

			{/* Code Roast Modal */}
			{showRoast && activeFile && (
				<CodeRoastModal
					code={activeFile.content || "// No content"}
					fileName={activeFile.path.split("/").pop() || activeFile.path}
					onClose={() => setShowRoast(false)}
				/>
			)}

			{/* Hacker Easter Egg */}
			{showMatrix && <MatrixRain />}

			{/* Spotify Easter Egg */}
			<SpotifyPlayer />

            {/* Community Help Modal */}
            <CommunityHelpModal
                isOpen={showCommunityHelp}
                onClose={() => setShowCommunityHelp(false)}
                repoUrl={projectRepoUrl ?? `${window.location.origin}/?w=${projectId}`}
            />
		</div>
	);
}

export default function Workspace(props: { onBack: () => void, projectId: string | null }) {
    return (
        <SocketProvider projectId={props.projectId}>
            <WorkspaceInner {...props} />
        </SocketProvider>
    );
}

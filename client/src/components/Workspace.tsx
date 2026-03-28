import FileExplorer from "./FileExplorer";
import ActivityFeed from "./ActivityFeed";
import EditorArea from "./EditorArea";
import TerminalArea from "./TerminalArea";
import VibeChat from "./VibeChat";
import ReelsWidget from "./ReelsWidget";
import SecurityScanModal from "./SecurityScanModal";
import RubberDuck from "./RubberDuck";
import WhiteboardArea from "./WhiteboardArea";
import PomodoroTimer from "./PomodoroTimer";
import SpotifyPlayer from "./SpotifyPlayer";
import MatrixRain from "./MatrixRain";
import ReactionOverlay from "./ReactionOverlay";
import CodeRoastModal from "./CodeRoastModal";
import { ArrowLeft, Loader2, Users, Check, Flame, GitCommit, PanelLeft, TerminalSquare, PanelRight, Shield, Terminal } from "lucide-react";
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from "react-resizable-panels";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { SocketProvider, useSocket } from "../contexts/SocketProvider";
import type { PendingUpdate, AgentFileAction } from "../hooks/useAgentStream";

export interface ProjectFile {
    id: string;
    path: string;
    content: string | null;
}

function WorkspaceInner({ onBack, projectId }: { onBack: () => void, projectId: string | null }) {
    const [files, setFiles] = useState<ProjectFile[]>([]);
    const [openFiles, setOpenFiles] = useState<ProjectFile[]>([]);
    const [activeFile, setActiveFile] = useState<ProjectFile | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [projectName, setProjectName] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [showReels, setShowReels] = useState(false);
    const [showMatrix, setShowMatrix] = useState(false);
    const [showRoast, setShowRoast] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showSecurityScan, setShowSecurityScan] = useState(false);

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

    const { user, getAccessTokenSilently, isAuthenticated, loginWithRedirect } = useAuth0();
    const getTokenRef = useRef(getAccessTokenSilently);
    useEffect(() => { getTokenRef.current = getAccessTokenSilently; }, [getAccessTokenSilently]);

    // 1. Fetch project files from API + store token for agent
    useEffect(() => {
        if (!projectId || !isAuthenticated) return;
        setIsLoading(true);
        getAccessTokenSilently().then(token => {
            setAgentToken(token);
            fetch(`http://localhost:3000/api/projects/${projectId}/files`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setFiles(data.files || []);
                    if (data.files?.length > 0) setActiveFile(data.files[0]);
                    if (data.projectName) setProjectName(data.projectName);
                }
                setIsLoading(false);
            })
            .catch(err => {
                console.error("Fetch files error:", err);
                setIsLoading(false);
            });
        }).catch(err => {
            console.error(err);
            if (err?.error === 'consent_required' || err?.message?.includes('Consent required')) {
                loginWithRedirect();
            }
        });
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

        const base = `http://localhost:3000/api/projects/${projectId}`;
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

    const handleSave = async () => {
        if (!projectId || !isAuthenticated) return;
        setIsSaving(true);
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch(`http://localhost:3000/api/projects/${projectId}/push`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (!data.success) {
                console.error("Save failed:", data.error);
            }
        } catch (e) {
            console.error("Save error:", e);
        }
        setIsSaving(false);
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
            <div className="h-screen w-full bg-[#09090b] flex flex-col items-center justify-center text-cyan-400 gap-4">
                <Loader2 size={32} className="animate-spin text-[#A855F7]" />
                <span className="text-sm font-['Space_Grotesk'] tracking-[0.2em] uppercase">Parsing Repository Data...</span>
            </div>
        );
    }

	return (
		<div className="h-screen w-full bg-[#09090b] text-[#c9d1d9] font-sans flex flex-col overflow-hidden selection:bg-cyan-500/30">
			{/* Top Bar */}
			<div className="h-12 bg-[#18181b] border-b border-[#27272a] shadow-sm flex items-center justify-between px-4 shrink-0 relative z-20">
				<div className="flex items-center gap-4">
					<button onClick={onBack} className="text-gray-400 hover:text-cyan-400 transition-colors flex items-center gap-1.5 text-sm">
						<ArrowLeft size={16} /> <span className="hidden sm:block">Back to Home</span>
					</button>
					<div className="w-[1px] h-4 bg-[#27272a]"></div>
					<div className="flex items-center gap-2">
						<div className="w-5 h-5 rounded-sm bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-black text-[10px] font-bold">iT</div>
						<span className="font-semibold text-sm text-gray-200">{projectName ?? (projectId ? `Project ${projectId.slice(0, 8)}` : "itec-project")}</span>
                        
                        <div className="ml-6 flex items-center bg-[#09090b] rounded-lg p-0.5 border border-[#27272a]">
                            <button 
                                onClick={() => setShowWhiteboard(false)}
                                className={`px-3 py-1 flex items-center gap-2 rounded-md text-xs font-semibold transition-all ${!showWhiteboard ? "bg-[#27272a] text-cyan-400" : "text-gray-500 hover:text-gray-300"}`}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                                Code
                            </button>
                            <button 
                                onClick={() => setShowWhiteboard(true)}
                                className={`px-3 py-1 flex items-center gap-2 rounded-md text-xs font-semibold transition-all ${showWhiteboard ? "bg-[#27272a] text-yellow-400" : "text-gray-500 hover:text-gray-300"}`}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                                Whiteboard
                            </button>
                        </div>
					</div>
                        {/* Panel Toggles */}
                        <div className="flex items-center gap-1 ml-4 bg-[#18181b] p-0.5 rounded border border-[#27272a]">
                            <button onClick={() => setShowSidebar(!showSidebar)} className={`p-1 rounded hover:bg-[#27272a] ${showSidebar ? "text-cyan-400" : "text-gray-500"} transition-colors`} title="Toggle Sidebar">
                                <PanelLeft size={14} />
                            </button>
                            <button onClick={() => setShowTerminal(!showTerminal)} className={`p-1 rounded hover:bg-[#27272a] ${showTerminal ? "text-cyan-400" : "text-gray-500"} transition-colors`} title="Toggle Terminal">
                                <TerminalSquare size={14} />
                            </button>
                            <button onClick={() => setShowChat(!showChat)} className={`p-1 rounded hover:bg-[#27272a] ${showChat ? "text-cyan-400" : "text-gray-500"} transition-colors`} title="Toggle Chat">
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

				<div className="flex items-center gap-4">
                    {/* Connected users */}
                    {collabUsers.length > 0 && (
                        <div className="flex -space-x-2 mr-2">
                            {collabUsers.map(u => (
                                <div key={u.id} title={`${u.name}${u.isHost ? ' (Host)' : ''}`} className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-bold text-white shadow-sm ${u.isHost ? 'border-yellow-400 z-10' : 'border-[#18181b]'}`} style={{ backgroundColor: u.color }}>
                                    {u.name.substring(0, 2).toUpperCase()}
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="mx-2 flex items-center">
                        <PomodoroTimer />
                    </div>

                    {/* Collaborate button */}
                    <button
                        onClick={copyCollabLink}
                        className={`text-xs px-3 py-1.5 rounded flex items-center gap-2 transition-all font-semibold shadow-sm ${
                            copied ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white"
                        }`}
                    >
                        {copied ? <Check size={14} /> : <Users size={14} />}
                        {copied ? "Copied Link!" : "Collaborate"}
                    </button>

                    {/* Emoji Reactions */}
                    <ReactionOverlay
                        lastMessage={lastMessage}
                        onSendReaction={(emoji) => send({ type: "emoji_reaction", emoji, sender: user?.name || "Someone" })}
                    />

                    {/* Roast My Code button */}
                    {activeFile && (
                        <button
                            onClick={() => setShowRoast(true)}
                            className="text-xs px-3 py-1.5 rounded flex items-center gap-2 transition-all font-semibold shadow-sm bg-gradient-to-r from-orange-600 to-red-600 hover:scale-105 text-white"
                            title="Let the AI roast your current file"
                        >
                            🔥 Roast My Code
                        </button>
                    )}

                    {/* Hacker Mode button */}
                    <button
                        onClick={() => setShowMatrix(prev => !prev)}
                        className={`text-xs px-3 py-1.5 rounded flex items-center gap-2 transition-all font-semibold shadow-sm hover:scale-105 ${showMatrix ? 'bg-green-500 text-black shadow-[0_0_15px_rgba(34,197,94,0.5)]' : 'bg-green-900/30 text-green-500 border border-green-500/30 hover:bg-green-500/20'}`}
                    >
                        <Terminal size={14} />
                        Hacker Mode
                    </button>

                    {/* Security Scan button */}
                    <button
						onClick={() => setShowSecurityScan(true)}
						className="text-xs px-3 py-1.5 rounded flex items-center gap-2 transition-all font-semibold shadow-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:scale-105 text-white"
					>
						<Shield size={14} />
						Security Scan
					</button>

                    {/* Vibe Reels button */}
                    <button
                        onClick={() => setShowReels(true)}
                        className="text-xs px-3 py-1.5 rounded flex items-center gap-2 transition-all font-semibold shadow-sm bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 hover:scale-105 text-white"
                    >
                        <Flame size={14} />
                        Vibe Reels
                    </button>

					<div className="w-[1px] h-4 bg-[#27272a] mx-1"></div>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="text-xs px-3 py-1.5 rounded flex items-center gap-2 transition-all font-semibold shadow-sm bg-[#27272a] hover:bg-[#3f3f46] text-gray-200 disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 size={14} className="animate-spin" /> : <GitCommit size={14} />}
                        Commit
                    </button>
					<div className="w-[1px] h-4 bg-[#27272a] mx-1"></div>
					<span className="relative flex h-2.5 w-2.5">
						<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
						<span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
					</span>
					<span className="text-xs text-gray-400 font-medium">Auto-saving...</span>
				</div>
			</div>

			<div className="flex-1 flex overflow-hidden">
                <PanelGroup orientation="horizontal" className="w-full h-full">
                    {/* Left Sidebar */}
                    {showSidebar && (
                        <>
                            <Panel defaultSize={20} minSize={15} className="flex flex-col bg-[#09090b] relative z-10 border-r border-[#27272a]">
                                <div className="flex-1 overflow-y-auto w-full">
                                    <FileExplorer
                                    files={files}
                                    activeFile={activeFile}
                                    onSelect={handleSelectFile}
                                    projectId={projectId}
                                    token={agentToken}
                                    onFilesChange={setFiles}
                                />
                                </div>
                                <div className="h-[220px] shrink-0 border-t border-[#27272a] overflow-y-auto shadow-[0_-5px_15px_rgba(0,0,0,0.5)]">
                                    <ActivityFeed projectId={projectId} />
                                </div>
                            </Panel>
                            <PanelResizeHandle className="w-1 hover:bg-cyan-500/50 transition-colors z-50 cursor-col-resize" />
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
                                        userId={user?.sub ? `${user.sub}_local` : "anon_local"}
                                        remoteCodeUpdate={remoteCodeUpdate}
                                        remoteCursorUpdate={remoteCursorUpdate}
                                        pendingUpdate={pendingUpdate}
                                        onPendingResolved={() => setPendingUpdate(null)}
                                        projectId={projectId}
                                    />
                                )}
                            </Panel>
                            
                            {showTerminal && (
                                <>
                                    <PanelResizeHandle className="h-1 bg-[#27272a] hover:bg-cyan-500/50 transition-colors z-50 cursor-row-resize" />
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
                            <PanelResizeHandle className="w-1 hover:bg-cyan-500/50 transition-colors z-50 cursor-col-resize border-l border-[#27272a]" />
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

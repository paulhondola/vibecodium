import FileExplorer from "./FileExplorer";
import ActionHistory from "./ActionHistory";
import EditorArea from "./EditorArea";
import TerminalArea from "./TerminalArea";
import VibeChat from "./VibeChat";
<<<<<<< HEAD
import JoinRequestModal from "./JoinRequestModal";
import { ArrowLeft, Loader2, Users, Check, ShieldX } from "lucide-react";
=======
import ReelsPanel from "./ReelsPanel";
import { ArrowLeft, Loader2, Share, Film } from "lucide-react";
>>>>>>> bc5f245de17e09394d37eb6a87dd1f40d03e64c4
import { useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { WebSocketProvider, useCollabSocket } from "../contexts/WebSocketProvider";

export interface ProjectFile {
    id: string;
    path: string;
    content: string | null;
}

export default function Workspace({ onBack, projectId }: { onBack: () => void, projectId: string | null }) {
    if (!projectId) {
        return (
            <div className="h-screen w-full bg-[#09090b] flex items-center justify-center text-gray-400 font-mono text-sm">
                No project selected. Go back and import a repository.
            </div>
        );
    }

    return (
        <WebSocketProvider projectId={projectId}>
            <WorkspaceInner onBack={onBack} projectId={projectId} />
        </WebSocketProvider>
    );
}

function WorkspaceInner({ onBack, projectId }: { onBack: () => void, projectId: string }) {
    const [files, setFiles] = useState<ProjectFile[]>([]);
    const [activeFile, setActiveFile] = useState<ProjectFile | null>(null);
    const [isLoading, setIsLoading] = useState(false);
<<<<<<< HEAD
    const [copied, setCopied] = useState(false);

    const { getAccessTokenSilently, isAuthenticated } = useAuth0();
    const { connectionState, myPermission, isHost, connectedUsers, syncedFiles } = useCollabSocket();

    // 1. Load Files for Host (they fetch from API)
=======
    const [isReelsOpen, setIsReelsOpen] = useState(false);
    const { getAccessTokenSilently, isAuthenticated } = useAuth0();



>>>>>>> bc5f245de17e09394d37eb6a87dd1f40d03e64c4
    useEffect(() => {
        if (!projectId || !isAuthenticated || !isHost) return;
        setIsLoading(true);
        getAccessTokenSilently().then(token => {
            fetch(`http://localhost:3000/api/projects/${projectId}/files`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setFiles(data.files || []);
                    if (data.files && data.files.length > 0) setActiveFile(data.files[0]);
                }
                setIsLoading(false);
            })
            .catch(err => {
                console.error("Fetch files error:", err);
                setIsLoading(false);
            });
        });
    }, [projectId, isAuthenticated, getAccessTokenSilently, isHost]);

    // 2. Load Files from sync_workspace for Guests
    useEffect(() => {
        if (syncedFiles && syncedFiles.length > 0) {
            setFiles(syncedFiles);
            setActiveFile(syncedFiles[0]);
        }
    }, [syncedFiles]);

    const copyCollabLink = () => {
        const url = `${window.location.origin}/?w=${projectId}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // ── GUEST SCREENS ──
    if (connectionState === 'waiting_approval') {
        return (
            <div className="h-screen w-full bg-[#09090b] flex flex-col items-center justify-center gap-6">
                <Loader2 size={40} className="animate-spin text-purple-500" />
                <div className="text-center">
                    <h2 className="text-lg font-semibold text-white mb-2">Waiting for Host Approval</h2>
                    <p className="text-sm text-gray-400 max-w-xs">
                        The host of this workspace needs to accept your request before you can join.
                    </p>
                </div>
                <button onClick={onBack} className="text-xs text-gray-500 hover:text-gray-300 transition-colors mt-4">
                    ← Cancel and go back
                </button>
            </div>
        );
    }

    if (connectionState === 'rejected') {
        return (
            <div className="h-screen w-full bg-[#09090b] flex flex-col items-center justify-center gap-6">
                <ShieldX size={48} className="text-red-500" />
                <div className="text-center">
                    <h2 className="text-lg font-semibold text-red-400 mb-2">Access Denied</h2>
                    <p className="text-sm text-gray-400 max-w-xs">
                        The host has rejected your join request to this workspace.
                    </p>
                </div>
                <button 
                    onClick={onBack} 
                    className="text-sm px-4 py-2 bg-[#18181b] hover:bg-[#27272a] text-white rounded-lg border border-[#27272a] transition-colors mt-2"
                >
                    Back to Home
                </button>
            </div>
        );
    }

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
						<div className="w-5 h-5 rounded-sm bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-black text-[10px] font-bold">
							iT
						</div>
						<span className="font-semibold text-sm text-gray-200">{projectId ? `Project ${projectId.slice(0, 8)}` : "itec-project-2026"}</span>
						<button 
							onClick={() => {
								const url = new URL(window.location.href);
								url.searchParams.set("project", projectId || "default");
								navigator.clipboard.writeText(url.toString());
								alert("Share link copied to clipboard!");
							}}
							className="ml-4 flex items-center gap-1.5 px-3 py-1 bg-[#27272a] hover:bg-[#3f3f46] text-xs font-semibold rounded text-cyan-400 transition-colors"
						>
							<Share size={12} />
							Share Link
						</button>
					</div>
				</div>

				<div className="flex items-center gap-4">
                    {/* Connected Users Avatars */}
                    {connectedUsers.length > 0 && (
                        <div className="flex -space-x-2 mr-2">
                            {connectedUsers.map(u => (
                                <div key={u.id} title={u.name} className="w-6 h-6 rounded-full border-2 border-[#18181b] flex items-center justify-center text-[10px] font-bold text-white shadow-sm" style={{ backgroundColor: u.color }}>
                                    {u.name.substring(0, 2).toUpperCase()}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Collaborate Button */}
                    <button 
                        onClick={copyCollabLink}
                        className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all font-semibold shadow-sm ${
                            copied ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white"
                        }`}
                    >
                        {copied ? <Check size={14} /> : <Users size={14} />}
                        {copied ? "Copied Link!" : "Collaborate"}
                    </button>

                    {/* Permission Badge */}
                    {!isHost && (
                        <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded ${
                            myPermission === 'edit' ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"
                        }`}>
                            {myPermission === 'edit' ? 'Editor' : 'Viewer'}
                        </span>
                    )}

					<div className="w-[1px] h-4 bg-[#27272a] mx-1"></div>
					<span className="relative flex h-2.5 w-2.5">
						<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
						<span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
					</span>
					<span className="text-xs text-gray-400 font-medium">
                        {isHost ? "Host" : "Connected"}
                    </span>
				</div>
			</div>

            {/* Host Join Request Modal */}
            <JoinRequestModal />

			<div className="flex-1 flex overflow-hidden">
				{/* Left Sidebar */}
				<div className="w-[220px] shrink-0 border-r border-[#27272a] flex flex-col bg-[#09090b] relative z-10">
					<div className="flex-1 overflow-y-auto w-full">
						<FileExplorer files={files} activeFile={activeFile} onSelect={setActiveFile} readOnly={myPermission === 'readonly'} />
					</div>
					<div className="h-[220px] shrink-0 border-t border-[#27272a] overflow-y-auto shadow-[0_-5px_15px_rgba(0,0,0,0.5)]">
						<ActionHistory />
					</div>
				</div>

				{/* Center Area */}
				<div className="flex-1 flex flex-col min-w-0 bg-[#09090b] relative">
					<div className="flex-1 relative border-b border-[#27272a] overflow-hidden">
						<EditorArea activeFile={activeFile} projectId={projectId} />
					</div>
					<div className="h-[280px] shrink-0 overflow-hidden relative bg-[#09090b]">
						<TerminalArea projectId={projectId} />
					</div>
				</div>

				{/* Right Sidebar */}
				<div className="w-[300px] shrink-0 border-l border-[#27272a] shadow-[-5px_0_15px_rgba(0,0,0,0.5)] flex flex-col bg-[#18181b] relative z-10">
					<VibeChat />
				</div>
			</div>

            {/* Vibe Reels Panel overlay */}
            {isReelsOpen && <ReelsPanel onClose={() => setIsReelsOpen(false)} />}

            {/* Side Button to Open Reels Panel */}
            {!isReelsOpen && (
                <button
                    onClick={() => setIsReelsOpen(true)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-24 bg-[#18181b] hover:bg-[#27272a] text-gray-500 hover:text-pink-500 border-l border-y border-[#27272a] hover:border-pink-500/50 rounded-l-lg flex flex-col items-center justify-center gap-2 shadow-[-5px_0_15px_rgba(0,0,0,0.3)] transition-all z-40 group group-hover:w-10"
                    title="Open Vibe Reels"
                >
                    <Film size={16} className="group-hover:scale-110 transition-transform" />
                </button>
            )}
		</div>
	);
}

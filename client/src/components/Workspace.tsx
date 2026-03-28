import FileExplorer from "./FileExplorer";
import ActionHistory from "./ActionHistory";
import EditorArea from "./EditorArea";
import TerminalArea from "./TerminalArea";
import VibeChat from "./VibeChat";
import { ArrowLeft, Loader2, Users, Check } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { SocketProvider, useSocket } from "../contexts/SocketProvider";

export interface ProjectFile {
    id: string;
    path: string;
    content: string | null;
}

function WorkspaceInner({ onBack, projectId }: { onBack: () => void, projectId: string | null }) {
    const [files, setFiles] = useState<ProjectFile[]>([]);
    const [activeFile, setActiveFile] = useState<ProjectFile | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    // Collab
    const { isConnected, lastMessage } = useSocket();
    const [collabUsers, setCollabUsers] = useState<{id: string, name: string, color: string, isHost?: boolean}[]>([]);
    const [, setMyColor] = useState("#A855F7");
    const [isHost, setIsHost] = useState(false);

    // Remote editor events — set in onmessage, consumed by EditorArea via props
    const [remoteCodeUpdate, setRemoteCodeUpdate] = useState<{ filePath: string; content: string; clientId: string } | null>(null);
    const [remoteCursorUpdate, setRemoteCursorUpdate] = useState<{ filePath: string; clientId: string; color: string; userName: string; position: { lineNumber: number; column: number } } | null>(null);

    const { user, getAccessTokenSilently, isAuthenticated } = useAuth0();

    // 1. Fetch project files from API
    useEffect(() => {
        if (!projectId || !isAuthenticated) return;
        setIsLoading(true);
        getAccessTokenSilently().then(token => {
            fetch(`http://localhost:3000/api/projects/${projectId}/files`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setFiles(data.files || []);
                    if (data.files?.length > 0) setActiveFile(data.files[0]);
                }
                setIsLoading(false);
            })
            .catch(err => {
                console.error("Fetch files error:", err);
                setIsLoading(false);
            });
        });
    }, [projectId, isAuthenticated, getAccessTokenSilently]);

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
        } else if (data.type === "host_changed") {
            // New host assignment from backend
            // In a fuller implementation, check if we are the new host via myUserId
        }
    }, [lastMessage]);

    const copyCollabLink = () => {
        const url = `${window.location.origin}/?w=${projectId}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
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
						<span className="font-semibold text-sm text-gray-200">{projectId ? `Project ${projectId.slice(0, 8)}` : "itec-project"}</span>
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

					<div className="w-[1px] h-4 bg-[#27272a] mx-1"></div>
					<span className="relative flex h-2.5 w-2.5">
						<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
						<span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
					</span>
					<span className="text-xs text-gray-400 font-medium">Auto-saving...</span>
				</div>
			</div>

			<div className="flex-1 flex overflow-hidden">
				{/* Left Sidebar */}
				<div className="w-[220px] shrink-0 border-r border-[#27272a] flex flex-col bg-[#09090b] relative z-10">
					<div className="flex-1 overflow-y-auto w-full">
						<FileExplorer files={files} activeFile={activeFile} onSelect={setActiveFile} />
					</div>
					<div className="h-[220px] shrink-0 border-t border-[#27272a] overflow-y-auto shadow-[0_-5px_15px_rgba(0,0,0,0.5)]">
						<ActionHistory />
					</div>
				</div>

				{/* Center Area */}
				<div className="flex-1 flex flex-col min-w-0 bg-[#09090b] relative">
					<div className="flex-1 relative border-b border-[#27272a] overflow-hidden">
                        <EditorArea
							activeFile={activeFile}
							userId={user?.sub ? `${user.sub}_local` : "anon_local"}
							remoteCodeUpdate={remoteCodeUpdate}
							remoteCursorUpdate={remoteCursorUpdate}
						/>
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

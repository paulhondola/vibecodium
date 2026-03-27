import FileExplorer from "./FileExplorer";
import ActionHistory from "./ActionHistory";
import EditorArea from "./EditorArea";
import TerminalArea from "./TerminalArea";
import VibeChat from "./VibeChat";
import ReelsPanel from "./ReelsPanel";
import { ArrowLeft, Loader2, Share, Film } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";

export interface ProjectFile {
    id: string;
    path: string;
    content: string | null;
}

export default function Workspace({ onBack, projectId }: { onBack: () => void, projectId: string | null }) {
    const [files, setFiles] = useState<ProjectFile[]>([]);
    const [activeFile, setActiveFile] = useState<ProjectFile | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isReelsOpen, setIsReelsOpen] = useState(false);
    const { getAccessTokenSilently, isAuthenticated } = useAuth0();



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
                    if (data.files && data.files.length > 0) setActiveFile(data.files[0]);
                }
                setIsLoading(false);
            })
            .catch(err => {
                console.error("Fetch files error:", err);
                setIsLoading(false);
            });
        });
    }, [projectId, isAuthenticated, getAccessTokenSilently]);

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
			{/* Top Bar Workspace */}
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
				<div className="flex items-center gap-3">
					<span className="relative flex h-2.5 w-2.5">
						<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
						<span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
					</span>
					<span className="text-xs text-gray-400 font-medium">Auto-saving...</span>
				</div>
			</div>

			<div className="flex-1 flex overflow-hidden">
				{/* Left Sidebar: 220px */}
				<div className="w-[220px] shrink-0 border-r border-[#27272a] flex flex-col bg-[#09090b] relative z-10">
					<div className="flex-1 overflow-y-auto w-full">
						<FileExplorer files={files} activeFile={activeFile} onSelect={setActiveFile} />
					</div>
					<div className="h-[220px] shrink-0 border-t border-[#27272a] overflow-y-auto shadow-[0_-5px_15px_rgba(0,0,0,0.5)]">
						<ActionHistory />
					</div>
				</div>

				{/* Center Area: 1fr */}
				<div className="flex-1 flex flex-col min-w-0 bg-[#09090b] relative">
					<div className="flex-1 relative border-b border-[#27272a] overflow-hidden">
						<EditorArea activeFile={activeFile} projectId={projectId} />
					</div>
					<div className="h-[280px] shrink-0 overflow-hidden relative bg-[#09090b]">
						<TerminalArea projectId={projectId} />
					</div>
				</div>

				{/* Right Sidebar: 300px */}
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

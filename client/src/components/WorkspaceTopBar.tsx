import { ArrowLeft, Loader2, Users, Check, GitCommit, PanelLeft, TerminalSquare, PanelRight, Rocket } from "lucide-react";

interface CollabUser {
	id: string;
	name: string;
	color: string;
	isHost?: boolean;
}

interface WorkspaceTopBarProps {
	projectName: string | null;
	projectId: string | null;
	showWhiteboard: boolean;
	setShowWhiteboard: (v: boolean) => void;
	showSidebar: boolean;
	setShowSidebar: (v: boolean) => void;
	showTerminal: boolean;
	setShowTerminal: (v: boolean) => void;
	showChat: boolean;
	setShowChat: (v: boolean) => void;
	isHost: boolean;
	isConnected: boolean;
	isDeploying: boolean;
	isSaving: boolean;
	collabUsers: CollabUser[];
	copied: boolean;
	onBack: () => void;
	onDeploy: () => void;
	onSave: () => void;
	onCopyCollabLink: () => void;
	onShowCommunityHelp: () => void;
}

export default function WorkspaceTopBar({
	projectName, projectId, showWhiteboard, setShowWhiteboard,
	showSidebar, setShowSidebar, showTerminal, setShowTerminal,
	showChat, setShowChat, isHost, isConnected, isDeploying, isSaving,
	collabUsers, copied, onBack, onDeploy, onSave, onCopyCollabLink,
	onShowCommunityHelp,
}: WorkspaceTopBarProps) {


	return (
		<div className="h-12 bg-[#18181b] border-b border-[#27272a] shadow-sm flex items-center justify-between px-4 shrink-0 relative z-20">
			<div className="flex items-center gap-4">
				<button onClick={onBack} className="text-gray-400 hover:text-cyan-400 transition-colors flex items-center gap-1.5 text-sm">
					<ArrowLeft size={16} /> <span className="hidden sm:block">Back to Home</span>
				</button>
				<div className="w-[1px] h-4 bg-[#27272a]"></div>
				<div className="flex items-center gap-2">
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
				<button
					onClick={onDeploy}
					disabled={isDeploying}
					className={`text-xs px-4 py-1.5 rounded-full flex items-center gap-2 transition-all font-bold shadow-[0_0_15px_rgba(34,197,94,0.3)] border border-green-500/30 ${isDeploying ? "bg-green-600/50 cursor-not-allowed" : "bg-green-600 hover:bg-green-500 text-white hover:scale-105 active:scale-95"}`}
				>
					{isDeploying ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
					{isDeploying ? "Shipping..." : "Ship to Cloud"}
				</button>

				<button
					onClick={onSave}
					disabled={isSaving}
					className="text-xs px-4 py-1.5 rounded-full flex items-center gap-2 transition-all font-bold border border-[#27272a] bg-[#18181b] hover:bg-[#27272a] text-gray-200 hover:scale-105 active:scale-95 disabled:opacity-50"
				>
					{isSaving ? <Loader2 size={14} className="animate-spin" /> : <GitCommit size={14} />}
					Commit
				</button>

				<button
					onClick={onCopyCollabLink}
					className={`text-xs px-4 py-1.5 rounded-full flex items-center gap-2 transition-all font-bold border border-[#A855F7]/30 bg-[#A855F7]/10 hover:bg-[#A855F7]/20 text-[#A855F7] hover:scale-105 active:scale-95 ${copied ? "text-green-400 border-green-500/30 bg-green-500/10" : ""}`}
				>
					{copied ? <Check size={14} /> : <Users size={14} />}
					{copied ? "Link Copied!" : "Collaborate"}
				</button>

				<button
					onClick={onShowCommunityHelp}
					className="text-xs px-4 py-1.5 rounded-full flex items-center gap-2 transition-all font-bold border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 hover:scale-105 active:scale-95"
					title="Post your issue to the community"
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
					Request Help
				</button>

				{collabUsers.length > 0 && (
					<div className="flex -space-x-2 mr-2">
						{collabUsers.map(u => (
							<div
								key={u.id}
								title={`${u.name}${u.isHost ? " (Host)" : ""}`}
								className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-bold text-white shadow-sm ${u.isHost ? "border-yellow-400 z-10" : "border-[#18181b]"}`}
								style={{ backgroundColor: u.color }}
							>
								{u.name.substring(0, 2).toUpperCase()}
							</div>
						))}
					</div>
				)}

			</div>
		</div>
	);
}

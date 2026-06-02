import { ArrowLeft, Loader2, Users, Check, PanelLeft, TerminalSquare, PanelRight, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";

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
	collabUsers: CollabUser[];
	copied: boolean;
	onBack: () => void;
	onDeploy: () => void;
	onCopyCollabLink: () => void;
}

export default function WorkspaceTopBar({
	projectName, projectId, showWhiteboard, setShowWhiteboard,
	showSidebar, setShowSidebar, showTerminal, setShowTerminal,
	showChat, setShowChat, isHost, isConnected, isDeploying,
	collabUsers, copied, onBack, onDeploy, onCopyCollabLink,
}: WorkspaceTopBarProps) {
	return (
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
				<Button variant="primary" size="sm" onClick={onDeploy} loading={isDeploying}>
					<Rocket />
					Ship to Cloud
				</Button>

				<Button
					variant="secondary"
					size="sm"
					onClick={onCopyCollabLink}
					className={copied ? "border-emerald-500/40 text-emerald-400 hover:border-emerald-500/60 hover:text-emerald-300" : ""}
				>
					{copied ? <Check /> : <Users />}
					{copied ? "Copied!" : "Collaborate"}
				</Button>

				{collabUsers.length > 0 && (
					<div className="flex -space-x-2">
						{collabUsers.map(u => (
							<div
								key={u.id}
								title={`${u.name}${u.isHost ? " (Host)" : ""}`}
								className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-bold text-white ${u.isHost ? "border-yellow-400 z-10" : "border-[#18181b]"}`}
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

import FileExplorer from "./FileExplorer";
import ActionHistory from "./ActionHistory";
import EditorArea from "./EditorArea";
import TerminalArea from "./TerminalArea";
import VibeChat from "./VibeChat";
import { ArrowLeft } from "lucide-react";

export default function Workspace({ onBack }: { onBack: () => void }) {
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
						<span className="font-semibold text-sm text-gray-200">itec-project-2026</span>
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
						<FileExplorer />
					</div>
					<div className="h-[220px] shrink-0 border-t border-[#27272a] overflow-y-auto shadow-[0_-5px_15px_rgba(0,0,0,0.5)]">
						<ActionHistory />
					</div>
				</div>

				{/* Center Area: 1fr */}
				<div className="flex-1 flex flex-col min-w-0 bg-[#09090b] relative">
					<div className="flex-1 relative border-b border-[#27272a] overflow-hidden">
						<EditorArea />
					</div>
					<div className="h-[280px] shrink-0 overflow-hidden relative bg-[#09090b]">
						<TerminalArea />
					</div>
				</div>

				{/* Right Sidebar: 300px */}
				<div className="w-[300px] shrink-0 border-l border-[#27272a] shadow-[-5px_0_15px_rgba(0,0,0,0.5)] flex flex-col bg-[#18181b] relative z-10">
					<VibeChat />
				</div>
			</div>
		</div>
	);
}

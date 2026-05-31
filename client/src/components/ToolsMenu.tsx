import ReactionOverlay from "./ReactionOverlay";
import { Flame, Terminal } from "lucide-react";
import type { ProjectFile } from "./Workspace";

interface ToolsMenuProps {
	activeFile: ProjectFile | null;
	send: (msg: object) => void;
	user: { name?: string } | null;
	lastMessage: unknown;
	showPowerMode: boolean;
	setShowPowerMode: React.Dispatch<React.SetStateAction<boolean>>;
	showMatrix: boolean;
	setShowMatrix: React.Dispatch<React.SetStateAction<boolean>>;
	onShowReels: () => void;
	onShowRoast: () => void;
	onClose: () => void;
}

export default function ToolsMenu({
	activeFile, send, user, lastMessage,
	showPowerMode, setShowPowerMode, showMatrix, setShowMatrix,
	onShowReels, onShowRoast, onClose,
}: ToolsMenuProps) {
	return (
		<div className="absolute right-0 top-full mt-1.5 w-52 bg-[#18181b] border border-[#27272a] rounded-lg shadow-xl z-50 overflow-hidden py-1">
			<div className="border-t border-[#27272a]">
				<ReactionOverlay
					lastMessage={lastMessage}
					onSendReaction={(emoji) => { send({ type: "emoji_reaction", emoji, sender: user?.name || "Someone" }); onClose(); }}
					buttonClassName="w-full text-left text-xs px-3 py-2 flex items-center gap-2.5 text-purple-400 hover:bg-[#27272a] hover:text-purple-300 transition-colors"
					pickerPosition="below"
				/>
			</div>

			{activeFile && (
				<button
					onClick={() => { onShowRoast(); onClose(); }}
					className="w-full text-left text-xs px-3 py-2 flex items-center gap-2.5 text-orange-400 hover:bg-[#27272a] hover:text-orange-300 transition-colors border-t border-[#27272a]"
				>
					<span>🔥</span>
					Roast My Code
				</button>
			)}

			<button
				onClick={() => { setShowPowerMode(prev => !prev); onClose(); }}
				className={`w-full text-left text-xs px-3 py-2 flex items-center gap-2.5 transition-colors border-t border-[#27272a] ${showPowerMode ? "text-orange-400 bg-orange-500/10 hover:bg-orange-500/20" : "text-orange-500 hover:bg-[#27272a] hover:text-orange-400"}`}
			>
				<span className="text-sm leading-none">⚡</span>
				Power Mode {showPowerMode && <span className="ml-auto text-[10px] font-bold text-orange-400">ON</span>}
			</button>

			<button
				onClick={() => { setShowMatrix(prev => !prev); onClose(); }}
				className={`w-full text-left text-xs px-3 py-2 flex items-center gap-2.5 transition-colors border-t border-[#27272a] ${showMatrix ? "text-green-400 bg-green-500/10 hover:bg-green-500/20" : "text-green-500 hover:bg-[#27272a] hover:text-green-400"}`}
			>
				<Terminal size={14} />
				Hacker Mode {showMatrix && <span className="ml-auto text-[10px] font-bold text-green-400">ON</span>}
			</button>

			<button
				onClick={() => { onShowReels(); onClose(); }}
				className="w-full text-left text-xs px-3 py-2 flex items-center gap-2.5 text-pink-400 hover:bg-[#27272a] hover:text-pink-300 transition-colors border-t border-[#27272a]"
			>
				<Flame size={14} />
				Vibe Reels
			</button>
		</div>
	);
}

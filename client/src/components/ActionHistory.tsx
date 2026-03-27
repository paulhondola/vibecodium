import { useState } from "react";
import { History, RotateCcw, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

interface Snapshot {
	id: string;
	label: string;
	timestamp: Date;
	agent: string;
}

const mockSnapshots: Snapshot[] = [
	{ id: "1", label: "wrote server/index.ts", timestamp: new Date(Date.now() - 1000 * 60 * 2), agent: "AI Agent" },
	{ id: "2", label: "added cors middleware", timestamp: new Date(Date.now() - 1000 * 60 * 15), agent: "AI Agent" },
	{ id: "3", label: "initial project setup", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), agent: "System" },
];

export default function ActionHistory() {
	const [hoveredId, setHoveredId] = useState<string | null>(null);

	return (
		<div className="flex flex-col h-full bg-[#09090b] text-[#c9d1d9] text-sm">
			<div className="flex items-center justify-between p-3 border-b border-[#27272a] shrink-0 sticky top-0 bg-[#09090b]/95 backdrop-blur z-10">
				<div className="flex items-center gap-2">
					<History size={14} className="text-gray-400" />
					<h2 className="font-semibold text-xs tracking-wider uppercase text-gray-400">Action History</h2>
				</div>
			</div>
			<div className="flex-1 overflow-y-auto">
				{mockSnapshots.map((snap) => (
					<div
						key={snap.id}
						onMouseEnter={() => setHoveredId(snap.id)}
						onMouseLeave={() => setHoveredId(null)}
						className="group flex flex-col p-3 border-b border-[#27272a] hover:bg-[#18181b] transition-colors cursor-pointer relative"
					>
						<div className="flex justify-between items-start mb-1">
							<span className="text-blue-400 font-medium truncate pr-2">{snap.label}</span>
						</div>
						<div className="flex justify-between items-center text-xs text-gray-500">
							<span>{snap.agent}</span>
							<span>{formatDistanceToNow(snap.timestamp, { addSuffix: true })}</span>
						</div>

						{/* Hover Actions */}
						<AnimatePresence>
							{hoveredId === snap.id && (
								<motion.div
									initial={{ opacity: 0, y: 5 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: 5 }}
									className="absolute right-2 top-2 flex gap-1"
								>
									<button
										className="p-1.5 bg-[#2ea043] hover:bg-[#3fb950] text-white rounded shadow-sm border border-[rgba(240,246,252,0.1)] transition-colors"
										title="Preview Diff"
										onClick={(e) => { e.stopPropagation(); alert("Diff preview modal would open here"); }}
									>
										<Eye size={12} />
									</button>
									<button
										className="p-1.5 bg-[#d1242f] hover:bg-[#f85149] text-white rounded shadow-sm border border-[rgba(240,246,252,0.1)] transition-colors"
										title="Restore"
										onClick={(e) => { e.stopPropagation(); alert("Restore preview and confirmation required before rollback"); }}
									>
										<RotateCcw size={12} />
									</button>
								</motion.div>
							)}
						</AnimatePresence>
					</div>
				))}
			</div>
		</div>
	);
}

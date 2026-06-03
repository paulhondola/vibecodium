interface DashboardFooterProps {
	repoCount: number;
	workspaceCount: number;
}

export default function DashboardFooter({
	repoCount,
	workspaceCount,
}: DashboardFooterProps) {
	return (
		<footer className="fixed bottom-0 w-full flex justify-between items-center px-6 z-[120] bg-[rgba(10,12,20,0.6)] backdrop-blur-xl border-t border-[rgba(168,85,247,0.2)] shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] h-8 bg-black">
			<div className="flex items-center gap-8 h-full">
				<div className="flex items-center gap-2 text-[#10B981] font-['JetBrains_Mono'] text-[9px] font-bold uppercase tracking-[0.25em]">
					<span className="material-symbols-outlined text-[14px] fill-1 animate-pulse">
						terminal
					</span>
					Session: Active
				</div>
				<div className="hidden md:flex items-center gap-8">
					<div className="text-slate-500 font-['JetBrains_Mono'] text-[8px] uppercase tracking-[0.3em]">
						{repoCount} repos
					</div>
					<div className="text-slate-500 font-['JetBrains_Mono'] text-[8px] uppercase tracking-[0.3em]">
						{workspaceCount} workspaces
					</div>
				</div>
			</div>
			<div className="flex items-center gap-8">
				<div className="flex items-center gap-2 text-slate-500 font-['JetBrains_Mono'] text-[8px] uppercase tracking-[0.25em]">
					<span className="material-symbols-outlined text-[14px] text-[#10B981]">
						cloud_done
					</span>
					GitHub Connected
				</div>
				<div
					className="text-[#A855F7] font-['JetBrains_Mono'] text-[8px] uppercase tracking-[0.3em] font-black"
					style={{ textShadow: "0 0 12px rgba(168, 85, 247, 0.6)" }}
				>
					VibeCodium v1.0
				</div>
			</div>
		</footer>
	);
}

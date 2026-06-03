import { useNavigate } from "@tanstack/react-router";

interface DashboardSidebarProps {
	onFilterChange: (filter: "all" | "recent") => void;
	onShowCreate: () => void;
	onShowCoderMatch: () => void;
	scrollToSection: (ref: React.RefObject<HTMLDivElement | null>) => void;
	reposRef: React.RefObject<HTMLDivElement | null>;
	recentRef: React.RefObject<HTMLDivElement | null>;
	vibeMatchUnread?: number;
}

export default function DashboardSidebar({
	onFilterChange,
	onShowCreate,
	onShowCoderMatch,
	scrollToSection,
	reposRef,
	recentRef,
	vibeMatchUnread = 0,
}: DashboardSidebarProps) {
	const navigate = useNavigate();

	return (
		<aside className="fixed left-0 top-14 h-[calc(100vh-56px)] w-64 bg-[rgba(10,12,20,0.6)] backdrop-blur-xl border-r border-[rgba(168,85,247,0.15)] flex flex-col py-8 z-40">
			<div className="px-8 mb-12">
				<div className="text-[9px] uppercase tracking-[0.4em] font-black text-[rgba(168,85,247,0.6)] mb-2">
					iTEC 2026
				</div>
				<div className="text-sm font-['Space_Grotesk'] font-bold text-[#f8fafc] tracking-widest flex items-center gap-2">
					VibeCodium
					<span className="w-1.5 h-1.5 rounded-full bg-[#A855F7] animate-pulse" />
				</div>
				<div className="text-[9px] font-['JetBrains_Mono'] text-slate-500 mt-1">
					Collaborative IDE
				</div>
			</div>
			<nav className="flex-1 space-y-1 px-4">
				<div className="flex items-center gap-5 px-6 py-3.5 rounded bg-[rgba(168,85,247,0.1)] text-[#A855F7] border-r-2 border-[#A855F7] transition-all group cursor-pointer">
					<span className="material-symbols-outlined text-xl">dashboard</span>
					<span className="font-['Space_Grotesk'] text-[10px] uppercase tracking-[0.2em] font-bold">
						Dashboard
					</span>
				</div>
				<div
					onClick={() => {
						onFilterChange("recent");
						scrollToSection(recentRef);
					}}
					className="flex items-center gap-5 px-6 py-3.5 rounded text-slate-500 hover:bg-white/5 hover:text-[#f8fafc] transition-all cursor-pointer"
				>
					<span className="material-symbols-outlined text-xl">history</span>
					<span className="font-['Space_Grotesk'] text-[10px] uppercase tracking-[0.2em] font-bold">
						Recent
					</span>
				</div>
				<div
					onClick={() => scrollToSection(reposRef)}
					className="flex items-center gap-5 px-6 py-3.5 rounded text-slate-500 hover:bg-white/5 hover:text-[#f8fafc] transition-all cursor-pointer"
				>
					<span className="material-symbols-outlined text-xl">upload_file</span>
					<span className="font-['Space_Grotesk'] text-[10px] uppercase tracking-[0.2em] font-bold">
						Import
					</span>
				</div>
				<div
					onClick={() => navigate({ to: "/profile" })}
					className="flex items-center gap-5 px-6 py-3.5 rounded text-slate-500 hover:bg-white/5 hover:text-[#f8fafc] transition-all cursor-pointer"
				>
					<span className="material-symbols-outlined text-xl">person</span>
					<span className="font-['Space_Grotesk'] text-[10px] uppercase tracking-[0.2em] font-bold">
						Profile
					</span>
				</div>
				<div
					onClick={onShowCoderMatch}
					className="flex items-center gap-5 px-6 py-3.5 rounded text-pink-500 hover:bg-pink-500/10 hover:text-pink-400 transition-all cursor-pointer"
				>
					<span className="material-symbols-outlined text-xl">favorite</span>
					<span className="font-['Space_Grotesk'] text-[10px] uppercase tracking-[0.2em] font-bold">
						Vibe Match
					</span>
					{vibeMatchUnread > 0 && (
						<span className="ml-auto w-2 h-2 bg-pink-500 rounded-full animate-pulse shrink-0" />
					)}
				</div>
			</nav>
			<div className="px-6 mt-auto">
				<button
					onClick={onShowCreate}
					className="w-full flex items-center justify-center gap-3 py-5 bg-[#A855F7] text-[#02040a] font-['Space_Grotesk'] font-black text-[10px] uppercase tracking-[0.3em] rounded shadow-[0_0_30px_rgba(168,85,247,0.3)] hover:brightness-110 active:scale-[0.98] transition-all"
				>
					<span className="material-symbols-outlined text-sm">add</span>
					New Repository
				</button>
			</div>
		</aside>
	);
}

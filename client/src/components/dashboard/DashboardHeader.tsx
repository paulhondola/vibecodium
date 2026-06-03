import { useNavigate } from "@tanstack/react-router";
import type { AuthUser } from "../../contexts/AuthProvider";

interface DashboardHeaderProps {
	user: AuthUser;
}

export default function DashboardHeader({ user }: DashboardHeaderProps) {
	const navigate = useNavigate();

	return (
		<header className="fixed top-0 z-[100] flex justify-between items-center w-full px-8 h-14 bg-[rgba(10,12,20,0.8)] backdrop-blur-xl border-b border-[rgba(168,85,247,0.1)]">
			<div className="flex items-center gap-12">
				<div
					className="text-xl font-bold tracking-tighter text-[#A855F7] font-['Space_Grotesk'] flex items-center gap-2 cursor-pointer"
					onClick={() => navigate({ to: "/", search: { w: undefined } })}
				>
					<span className="material-symbols-outlined text-[#A855F7] fill-1 animate-pulse">
						terminal
					</span>
					VibeCodium
				</div>
			</div>
			<div className="flex items-center gap-6">
				<div className="hidden lg:flex items-center bg-[rgba(168,85,247,0.1)] px-4 py-1.5 rounded-full border border-[rgba(168,85,247,0.2)]">
					<span className="w-1.5 h-1.5 rounded-full bg-[#A855F7] mr-3 animate-ping" />
					<span className="text-[9px] uppercase tracking-[0.3em] font-black text-[#A855F7]">
						Online
					</span>
				</div>
				<div className="flex items-center gap-3 ml-2 border-l border-white/10 pl-5">
					<span className="text-[9px] font-['JetBrains_Mono'] text-slate-500 uppercase tracking-widest hidden sm:block">
						<span className="text-[#A855F7]">@{user.nickname}</span>
					</span>
					<div className="w-8 h-8 rounded-full border border-[rgba(168,85,247,0.3)] p-0.5 overflow-hidden">
						<img
							alt="User Profile"
							className="w-full h-full rounded-full object-cover"
							src={user.picture || ""}
						/>
					</div>
				</div>
			</div>
		</header>
	);
}

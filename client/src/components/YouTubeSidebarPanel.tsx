import { useState } from "react";
import { Youtube } from "lucide-react";

const PLAYLISTS = [
	{ id: "PLhQjrBD2T380xvFSUmToMMzERZ3qB5Ueu", label: "🎓 CS50" },
	{ id: "PLillGF-RfqbZ7s3t6ZInY3NjEOOX7hsBv", label: "⚡ Web Dev" },
	{ id: "PLZlA0Gpn_vH8jbFkBjOumy_oe4Ya3PeIX", label: "🟨 JavaScript" },
	{ id: "PLWKjhJtqVAbnRT_hue-3zyiuIYj0OlpyG", label: "🔷 TypeScript" },
	{ id: "PL0vfts4VzfNiI1BsIK5ArtkZNACOTJKMN", label: "🤖 AI Coding" },
] as const;

export default function YouTubeSidebarPanel() {
	const [selectedId, setSelectedId] = useState<string>(PLAYLISTS[0].id);

	const embedSrc = `https://www.youtube-nocookie.com/embed/videoseries?list=${selectedId}&autoplay=0&rel=0`;

	return (
		<div className="flex flex-col h-full bg-[#09090b]">
			<div className="px-3 py-2 border-b border-[#27272a] shrink-0 flex items-center gap-2">
				<Youtube size={13} className="text-[#FF0000]" />
				<span className="text-[10px] uppercase tracking-wider font-medium text-zinc-500">
					Dev Content
				</span>
			</div>
			<div className="flex gap-1 px-2 py-1.5 border-b border-[#27272a] shrink-0 flex-wrap">
				{PLAYLISTS.map((p) => (
					<button
						key={p.id}
						onClick={() => setSelectedId(p.id)}
						className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
							selectedId === p.id
								? "bg-[#FF0000]/10 border-[#FF0000]/40 text-red-400"
								: "border-[#27272a] text-zinc-500 hover:border-zinc-600 hover:text-zinc-400"
						}`}
					>
						{p.label}
					</button>
				))}
			</div>
			<div className="flex-1 min-h-0">
				<iframe
					key={embedSrc}
					src={embedSrc}
					width="100%"
					height="100%"
					frameBorder="0"
					allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
					allowFullScreen
					style={{ display: "block" }}
				/>
			</div>
		</div>
	);
}

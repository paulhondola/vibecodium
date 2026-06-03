/**
 * Development preview — import this in any route temporarily to inspect all button states.
 * Delete when done.
 *
 * Usage: import ButtonPreview from "@/components/ui/button-preview"
 *        then <ButtonPreview /> anywhere on screen
 */

import {
	Rocket,
	GitBranch,
	Shield,
	Plus,
	ExternalLink,
	Terminal,
} from "lucide-react";
import { Button } from "./button";

export default function ButtonPreview() {
	return (
		<div className="min-h-screen bg-[#09090b] flex items-center justify-center p-12 font-['Inter',system-ui,sans-serif]">
			<div className="w-full max-w-xl space-y-10">
				{/* Header */}
				<div className="space-y-1">
					<p className="text-[11px] font-medium tracking-[0.66px] uppercase text-zinc-600">
						VibeCodium Design System
					</p>
					<h1 className="text-2xl font-semibold tracking-[-0.48px] text-zinc-50">
						Button Component
					</h1>
				</div>

				{/* Primary */}
				<section className="space-y-3">
					<label className="text-[11px] font-medium tracking-[0.66px] uppercase text-zinc-600 block">
						Primary
					</label>
					<div className="flex flex-wrap items-center gap-3">
						<Button variant="primary" size="lg">
							<Rocket />
							Deploy
						</Button>
						<Button variant="primary">
							<Plus />
							New Project
						</Button>
						<Button variant="primary" size="sm">
							Commit
						</Button>
						<Button variant="primary" loading>
							Deploying
						</Button>
						<Button variant="primary" disabled>
							Disabled
						</Button>
					</div>
				</section>

				{/* Secondary */}
				<section className="space-y-3">
					<label className="text-[11px] font-medium tracking-[0.66px] uppercase text-zinc-600 block">
						Secondary
					</label>
					<div className="flex flex-wrap items-center gap-3">
						<Button variant="secondary" size="lg">
							<GitBranch />
							Import Repo
						</Button>
						<Button variant="secondary">
							<ExternalLink />
							Open Preview
						</Button>
						<Button variant="secondary" size="sm">
							Cancel
						</Button>
						<Button variant="secondary" loading>
							Loading
						</Button>
						<Button variant="secondary" disabled>
							Disabled
						</Button>
					</div>
				</section>

				{/* Ghost */}
				<section className="space-y-3">
					<label className="text-[11px] font-medium tracking-[0.66px] uppercase text-zinc-600 block">
						Ghost
					</label>
					<div className="flex flex-wrap items-center gap-3">
						<Button variant="ghost">
							<Terminal />
							Toggle Terminal
						</Button>
						<Button variant="ghost" size="sm">
							Format
						</Button>
						<Button variant="ghost" disabled>
							Disabled
						</Button>
					</div>
				</section>

				{/* Destructive */}
				<section className="space-y-3">
					<label className="text-[11px] font-medium tracking-[0.66px] uppercase text-zinc-600 block">
						Destructive
					</label>
					<div className="flex flex-wrap items-center gap-3">
						<Button variant="destructive">
							<Shield />
							Delete Project
						</Button>
						<Button variant="destructive" size="sm">
							Remove
						</Button>
						<Button variant="destructive" loading>
							Deleting
						</Button>
					</div>
				</section>

				{/* Icon */}
				<section className="space-y-3">
					<label className="text-[11px] font-medium tracking-[0.66px] uppercase text-zinc-600 block">
						Icon sizes
					</label>
					<div className="flex flex-wrap items-center gap-3">
						<Button variant="ghost" size="icon">
							<Plus />
						</Button>
						<Button variant="ghost" size="icon-md">
							<Terminal />
						</Button>
						<Button variant="secondary" size="icon">
							<GitBranch />
						</Button>
						<Button variant="primary" size="icon-md">
							<Rocket />
						</Button>
					</div>
				</section>

				{/* Link */}
				<section className="space-y-3">
					<label className="text-[11px] font-medium tracking-[0.66px] uppercase text-zinc-600 block">
						Link
					</label>
					<div className="flex flex-wrap items-center gap-3">
						<Button variant="link">View documentation</Button>
						<Button variant="link">
							<ExternalLink />
							Open in browser
						</Button>
					</div>
				</section>

				{/* Divider */}
				<div className="border-t border-[#27272a] pt-6 space-y-3">
					<label className="text-[11px] font-medium tracking-[0.66px] uppercase text-zinc-600 block">
						Real usage — toolbar row
					</label>
					<div className="flex items-center gap-1 bg-[#111113] border border-[#27272a] rounded-[10px] px-3 py-2">
						<Button variant="ghost" size="icon">
							<GitBranch />
						</Button>
						<Button variant="ghost" size="icon">
							<Terminal />
						</Button>
						<Button variant="ghost" size="icon">
							<Shield />
						</Button>
						<div className="w-px h-5 bg-[#27272a] mx-1" />
						<Button variant="secondary" size="sm">
							Save
						</Button>
						<Button variant="primary" size="sm">
							<Rocket />
							Deploy
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}

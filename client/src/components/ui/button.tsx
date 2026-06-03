import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
	// Base: font, layout, transitions, focus, disabled
	[
		"relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap",
		"font-['Inter',system-ui,sans-serif] font-medium text-[13px] leading-none",
		"select-none cursor-pointer outline-none",
		"transition-[colors,background-color,border-color,transform,opacity] duration-150 ease-out",
		"disabled:pointer-events-none disabled:opacity-35",
		"[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-[14px] [&_svg]:shrink-0",
		// Focus ring — purple, offset against the canvas
		"focus-visible:ring-2 focus-visible:ring-purple-500/50 focus-visible:ring-offset-1 focus-visible:ring-offset-[#09090b]",
		// Active press feel
		"active:scale-[0.97]",
	],
	{
		variants: {
			variant: {
				// ── Primary ─────────────────────────────────────────────────────────
				// Purple accent, diagonal shimmer sweep on hover, darker on press
				primary: [
					"bg-[#A855F7] text-white rounded-[7px]",
					"hover:bg-[#9333EA]",
					"active:bg-[#7E22CE]",
					// Shimmer sweep via ::before
					"overflow-hidden",
					"before:absolute before:inset-0 before:content-['']",
					"before:translate-x-[-130%] before:skew-x-[-20deg]",
					"before:bg-gradient-to-r before:from-transparent before:via-white/[0.09] before:to-transparent",
					"hover:before:translate-x-[130%] before:transition-transform before:duration-700 before:ease-out",
				],
				// Default maps to primary for shadcn compat
				default: [
					"bg-[#A855F7] text-white rounded-[7px]",
					"hover:bg-[#9333EA]",
					"active:bg-[#7E22CE]",
					"overflow-hidden",
					"before:absolute before:inset-0 before:content-['']",
					"before:translate-x-[-130%] before:skew-x-[-20deg]",
					"before:bg-gradient-to-r before:from-transparent before:via-white/[0.09] before:to-transparent",
					"hover:before:translate-x-[130%] before:transition-transform before:duration-700 before:ease-out",
				],

				// ── Secondary ────────────────────────────────────────────────────────
				// Transparent + hairline border. Hover: border brightens, bg steps up.
				secondary: [
					"bg-transparent text-zinc-400 rounded-[7px]",
					"border border-[#3f3f46]",
					"hover:border-zinc-500 hover:text-zinc-200 hover:bg-[#1e1e24]",
					"active:bg-[#27272a]",
				],

				// Outline alias
				outline: [
					"bg-transparent text-zinc-400 rounded-[7px]",
					"border border-[#3f3f46]",
					"hover:border-zinc-500 hover:text-zinc-200 hover:bg-[#1e1e24]",
					"active:bg-[#27272a]",
				],

				// ── Ghost ─────────────────────────────────────────────────────────────
				// No border. Used for toolbar actions, icon-adjacent labels.
				ghost: [
					"bg-transparent text-zinc-500 rounded-[5px]",
					"hover:bg-[#1e1e24] hover:text-zinc-300",
					"active:bg-[#27272a]",
				],

				// ── Destructive ───────────────────────────────────────────────────────
				// Red tint. For dangerous actions only.
				destructive: [
					"bg-red-500/10 text-red-400 rounded-[7px]",
					"border border-red-500/25",
					"hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-300",
					"active:bg-red-500/30",
					"focus-visible:ring-red-500/40",
				],

				// ── Link ──────────────────────────────────────────────────────────────
				link: [
					"bg-transparent text-purple-400 underline-offset-4",
					"hover:underline hover:text-purple-300",
					"active:text-purple-500",
					"px-1 rounded-[3px]",
				],
			},

			size: {
				default: "h-9 px-4 has-[>svg]:px-3",
				sm: "h-7 px-3 text-[12px] rounded-[5px] has-[>svg]:px-2.5",
				lg: "h-10 px-5 text-[14px] rounded-[9px] has-[>svg]:px-4",
				icon: "size-[28px] rounded-[5px] p-0",
				"icon-md": "size-9 rounded-[7px] p-0",
			},
		},

		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

export interface ButtonProps
	extends React.ComponentProps<"button">,
		VariantProps<typeof buttonVariants> {
	asChild?: boolean;
	loading?: boolean;
}

function Button({
	className,
	variant,
	size,
	asChild = false,
	loading = false,
	disabled,
	children,
	...props
}: ButtonProps) {
	const Comp = asChild ? Slot : "button";

	return (
		<Comp
			data-slot="button"
			disabled={disabled || loading}
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		>
			{loading ? (
				<>
					<Loader2 className="size-[14px] animate-spin opacity-70 shrink-0" />
					<span className="opacity-60">{children}</span>
				</>
			) : (
				children
			)}
		</Comp>
	);
}

export { Button, buttonVariants };

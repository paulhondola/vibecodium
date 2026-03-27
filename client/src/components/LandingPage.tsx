import { motion, useMotionTemplate, useMotionValue, type Variants } from "framer-motion";
import { Copy, Terminal as TerminalIcon, Users, Bot, Sparkles, ArrowRight, Layers, MousePointer2 } from "lucide-react";
import { MouseEvent } from "react";

interface LandingPageProps {
	onEnter: () => void;
}

// Complex framer motion variants
const containerVariants: Variants = {
	hidden: { opacity: 0 },
	show: {
		opacity: 1,
		transition: {
			staggerChildren: 0.15,
			delayChildren: 0.1,
		},
	},
};

const itemVariants: Variants = {
	hidden: { opacity: 0, y: 40, filter: "blur(10px)" },
	show: { 
        opacity: 1, 
        y: 0, 
        filter: "blur(0px)",
        transition: { type: "spring", stiffness: 60, damping: 15, duration: 0.6 } 
    },
};

// Interactive Bento Card Component with a glowing gradient effect following the mouse
function BentoCard({ children, className = "" }: { children: React.ReactNode, className?: string }) {
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    function handleMouseMove({ currentTarget, clientX, clientY }: MouseEvent) {
        const { left, top } = currentTarget.getBoundingClientRect();
        mouseX.set(clientX - left);
        mouseY.set(clientY - top);
    }

    return (
        <motion.div 
            variants={itemVariants}
            onMouseMove={handleMouseMove}
            className={`group relative rounded-3xl bg-[#09090b] border border-white/10 overflow-hidden transform transition-all hover:scale-[1.02] hover:shadow-2xl hover:shadow-cyan-500/10 ${className}`}
        >
            <motion.div
                className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 transition duration-300 group-hover:opacity-100"
                style={{
                    background: useMotionTemplate`
                        radial-gradient(
                            650px circle at ${mouseX}px ${mouseY}px,
                            rgba(6, 182, 212, 0.15),
                            transparent 80%
                        )
                    `,
                }}
            />
            <div className="relative h-full z-10 p-8 flex flex-col justify-between overflow-hidden">
                {children}
            </div>
        </motion.div>
    );
}

export default function LandingPage({ onEnter }: LandingPageProps) {
	return (
		<div className="min-h-screen bg-[#000000] text-white font-sans overflow-x-hidden selection:bg-cyan-500/30 relative">
            {/* Background Grid Pattern */}
			<div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none opacity-40" />

			{/* Soft Ambient Glows */}
			<div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-cyan-600/20 blur-[140px] pointer-events-none" />
			<div className="absolute top-[20%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-purple-600/10 blur-[140px] pointer-events-none" />

			{/* Navigation */}
			<nav className="flex items-center justify-between px-8 py-6 max-w-[1400px] mx-auto relative z-20">
				<div className="flex items-center gap-3">
					<div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-400 to-blue-600 flex items-center justify-center text-black font-extrabold shadow-lg shadow-cyan-500/20">
						iT
					</div>
					<span className="font-bold text-2xl tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">iTECify</span>
				</div>
                <button onClick={onEnter} className="group px-5 py-2.5 rounded-full bg-white text-black text-sm font-semibold transition-all hover:bg-gray-200 shadow-lg shadow-white/10 flex items-center gap-2">
                    Start Coding
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
			</nav>

			{/* Hero Section */}
			<main className="max-w-[1200px] mx-auto px-6 pt-20 pb-40 relative z-10 flex flex-col items-center">
				<motion.div
					initial={{ opacity: 0, y: 30 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ type: "spring", stiffness: 80, damping: 20, delay: 0.1 }}
					className="max-w-4xl flex flex-col items-center text-center"
				>
					<div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-gray-300 text-xs font-semibold uppercase tracking-widest mb-10 shadow-sm backdrop-blur-md">
						<Sparkles size={14} className="text-cyan-400" />
						Figma pentru Cod, propulsat de AI.
					</div>

					<h1 className="text-6xl md:text-8xl font-bold tracking-tighter mb-8 bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-gray-500 leading-[1.1]">
						Colaborare fluidă.<br />
						<span className="bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600">Zero compromisuri.</span>
					</h1>

					<p className="text-xl text-gray-400 max-w-2xl mb-12 leading-relaxed font-light">
						Tu, echipa ta și un asistent AI codați împreună în timp real direcți din browser. Fără servere setate, totul rulează instant într-un <span className="text-white font-medium">sandbox inteligent</span>.
					</p>

					<button
						onClick={onEnter}
						className="group relative px-10 py-5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-full text-xl transition-all hover:shadow-[0_0_80px_rgba(6,182,212,0.4)] hover:scale-105 flex items-center gap-3 overflow-hidden shadow-2xl"
					>
                        <div className="absolute inset-0 bg-white/20 w-full h-full skew-x-[-30deg] -translate-x-[150%] group-hover:animate-[shimmer_1.5s_infinite]" />
						Deschide Workspace
						<ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" />
					</button>
				</motion.div>

				{/* Bento Grid Features */}
				<motion.div
					variants={containerVariants}
					initial="hidden"
					whileInView="show"
                    viewport={{ once: true, margin: "-100px" }}
					className="w-full mt-40 grid grid-cols-1 md:grid-cols-6 gap-6 auto-rows-[340px]"
				>
					{/* Card 1: Multi-Human & AI */}
					<BentoCard className="md:col-span-4">
                        {/* Mock Editor Visual */}
                        <div className="absolute right-0 top-0 bottom-0 w-[60%] sm:w-[50%] bg-[#111111] border-l border-white/10 p-6 flex flex-col gap-3 font-mono text-[10px] text-gray-500 mask-image-linear">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
                                <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                            </div>
                            <div className="text-blue-400">export function <span className="text-yellow-200">App</span>() &#123;</div>
                            <div className="pl-4">return (</div>
                            <div className="pl-8 text-cyan-200">&lt;div className="app"&gt;</div>
                            
                            {/* Animated Cursor 1 */}
                            <motion.div 
                                animate={{ x: [0, 20, 0], opacity: [1, 0.8, 1] }} 
                                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                                className="pl-12 flex items-center gap-1 text-cyan-400"
                            >
                                &lt;Header /&gt; <MousePointer2 size={12} fill="#22d3ee" className="-ml-1" />
                            </motion.div>
                            
                            {/* Animated Cursor 2 (AI) */}
                            <motion.div 
                                animate={{ x: [30, 0, 30], y: [10, 0, 10] }} 
                                transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut", delay: 0.5 }}
                                className="pl-12 flex items-center relative gap-1 text-purple-400 mt-2"
                            >
                                &lt;HeroSection /&gt; <div className="absolute -right-4 -bottom-4 bg-purple-500 text-white text-[8px] px-1 rounded flex items-center gap-1"><Sparkles size={8}/> AI Agent</div>
                                <div className="w-[1px] h-4 bg-purple-500 animate-pulse ml-0.5" />
                            </motion.div>

                            <div className="pl-8 text-cyan-200 mt-2">&lt;/div&gt;</div>
                            <div className="pl-4">);</div>
                            <div>&#125;</div>
                        </div>

						<div className="relative z-20 max-w-[50%] flex flex-col justify-end h-full">
                            <div className="w-12 h-12 bg-blue-500/20 border border-blue-500/30 rounded-2xl flex items-center justify-center mb-6">
                                <Users size={24} className="text-blue-400" />
                            </div>
							<h3 className="text-3xl font-bold tracking-tight text-white mb-4">Echipă Completă.<br/>+ Asistent Inteligent.</h3>
							<p className="text-gray-400 text-lg">Ai-ul și colegii tăi pot scrie cod în același fișier, în timp real, direct în browser.</p>
						</div>
					</BentoCard>

					{/* Card 2: Sandboxing */}
					<BentoCard className="md:col-span-2">
                        {/* Mock Terminal Visual */}
                        <div className="absolute top-0 right-0 left-0 h-[50%] bg-gradient-to-b from-[#111111] to-transparent p-6 font-mono text-[10px]">
                            <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 2 }} className="text-green-400">➜ ~/project $ bun run dev</motion.div>
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="text-gray-400 mt-2">Vite server started on localhost:3000</motion.div>
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }} className="text-cyan-400 mt-1">Docker container spawned in 12ms.</motion.div>
                        </div>
						<div className="relative z-20 flex flex-col justify-end h-full mt-auto">
                            <div className="w-12 h-12 bg-green-500/20 border border-green-500/30 rounded-2xl flex items-center justify-center mb-4 mt-8">
                                <TerminalIcon size={24} className="text-green-400" />
                            </div>
							<h3 className="text-xl font-bold text-white mb-2">Sandbox Instantaneu</h3>
							<p className="text-gray-400 text-sm">Orice cod e rulat într-un container complet protejat, direct din terminalul integrat.</p>
						</div>
					</BentoCard>

					{/* Card 3: Pending UI Blocks */}
					<BentoCard className="md:col-span-3">
                        <div className="absolute right-0 top-0 w-[55%] h-full bg-[#111111] border-l border-white/10 p-4 flex flex-col gap-2 opacity-80 mix-blend-screen">
                            {/* Mock Pending Edit */}
                            <div className="w-full bg-[#09090b] rounded border border-purple-500/40 p-3 mt-4">
                                <div className="text-[10px] text-purple-400 font-semibold mb-2 flex items-center gap-1"><Bot size={10}/> AI Proposal</div>
                                <div className="text-[10px] text-red-400 line-through bg-red-500/10 px-1 rounded">- old code snippet</div>
                                <div className="text-[10px] text-green-400 bg-green-500/10 px-1 rounded mt-1">+ new perfect code</div>
                                <div className="flex gap-2 mt-3 cursor-pointer">
                                    <div className="w-16 h-4 rounded bg-red-500/20" />
                                    <div className="w-16 h-4 rounded bg-green-500/40" />
                                </div>
                            </div>
                        </div>
						<div className="relative z-20 max-w-[50%] flex flex-col justify-end h-full">
                            <div className="w-12 h-12 bg-purple-500/20 border border-purple-500/30 rounded-2xl flex items-center justify-center mb-6">
                                <Layers size={24} className="text-purple-400" />
                            </div>
							<h3 className="text-2xl font-bold text-white mb-2">AI Block-Editor</h3>
							<p className="text-gray-400 text-sm">Modificările AI sunt adăugate în UI ca blocuri (precum cele din Notion). Tu accepți sau refuzi.</p>
						</div>
					</BentoCard>

					{/* Card 4: Action History */}
					<BentoCard className="md:col-span-3">
                        <div className="absolute right-0 top-0 bottom-0 w-[40%] border-l border-white/10 bg-[#161b22]/50 flex flex-col pt-8">
                            <div className="h-0.5 w-full bg-blue-500/50 mb-4 scale-y-50" />
                            <div className="h-0.5 w-[80%] bg-blue-500/20 mb-4 scale-y-50" />
                            <div className="h-0.5 w-[60%] bg-blue-500/20 mb-4 scale-y-50" />
                            <div className="h-0.5 w-[90%] bg-blue-500/20 mb-4 scale-y-50" />
                            <div className="absolute top-[30px] left-[-4px] w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,1)]" />
                        </div>
						<div className="relative z-20 max-w-[60%] flex flex-col justify-end h-full">
                            <div className="w-12 h-12 bg-orange-500/20 border border-orange-500/30 rounded-2xl flex items-center justify-center mb-6">
                                <Copy size={24} className="text-orange-400" />
                            </div>
							<h3 className="text-2xl font-bold text-white mb-2">Time-Travel History</h3>
							<p className="text-gray-400 text-sm">Agentul a greșit? Nici o problemă. Alege un snapshot diferențial și revino la codul corect.</p>
						</div>
					</BentoCard>

				</motion.div>
			</main>
		</div>
	);
}

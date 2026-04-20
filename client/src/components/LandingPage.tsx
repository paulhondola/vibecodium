import { useAuth } from "@/contexts/AuthProvider";
import { useState } from "react";
import ImportModal from "./ImportModal";
import { useNavigate } from "@tanstack/react-router";

interface LandingPageProps {
	onEnter: (projectId?: string) => void;
}

export default function LandingPage({ onEnter }: LandingPageProps) {
    const { isAuthenticated, user, isLoading, loginWithRedirect } = useAuth();
    const [isImportModalOpen, setImportModalOpen] = useState(false);
    const navigate = useNavigate();

	return (
		<div className="min-h-screen bg-[#02040a] text-[#f8fafc] font-['Inter'] selection:bg-[rgba(168,85,247,0.3)] selection:text-white overflow-x-hidden">
			{/* Navigation */}
			<nav className="fixed top-0 z-[100] flex justify-between items-center w-full px-6 h-14 glass-card rounded-none border-x-0 border-t-0 border-b-[rgba(168,85,247,0.1)]">
				<div className="flex items-center gap-10">
					<span className="text-xl font-bold text-[#A855F7] tracking-tighter font-['Space_Grotesk'] flex items-center gap-2">
						<span className="material-symbols-outlined text-[#A855F7] fill-1 animate-pulse">terminal</span>
						VibeCodium
					</span>

				</div>
				<div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate({ to: "/community" })}
                        className="text-xs font-semibold text-gray-400 hover:text-[#A855F7] transition-colors tracking-widest uppercase flex items-center gap-1.5"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                        Community
                    </button>

					<button
						onClick={() => isAuthenticated ? navigate({ to: "/profile" }) : onEnter()}
						className="relative overflow-hidden px-6 py-2 rounded-lg bg-[#A855F7] font-['Space_Grotesk'] font-bold text-xs uppercase tracking-widest text-[#02040a] hover:scale-105 active:scale-95 transition-all group flex items-center justify-center gap-2"
					>
						<span className="relative z-10 flex items-center gap-1.5">
                            {isLoading ? "..." : isAuthenticated ? (
                                <>
                                  <span className="material-symbols-outlined text-[16px] leading-[1]">person</span>
                                  {user?.nickname || user?.name || "User"}
                                </>
                            ) : "Go Live"}
                        </span>
						<div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
					</button>
				</div>
			</nav>

			<main className="pl-16 pt-14 pb-8 overflow-x-hidden">
				{/* Cinematic Hero Section */}
				<section className="relative min-h-[90vh] flex flex-col items-center justify-center px-6 warp-speed">
					<div className="warp-layer"></div>
					<div className="absolute inset-0 bg-gradient-to-b from-[#02040a] via-transparent to-[#02040a] z-0"></div>

					{/* Floating Particles & Data Streams */}
					<div className="absolute inset-0 pointer-events-none z-10">
						<div className="data-stream top-[20%]"></div>
						<div className="data-stream top-[45%] opacity-30" style={{ animationDelay: '1.5s' }}></div>
						<div className="data-stream top-[70%]" style={{ animationDelay: '0.8s' }}></div>
					</div>

					<div className="z-20 text-center max-w-5xl mx-auto space-y-10 animate-float pt-20">


						<h1 className="text-6xl md:text-8xl font-['Space_Grotesk'] font-bold tracking-tighter text-[#f8fafc] leading-[0.9] text-glow">
							The Future of <br/>
							<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#A855F7] via-white to-[#3B82F6] animate-pulse">Collaborative Coding</span>
						</h1>

						<p className="text-xl md:text-2xl text-slate-400 font-light max-w-3xl mx-auto tracking-tight">
							Build at the speed of thought with agentic AI integration. <br/>
							<span className="text-[rgba(59,130,246,0.8)]">A high-density workspace for the modern digital architect.</span>
						</p>

						<div className="flex flex-wrap justify-center gap-6 pt-6">
							<button
								onClick={() => isAuthenticated ? navigate({ to: "/dashboard" }) : onEnter()}
								className="px-10 py-5 bg-[#A855F7] text-[#02040a] font-['Space_Grotesk'] font-bold rounded-xl shadow-[0_0_30px_rgba(168,85,247,0.4)] hover:shadow-[0_0_50px_rgba(168,85,247,0.6)] hover:-translate-y-1 transition-all duration-300 uppercase tracking-widest text-sm"
							>
								{isLoading ? "Starting..." : isAuthenticated ? "Dashboard" : "Initialize Workspace"}
							</button>
							<button 
                                onClick={() => isAuthenticated ? setImportModalOpen(true) : loginWithRedirect()}
                                className="px-10 py-5 glass-card text-[#f8fafc] font-['Space_Grotesk'] font-bold rounded-xl hover:bg-white/5 transition-all duration-300 uppercase tracking-widest text-sm border-[rgba(168,85,247,0.2)]">
								Import Repository
							</button>
						</div>
					</div>

					{/* Terminal Preview with Digital Rain feel */}
					<div className="z-20 mt-20 w-full max-w-5xl mx-auto rounded-2xl overflow-hidden glass-card border-[rgba(168,85,247,0.2)] sentient-ai transform rotate-1 perspective-1000">
						<div className="flex items-center justify-between px-6 py-3 bg-[rgba(26,31,46,0.4)] border-b border-[rgba(168,85,247,0.1)]">
							<div className="flex gap-2">
								<div className="w-3 h-3 rounded-full bg-red-500/50"></div>
								<div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
								<div className="w-3 h-3 rounded-full bg-green-500/50"></div>
							</div>
							<div className="text-[10px] font-['Space_Grotesk'] text-slate-500 uppercase tracking-[0.4em]">system.core — vibecodium_v4</div>
							<div className="flex gap-4 opacity-50">
								<span className="material-symbols-outlined text-sm">bolt</span>
							</div>
						</div>
						<div className="flex flex-col md:flex-row h-[450px]">
							<div className="flex-1 p-8 font-mono text-sm leading-relaxed overflow-hidden bg-black/40">
								<div className="flex gap-4 text-slate-600 mb-1">
									<span className="w-6 text-right">01</span>
									<span className="text-[#3B82F6]">import</span>
									<span>{'{ NeuralMesh }'}</span>
									<span className="text-[#3B82F6]">from</span>
									<span className="text-[#10B981]">'@vibecodium/v4'</span>;
								</div>
								<div className="flex gap-4 text-slate-600 mb-1">
									<span className="w-6 text-right">02</span>
									<span> </span>
								</div>
								<div className="flex gap-4 mb-1 text-[#f8fafc]">
									<span className="w-6 text-right text-slate-600">03</span>
									<span className="text-[#3B82F6]">const</span>
									<span>architect</span> =
									<span className="text-[#3B82F6]">new</span>
									<span className="text-[#A855F7]">NeuralMesh</span>({'{'}
								</div>
								<div className="relative ml-14 my-6 p-6 rounded-xl glass-card border-l-4 border-[#A855F7] sentient-ai">
									<div className="flex items-center gap-3 mb-3">
										<span className="material-symbols-outlined text-[#A855F7] text-lg fill-1 animate-pulse">psychology</span>
										<span className="text-[10px] font-['Space_Grotesk'] font-black text-[#A855F7] uppercase tracking-[0.3em]">AI Sentient Optimization</span>
									</div>
									<div className="text-sm font-mono text-[#f8fafc] space-y-1">
										<div>
											<span className="text-[#10B981]">pattern</span>:
											<span className="text-secondary-fixed-dim">'Distributed-Graph'</span>,
										</div>
										<div>
											<span className="text-[#10B981]">concurrency</span>:
											<span className="text-[#3B82F6]">true</span>,
										</div>
										<div>
											<span className="text-[#10B981]">latency_threshold</span>:
											<span className="text-[#A855F7]">'&lt; 5ms'</span>
										</div>
									</div>
									<div className="mt-5 flex gap-3">
										<button className="px-4 py-1 text-[10px] bg-[#A855F7] text-[#02040a] font-black rounded uppercase tracking-widest hover:brightness-125 transition-all">
											Accept Merge
										</button>
										<button className="px-4 py-1 text-[10px] border border-white/10 text-slate-400 rounded uppercase tracking-widest hover:bg-white/5">
											Refactor
										</button>
									</div>
								</div>
								<div className="flex gap-4 text-slate-600">
									<span className="w-6 text-right">04</span>
									<span>{'});'}</span>
								</div>
							</div>
							<div className="hidden md:block w-80 bg-[rgba(10,12,20,0.6)] border-l border-[rgba(168,85,247,0.1)] p-6 font-mono text-[11px] backdrop-blur-xl">
								<div className="text-[#10B981] mb-3 flex items-center gap-2">
									<span className="w-2 h-2 rounded-full bg-[#10B981] shadow-[0_0_10px_#10B981]"></span>
									CORE ONLINE
								</div>
								<div className="text-slate-500">$ vibecodium deploy --global</div>
								<div className="text-slate-400 mt-2">Connecting to Neural Edge...</div>
								<div className="text-[#A855F7] mt-3 font-bold">SYCHRONIZING [████████████] 100%</div>
								<div className="text-[#10B981] mt-2">DEPLOYED: https://void-x1.vibecodium.dev</div>
								<div className="mt-10 border-t border-[rgba(168,85,247,0.1)] pt-4">
									<div className="flex items-center gap-2 text-[rgba(168,85,247,0.6)]">
										<span className="material-symbols-outlined text-xs">radar</span>
										<span className="uppercase tracking-[0.2em] text-[9px]">Neural Stream Active</span>
									</div>
									<div className="mt-2 h-16 w-full bg-[rgba(168,85,247,0.05)] rounded border border-[rgba(168,85,247,0.1)] flex items-end p-1 gap-1">
										<div className="flex-1 bg-[rgba(168,85,247,0.4)] animate-pulse h-1/2"></div>
										<div className="flex-1 bg-[rgba(168,85,247,0.6)] animate-pulse h-3/4"></div>
										<div className="flex-1 bg-[rgba(168,85,247,0.4)] animate-pulse h-1/3"></div>
										<div className="flex-1 bg-[rgba(168,85,247,0.8)] animate-pulse h-full"></div>
										<div className="flex-1 bg-[rgba(168,85,247,0.5)] animate-pulse h-1/2"></div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</section>

				{/* Feature Bento Grid */}
				<section className="py-32 px-6 max-w-7xl mx-auto relative">
					<div className="absolute top-0 right-0 w-96 h-96 bg-[rgba(168,85,247,0.1)] blur-[150px] -z-10"></div>
					<div className="absolute bottom-0 left-0 w-96 h-96 bg-[rgba(59,130,246,0.1)] blur-[150px] -z-10"></div>

					<div className="mb-20 text-center lg:text-left flex flex-col lg:flex-row items-end justify-between gap-10">
						<div className="max-w-2xl">
							<h2 className="text-5xl font-['Space_Grotesk'] font-bold tracking-tighter mb-6 text-glow">
								Everything you need. <span className="text-[#A855F7]">Nothing you don't.</span>
							</h2>
							<p className="text-slate-400 text-lg">
								A real IDE in the browser — with live collaboration, an AI agent that shows its work, and sandboxed execution for six languages.
							</p>
						</div>
						<div className="hidden lg:block h-[1px] flex-1 bg-gradient-to-r from-[rgba(168,85,247,0.5)] to-transparent mb-4"></div>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-12 gap-8">
						{/* Collaboration — large card */}
						<div className="md:col-span-8 glass-card p-10 relative overflow-hidden group">
							<div className="absolute top-0 right-0 w-64 h-64 bg-[rgba(59,130,246,0.05)] blur-3xl -z-10 group-hover:bg-[rgba(59,130,246,0.15)] transition-all duration-700"></div>
							<div className="flex flex-col md:flex-row gap-10 h-full">
								<div className="flex-1">
									<div className="mb-8 w-14 h-14 rounded-2xl bg-[rgba(59,130,246,0.2)] flex items-center justify-center border border-[rgba(59,130,246,0.3)] shadow-[0_0_20px_rgba(59,130,246,0.3)]">
										<span className="material-symbols-outlined text-[#3B82F6] text-3xl fill-1">group</span>
									</div>
									<h3 className="text-3xl font-['Space_Grotesk'] font-bold mb-5 tracking-tight">Live Collaboration</h3>
									<p className="text-slate-400 leading-relaxed mb-8">
										Multiple developers, one editor — powered by Yjs CRDT. Colored cursors show exactly who is editing what file. Changes merge conflict-free in real time over WebSocket.
									</p>
									<div className="flex items-center gap-3 flex-wrap">
										<span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[rgba(59,130,246,0.15)] border border-[rgba(59,130,246,0.3)] text-[#3B82F6]">Yjs CRDT</span>
										<span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[rgba(59,130,246,0.15)] border border-[rgba(59,130,246,0.3)] text-[#3B82F6]">Y-Monaco</span>
										<span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[rgba(59,130,246,0.15)] border border-[rgba(59,130,246,0.3)] text-[#3B82F6]">WebSocket</span>
										<span className="ml-2 text-[10px] text-[#10B981] uppercase tracking-[0.3em] animate-pulse">● Live Now</span>
									</div>
								</div>
								<div className="flex-1 hidden lg:flex flex-col gap-3 justify-center font-mono text-xs">
									<div className="p-3 bg-black/40 rounded-xl border border-white/5 flex items-center gap-3">
										<span className="w-2.5 h-2.5 rounded-full bg-[#A855F7] shadow-[0_0_8px_#A855F7] flex-shrink-0"></span>
										<span className="text-slate-400">Alex is editing <span className="text-white">server/index.ts</span></span>
									</div>
									<div className="p-3 bg-black/40 rounded-xl border border-white/5 flex items-center gap-3">
										<span className="w-2.5 h-2.5 rounded-full bg-[#10B981] shadow-[0_0_8px_#10B981] flex-shrink-0"></span>
										<span className="text-slate-400">Radu is editing <span className="text-white">client/Workspace.tsx</span></span>
									</div>
									<div className="p-3 bg-black/40 rounded-xl border border-white/5 flex items-center gap-3">
										<span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6] shadow-[0_0_8px_#3B82F6] flex-shrink-0"></span>
										<span className="text-slate-400">Ana joined the session</span>
									</div>
								</div>
							</div>
						</div>

						{/* Deploy — small card */}
						<div className="md:col-span-4 glass-card p-10 flex flex-col justify-between group">
							<div className="mb-8 w-14 h-14 rounded-2xl bg-[rgba(16,185,129,0.2)] flex items-center justify-center border border-[rgba(16,185,129,0.3)]">
								<span className="material-symbols-outlined text-[#10B981] text-3xl">rocket_launch</span>
							</div>
							<div>
								<h3 className="text-2xl font-['Space_Grotesk'] font-bold mb-4 tracking-tight">One-Click Deploy</h3>
								<p className="text-slate-400 text-sm leading-relaxed">
									Connect your Vercel token in profile settings and deploy your project straight from the editor. Deployment logs stream back in the terminal in real time.
								</p>
							</div>
						</div>

						{/* AI Agent — full-width */}
						<div className="md:col-span-12 glass-card p-1 border-[rgba(168,85,247,0.3)] relative group overflow-hidden sentient-ai">
							<div className="absolute inset-0 bg-gradient-to-r from-[rgba(168,85,247,0.05)] via-[rgba(59,130,246,0.05)] to-[rgba(168,85,247,0.05)] animate-pulse"></div>
							<div className="relative bg-[#0a0c14] p-12 rounded-[14px] flex flex-col lg:flex-row items-start gap-16">
								<div className="lg:w-3/5">
									<div className="inline-flex items-center gap-3 mb-8 px-4 py-2 rounded-xl bg-[rgba(168,85,247,0.1)] border border-[rgba(168,85,247,0.2)]">
										<span className="material-symbols-outlined text-[#A855F7] fill-1 sentient-ai">bolt</span>
										<span className="text-xs font-black text-[#A855F7] uppercase tracking-[0.4em]">AI Agent</span>
									</div>
									<h3 className="text-4xl font-['Space_Grotesk'] font-bold mb-6 text-glow">AI that shows its work</h3>
									<p className="text-slate-400 text-lg leading-relaxed max-w-2xl mb-6">
										The agent streams token-by-token via SSE, reads your files, writes proposed changes, and runs commands — all in a tool loop. Every edit surfaces as a diff you <span className="text-[#10B981] font-semibold">Accept</span> or <span className="text-red-400 font-semibold">Reject</span> inline in Monaco before anything touches your files.
									</p>
									<div className="flex gap-3 flex-wrap">
										<span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[rgba(168,85,247,0.15)] border border-[rgba(168,85,247,0.3)] text-[#A855F7]">SSE Streaming</span>
										<span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[rgba(168,85,247,0.15)] border border-[rgba(168,85,247,0.3)] text-[#A855F7]">Tool Loop</span>
										<span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[rgba(168,85,247,0.15)] border border-[rgba(168,85,247,0.3)] text-[#A855F7]">Accept / Reject Diffs</span>
										<span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[rgba(168,85,247,0.15)] border border-[rgba(168,85,247,0.3)] text-[#A855F7]">DeepSeek / LM Studio</span>
									</div>
								</div>
								<div className="lg:w-2/5 w-full">
									<div className="space-y-3 font-mono text-xs">
										<div className="p-4 glass-card border-[rgba(168,85,247,0.3)] rounded-2xl sentient-ai">
											<div className="text-[#A855F7] font-bold mb-1 text-[10px] uppercase tracking-widest">Agent → read_file</div>
											<span className="text-slate-400">Reading <span className="text-white">server/routes/agent.ts</span>...</span>
										</div>
										<div className="p-4 glass-card border-[rgba(168,85,247,0.3)] rounded-2xl sentient-ai">
											<div className="text-[#A855F7] font-bold mb-1 text-[10px] uppercase tracking-widest">Agent → write_file</div>
											<span className="text-slate-400">Proposing changes to <span className="text-white">agent.ts</span></span>
											<div className="flex gap-2 mt-3">
												<button className="px-3 py-1 text-[10px] bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30 font-bold rounded uppercase tracking-widest">✓ Accept</button>
												<button className="px-3 py-1 text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 font-bold rounded uppercase tracking-widest">✗ Reject</button>
											</div>
										</div>
										<div className="p-4 glass-card border-white/5 rounded-2xl opacity-60">
											<div className="text-[#10B981] font-bold mb-1 text-[10px] uppercase tracking-widest">Agent → execute_command</div>
											<span className="text-slate-400">$ bun run build</span>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</section>

				{/* Secondary Features */}
				<section className="py-32 bg-black/40 relative">
					<div className="max-w-7xl mx-auto px-6">
						<div className="text-center mb-20">
							<h2 className="text-5xl font-['Space_Grotesk'] font-bold tracking-tighter mb-6 text-glow">
								Built for real <span className="text-[#A855F7]">developer workflows</span>
							</h2>
							<p className="text-slate-400 text-lg max-w-2xl mx-auto">
								From sandboxed execution to code history — every feature solves a problem that matters.
							</p>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
							<div className="flex gap-6 group p-8 glass-card rounded-2xl hover:border-[rgba(59,130,246,0.3)] transition-colors">
								<div className="flex-shrink-0 w-12 h-12 glass-card flex items-center justify-center border-[rgba(59,130,246,0.3)] group-hover:scale-110 transition-transform rounded-xl">
									<span className="material-symbols-outlined text-[#3B82F6] text-xl">code_blocks</span>
								</div>
								<div>
									<h4 className="text-lg font-bold font-['Space_Grotesk'] mb-2 text-[#f8fafc] group-hover:text-[#3B82F6] transition-colors">
										Sandboxed Execution
									</h4>
									<p className="text-slate-500 text-sm leading-relaxed">
										Run Python, Node, C++, Rust, Go, and Bun inside isolated Docker containers. 2 GB RAM limit, network off, 3-second timeout — code can't escape.
									</p>
								</div>
							</div>

							<div className="flex gap-6 group p-8 glass-card rounded-2xl hover:border-[rgba(168,85,247,0.3)] transition-colors">
								<div className="flex-shrink-0 w-12 h-12 glass-card flex items-center justify-center border-[rgba(168,85,247,0.3)] group-hover:scale-110 transition-transform rounded-xl">
									<span className="material-symbols-outlined text-[#A855F7] text-xl">history</span>
								</div>
								<div>
									<h4 className="text-lg font-bold font-['Space_Grotesk'] mb-2 text-[#f8fafc] group-hover:text-[#A855F7] transition-colors">
										Timeline &amp; Checkpoints
									</h4>
									<p className="text-slate-500 text-sm leading-relaxed">
										Click any checkpoint to restore that file state instantly — or ask the AI to explain what changed between two points.
									</p>
								</div>
							</div>

							<div className="flex gap-6 group p-8 glass-card rounded-2xl hover:border-[rgba(16,185,129,0.3)] transition-colors">
								<div className="flex-shrink-0 w-12 h-12 glass-card flex items-center justify-center border-[rgba(16,185,129,0.3)] group-hover:scale-110 transition-transform rounded-xl">
									<span className="material-symbols-outlined text-[#10B981] text-xl">shield_check</span>
								</div>
								<div>
									<h4 className="text-lg font-bold font-['Space_Grotesk'] mb-2 text-[#f8fafc] group-hover:text-[#10B981] transition-colors">
										Security Scanner
									</h4>
									<p className="text-slate-500 text-sm leading-relaxed">
										Static analysis runs before every execution. Critical issues like fork bombs and disk wipers are blocked outright. High, medium, and low findings surface with explanations.
									</p>
								</div>
							</div>

							<div className="flex gap-6 group p-8 glass-card rounded-2xl hover:border-[rgba(59,130,246,0.3)] transition-colors">
								<div className="flex-shrink-0 w-12 h-12 glass-card flex items-center justify-center border-[rgba(59,130,246,0.3)] group-hover:scale-110 transition-transform rounded-xl">
									<span className="material-symbols-outlined text-[#3B82F6] text-xl">link</span>
								</div>
								<div>
									<h4 className="text-lg font-bold font-['Space_Grotesk'] mb-2 text-[#f8fafc] group-hover:text-[#3B82F6] transition-colors">
										Session Sharing
									</h4>
									<p className="text-slate-500 text-sm leading-relaxed">
										Generate a shareable link with a signed token — valid for 7 days. Recipients can access the project without an account. Revoke anytime.
									</p>
								</div>
							</div>

							<div className="flex gap-6 group p-8 glass-card rounded-2xl hover:border-[rgba(168,85,247,0.3)] transition-colors">
								<div className="flex-shrink-0 w-12 h-12 glass-card flex items-center justify-center border-[rgba(168,85,247,0.3)] group-hover:scale-110 transition-transform rounded-xl">
									<span className="material-symbols-outlined text-[#A855F7] text-xl">terminal</span>
								</div>
								<div>
									<h4 className="text-lg font-bold font-['Space_Grotesk'] mb-2 text-[#f8fafc] group-hover:text-[#A855F7] transition-colors">
										Shared Terminal
									</h4>
									<p className="text-slate-500 text-sm leading-relaxed">
										A real xterm.js terminal backed by a PTY process over WebSocket. Run a command and everyone in the session sees the output at the same time.
									</p>
								</div>
							</div>

							<div className="flex gap-6 group p-8 glass-card rounded-2xl hover:border-[rgba(16,185,129,0.3)] transition-colors">
								<div className="flex-shrink-0 w-12 h-12 glass-card flex items-center justify-center border-[rgba(16,185,129,0.3)] group-hover:scale-110 transition-transform rounded-xl">
									<span className="material-symbols-outlined text-[#10B981] text-xl">forum</span>
								</div>
								<div>
									<h4 className="text-lg font-bold font-['Space_Grotesk'] mb-2 text-[#f8fafc] group-hover:text-[#10B981] transition-colors">
										Community &amp; CoderMatch
									</h4>
									<p className="text-slate-500 text-sm leading-relaxed">
										Post your repo for community code review. Or spin the CoderMatch wheel and get randomly paired with another developer for a session.
									</p>
								</div>
							</div>
						</div>
					</div>
				</section>


				
                <ImportModal 
                    isOpen={isImportModalOpen} 
                    onClose={() => setImportModalOpen(false)} 
                    onSuccess={(projectId) => {
                        onEnter(projectId);
                    }} 
                />
			</main>

			{/* Status Bar Footer */}
			<footer className="fixed bottom-0 w-full flex justify-between items-center px-4 z-[100] glass-card h-8 border-x-0 border-b-0 border-t-[rgba(168,85,247,0.2)] rounded-none bg-black">
				<div className="flex items-center gap-6 h-full">
					<div className="flex items-center gap-2 text-[#10B981] font-['JetBrains_Mono'] text-[10px] font-bold uppercase tracking-[0.2em]">
						<span className="material-symbols-outlined text-[14px] fill-1 animate-pulse">terminal</span>
						Terminal
					</div>
					<div className="hidden sm:flex items-center gap-6">
						<div className="text-slate-500 hover:text-white transition-colors font-['JetBrains_Mono'] text-[9px] uppercase tracking-[0.2em] cursor-pointer">
							Debug Console
						</div>
						<div className="text-slate-500 hover:text-white transition-colors font-['JetBrains_Mono'] text-[9px] uppercase tracking-[0.2em] cursor-pointer">
							Output
						</div>
						<div className="text-slate-500 hover:text-white transition-colors font-['JetBrains_Mono'] text-[9px] uppercase tracking-[0.2em] cursor-pointer">
							Problems <span className="bg-red-500 text-white px-1.5 rounded-full ml-1 text-[8px]">0</span>
						</div>
					</div>
				</div>
				<div className="flex items-center gap-6">
					<div className="flex items-center gap-2 text-slate-400 font-['JetBrains_Mono'] text-[9px] uppercase tracking-[0.2em]">
						<span className="material-symbols-outlined text-[14px] text-[#10B981]">cloud_done</span>
						Edge Synchronized
					</div>
					<div className="text-[#A855F7] font-['JetBrains_Mono'] text-[9px] uppercase tracking-[0.2em] font-bold">
						VibeCodium v4.0.2 Stable
					</div>
				</div>
			</footer>
		</div>
	);
}

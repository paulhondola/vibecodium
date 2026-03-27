import { useAuth0 } from "@auth0/auth0-react";
import { useState } from "react";
import ImportModal from "./ImportModal";

interface LandingPageProps {
	onEnter: (projectId?: string) => void;
}

export default function LandingPage({ onEnter }: LandingPageProps) {
    const { isAuthenticated, user, isLoading, loginWithRedirect } = useAuth0();
    const [isImportModalOpen, setImportModalOpen] = useState(false);

	return (
		<div className="min-h-screen bg-[#02040a] text-[#f8fafc] font-['Inter'] selection:bg-[rgba(168,85,247,0.3)] selection:text-white overflow-x-hidden">
			{/* Navigation */}
			<nav className="fixed top-0 z-[100] flex justify-between items-center w-full px-6 h-14 glass-card rounded-none border-x-0 border-t-0 border-b-[rgba(168,85,247,0.1)]">
				<div className="flex items-center gap-10">
					<span className="text-xl font-bold text-[#A855F7] tracking-tighter font-['Space_Grotesk'] flex items-center gap-2">
						<span className="material-symbols-outlined text-[#A855F7] fill-1 animate-pulse">terminal</span>
						iTECify
					</span>
					<div className="hidden lg:flex items-center gap-8">
						<a className="font-['Space_Grotesk'] text-xs font-bold uppercase tracking-[0.2em] text-[#A855F7] border-b border-[#A855F7] transition-all" href="#">Features</a>
						<a className="font-['Space_Grotesk'] text-xs font-bold uppercase tracking-[0.2em] text-slate-400 hover:text-[#3B82F6] transition-all" href="#">Docs</a>
						<a className="font-['Space_Grotesk'] text-xs font-bold uppercase tracking-[0.2em] text-slate-400 hover:text-[#3B82F6] transition-all" href="#">Pricing</a>
						<a className="font-['Space_Grotesk'] text-xs font-bold uppercase tracking-[0.2em] text-slate-400 hover:text-[#3B82F6] transition-all" href="#">Changelog</a>
					</div>
				</div>
				<div className="flex items-center gap-4">
					<div className="hidden sm:flex items-center gap-1 p-1 bg-[rgba(26,31,46,0.3)] rounded-lg">
						<button className="p-2 rounded hover:text-[#A855F7] transition-colors text-slate-500">
							<span className="material-symbols-outlined text-[20px]">group_add</span>
						</button>
						<button className="p-2 rounded hover:text-[#A855F7] transition-colors text-slate-500">
							<span className="material-symbols-outlined text-[20px]">share</span>
						</button>
					</div>
					<button
						onClick={() => onEnter()}
						className="relative overflow-hidden px-6 py-2 rounded-lg bg-[#A855F7] font-['Space_Grotesk'] font-bold text-xs uppercase tracking-widest text-[#02040a] hover:scale-105 active:scale-95 transition-all group"
					>
						<span className="relative z-10">
                            {isLoading ? "..." : isAuthenticated ? `Enter as ${user?.nickname || user?.name || "User"}` : "Go Live"}
                        </span>
						<div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
					</button>
				</div>
			</nav>

			{/* Sidebar */}
			<aside className="hidden md:flex fixed left-0 top-14 h-[calc(100vh-88px)] w-16 glass-card rounded-none border-y-0 border-l-0 flex-col items-center py-6 space-y-8 z-40">
				<div className="flex flex-col items-center space-y-8 w-full">
					<button className="relative group text-[#A855F7]">
						<span className="material-symbols-outlined text-2xl">folder</span>
						<div className="absolute -right-2 top-0 w-1 h-6 bg-[#A855F7] rounded-full"></div>
					</button>
					<button className="text-slate-500 hover:text-[#3B82F6] transition-all transform hover:scale-110">
						<span className="material-symbols-outlined text-2xl">search</span>
					</button>
					<button className="text-slate-500 hover:text-[#3B82F6] transition-all transform hover:scale-110">
						<span className="material-symbols-outlined text-2xl">account_tree</span>
					</button>
					<button className="text-slate-500 hover:text-[#3B82F6] transition-all transform hover:scale-110">
						<span className="material-symbols-outlined text-2xl">extension</span>
					</button>
					<button className="text-slate-500 hover:text-[#A855F7] transition-all transform hover:scale-110">
						<span className="material-symbols-outlined text-2xl sentient-ai">smart_toy</span>
					</button>
				</div>
				<div className="mt-auto flex flex-col items-center space-y-6 w-full">
					<button className="text-slate-600 hover:text-slate-300 transition-all">
						<span className="material-symbols-outlined">settings</span>
					</button>
					<div className="w-8 h-8 rounded-full border border-[rgba(168,85,247,0.3)] p-0.5 animate-pulse">
						<img
							alt="User"
							className="w-full h-full rounded-full object-cover"
							src="https://lh3.googleusercontent.com/aida-public/AB6AXuB2q2NOe8rpubJsKNRyuGl5bx1jOwXvU5Phzd-WY9zbU3xopgRGK80DPolznn8NUaxUKiMzhnFcRAXyqNJacEYeSUTochygQDU0tl7hBC1DCpMefGJJB9hRTOrbcRRIt-qerNfm98JiUIErglxBmQdAKQjGlA9nzThCOGSRKBKijO1EmcuFZY4G23ebVcGfgSYYIj3nacMwKwbMYtdU8QzqVDo05t9Bw1yK8fA9_Y6iYZXHcMKAmC-IQt3kOQDqTtFkf0NBJ3QxNCxO"
						/>
					</div>
				</div>
			</aside>

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
								onClick={() => onEnter()}
								className="px-10 py-5 bg-[#A855F7] text-[#02040a] font-['Space_Grotesk'] font-bold rounded-xl shadow-[0_0_30px_rgba(168,85,247,0.4)] hover:shadow-[0_0_50px_rgba(168,85,247,0.6)] hover:-translate-y-1 transition-all duration-300 uppercase tracking-widest text-sm"
							>
								{isLoading ? "Starting..." : isAuthenticated ? `Resume Session (${user?.name || "User"})` : "Initialize Workspace"}
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
							<div className="text-[10px] font-['Space_Grotesk'] text-slate-500 uppercase tracking-[0.4em]">system.core — iTECify_v4</div>
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
									<span className="text-[#10B981]">'@itecify/v4'</span>;
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
								<div className="text-slate-500">$ itecify deploy --global</div>
								<div className="text-slate-400 mt-2">Connecting to Neural Edge...</div>
								<div className="text-[#A855F7] mt-3 font-bold">SYCHRONIZING [████████████] 100%</div>
								<div className="text-[#10B981] mt-2">DEPLOYED: https://void-x1.itecify.dev</div>
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

				{/* Bento Grid with Overlapping Elements */}
				<section className="py-32 px-6 max-w-7xl mx-auto relative">
					<div className="absolute top-0 right-0 w-96 h-96 bg-[rgba(168,85,247,0.1)] blur-[150px] -z-10"></div>
					<div className="absolute bottom-0 left-0 w-96 h-96 bg-[rgba(59,130,246,0.1)] blur-[150px] -z-10"></div>

					<div className="mb-20 text-center lg:text-left flex flex-col lg:flex-row items-end justify-between gap-10">
						<div className="max-w-2xl">
							<h2 className="text-5xl font-['Space_Grotesk'] font-bold tracking-tighter mb-6 text-glow">
								Architected for <span className="text-[#A855F7]">Light Speed</span>.
							</h2>
							<p className="text-slate-400 text-lg">
								Hyper-optimized components for the next generation of performance-driven software architects.
							</p>
						</div>
						<div className="hidden lg:block h-[1px] flex-1 bg-gradient-to-r from-[rgba(168,85,247,0.5)] to-transparent mb-4"></div>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-12 gap-8">
						{/* Asymmetric Large Feature */}
						<div className="md:col-span-8 glass-card p-10 relative overflow-hidden group">
							<div className="absolute top-0 right-0 w-64 h-64 bg-[rgba(59,130,246,0.05)] blur-3xl -z-10 group-hover:bg-[rgba(59,130,246,0.2)] transition-all duration-700"></div>
							<div className="flex flex-col md:flex-row gap-10 h-full">
								<div className="flex-1">
									<div className="mb-8 w-14 h-14 rounded-2xl bg-[rgba(59,130,246,0.2)] flex items-center justify-center border border-[rgba(59,130,246,0.3)] shadow-[0_0_20px_rgba(59,130,246,0.3)]">
										<span className="material-symbols-outlined text-[#3B82F6] text-3xl fill-1">hub</span>
									</div>
									<h3 className="text-3xl font-['Space_Grotesk'] font-bold mb-5 tracking-tight">Kinetic Collaboration</h3>
									<p className="text-slate-400 leading-relaxed mb-8">
										Multi-cursor synchronization with sub-5ms global latency. Share entire development environments as single neural links.
									</p>
									<div className="flex -space-x-3 items-center">
										<img
											alt="Avatar"
											className="w-12 h-12 rounded-full border-2 border-[rgba(168,85,247,0.4)] p-0.5 object-cover"
											src="https://lh3.googleusercontent.com/aida-public/AB6AXuB2q2NOe8rpubJsKNRyuGl5bx1jOwXvU5Phzd-WY9zbU3xopgRGK80DPolznn8NUaxUKiMzhnFcRAXyqNJacEYeSUTochygQDU0tl7hBC1DCpMefGJJB9hRTOrbcRRIt-qerNfm98JiUIErglxBmQdAKQjGlA9nzThCOGSRKBKijO1EmcuFZY4G23ebVcGfgSYYIj3nacMwKwbMYtdU8QzqVDo05t9Bw1yK8fA9_Y6iYZXHcMKAmC-IQt3kOQDqTtFkf0NBJ3QxNCxO"
										/>
										<img
											alt="Avatar"
											className="w-12 h-12 rounded-full border-2 border-[rgba(59,130,246,0.4)] p-0.5 object-cover"
											src="https://lh3.googleusercontent.com/aida-public/AB6AXuBqCpkYX18iZ3f54mhYJJ9UQKEBvqYp2aXzPW-nj8do_HiKRVf3QG22TjOyiakzh9OAWmmsDnrv7trzxJUvRp8ZX45IZA9HWKvEv4ZYohjyBvrRj2X-MK16ltlPK3zDRlD8LaTsEZqqXy5UZd4Jgv4BFJfCOF_wcnTwx0OhgwGPRJj68uL39ldkkREuNanaTZfDCNry1VH_3z3Q3rOa9s7HQ_rB3EWWWgrWjUVifgXRwNkaQd4W-WLwblfAPMOdbbY6-p6TKknW9J2h"
										/>
										<div className="w-12 h-12 rounded-full bg-[#1a1f2e] flex items-center justify-center text-xs font-bold border border-white/10 text-white">+24</div>
										<span className="ml-6 text-[10px] text-[#10B981] uppercase tracking-[0.3em] animate-pulse">● Live Now</span>
									</div>
								</div>
								<div className="flex-1 relative hidden lg:block">
									<div className="absolute inset-0 bg-gradient-to-tr from-[rgba(168,85,247,0.1)] to-transparent rounded-2xl border border-white/5 rotate-3 -translate-y-4"></div>
									<div className="absolute inset-0 bg-black/40 rounded-2xl border border-white/10 -rotate-2"></div>
								</div>
							</div>
						</div>

						<div className="md:col-span-4 glass-card p-10 flex flex-col justify-between group">
							<div className="mb-8 w-14 h-14 rounded-2xl bg-[rgba(16,185,129,0.2)] flex items-center justify-center border border-[rgba(16,185,129,0.3)]">
								<span className="material-symbols-outlined text-[#10B981] text-3xl">rocket_launch</span>
							</div>
							<div>
								<h3 className="text-2xl font-['Space_Grotesk'] font-bold mb-4 tracking-tight">Instant Deployment</h3>
								<p className="text-slate-400 text-sm leading-relaxed">
									Push to production at the edge. Automatic SSL, infinite scaling, and global distribution in under 2 seconds.
								</p>
							</div>
						</div>

						{/* Sentient AI Section */}
						<div className="md:col-span-12 glass-card p-1 border-[rgba(168,85,247,0.3)] relative group overflow-hidden sentient-ai">
							<div className="absolute inset-0 bg-gradient-to-r from-[rgba(168,85,247,0.05)] via-[rgba(59,130,246,0.05)] to-[rgba(168,85,247,0.05)] animate-pulse"></div>
							<div className="relative bg-[#0a0c14] p-12 rounded-[14px] flex flex-col lg:flex-row items-center gap-16">
								<div className="lg:w-3/5">
									<div className="inline-flex items-center gap-3 mb-8 px-4 py-2 rounded-xl bg-[rgba(168,85,247,0.1)] border border-[rgba(168,85,247,0.2)]">
										<span className="material-symbols-outlined text-[#A855F7] fill-1 sentient-ai">bolt</span>
										<span className="text-xs font-black text-[#A855F7] uppercase tracking-[0.4em]">Autonomous Intelligence</span>
									</div>
									<h3 className="text-4xl font-['Space_Grotesk'] font-bold mb-6 text-glow">The IDE that Thinks with You</h3>
									<p className="text-slate-400 text-lg leading-relaxed max-w-2xl">
										iTECify's AI isn't just an autocomplete engine. It's a sentient development partner that understands your system's architectural intent and executes refactors before you even hit save.
									</p>
								</div>
								<div className="lg:w-2/5 w-full">
									<div className="space-y-4 font-mono text-xs">
										<div className="p-5 glass-card border-[rgba(168,85,247,0.3)] rounded-2xl sentient-ai">
											<span className="text-[#A855F7] font-bold">SENTIENT AI:</span> "I've detected a race condition in your WebSocket handler. Generating a deadlock-free factory pattern..."
										</div>
										<div className="p-5 glass-card border-white/5 rounded-2xl opacity-50 blur-[1px] hover:blur-0 transition-all">
											<span className="text-[#10B981] font-bold">SYSTEM:</span> Optimized 24 modules. Performance increased by 18%.
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</section>

				{/* Interactive Features Grid */}
				<section className="py-32 bg-black/40 relative">
					<div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-24 items-center">
						<div className="relative group">
							<div className="absolute -inset-10 bg-[rgba(168,85,247,0.2)] blur-[120px] rounded-full opacity-30 group-hover:opacity-60 transition-opacity"></div>
							<div className="relative rounded-3xl overflow-hidden glass-card border-[rgba(168,85,247,0.2)] shadow-2xl transform hover:scale-[1.02] transition-transform duration-500">
								<img
									alt="Circuitry"
									className="w-full opacity-80"
									src="https://lh3.googleusercontent.com/aida-public/AB6AXuCsvbzu4BHV8r-oN3Co6cqaiF2y3A9bEqMkjffBjz9jwmxciYwCqlw22e5tpsc5NnSXJ9SR_OxReis5rt_nzBZs73RuKvE1uPXmsm-HqarQ6IIzvOja63nWHAnoS4Gisl7rhevYH1TlQZNIQuJ8sA69jzMC6Oarqzc5DnHa2-9ny5jMI6DuSdQicoeG8_S92cf-wf_hujntNlbwzqauQ-hNAMjLd8PRyfVTxI38dLniTRoQjh2x7hTGZeqsnS3rvknHNpc78aTF-eUu"
								/>
								<div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
							</div>
						</div>
						<div className="space-y-12">
							<h2 className="text-5xl font-['Space_Grotesk'] font-bold tracking-tighter text-glow">
								Built for the <br/>
								<span className="text-[#A855F7]">Kinetic Developer</span>
							</h2>
							<div className="space-y-10">
								<div className="flex gap-6 group">
									<div className="flex-shrink-0 w-14 h-14 glass-card flex items-center justify-center border-[rgba(59,130,246,0.3)] group-hover:scale-110 transition-transform">
										<span className="material-symbols-outlined text-[#3B82F6] text-2xl">security</span>
									</div>
									<div>
										<h4 className="text-xl font-bold font-['Space_Grotesk'] mb-2 text-[#f8fafc] group-hover:text-[#3B82F6] transition-colors">
											Zero-Trust Neural Security
										</h4>
										<p className="text-slate-500 text-sm leading-relaxed">
											End-to-end encrypted sessions with biometric validation. Your source code remains yours, even in our cloud.
										</p>
									</div>
								</div>
								<div className="flex gap-6 group">
									<div className="flex-shrink-0 w-14 h-14 glass-card flex items-center justify-center border-[rgba(16,185,129,0.3)] group-hover:scale-110 transition-transform">
										<span className="material-symbols-outlined text-[#10B981] text-2xl">cloud_sync</span>
									</div>
									<div>
										<h4 className="text-xl font-bold font-['Space_Grotesk'] mb-2 text-[#f8fafc] group-hover:text-[#10B981] transition-colors">
											Global Edge Synchronization
										</h4>
										<p className="text-slate-500 text-sm leading-relaxed">
											Instant file-system mirroring across 24 availability zones. Work from anywhere with zero latency lag.
										</p>
									</div>
								</div>
								<div className="flex gap-6 group">
									<div className="flex-shrink-0 w-14 h-14 glass-card flex items-center justify-center border-[rgba(168,85,247,0.3)] group-hover:scale-110 transition-transform">
										<span className="material-symbols-outlined text-[#A855F7] text-2xl">extension</span>
									</div>
									<div>
										<h4 className="text-xl font-bold font-['Space_Grotesk'] mb-2 text-[#f8fafc] group-hover:text-[#A855F7] transition-colors">
											Universal Extension Architecture
										</h4>
										<p className="text-slate-500 text-sm leading-relaxed">
											Full compatibility with the VS Code marketplace. Bring your themes, keybindings, and plugins into the void.
										</p>
									</div>
								</div>
							</div>
						</div>
					</div>
				</section>

				{/* Spectacular Testimonial */}
				<section className="py-40 px-6 text-center relative overflow-hidden">
					<div className="absolute inset-0 warp-layer opacity-10"></div>
					<div className="max-w-4xl mx-auto space-y-12 relative z-10">
						<div className="inline-flex items-center gap-2 px-4 py-1 bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.3)] rounded-full">
							<span className="material-symbols-outlined text-[#10B981] text-[10px] fill-1">verified</span>
							<span className="text-[9px] font-black text-[#10B981] uppercase tracking-[0.5em]">Verified Industry Titan</span>
						</div>
						<blockquote className="text-4xl md:text-5xl font-['Space_Grotesk'] font-medium italic text-[#f8fafc] leading-tight tracking-tighter">
							"iTECify is the first tool in a decade that actually matches the speed of human thought. It's not just an IDE; it's a{' '}
							<span className="text-[#A855F7] text-glow">cognitive accelerator</span> for distributed teams."
						</blockquote>
						<div className="flex flex-col items-center">
							<div className="relative mb-6">
								<div className="absolute -inset-4 bg-[rgba(168,85,247,0.2)] blur-xl rounded-full animate-pulse"></div>
								<img
									alt="Testimonial"
									className="relative w-24 h-24 rounded-full border-2 border-[#A855F7] object-cover"
									src="https://lh3.googleusercontent.com/aida-public/AB6AXuAdZWvJoFqCklXcWZHRrRsrkK4hVXXwERlMReFALRQUXS-5up8oXe2DcJSUbO-10WnHdCgFYK5cv3pg2wX_8W_XaKIognozJOMQOqqwVGuPV6mtnOnSMZ-Q2Fy9dfdNCXLTZ7t1e6pUCc5eyg6VAJuuhkCrBpLh40fMpbdhm26JKJyzVATOXDinC8mtX2P1JEA1HmvDlrZACvwY8wdN8ZsSlgxhEGpv2htkIMKvVa1wq2v1RCYQH1SiMqoUr9C9ZZd6asNdGI4lvSac"
								/>
							</div>
							<div className="font-['Space_Grotesk'] font-black text-2xl tracking-tight">ALEX THORNE</div>
							<div className="text-[10px] text-slate-500 uppercase tracking-[0.4em] mt-2">Chief Architect, Synthetix Corp</div>
						</div>
					</div>
				</section>

				{/* Final CTA */}
				<section className="py-32 px-6">
					<div className="max-w-6xl mx-auto rounded-[3rem] glass-card p-16 md:p-32 text-center relative overflow-hidden border-[rgba(168,85,247,0.2)] group hover:border-[rgba(168,85,247,0.5)]">
						<div className="absolute inset-0 bg-gradient-to-br from-[rgba(168,85,247,0.1)] via-[#02040a] to-[rgba(59,130,246,0.1)] -z-10"></div>
						<div className="absolute -top-1/2 -left-1/2 w-full h-full bg-[rgba(168,85,247,0.1)] blur-[150px] animate-pulse-slow"></div>
						<h2 className="text-6xl md:text-8xl font-['Space_Grotesk'] font-bold mb-10 tracking-tighter text-glow">
							Ready to Enter <br/>
							<span className="text-[#A855F7]">The Void?</span>
						</h2>
						<p className="text-2xl text-slate-400 max-w-2xl mx-auto mb-16 font-light">
							Join 100,000+ architects building the next generation of digital infrastructure.
						</p>
						<div className="flex flex-wrap justify-center gap-10 relative z-10">
							<button
								onClick={() => onEnter()}
								className="px-14 py-6 bg-[#A855F7] text-[#02040a] font-['Space_Grotesk'] font-black text-lg rounded-2xl shadow-[0_0_50px_rgba(168,85,247,0.3)] hover:scale-105 transition-all uppercase tracking-[0.2em]"
							>
								Create Neural Link
							</button>
							<button className="px-14 py-6 glass-card text-[#f8fafc] font-['Space_Grotesk'] font-black text-lg rounded-2xl hover:bg-white/10 transition-all uppercase tracking-[0.2em] border-[rgba(168,85,247,0.2)]">
								Talk to Sales
							</button>
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
						iTECify v4.0.2 Stable
					</div>
				</div>
			</footer>
		</div>
	);
}

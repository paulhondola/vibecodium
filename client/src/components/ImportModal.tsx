import { motion, AnimatePresence } from "framer-motion";
import { Github, X, Loader2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthProvider";
import { API_BASE } from "@/lib/config";
import { ENVIRONMENTS, type EnvironmentKey } from "shared";

interface ImportModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: (projectId: string, path: string) => void;
}

export default function ImportModal({ isOpen, onClose, onSuccess }: ImportModalProps) {
	const [url, setUrl] = useState("");
	const [selectedEnv, setSelectedEnv] = useState<EnvironmentKey>("auto");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const { getAccessTokenSilently } = useAuth();

	const handleImport = async () => {
		if (!url.startsWith("https://github.com/")) {
			setError("Please enter a valid GitHub repository URL.");
			return;
		}

		setIsLoading(true);
		setError(null);

		try {
			const token = await getAccessTokenSilently();

			const res = await fetch(`${API_BASE}/api/projects/import`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ repoUrl: url, environment: selectedEnv }),
			});

			const data = await res.json();

			if (!res.ok) {
				throw new Error(data.error || "Failed to import repo");
			}

			onSuccess(data.projectId, data.path);
			onClose();
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "Unknown error");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<AnimatePresence>
			{isOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
					<motion.div
						initial={{ opacity: 0, scale: 0.95, y: 20 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.95, y: 20 }}
						transition={{ type: "spring", stiffness: 300, damping: 25 }}
						className="relative w-full max-w-lg bg-[#18181b] border border-[#27272a] rounded-2xl shadow-2xl overflow-hidden"
					>
						<div className="flex items-center justify-between p-4 border-b border-[#27272a]">
							<h3 className="text-white font-semibold flex items-center gap-2">
								<Github size={18} className="text-gray-400" />
								Import Repository
							</h3>
							<button
								onClick={onClose}
								className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-[#27272a] transition-colors"
							>
								<X size={16} />
							</button>
						</div>

						<div className="p-6 flex flex-col gap-5">
							<p className="text-sm text-gray-400">
								Enter a GitHub repository URL to clone into your isolated workspace. Private repos require a GitHub token set in your profile.
							</p>

							{/* URL input */}
							<div className="flex flex-col gap-2">
								<label className="text-xs font-medium text-gray-300 uppercase tracking-widest">
									Repository URL
								</label>
								<input
									type="text"
									placeholder="https://github.com/user/repo"
									value={url}
									onChange={(e) => setUrl(e.target.value)}
									className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all placeholder:text-gray-600"
								/>
								{error && <p className="text-xs text-red-400">{error}</p>}
							</div>

							{/* Environment selector */}
							<div className="flex flex-col gap-2">
								<label className="text-xs font-medium text-gray-300 uppercase tracking-widest">
									Environment
								</label>
								<div className="grid grid-cols-4 gap-2">
									{ENVIRONMENTS.map((env) => {
										const isSelected = selectedEnv === env.key;
										return (
											<button
												key={env.key}
												type="button"
												onClick={() => setSelectedEnv(env.key)}
												className="group relative flex flex-col items-center gap-1.5 p-2.5 rounded-xl text-center cursor-pointer"
												style={{
													background: isSelected ? `${env.color}14` : "rgba(9,9,11,0.6)",
													border: `1.5px solid ${isSelected ? env.color : "#27272a"}`,
													boxShadow: isSelected ? `0 0 12px ${env.color}40` : "none",
													transition: "border-color 120ms ease, box-shadow 120ms ease, background 120ms ease",
												}}
												onMouseEnter={(e) => {
													if (!isSelected) {
														(e.currentTarget as HTMLButtonElement).style.borderColor = `${env.color}80`;
														(e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 8px ${env.color}28`;
													}
												}}
												onMouseLeave={(e) => {
													if (!isSelected) {
														(e.currentTarget as HTMLButtonElement).style.borderColor = "#27272a";
														(e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
													}
												}}
											>
												<span className="text-lg leading-none">{env.icon}</span>
												<span
													className="text-[10px] font-semibold leading-tight"
													style={{ color: isSelected ? env.color : "#9ca3af" }}
												>
													{env.label}
												</span>
												<span className="text-[9px] text-gray-600 leading-tight hidden sm:block">
													{env.description.split(" ").slice(0, 3).join(" ")}
												</span>
											</button>
										);
									})}
								</div>
							</div>

							<div className="flex justify-end gap-3">
								<button
									onClick={onClose}
									className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
								>
									Cancel
								</button>
								<button
									onClick={handleImport}
									disabled={isLoading || !url}
									className="group flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-sm font-semibold rounded-lg hover:from-cyan-500 hover:to-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_15px_rgba(6,182,212,0.2)]"
								>
									{isLoading ? <Loader2 size={16} className="animate-spin" /> : <Github size={16} />}
									{isLoading ? "Cloning..." : "Import"}
								</button>
							</div>
						</div>
					</motion.div>
				</div>
			)}
		</AnimatePresence>
	);
}

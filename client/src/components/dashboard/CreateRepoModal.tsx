import { Loader2, X } from "lucide-react";

interface CreateRepoModalProps {
	onClose: () => void;
	onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
	isCreating: boolean;
}

export default function CreateRepoModal({ onClose, onSubmit, isCreating }: CreateRepoModalProps) {
	return (
		<div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm">
			<div className="bg-[rgba(10,12,20,0.95)] backdrop-blur-xl border border-[rgba(168,85,247,0.3)] rounded-xl p-8 w-full max-w-md shadow-[0_0_60px_rgba(168,85,247,0.3)] relative">
				<button
					onClick={onClose}
					className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors"
				>
					<X size={20} />
				</button>

				<h2 className="text-2xl font-['Space_Grotesk'] font-bold text-[#A855F7] mb-6">Create New Repository</h2>

				<form onSubmit={onSubmit} className="space-y-6">
					<div>
						<label className="block text-[10px] font-['Space_Grotesk'] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">
							Repository Name *
						</label>
						<input
							type="text"
							name="name"
							required
							className="w-full bg-[rgba(10,12,20,0.6)] border border-[rgba(168,85,247,0.2)] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[rgba(168,85,247,0.5)] transition-colors"
							placeholder="my-awesome-project"
						/>
					</div>

					<div>
						<label className="block text-[10px] font-['Space_Grotesk'] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">
							Description
						</label>
						<textarea
							name="description"
							rows={3}
							className="w-full bg-[rgba(10,12,20,0.6)] border border-[rgba(168,85,247,0.2)] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[rgba(168,85,247,0.5)] transition-colors resize-none"
							placeholder="A brief description of your project..."
						/>
					</div>

					<div className="flex items-center gap-3">
						<input
							type="checkbox"
							name="private"
							id="private"
							className="w-4 h-4 rounded border-[rgba(168,85,247,0.2)] bg-[rgba(10,12,20,0.6)] checked:bg-[#A855F7]"
						/>
						<label htmlFor="private" className="text-sm text-slate-300">
							Make this repository private
						</label>
					</div>

					<div className="flex gap-4 pt-4">
						<button
							type="button"
							onClick={onClose}
							className="flex-1 py-3 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-all font-['Space_Grotesk'] font-bold text-xs uppercase tracking-[0.2em]"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={isCreating}
							className="flex-1 py-3 bg-[#A855F7] text-[#02040a] rounded-lg hover:brightness-110 transition-all font-['Space_Grotesk'] font-bold text-xs uppercase tracking-[0.2em] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
						>
							{isCreating ? (
								<>
									<Loader2 size={16} className="animate-spin" />
									Creating...
								</>
							) : (
								"Create Repository"
							)}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

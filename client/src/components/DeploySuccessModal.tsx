import { motion, AnimatePresence } from "framer-motion";
import { Rocket, ExternalLink, X } from "lucide-react";

interface DeploySuccessModalProps {
	deploySuccess: { url: string } | null;
	onClose: () => void;
	showConfetti: boolean;
}

export default function DeploySuccessModal({
	deploySuccess,
	onClose,
	showConfetti,
}: DeploySuccessModalProps) {
	return (
		<>
			<AnimatePresence>
				{deploySuccess && (
					<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
						<motion.div
							initial={{ scale: 0.9, opacity: 0, y: 20 }}
							animate={{ scale: 1, opacity: 1, y: 0 }}
							exit={{ scale: 0.9, opacity: 0, y: 20 }}
							className="bg-[#18181b] border border-green-500/30 rounded-2xl p-8 max-w-md w-full shadow-[0_0_50px_rgba(34,197,94,0.2)] text-center relative overflow-hidden"
						>
							<div className="absolute top-0 left-0 w-full h-1 bg-green-500" />
							<div className="flex justify-center mb-6">
								<div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20">
									<Rocket size={40} className="text-green-500" />
								</div>
							</div>
							<h2 className="text-2xl font-bold text-white mb-2">
								Deployed Successfully!
							</h2>
							<p className="text-gray-400 text-sm mb-6">
								Your project is now live on Railway with zero downtime.
							</p>
							<div className="bg-[#09090b] border border-[#27272a] rounded-xl p-4 flex items-center justify-between mb-8 group hover:border-green-500/30 transition-colors">
								<div className="flex flex-col items-start overflow-hidden">
									<span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">
										Production URL
									</span>
									<span className="text-sm text-green-400 font-mono truncate w-full">
										{deploySuccess.url}
									</span>
								</div>
								<a
									href={deploySuccess.url}
									target="_blank"
									rel="noopener noreferrer"
									className="p-2 rounded-lg bg-[#27272a] hover:bg-green-600 text-white transition-all ml-4"
								>
									<ExternalLink size={18} />
								</a>
							</div>
							<button
								onClick={onClose}
								className="w-full py-3 rounded-xl bg-[#27272a] hover:bg-[#3f3f46] text-white font-semibold transition-all"
							>
								Back to Editor
							</button>
							<button
								onClick={onClose}
								className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
							>
								<X size={20} />
							</button>
						</motion.div>
					</div>
				)}
			</AnimatePresence>

			{showConfetti && (
				<div className="fixed inset-0 pointer-events-none z-[110] overflow-hidden">
					{Array.from({ length: 50 }).map((_, i) => (
						<motion.div
							key={i}
							initial={{
								top: -20,
								left: `${Math.random() * 100}%`,
								rotate: 0,
								scale: Math.random() * 0.5 + 0.5,
							}}
							animate={{
								top: "110%",
								rotate: 360 * (Math.random() > 0.5 ? 1 : -1),
								left: `${(Math.random() - 0.5) * 20 + i * 2}%`,
							}}
							transition={{
								duration: Math.random() * 2 + 2,
								ease: "linear",
								repeat: 0,
							}}
							className="absolute w-2 h-2 rounded-sm"
							style={{
								backgroundColor: [
									"#22c55e",
									"#3b82f6",
									"#eab308",
									"#ec4899",
									"#a855f7",
								][Math.floor(Math.random() * 5)],
							}}
						/>
					))}
				</div>
			)}
		</>
	);
}

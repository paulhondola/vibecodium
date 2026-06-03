import { motion, AnimatePresence } from "framer-motion";
import { Key } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

interface TokenPromptModalProps {
	tokenPrompt: { type: "GITHUB" | "VERCEL"; message: string } | null;
	onClose: () => void;
}

export default function TokenPromptModal({
	tokenPrompt,
	onClose,
}: TokenPromptModalProps) {
	const navigate = useNavigate();

	return (
		<AnimatePresence>
			{tokenPrompt && (
				<div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md px-4">
					<motion.div
						initial={{ scale: 0.9, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						exit={{ scale: 0.9, opacity: 0 }}
						className="bg-[#18181b] border border-[#A855F7]/30 rounded-2xl p-8 max-w-md w-full shadow-[0_0_50px_rgba(168,85,247,0.2)] text-center relative"
					>
						<div className="flex justify-center mb-6">
							<div className="w-16 h-16 rounded-full bg-[#A855F7]/10 flex items-center justify-center border border-[#A855F7]/20">
								<Key size={32} className="text-[#A855F7]" />
							</div>
						</div>
						<h2 className="text-xl font-bold text-white mb-3">
							Integrations Required
						</h2>
						<p className="text-gray-400 text-sm mb-8 leading-relaxed">
							{tokenPrompt.message}
						</p>
						<div className="flex flex-col gap-3">
							<button
								onClick={() => navigate({ to: "/profile" })}
								className="w-full py-3 rounded-xl bg-[#A855F7] hover:bg-[#9333ea] text-white font-bold transition-all shadow-[0_0_20px_rgba(168,85,247,0.4)]"
							>
								Go to Profile to Register
							</button>
							<button
								onClick={onClose}
								className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 font-semibold transition-all"
							>
								Maybe Later
							</button>
						</div>
					</motion.div>
				</div>
			)}
		</AnimatePresence>
	);
}

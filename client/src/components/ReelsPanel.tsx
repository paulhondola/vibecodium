import { X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

const REEL_IDS = [
  "CmUv48DLvxd", // Messi World Cup
  "BsOGulcndj-", // World Record Egg
  "CmYyND_OYMl"  // Popular post
];

export default function ReelsPanel({ onClose }: { onClose: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Esc key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleNext = () => {
    setIsLoading(true);
    setCurrentIndex((prev) => (prev + 1) % REEL_IDS.length);
  };

  const handlePrev = () => {
    setIsLoading(true);
    setCurrentIndex((prev) => (prev - 1 + REEL_IDS.length) % REEL_IDS.length);
  };

  return (
    <div className="fixed top-12 right-0 bottom-0 z-50 flex flex-col items-center bg-[#18181b] border-l border-[#27272a] p-4 pb-6 shadow-[-10px_0_30px_rgba(0,0,0,0.5)] w-[380px] animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="w-full flex justify-between items-center mb-4 px-2 shrink-0">
            <div className="flex items-center gap-3">
                <h2 className="text-white font-semibold flex items-center gap-2">
                    <span className="bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 text-transparent bg-clip-text">Vibe Reels</span>
                </h2>
                <button
                    onClick={() => window.open("https://www.instagram.com/accounts/login/", "_blank", "noopener,noreferrer")}
                    className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#27272a] text-gray-300 hover:text-pink-400 hover:bg-[#3f3f46] transition-colors border border-[#3f3f46]"
                >
                    Login
                </button>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors bg-[#27272a] hover:bg-[#3f3f46] rounded-full p-1.5 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-opacity-50">
                <X size={16} />
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 w-full bg-[#09090b] rounded-xl overflow-hidden relative flex items-center justify-center">
            {isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#09090b] z-10 gap-3">
                    <Loader2 className="animate-spin text-pink-500" size={32} />
                    <span className="text-sm text-gray-400 tracking-wider">Tuning the vibe...</span>
                </div>
            )}
            <iframe
                src={`https://www.instagram.com/p/${REEL_IDS[currentIndex]}/embed`}
                className="w-full h-[650px] border-none"
                title="Instagram Reel"
                onLoad={() => setIsLoading(false)}
                scrolling="no"
                allowTransparency={true}
                allow="encrypted-media"
            ></iframe>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between w-full mt-4 px-2 shrink-0">
            <button
                onClick={handlePrev}
                className="flex items-center justify-center p-2 rounded-full bg-[#27272a] text-white hover:bg-pink-600 transition-colors shadow-lg group"
            >
                <ChevronLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
            </button>
            <span className="text-gray-400 text-xs font-medium uppercase tracking-widest">Reel {currentIndex + 1} of {REEL_IDS.length}</span>
            <button
                onClick={handleNext}
                className="flex items-center justify-center p-2 rounded-full bg-[#27272a] text-white hover:bg-pink-600 transition-colors shadow-lg group"
            >
                <ChevronRight size={20} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
        </div>
      </div>
  );
}

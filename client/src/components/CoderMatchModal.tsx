import { Heart, X, Flame, MapPin, Code2 } from "lucide-react";
import { useState } from "react";

const BOGUS_PROFILES = [
    { id: 1, name: "Chad", age: 24, bio: "I use Arch btw. Looking for someone to rewrite my Node.js backend in Rust.", language: "Rust", distance: "2 miles away", image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Chad" },
    { id: 2, name: "Emily", age: 26, bio: "React developer. If you don't use functional components, swipe left.", language: "TypeScript", distance: "5 miles away", image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Emily" },
    { id: 3, name: "Bob", age: 31, bio: "Java Enterprise Edition. I like long walks on the beach and AbstractSingletonProxyFactoryBeans.", language: "Java", distance: "12 miles away", image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Bob" },
    { id: 4, name: "Alice", age: 22, bio: "Python enthusiast. Ask me about machine learning.", language: "Python", distance: "1 mile away", image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alice" },
];

export default function CoderMatchModal({ onClose }: { onClose: () => void }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [matchMode, setMatchMode] = useState(false);

    const handleSwipe = (direction: 'left' | 'right') => {
        if (direction === 'right' && Math.random() > 0.5) {
            setMatchMode(true);
            setTimeout(() => {
                setMatchMode(false);
                setCurrentIndex(prev => prev + 1);
            }, 2000);
        } else {
            setCurrentIndex(prev => prev + 1);
        }
    };

    if (currentIndex >= BOGUS_PROFILES.length) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-8 max-w-sm w-full text-center relative shadow-2xl">
                    <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                    <Flame className="w-16 h-16 text-pink-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-white mb-2">No more coders!</h2>
                    <p className="text-gray-400 text-sm">You ran out of hot singles in your area. Go back to coding.</p>
                </div>
            </div>
        );
    }

    const profile = BOGUS_PROFILES[currentIndex];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-[#09090b] border border-[#27272a] rounded-3xl overflow-hidden max-w-sm w-full relative shadow-[0_0_50px_rgba(236,72,153,0.15)] flex flex-col h-[600px]">
                {matchMode && (
                    <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-6 text-center animate-out fade-out duration-300">
                        <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-rose-500 italic mb-4 -rotate-12">IT'S A MATCH!</h2>
                        <p className="text-white mb-8 text-lg font-medium">You and {profile.name} both love avoiding documentation.</p>
                        <div className="flex gap-4">
                            <img src={profile.image} alt={profile.name} className="w-24 h-24 rounded-full border-4 border-pink-500 bg-white" />
                            <div className="w-24 h-24 rounded-full border-4 border-pink-500 flex items-center justify-center bg-gradient-to-br from-cyan-400 to-blue-600 font-bold text-2xl text-black">
                                iT
                            </div>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="p-4 border-b border-[#27272a] flex justify-between items-center bg-[#18181b]">
                    <div className="flex items-center gap-2 text-pink-500 font-bold text-xl tracking-tight">
                        <Flame size={24} className="fill-pink-500" />
                        <div>Vibe<span className="text-white">Match</span></div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-[#27272a] text-gray-400 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Card */}
                <div className="flex-1 p-4 relative overflow-hidden flex flex-col">
                    <div className="flex-1 bg-white rounded-2xl overflow-hidden relative shadow-md flex flex-col h-full border border-gray-200">
                        <div className="h-64 bg-gradient-to-br from-pink-100 to-purple-200 flex items-center justify-center shrink-0">
                            <img src={profile.image} alt={profile.name} className="w-48 h-48 drop-shadow-xl" />
                        </div>
                        <div className="flex-1 p-5 flex flex-col justify-start bg-white text-black">
                            <h3 className="text-2xl font-black flex items-baseline gap-2">
                                {profile.name} <span className="text-lg font-normal text-gray-500">{profile.age}</span>
                            </h3>
                            <div className="flex items-center gap-1 text-gray-500 mt-1 text-xs font-medium uppercase tracking-wider">
                                <MapPin size={12} /> {profile.distance}
                            </div>
                            <div className="flex items-center gap-1 text-pink-500 bg-pink-50 w-fit px-2 py-1 rounded-md mt-2 text-sm font-bold mb-3 border border-pink-100">
                                <Code2 size={14} /> Writes {profile.language}
                            </div>
                            <p className="text-gray-700 font-medium leading-snug">
                                "{profile.bio}"
                            </p>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="p-6 bg-[#18181b] flex justify-center gap-8 pb-8 border-t border-[#27272a]">
                    <button 
                        onClick={() => handleSwipe('left')}
                        className="w-16 h-16 rounded-full bg-[#09090b] flex items-center justify-center border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)] hover:scale-110"
                    >
                        <X size={28} strokeWidth={3} />
                    </button>
                    <button 
                        onClick={() => handleSwipe('right')}
                        className="w-16 h-16 rounded-full bg-[#09090b] flex items-center justify-center border-2 border-green-500 text-green-500 hover:bg-green-500 hover:text-white transition-all shadow-[0_0_15px_rgba(34,197,94,0.2)] hover:scale-110"
                    >
                        <Heart size={28} strokeWidth={3} className={matchMode ? "fill-white" : ""} />
                    </button>
                </div>
            </div>
        </div>
    );
}

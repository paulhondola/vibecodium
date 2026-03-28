import { X, Music } from 'lucide-react';
import { useState } from 'react';

export default function SpotifyPlayer() {
    const [isOpen, setIsOpen] = useState(false);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 left-4 z-50 bg-[#1db954] hover:bg-[#1ed760] text-black w-12 h-12 rounded-full shadow-[0_0_15px_rgba(29,185,84,0.5)] transition-all flex items-center justify-center hover:scale-110 group"
                title="Vibe to Spotify"
            >
                <Music size={24} />
            </button>
        );
    }

    return (
        <div className="fixed bottom-4 left-4 z-50 w-80 bg-black/90 border border-[#1db954] rounded-xl shadow-[0_0_20px_rgba(29,185,84,0.3)] overflow-hidden flex flex-col backdrop-blur-md">
            <div className="bg-[#1db954] text-black p-2 flex justify-between items-center pl-3">
                <div className="flex items-center gap-2 font-bold text-sm">
                    <Music size={16} /> Coding Vibes
                </div>
                <button onClick={() => setIsOpen(false)} className="hover:bg-black/20 p-1 rounded transition-colors mr-1">
                    <X size={16} />
                </button>
            </div>
            <div className="p-0 h-[152px] flex items-center justify-center text-gray-400 text-sm">
                <iframe 
                    style={{borderRadius: "0 0 12px 12px"}} 
                    src="https://open.spotify.com/embed/playlist/0vvXsWCC9xrXsKd4FyS8kM?utm_source=generator&theme=0" 
                    width="100%" 
                    height="152" 
                    frameBorder="0" 
                    allowFullScreen={false} 
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
                    loading="lazy">
                </iframe>
            </div>
        </div>
    );
}

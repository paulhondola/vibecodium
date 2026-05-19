import { useState } from 'react';
import { Music } from 'lucide-react';

const DEFAULT_URI = 'spotify:playlist:0vvXsWCC9xrXsKd4FyS8kM';

function spotifyUrlToUri(input: string): string {
    const match = input.match(/open\.spotify\.com\/(playlist|album|track|artist)\/([a-zA-Z0-9]+)/);
    if (match) return `spotify:${match[1]}:${match[2]}`;
    if (input.startsWith('spotify:')) return input.split('?')[0];
    return '';
}

export default function SpotifySidebarPanel() {
    const [spotifyUri, setSpotifyUri] = useState(DEFAULT_URI);
    const [inputValue, setInputValue] = useState('');

    const [type, id] = spotifyUri.replace('spotify:', '').split(':');
    const embedSrc = `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`;

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key !== 'Enter') return;
        const uri = spotifyUrlToUri(inputValue.trim());
        if (uri) {
            setSpotifyUri(uri);
            setInputValue('');
        }
    }

    return (
        <div className="flex flex-col h-full bg-[#09090b]">
            <div className="px-3 py-2 border-b border-[#27272a] shrink-0 flex items-center gap-2">
                <Music size={13} className="text-[#1db954]" />
                <span className="text-[10px] uppercase tracking-wider font-medium text-zinc-500">Spotify</span>
            </div>
            <div className="px-2 py-1.5 border-b border-[#27272a] shrink-0">
                <input
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Paste Spotify link & press Enter…"
                    className="w-full bg-[#111113] border border-[#27272a] focus:border-[#1db954]/40 rounded-[4px] px-2 py-1.5 text-[10px] text-zinc-400 placeholder:text-zinc-700 focus:outline-none transition-colors"
                />
            </div>
            <div className="flex-1 min-h-0">
                <iframe
                    key={embedSrc}
                    src={embedSrc}
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                    style={{ display: 'block' }}
                />
            </div>
        </div>
    );
}

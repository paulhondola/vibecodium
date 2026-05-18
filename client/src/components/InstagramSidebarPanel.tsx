import { useState } from 'react';
import { Instagram } from 'lucide-react';

const DEFAULT_SHORTCODE = 'C7RfHiDvRCi';

function extractShortcode(input: string): string {
    const match = input.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
    if (match) return match[1];
    if (/^[A-Za-z0-9_-]{9,12}$/.test(input.trim())) return input.trim();
    return '';
}

export default function InstagramSidebarPanel() {
    const [shortcode, setShortcode] = useState(() => {
        return localStorage.getItem('ig-sidebar-shortcode') ?? DEFAULT_SHORTCODE;
    });
    const [inputValue, setInputValue] = useState('');

    const embedSrc = `https://www.instagram.com/p/${shortcode}/embed/`;

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key !== 'Enter') return;
        const code = extractShortcode(inputValue.trim());
        if (code) {
            setShortcode(code);
            localStorage.setItem('ig-sidebar-shortcode', code);
            setInputValue('');
        }
    }

    return (
        <div className="flex flex-col h-full bg-[#09090b]">
            <div className="px-3 py-2 border-b border-[#27272a] shrink-0 flex items-center gap-2">
                <Instagram size={13} className="text-[#E1306C]" />
                <span className="text-[10px] uppercase tracking-wider font-medium text-zinc-500">Instagram</span>
            </div>
            <div className="px-2 py-1.5 border-b border-[#27272a] shrink-0">
                <input
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Paste post or reel URL & press Enter…"
                    className="w-full bg-[#111113] border border-[#27272a] focus:border-[#E1306C]/40 rounded-[4px] px-2 py-1.5 text-[10px] text-zinc-400 placeholder:text-zinc-700 focus:outline-none transition-colors"
                />
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
                <iframe
                    key={embedSrc}
                    src={embedSrc}
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    allow="encrypted-media"
                    loading="lazy"
                    style={{ display: 'block' }}
                />
            </div>
        </div>
    );
}

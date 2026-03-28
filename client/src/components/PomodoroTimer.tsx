import { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Coffee } from 'lucide-react';

export default function PomodoroTimer() {
    const [timeLeft, setTimeLeft] = useState(25 * 60);
    const [isActive, setIsActive] = useState(false);
    const [mode, setMode] = useState<'work' | 'break'>('work');

    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;
        if (isActive && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft((time) => time - 1);
            }, 1000);
        } else if (timeLeft === 0) {
            if (interval) clearInterval(interval);
            // Play notification sound
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.play().catch(e => console.log('Audio error:', e));
            
            if (mode === 'work') {
                setMode('break');
                setTimeLeft(5 * 60);
            } else {
                setMode('work');
                setTimeLeft(25 * 60);
            }
            setIsActive(false);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isActive, timeLeft, mode]);

    const toggleTimer = () => setIsActive(!isActive);

    const resetTimer = () => {
        setIsActive(false);
        setMode('work');
        setTimeLeft(25 * 60);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono text-xs font-bold transition-all ${mode === 'work' ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-green-500/10 border-green-500/30 text-green-400'}`}>
            <span className="w-[45px] text-center">
                {formatTime(timeLeft)}
            </span>
            <div className="w-[1px] h-3 bg-current opacity-30 mx-1"></div>
            <button onClick={toggleTimer} className="hover:opacity-70 transition-opacity outline-none" title={isActive ? "Pause" : "Start"}>
                {isActive ? <Pause size={14} /> : (mode === 'work' ? <Play size={14} /> : <Coffee size={14} />)}
            </button>
            <button onClick={resetTimer} className="hover:opacity-70 transition-opacity outline-none" title="Reset">
                <RotateCcw size={14} />
            </button>
        </div>
    );
}

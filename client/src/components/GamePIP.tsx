import { useState, useRef, useEffect } from 'react';
import SubwaySurfer3D from './SubwaySurfer3D';
import { Maximize2, Minimize2, X } from 'lucide-react';

interface GamePIPProps {
    onClose: () => void;
}

export default function GamePIP({ onClose }: GamePIPProps) {
    const [isMinimized, setIsMinimized] = useState(false);
    const [position, setPosition] = useState({ x: window.innerWidth - 340, y: window.innerHeight - 280 });
    const [size, setSize] = useState({ width: 320, height: 240 });
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
    const pipRef = useRef<HTMLDivElement>(null);

    // Handle dragging
    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('.pip-resize-handle')) return;
        setIsDragging(true);
        setDragStart({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (isDragging) {
            const newX = Math.max(0, Math.min(e.clientX - dragStart.x, window.innerWidth - size.width));
            const newY = Math.max(0, Math.min(e.clientY - dragStart.y, window.innerHeight - size.height));
            setPosition({ x: newX, y: newY });
        } else if (isResizing) {
            const deltaX = e.clientX - resizeStart.x;
            const deltaY = e.clientY - resizeStart.y;
            const newWidth = Math.max(280, Math.min(resizeStart.width + deltaX, window.innerWidth - position.x));
            const newHeight = Math.max(200, Math.min(resizeStart.height + deltaY, window.innerHeight - position.y));
            setSize({ width: newWidth, height: newHeight });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setIsResizing(false);
    };

    useEffect(() => {
        if (isDragging || isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, isResizing, dragStart, resizeStart, position, size]);

    const handleResizeStart = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsResizing(true);
        setResizeStart({
            x: e.clientX,
            y: e.clientY,
            width: size.width,
            height: size.height
        });
    };

    const handleGameClose = () => {
        onClose();
    };

    if (isMinimized) {
        return (
            <button
                onClick={() => setIsMinimized(false)}
                className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl shadow-[0_0_30px_rgba(249,115,22,0.5)] hover:shadow-[0_0_40px_rgba(249,115,22,0.7)] transition-all hover:scale-110 active:scale-95 flex items-center justify-center text-white text-2xl font-bold z-[9998] border border-orange-400/30"
                title="Open Code Runner Game"
            >
                🎮
            </button>
        );
    }

    return (
        <div
            ref={pipRef}
            className="fixed bg-black rounded-xl shadow-[0_8px_40px_rgba(0,0,0,0.6)] overflow-hidden border-2 border-orange-500/40 z-[9998]"
            style={{
                left: position.x,
                top: position.y,
                width: size.width,
                height: size.height,
                cursor: isDragging ? 'grabbing' : 'default'
            }}
        >
            {/* Header Bar */}
            <div
                className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-r from-orange-600 to-red-600 flex items-center justify-between px-3 z-10 cursor-grab active:cursor-grabbing"
                onMouseDown={handleMouseDown}
            >
                <div className="flex items-center gap-2 text-white text-xs font-bold tracking-wider">
                    <span className="text-sm">🎮</span>
                    <span>CODE RUNNER</span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setIsMinimized(true)}
                        className="w-6 h-6 hover:bg-white/20 rounded flex items-center justify-center transition-colors"
                        title="Minimize"
                    >
                        <Minimize2 size={14} className="text-white" />
                    </button>
                    <button
                        onClick={() => {
                            if (size.width === 320) {
                                setSize({ width: 640, height: 480 });
                            } else {
                                setSize({ width: 320, height: 240 });
                            }
                        }}
                        className="w-6 h-6 hover:bg-white/20 rounded flex items-center justify-center transition-colors"
                        title="Toggle Size"
                    >
                        <Maximize2 size={14} className="text-white" />
                    </button>
                    <button
                        onClick={handleGameClose}
                        className="w-6 h-6 hover:bg-red-500/50 rounded flex items-center justify-center transition-colors"
                        title="Close Game"
                    >
                        <X size={14} className="text-white" />
                    </button>
                </div>
            </div>

            {/* Game Content */}
            <div className="w-full h-full pt-8">
                <SubwaySurfer3D onClose={handleGameClose} />
            </div>

            {/* Resize Handle */}
            <div
                className="pip-resize-handle absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
                onMouseDown={handleResizeStart}
            >
                <div className="absolute bottom-1 right-1 w-0 h-0 border-l-8 border-l-transparent border-b-8 border-b-orange-500/60" />
            </div>
        </div>
    );
}

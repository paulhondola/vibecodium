import { useEffect } from 'react';

interface SubwaySurfer3DProps {
    onClose: () => void;
}

export default function SubwaySurfer3D({ onClose }: SubwaySurfer3DProps) {
    useEffect(() => {
        const handler = (e: MessageEvent) => {
            if (e.data?.type === 'GAME_EXIT') onClose();
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, [onClose]);

    return (
        <div style={{
            width: '100%',
            height: '100%',
            background: '#000',
        }}>
            <iframe
                src="/subway-surfer.html"
                style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    display: 'block',
                }}
                title="Code Runner Game"
                allow="gamepad"
            />
        </div>
    );
}

import '@tldraw/tldraw/tldraw.css';
import { Tldraw } from '@tldraw/tldraw';
import { useMemo } from 'react';

interface WhiteboardAreaProps {
  projectId: string | null;
}

export default function WhiteboardArea({ projectId }: WhiteboardAreaProps) {
  // Use a unique persistence key based on project ID to store it per-project locally.
  // In a fully deployed environment, this is replaced by a remote sync provider.
  const persistenceKey = useMemo(() => `tldraw-room-${projectId || 'local'}`, [projectId]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', zIndex: 10 }}>
      {/* 
        This is a live, real-time capable Tldraw canvas.
        persistenceKey ensures the state doesn't vanish on reload.
        To make it fully multiplayer, hook up the `store` prop to a Yjs document 
        via @tldraw/yjs or our existing SocketProvider. 
      */}
      <Tldraw persistenceKey={persistenceKey} autoFocus={false} />
    </div>
  );
}

import { useRef, useState, useEffect, useCallback } from "react";
import MonacoEditor, { useMonaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { Bot, Check, X } from "lucide-react";
import type { ProjectFile } from "./Workspace";
import { useSocket } from "../contexts/SocketProvider";
import type { PendingUpdate } from "../hooks/useAgentStream";
import GamePIP from "./GamePIP";

function safeCssId(id: string) {
    return id.replace(/[^a-zA-Z0-9]/g, "_");
}

interface RemoteCodeUpdate { filePath: string; content: string; clientId: string }
interface RemoteCursorUpdate { filePath: string; clientId: string; color: string; userName: string; position: { lineNumber: number; column: number } }

interface EditorAreaProps {
    openFiles: ProjectFile[];
    onSelectFile: (file: ProjectFile) => void;
    onCloseFile: (file: ProjectFile, e?: React.MouseEvent) => void;
    activeFile: ProjectFile | null;
    userId?: string;
    remoteCodeUpdate?: RemoteCodeUpdate | null;
    remoteCursorUpdate?: RemoteCursorUpdate | null;
    pendingUpdate?: PendingUpdate | null;
    onPendingResolved?: () => void;
    projectId?: string | null;
}

export default function EditorArea({
    openFiles, onSelectFile, onCloseFile,
    activeFile, userId, remoteCodeUpdate, remoteCursorUpdate,
    pendingUpdate, onPendingResolved, projectId,
}: EditorAreaProps) {
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const monaco = useMonaco();
    const [code, setCode] = useState("");
    const [isRetro, setIsRetro] = useState(false);
    const [editorMode, setEditorMode] = useState<'default' | 'vim' | 'emacs'>('default');
    const vimInstanceRef = useRef<any>(null);

    // Power Mode state
    const [combo, setCombo] = useState(0);
    const [isPowerMode, setIsPowerMode] = useState(false);
    const [sparks, setSparks] = useState<{ id: string; x: number; y: number; color: string }[]>([]);
    const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const editorContainerRef = useRef<HTMLDivElement>(null);

    // Time-Travel Debugging state
    const [isTimeTravelOpen, setIsTimeTravelOpen] = useState(false);
    const [snapshots, setSnapshots] = useState<{timestamp: number, content: string}[]>([]);
    const [snapshotIndex, setSnapshotIndex] = useState(0);

    // Game state
    const [showGame, setShowGame] = useState(false);

    const { send } = useSocket();
    const sendRef = useRef(send);
    useEffect(() => { sendRef.current = send; }, [send]);

    const decorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null);
    const isRemoteUpdate = useRef(false);
    const injectedStyles = useRef<Set<string>>(new Set());
    const activeFileRef = useRef(activeFile);
    useEffect(() => { activeFileRef.current = activeFile; }, [activeFile]);

    // Konami code Easter Egg
    const konamiIndex = useRef(0);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
            if (e.key === konamiCode[konamiIndex.current] || e.key.toLowerCase() === konamiCode[konamiIndex.current].toLowerCase()) {
                konamiIndex.current++;
                if (konamiIndex.current === konamiCode.length) {
                    setIsRetro(prev => !prev);
                    konamiIndex.current = 0;
                    // Play level up sound effect
                    new Audio('https://www.myinstants.com/media/sounds/1up.mp3').play().catch(() => {});
                }
            } else {
                konamiIndex.current = 0;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Define retro theme
    useEffect(() => {
        if (monaco) {
            monaco.editor.defineTheme('retro', {
                base: 'vs-dark',
                inherit: false,
                rules: [
                    { token: '', foreground: '00FF00', background: '000000' },
                    { token: 'keyword', foreground: '00FF00', fontStyle: 'bold' },
                    { token: 'string', foreground: '33FF33' },
                    { token: 'number', foreground: 'AAFFAA' },
                    { token: 'comment', foreground: '008800' },
                ],
                colors: {
                    'editor.background': '#000000',
                    'editor.foreground': '#00FF00',
                    'editorCursor.foreground': '#00FF00',
                    'editor.lineHighlightBackground': '#002200',
                    'editorLineNumber.foreground': '#008800',
                    'editor.selectionBackground': '#004400',
                }
            });
        }
    }, [monaco]);

    // Sync code when active file changes
    useEffect(() => {
        setIsTimeTravelOpen(false); // Close timeline on file switch
        if (activeFile) {
            setCode(activeFile.content || "");
            decorationsRef.current?.clear();
        } else {
            setCode("");
        }
    }, [activeFile]);

    // Fetch snapshots when Time-Travel opens
    useEffect(() => {
        if (isTimeTravelOpen && projectId && activeFile) {
            fetch(`/api/projects/${projectId}/snapshots?path=${encodeURIComponent(activeFile.path)}`)
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.snapshots) {
                        // Snapshots from backend might be desc, we want chronological (oldest to newest)
                        const chronological = [...data.snapshots].reverse();
                        setSnapshots(chronological);
                        setSnapshotIndex(chronological.length - 1);
                    }
                })
                .catch(err => console.error("Failed fetching snapshots:", err));
        }
    }, [isTimeTravelOpen, projectId, activeFile]);

    // Apply snapshot content to editor when scrubbing slider
    useEffect(() => {
        if (isTimeTravelOpen && snapshots.length > 0) {
            const snappedCode = snapshots[snapshotIndex]?.content || "";
            setCode(snappedCode);
            if (editorRef.current) {
                const model = editorRef.current.getModel();
                if (model && model.getValue() !== snappedCode) {
                    isRemoteUpdate.current = true;
                    model.setValue(snappedCode);
                    setTimeout(() => { isRemoteUpdate.current = false; }, 50);
                }
            }
        }
    }, [snapshotIndex, isTimeTravelOpen, snapshots]);

    const handleRestoreSnapshot = () => {
        if (!isTimeTravelOpen || snapshots.length === 0) return;
        const restoredContent = snapshots[snapshotIndex]?.content || "";
        if (activeFileRef.current) {
            activeFileRef.current.content = restoredContent;
            sendRef.current({
                type: "code_change",
                filePath: activeFileRef.current.path,
                content: restoredContent
            });
        }
        setIsTimeTravelOpen(false);
    };



    // Emit file_focus when switching files
    useEffect(() => {
        if (!activeFile) return;
        sendRef.current({ type: "file_focus", filePath: activeFile.path });
    }, [activeFile]);

    // Apply incoming remote code update
    useEffect(() => {
        if (!remoteCodeUpdate) return;
        if (remoteCodeUpdate.clientId === userId) return;
        if (remoteCodeUpdate.filePath !== activeFileRef.current?.path) return;

        isRemoteUpdate.current = true;
        setCode(remoteCodeUpdate.content);
        if (activeFileRef.current) activeFileRef.current.content = remoteCodeUpdate.content;

        if (editorRef.current) {
            const model = editorRef.current.getModel();
            if (model && model.getValue() !== remoteCodeUpdate.content) {
                const selections = editorRef.current.getSelections();
                model.setValue(remoteCodeUpdate.content);
                if (selections) editorRef.current.setSelections(selections);
            }
        }
        setTimeout(() => { isRemoteUpdate.current = false; }, 50);
    }, [remoteCodeUpdate, userId]);

    // Apply incoming remote cursor update
    useEffect(() => {
        if (!remoteCursorUpdate || !monaco || !editorRef.current) return;
        if (remoteCursorUpdate.clientId === userId) return;
        if (remoteCursorUpdate.filePath !== activeFileRef.current?.path) return;

        const { clientId, color, userName, position } = remoteCursorUpdate;
        const safeId = safeCssId(clientId);

        if (!decorationsRef.current) {
            decorationsRef.current = editorRef.current.createDecorationsCollection([]);
        }

        if (!injectedStyles.current.has(safeId)) {
            const style = document.createElement("style");
            style.id = `cursor-${safeId}`;
            style.innerHTML = `
                .rc-${safeId} { border-left: 2px solid ${color} !important; position: relative; z-index: 9; }
                .rc-${safeId}::after {
                    content: "${userName}";
                    position: absolute; top: -18px; left: 0;
                    background: ${color}; color: white;
                    font-size: 10px; padding: 1px 5px; border-radius: 3px;
                    white-space: nowrap; pointer-events: none; font-family: 'Inter', sans-serif;
                }
            `;
            document.head.appendChild(style);
            injectedStyles.current.add(safeId);
        }

        decorationsRef.current.set([{
            range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
            options: { className: `rc-${safeId}`, hoverMessage: { value: `**${userName}**` } }
        }]);
    }, [remoteCursorUpdate, userId, monaco]);

    const handleEditorDidMount = (ed: editor.IStandaloneCodeEditor) => {
        editorRef.current = ed;
        decorationsRef.current = ed.createDecorationsCollection([]);

        if (editorMode === 'vim') {
            vimInstanceRef.current = initVimMode(ed, document.getElementById('vim-status'));
        } else if (editorMode === 'emacs') {
            vimInstanceRef.current = emacsMode(ed, document.getElementById('vim-status'));
        }

        ed.onDidChangeCursorPosition((e) => {
            if (activeFileRef.current) {
                sendRef.current({
                    type: "cursor_move",
                    filePath: activeFileRef.current.path,
                    position: { lineNumber: e.position.lineNumber, column: e.position.column }
                });
            }
        });

        // Power Mode: track keystrokes for combo
        ed.onKeyDown((e) => {
            // Only count printable characters (not modifier-only keys)
            if (e.code.startsWith('Key') || e.code.startsWith('Digit') || e.code === 'Space' || e.code === 'Enter' || e.code === 'Backspace') {
                setCombo(c => {
                    const next = c + 1;
                    if (next >= 20) setIsPowerMode(true);
                    return next;
                });
                // Reset the idle timer
                if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
                comboTimerRef.current = setTimeout(() => {
                    setCombo(0);
                    setIsPowerMode(false);
                }, 1500);

                // Spawn a spark at a random position near the cursor
                const pos = ed.getPosition();
                if (pos && editorContainerRef.current) {
                    const rect = editorContainerRef.current.getBoundingClientRect();
                    const lineHeight = (ed.getOption(66) as unknown as number) || 20;
                    const x = Math.random() * rect.width;
                    const y = Math.max(0, (pos.lineNumber - 1) * lineHeight);
                    const SPARK_COLORS = ['#f97316','#facc15','#a855f7','#22d3ee','#ec4899','#10b981'];
                    const color = SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)];
                    const id = crypto.randomUUID();
                    setSparks(prev => [...prev, { id, x, y, color }]);
                    setTimeout(() => setSparks(prev => prev.filter(s => s.id !== id)), 600);
                }
            }
        });
    };

    const handleCodeChange = (val: string | undefined) => {
        const text = val || "";
        setCode(text);
        if (isRemoteUpdate.current) return;
        if (activeFileRef.current) {
            sendRef.current({
                type: "code_change",
                filePath: activeFileRef.current.path,
                content: text
            });
        }
    };

    // ── Diff lines for the inline overlay ──────────────────────────────────
    const diffLines = useCallback((original: string, suggested: string) => {
        const oLines = original.split("\n");
        const sLines = suggested.split("\n");
        const result: { type: "remove" | "add" | "equal"; text: string }[] = [];
        for (const l of oLines) result.push({ type: "remove", text: l });
        for (const l of sLines) result.push({ type: "add", text: l });
        return result;
    }, []);

    // ── Accept / Reject handlers ────────────────────────────────────────────
    const handleAccept = useCallback(() => {
        if (!pendingUpdate) return;

        // Targeted replace: sub in only the changed section, keep the rest of the file intact
        const currentContent = editorRef.current?.getModel()?.getValue() ?? code;
        const newContent = currentContent.includes(pendingUpdate.originalContent)
            ? currentContent.replace(pendingUpdate.originalContent, pendingUpdate.suggestedContent)
            : pendingUpdate.suggestedContent; // fallback: full replace if original not found

        setCode(newContent);
        if (editorRef.current) {
            const model = editorRef.current.getModel();
            if (model) {
                isRemoteUpdate.current = true;
                model.setValue(newContent);
                setTimeout(() => { isRemoteUpdate.current = false; }, 50);
            }
        }
        if (activeFileRef.current) {
            activeFileRef.current.content = newContent;
        }

        sendRef.current({
            type: "agent_accepted",
            filePath: pendingUpdate.filePath,
            content: newContent,
            updateId: pendingUpdate.id,
        });

        onPendingResolved?.();
    }, [pendingUpdate, code, onPendingResolved]);

    const handleReject = useCallback(() => {
        onPendingResolved?.();
    }, [onPendingResolved]);

    const getFileLanguage = (path: string | undefined) => {
        if (!path) return "javascript";
        const parts = path.split('.');
        if (parts.length < 2) return "plaintext";
        const ext = parts.pop()?.toLowerCase();
        
        switch (ext) {
            case "ts": case "tsx": return "typescript";
            case "js": case "jsx": return "javascript";
            case "json": return "json";
            case "md": case "mdx": return "markdown";
            case "css": case "scss": case "sass": case "less": return "css";
            case "html": case "htm": return "html";
            case "vue": return "vue";
            case "py": case "pyw": return "python";
            case "java": return "java";
            case "go": return "go";
            case "c": return "c";
            case "cpp": case "cxx": case "cc": case "h": case "hpp": return "cpp";
            case "cs": return "csharp";
            case "rs": return "rust";
            case "php": return "php";
            case "rb": return "ruby";
            case "pl": case "pm": return "perl";
            case "sql": return "sql";
            case "sh": case "bash": return "shell";
            case "yaml": case "yml": return "yaml";
            case "xml": return "xml";
            case "txt": return "plaintext";
            default: return "javascript";
        }
    };

    const language = getFileLanguage(activeFile?.path);

    const hasPending = !!pendingUpdate && pendingUpdate.status === "pending";

    useEffect(() => {
        if (editorRef.current) {
            if (editorMode === 'vim') {
                if (vimInstanceRef.current) vimInstanceRef.current.dispose();
                vimInstanceRef.current = initVimMode(editorRef.current, document.getElementById('vim-status'));
            } else if (editorMode === 'emacs') {
                if (vimInstanceRef.current) vimInstanceRef.current.dispose();
                try { vimInstanceRef.current = emacsMode(editorRef.current, document.getElementById('vim-status')); } catch(e) {}
            } else {
                if (vimInstanceRef.current) {
                    vimInstanceRef.current.dispose();
                    vimInstanceRef.current = null;
                }
            }
        }
        return () => {
            if (vimInstanceRef.current) {
                vimInstanceRef.current.dispose();
                vimInstanceRef.current = null;
            }
        }
    }, [editorMode]);

    // Escape key rejects the pending diff
    useEffect(() => {
        if (!hasPending) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleReject(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [hasPending, handleReject]);

    return (
        <div className="flex flex-col h-full bg-[#09090b] text-[#c9d1d9] relative">
            {/* Tab bar */}
            <div className="flex bg-[#09090b] border-b border-[#27272a] shrink-0 overflow-x-auto no-scrollbar scroll-smooth">
                {openFiles.map(file => {
                    const isActive = activeFile?.path === file.path;
                    const ext = file.path.split('.').pop()?.toUpperCase() || '';
                    const isJS = ext === 'JS' || ext === 'TS' || ext === 'TSX' || ext === 'JSX';

                    return (
                        <div
                            key={file.path}
                            onClick={() => onSelectFile(file)}
                            className={`flex items-center gap-2 px-3 py-1.5 border-r border-[#27272a] cursor-pointer max-w-[200px] min-w-[120px] group transition-colors ${
                                isActive
                                    ? "bg-[#18181b] border-t-[3px] border-t-cyan-500 text-gray-200"
                                    : "bg-[#09090b] text-gray-500 hover:bg-[#18181b] hover:text-gray-300 border-t-[3px] border-t-transparent"
                            }`}
                        >
                            <span className={`font-bold text-[10px] ${isActive ? (isJS ? "text-yellow-400" : "text-cyan-400") : "text-gray-600"}`}>
                                {isJS ? 'JS' : ext.substring(0, 3)}
                            </span>
                            <span className="text-xs truncate flex-1 font-medium">{file.path.split("/").pop()}</span>
                            <button
                                onClick={(e) => onCloseFile(file, e)}
                                className={`p-0.5 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity ${isActive ? "hover:bg-[#27272a] text-gray-400" : "hover:bg-[#27272a] text-gray-500"}`}
                            >
                                <X size={12} />
                            </button>
                        </div>
                    );
                })}
                
                {/* Editor Mode Selection */}
                <div className="ml-auto p-1.5 flex items-center shrink-0 border-l border-[#27272a] gap-2">
                    <select 
                        value={editorMode}
                        onChange={(e) => setEditorMode(e.target.value as any)}
                        className="bg-[#18181b] border border-[#27272a] text-[#c9d1d9] text-[10px] uppercase font-bold px-2 py-1 rounded cursor-pointer outline-none"
                    >
                        <option value="default">Default</option>
                        <option value="vim">Vim</option>
                        <option value="emacs">Emacs</option>
                    </select>
                </div>

                {/* Time Travel Toggle Button */}
                <div className="p-1.5 flex items-center shrink-0 border-l border-[#27272a]">
                    <button
                        onClick={() => setIsTimeTravelOpen(prev => !prev)}
                        className={`text-[10px] px-2 py-1 flex items-center gap-1.5 rounded transition font-medium tracking-wide ${isTimeTravelOpen ? "bg-cyan-500/20 text-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.2)]" : "text-gray-400 hover:text-gray-200 hover:bg-[#27272a]"}`}
                        title="Time-Travel History"
                    >
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        TIME TRAVEL
                    </button>
                </div>

                {/* Game Toggle Button */}
                <div className="p-1.5 flex items-center shrink-0 border-l border-[#27272a]">
                    <button
                        onClick={() => setShowGame(prev => !prev)}
                        className="text-[10px] px-2 py-1 flex items-center gap-1.5 rounded transition font-medium tracking-wide bg-gradient-to-r from-orange-500/10 to-red-500/10 text-orange-400 hover:from-orange-500/20 hover:to-red-500/20 hover:shadow-[0_0_8px_rgba(249,115,22,0.2)] border border-orange-500/20"
                        title="Play Code Runner Game"
                    >
                        <span className="text-xs">🎮</span>
                        GAME
                    </button>
                </div>
            </div>

            {/* Power Mode indicator */}
            {combo > 10 && (
                <div className={`absolute top-12 right-4 z-40 pointer-events-none flex flex-col items-end gap-1 transition-all duration-200 ${isPowerMode ? 'opacity-100' : 'opacity-70'}`}>
                    <div className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded font-mono ${
                        isPowerMode 
                            ? 'bg-orange-500/20 text-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.5)] animate-pulse' 
                            : 'bg-white/5 text-gray-500'
                    }`}>
                        {isPowerMode ? '⚡ POWER MODE' : 'COMBO'}
                    </div>
                    <div className={`text-4xl font-black font-mono ${isPowerMode ? 'text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,1)]' : 'text-gray-400'}`}>
                        x{combo}
                    </div>
                </div>
            )}

            <div
                ref={editorContainerRef}
                className="flex-1 relative"
                style={isPowerMode ? {
                    animation: 'shake 0.08s ease-in-out infinite alternate',
                } : undefined}
            >
                {/* Sparks */}
                {sparks.map(s => (
                    <div
                        key={s.id}
                        className="absolute pointer-events-none"
                        style={{ left: s.x, top: s.y, zIndex: 40 }}
                    >
                        {['', '✦', '·', '★', '•'].map((char, i) => (
                            <span
                                key={i}
                                className="absolute text-sm"
                                style={{
                                    color: s.color,
                                    transform: `rotate(${i * 72}deg)`,
                                    animation: 'sparkOut 0.5s ease-out forwards',
                                    animationDelay: `${i * 30}ms`,
                                }}
                            >{char}</span>
                        ))}
                    </div>
                ))}
                {activeFile ? (
                    <>
                        <MonacoEditor
                        height="100%"
                        language={language}
                        theme={isRetro ? "retro" : "vs-dark"}
                        value={code}
                        onChange={handleCodeChange}
                        options={{
                            fontSize: 13,
                            minimap: { enabled: false },
                            automaticLayout: true,
                            scrollBeyondLastLine: false,
                            fontFamily: isRetro ? "'Courier New', monospace" : "'JetBrains Mono', 'Fira Code', monospace",
                            padding: { top: 16 },
                            readOnly: hasPending || isTimeTravelOpen, // lock editor while diff is shown or time traveling
                        }}
                        onMount={handleEditorDidMount}
                    />

                    <div id="vim-status" className="absolute bottom-4 left-4 z-50 font-mono text-xs bg-black/80 px-2 py-0.5 rounded text-white shadow-lg pointer-events-none empty:hidden" />
                    
                    {/* ── Time-Travel Slider Overlay ── */}
                    {isTimeTravelOpen && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[550px] bg-[#0d0d0f]/95 backdrop-blur-xl border border-cyan-500/40 rounded-xl overflow-hidden shadow-[0_8px_40px_rgba(34,211,238,0.15)] flex flex-col z-30">
                            <div className="px-4 py-3 flex items-center justify-between border-b border-cyan-500/20 bg-cyan-900/10">
                                <div className="text-[11px] font-semibold tracking-wider uppercase text-cyan-400 flex items-center gap-2">
                                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                    History Timeline
                                </div>
                                <button onClick={() => setIsTimeTravelOpen(false)} className="text-cyan-600 hover:text-cyan-400 p-1"><X size={14}/></button>
                            </div>
                            <div className="p-5 flex flex-col gap-4">
                                {snapshots.length === 0 ? (
                                    <p className="text-gray-400 text-[11px] text-center font-mono">No history snapshots found for this file.</p>
                                ) : (
                                    <>
                                        <div className="flex items-center justify-between text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                                            <span>Older</span>
                                            <span className="text-cyan-300 font-mono bg-cyan-900/40 px-2 py-0.5 rounded shadow-inner">
                                                {new Date(snapshots[snapshotIndex]?.timestamp).toLocaleString()}
                                            </span>
                                            <span>Newer</span>
                                        </div>
                                        <input 
                                            type="range" 
                                            min={0} 
                                            max={snapshots.length - 1} 
                                            value={snapshotIndex} 
                                            onChange={(e) => setSnapshotIndex(Number(e.target.value))}
                                            className="w-full h-1.5 bg-[#27272a] rounded-lg appearance-none cursor-pointer"
                                        />
                                        <div className="flex justify-between items-center mt-2">
                                            <span className="text-[10px] text-gray-500 font-mono">Revision {snapshotIndex + 1} of {snapshots.length}</span>
                                            <button 
                                                onClick={handleRestoreSnapshot}
                                                className="bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] uppercase tracking-wider font-bold px-4 py-1.5 rounded transition shadow-lg shadow-cyan-900/30"
                                            >
                                                Restore Version
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                    </>
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[#09090b] select-none">
                        <div className="text-center flex flex-col items-center">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-[#09090b] text-3xl font-bold mb-6 shadow-[0_0_30px_rgba(34,211,238,0.2)]">iT</div>
                            <h2 className="text-2xl font-bold text-gray-300 mb-2 font-['Space_Grotesk']">iTECify Editor</h2>
                            <p className="text-gray-500 text-sm mb-10">Select a file from the explorer to begin coding.</p>
                            <div className="flex flex-col items-start text-xs text-gray-500 gap-3 font-mono border-t border-[#27272a] pt-6">
                                <div className="flex items-center justify-between w-64"><span className="text-gray-600">Show Explorer</span> <span className="px-1.5 py-0.5 rounded bg-[#18181b] border border-[#27272a] text-gray-400">⌘ E</span></div>
                                <div className="flex items-center justify-between w-64"><span className="text-gray-600">Toggle Terminal</span> <span className="px-1.5 py-0.5 rounded bg-[#18181b] border border-[#27272a] text-gray-400">⌘ J</span></div>
                                <div className="flex items-center justify-between w-64"><span className="text-gray-600">Toggle Agent Chat</span> <span className="px-1.5 py-0.5 rounded bg-[#18181b] border border-[#27272a] text-gray-400">⌘ B</span></div>
                                <div className="flex items-center justify-between w-64"><span className="text-gray-600 text-cyan-500/80">Toggle Zen Mode</span> <span className="px-1.5 py-0.5 rounded bg-cyan-900/20 border border-cyan-500/20 text-cyan-400">⌘ K</span></div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Compact Inline Agent Diff Panel ─────────────────────── */}
                {hasPending && pendingUpdate && (
                    <div className="absolute bottom-4 right-4 w-[480px] max-h-[55%] bg-[#0d0d0f]/98 backdrop-blur-xl border border-purple-500/40 rounded-xl overflow-hidden shadow-[0_8px_40px_rgba(168,85,247,0.2)] flex flex-col z-30">
                        {/* Header */}
                        <div className="flex items-center justify-between px-3 py-2 bg-purple-900/20 border-b border-purple-500/20 shrink-0">
                            <div className="flex items-center gap-2 text-purple-300 font-medium text-[11px]">
                                <Bot size={12} className="text-purple-400" />
                                <span>Suggested change in <code className="text-purple-200 bg-purple-500/10 px-1 py-0.5 rounded font-mono text-[10px]">{pendingUpdate.filePath.split("/").pop()}</code></span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={handleReject}
                                    className="bg-red-500/10 hover:bg-red-500/20 text-red-300 px-2.5 py-1 flex items-center gap-1 rounded-md text-[11px] font-semibold transition-all border border-red-500/20"
                                >
                                    <X size={11} /> Reject
                                </button>
                                <button
                                    onClick={handleAccept}
                                    className="bg-green-500/10 hover:bg-green-500/20 text-green-300 px-2.5 py-1 flex items-center gap-1 rounded-md text-[11px] font-semibold transition-all border border-green-500/20 shadow-[0_0_8px_rgba(34,197,94,0.1)]"
                                >
                                    <Check size={11} /> Accept
                                </button>
                            </div>
                        </div>

                        {/* Diff content — scrollable */}
                        <div className="overflow-auto p-3 font-mono text-[11px] leading-5 flex-1">
                            <div className="mb-2 text-[9px] uppercase tracking-widest text-gray-600 font-sans flex items-center gap-3">
                                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500/70"></span> Before</span>
                                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500/70"></span> After</span>
                            </div>
                            {diffLines(pendingUpdate.originalContent, pendingUpdate.suggestedContent).map((line, i) => (
                                <div
                                    key={i}
                                    className={`flex gap-2 px-1.5 py-px rounded-sm ${
                                        line.type === "remove"
                                            ? "bg-red-500/8 text-red-300/75 line-through decoration-red-400/30"
                                            : "bg-green-500/8 text-green-300 border-l-2 border-green-500/40"
                                    }`}
                                >
                                    <span className={`shrink-0 select-none w-3 text-center ${line.type === "remove" ? "text-red-600" : "text-green-600"}`}>
                                        {line.type === "remove" ? "−" : "+"}
                                    </span>
                                    <span className="whitespace-pre-wrap break-all">{line.text || "\u00a0"}</span>
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="shrink-0 px-3 py-1.5 border-t border-purple-500/10 text-[9px] text-gray-600 flex items-center justify-between">
                            <span>Accept syncs to all collaborators</span>
                            <kbd className="px-1 py-0.5 bg-[#18181b] border border-[#27272a] rounded text-gray-500">Esc</kbd>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes shake {
                    0% { transform: translate(-1px, 0px); }
                    25% { transform: translate(1px, 1px); }
                    50% { transform: translate(-1px, -1px); }
                    75% { transform: translate(1px, 0px); }
                    100% { transform: translate(0, -1px); }
                }
                @keyframes sparkOut {
                    0% { opacity: 1; transform: translate(0,0) scale(1); }
                    100% { opacity: 0; transform: translate(var(--sx, 12px), var(--sy, -20px)) scale(0); }
                }
            `}</style>

            {/* Game PIP */}
            {showGame && (
                <GamePIP onClose={() => setShowGame(false)} />
            )}
        </div>
    );
}

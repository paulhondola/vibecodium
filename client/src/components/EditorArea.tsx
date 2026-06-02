import { useRef, useState, useEffect, useCallback } from "react";
import MonacoEditor, { useMonaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { Bot, Check, X, GitBranch } from "lucide-react";
import type { ProjectFile } from "./Workspace";
import { useSocket } from "../contexts/SocketProvider";
import type { PendingUpdate } from "../hooks/useAgentStream";
import GamePIP, { type GameType } from "./GamePIP";
import * as Y from "yjs";

function uint8ArrayToBase64(arr: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < arr.byteLength; i++) binary += String.fromCharCode(arr[i]!);
    return btoa(binary);
}
function base64ToUint8Array(b64: string): Uint8Array {
    const binaryStr = atob(b64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    return bytes;
}

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
    powerModeEnabled?: boolean;
    gameOpen?: boolean;
    onGameChange?: (open: boolean) => void;
    initialGameType?: GameType;
    branchName?: string;
    onCloseOthers?: (file: ProjectFile) => void;
}

export default function EditorArea({
    openFiles, onSelectFile, onCloseFile,
    activeFile, userId, remoteCodeUpdate, remoteCursorUpdate,
    pendingUpdate, onPendingResolved, powerModeEnabled = false,
    gameOpen = false, onGameChange, initialGameType = 'flappy',
    branchName = 'main', onCloseOthers,
}: EditorAreaProps) {
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const monaco = useMonaco();
    const [code, setCode] = useState("");
    const [isRetro, setIsRetro] = useState(false);

    // Power Mode state
    const [combo, setCombo] = useState(0);
    const [isPowerMode, setIsPowerMode] = useState(false);
    const [sparks, setSparks] = useState<{ id: string; x: number; y: number; color: string }[]>([]);
    const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const [activeGame, setActiveGame] = useState<GameType>(initialGameType);
    useEffect(() => { if (gameOpen) setActiveGame(initialGameType); }, [gameOpen, initialGameType]);

    const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
    const [contextMenu, setContextMenu] = useState<{ file: ProjectFile; x: number; y: number } | null>(null);



    const { send, lastMessage: socketMessage } = useSocket();
    const sendRef = useRef(send);
    useEffect(() => { sendRef.current = send; }, [send]);

    // One Y.Doc per open file — keyed by filePath
    const ydocsRef = useRef(new Map<string, Y.Doc>());

    const decorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null);
    const isRemoteUpdate = useRef(false);
    const injectedStyles = useRef<Set<string>>(new Set());
    const activeFileRef = useRef(activeFile);
    useEffect(() => { activeFileRef.current = activeFile; }, [activeFile]);

    // Initialise Y.Doc when active file changes (creates it if missing)
    useEffect(() => {
        if (!activeFile) return;
        const { path: filePath, content: initialContent } = activeFile;
        if (!ydocsRef.current.has(filePath)) {
            const doc = new Y.Doc();
            if (initialContent) {
                doc.transact(() => doc.getText("content").insert(0, initialContent), "init");
            }
            doc.on("update", (update: Uint8Array, origin: unknown) => {
                if (origin !== "local") return;
                sendRef.current({
                    type: "yjs_update",
                    filePath: activeFileRef.current!.path,
                    update: uint8ArrayToBase64(update),
                });
            });
            ydocsRef.current.set(filePath, doc);
        }
        // Sync Monaco to Y.Doc on file switch (may have received remote edits while tab was inactive)
        if (editorRef.current) {
            const doc = ydocsRef.current.get(filePath)!;
            const ydocContent = doc.getText("content").toString();
            const model = editorRef.current.getModel();
            if (model && ydocContent && model.getValue() !== ydocContent) {
                isRemoteUpdate.current = true;
                model.setValue(ydocContent);
                setCode(ydocContent);
                setTimeout(() => { isRemoteUpdate.current = false; }, 50);
            }
        }
    }, [activeFile?.path]); // eslint-disable-line react-hooks/exhaustive-deps

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

    // Register onDidChangeContent on the current Monaco model.
    // Placed after Y.Doc init so the Y.Doc exists when the listener first fires.
    // Re-runs on file switch to future-proof against model changes (e.g. if a path prop is added).
    useEffect(() => {
        const ed = editorRef.current;
        if (!ed) return;
        const model = ed.getModel();
        if (!model) return;
        const disposable = model.onDidChangeContent((e) => {
            if (isRemoteUpdate.current) return;
            const filePath = activeFileRef.current?.path;
            if (!filePath) return;
            const doc = ydocsRef.current.get(filePath);
            if (!doc) return;
            for (const change of e.changes) {
                doc.transact(() => {
                    const ytext = doc.getText("content");
                    if (change.rangeLength > 0) ytext.delete(change.rangeOffset, change.rangeLength);
                    if (change.text) ytext.insert(change.rangeOffset, change.text);
                }, "local");
            }
        });
        return () => disposable.dispose();
    }, [activeFile?.path]); // eslint-disable-line react-hooks/exhaustive-deps

    // Sync code when active file changes
    useEffect(() => {
        if (activeFile) {
            // Guard the model update that @monaco-editor/react will trigger via executeEdits
            // (value prop change fires onDidChangeContent — must not corrupt the new file's Y.Doc)
            isRemoteUpdate.current = true;
            setCode(activeFile.content || "");
            setTimeout(() => { isRemoteUpdate.current = false; }, 100);
            decorationsRef.current?.clear();
        } else {
            setCode("");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeFile]);

    // Emit file_focus when switching files
    useEffect(() => {
        if (!activeFile) return;
        sendRef.current({ type: "file_focus", filePath: activeFile.path });
    }, [activeFile]);

    // Apply incoming remote code update (non-Yjs path — room_state and legacy code_update)
    useEffect(() => {
        if (!remoteCodeUpdate) return;
        if (remoteCodeUpdate.clientId === userId) return;
        if (remoteCodeUpdate.filePath !== activeFileRef.current?.path) return;

        // If Yjs is active for this file, skip regular code_update — Yjs handles it more accurately.
        // Always apply room_state (reconnect) and __agent_accepted__ (agent accept from another client).
        if (
            ydocsRef.current.has(remoteCodeUpdate.filePath) &&
            remoteCodeUpdate.clientId !== "room_state" &&
            remoteCodeUpdate.clientId !== "__agent_accepted__"
        ) return;

        if (remoteCodeUpdate.clientId === "room_state" || remoteCodeUpdate.clientId === "__agent_accepted__") {
            // Re-initialise the Y.Doc from the authoritative content
            const doc = ydocsRef.current.get(remoteCodeUpdate.filePath);
            if (doc) {
                const ytext = doc.getText("content");
                doc.transact(() => {
                    ytext.delete(0, ytext.length);
                    ytext.insert(0, remoteCodeUpdate.content);
                }, "agent_accepted");
            }
        }

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

    // Apply incoming Yjs updates and syncs from socket
    useEffect(() => {
        if (!socketMessage) return;

        if (socketMessage.type === "yjs_update") {
            const { filePath, update: updateB64, clientId: remoteId } = socketMessage;
            if (remoteId === userId) return;
            const doc = ydocsRef.current.get(filePath);
            if (!doc) return; // file not open — ignore; room_state will cover it on next open
            Y.applyUpdate(doc, base64ToUint8Array(updateB64), "remote");
            const merged = doc.getText("content").toString();
            if (filePath === activeFileRef.current?.path && editorRef.current) {
                isRemoteUpdate.current = true;
                const model = editorRef.current.getModel();
                if (model && model.getValue() !== merged) {
                    const sels = editorRef.current.getSelections();
                    model.setValue(merged);
                    if (sels) editorRef.current.setSelections(sels);
                }
                setCode(merged);
                if (activeFileRef.current) activeFileRef.current.content = merged;
                setTimeout(() => { isRemoteUpdate.current = false; }, 50);
            }
            return;
        }

        if (socketMessage.type === "yjs_sync") {
            const { filePath, update: updateB64 } = socketMessage;
            // Only apply to files that are already open (have a Y.Doc)
            const doc = ydocsRef.current.get(filePath);
            if (!doc) return;
            Y.applyUpdate(doc, base64ToUint8Array(updateB64), "remote");
            if (filePath === activeFileRef.current?.path && editorRef.current) {
                const merged = doc.getText("content").toString();
                isRemoteUpdate.current = true;
                const model = editorRef.current.getModel();
                if (model && model.getValue() !== merged) model.setValue(merged);
                setCode(merged);
                if (activeFileRef.current) activeFileRef.current.content = merged;
                setTimeout(() => { isRemoteUpdate.current = false; }, 50);
            }
            return;
        }
    }, [socketMessage, userId]); // eslint-disable-line react-hooks/exhaustive-deps

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

        ed.onDidChangeCursorPosition((e) => {
            setCursorPos({ line: e.position.lineNumber, col: e.position.column });
            if (activeFileRef.current) {
                sendRef.current({
                    type: "cursor_move",
                    filePath: activeFileRef.current.path,
                    position: { lineNumber: e.position.lineNumber, column: e.position.column }
                });
            }
        });

        // Power Mode: track keystrokes for combo (only when enabled via Tools menu)
        ed.onKeyDown((e) => {
            if (!powerModeEnabled) return;
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

        // Sync Y.Doc so next keystroke produces a correct delta (not corrupt).
        // Use "agent_accepted" origin so the observer doesn't double-send via yjs_update.
        const acceptDoc = ydocsRef.current.get(pendingUpdate.filePath);
        if (acceptDoc) {
            acceptDoc.transact(() => {
                const ytext = acceptDoc.getText("content");
                ytext.delete(0, ytext.length);
                ytext.insert(0, newContent);
            }, "agent_accepted");
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

    // Escape key rejects the pending diff
    useEffect(() => {
        if (!hasPending) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleReject(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [hasPending, handleReject]);

    // Close context menu on outside click
    useEffect(() => {
        if (!contextMenu) return;
        const handler = () => setContextMenu(null);
        window.addEventListener("mousedown", handler);
        return () => window.removeEventListener("mousedown", handler);
    }, [contextMenu]);

    return (
        <div className="flex flex-col h-full bg-[#09090b] text-[#c9d1d9] relative">
            {/* Tab bar */}
            <div className="flex bg-[#18181b] border-b border-[#27272a] shrink-0 overflow-x-auto no-scrollbar scroll-smooth">
                {openFiles.map(file => {
                    const isActive = activeFile?.path === file.path;
                    const ext = file.path.split('.').pop()?.toUpperCase() || '';
                    const isJS = ext === 'JS' || ext === 'TS' || ext === 'TSX' || ext === 'JSX';

                    return (
                        <div
                            key={file.path}
                            onClick={() => onSelectFile(file)}
                            onContextMenu={(e) => { e.preventDefault(); setContextMenu({ file, x: e.clientX, y: e.clientY }); }}
                            className={`flex items-center gap-2 px-3 py-1.5 border-r border-[#27272a] cursor-pointer max-w-[200px] min-w-[120px] group transition-colors ${
                                isActive
                                    ? "bg-[#09090b] border-t-2 border-t-[#A855F7] text-zinc-100"
                                    : "bg-[#18181b] text-zinc-500 hover:bg-[#111113] hover:text-zinc-300 border-t-2 border-t-transparent"
                            }`}
                        >
                            <span className={`font-bold text-[10px] ${isActive ? (isJS ? "text-yellow-400" : "text-zinc-400") : "text-zinc-600"}`}>
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
                
            </div>

            {/* Power Mode indicator — only when enabled */}
            {powerModeEnabled && combo > 10 && (
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
                className="flex-1 relative overflow-hidden"
                style={powerModeEnabled && isPowerMode ? {
                    animation: 'shake 0.08s ease-in-out infinite alternate',
                } : undefined}
            >
                {/* Sparks — only when Power Mode is enabled */}
                {powerModeEnabled && sparks.map(s => (
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
                            readOnly: hasPending, // lock editor while diff is shown
                        }}
                        onMount={handleEditorDidMount}
                    />
                    </>
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[#09090b] select-none">
                        <div className="text-center flex flex-col items-center">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-purple-900 flex items-center justify-center text-white text-3xl font-bold mb-6">VC</div>
                            <h2 className="text-2xl font-semibold text-zinc-200 mb-2 tracking-[-0.48px]">VibeCodium Editor</h2>
                            <p className="text-zinc-500 text-sm mb-10">Select a file from the explorer to begin coding.</p>
                            <div className="flex flex-col items-start text-xs text-zinc-500 gap-3 font-mono border-t border-[#27272a] pt-6">
                                <div className="flex items-center justify-between w-64"><span className="text-zinc-600">Go to File</span> <span className="px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400">⌘ P</span></div>
                                <div className="flex items-center justify-between w-64"><span className="text-zinc-600">Search in Files</span> <span className="px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400">⌘ ⇧ F</span></div>
                                <div className="flex items-center justify-between w-64"><span className="text-zinc-600">Show Explorer</span> <span className="px-1.5 py-0.5 rounded bg-[#18181b] border border-[#27272a] text-zinc-400">⌘ E</span></div>
                                <div className="flex items-center justify-between w-64"><span className="text-zinc-600">Toggle Terminal</span> <span className="px-1.5 py-0.5 rounded bg-[#18181b] border border-[#27272a] text-zinc-400">⌘ J</span></div>
                                <div className="flex items-center justify-between w-64"><span className="text-zinc-600">Toggle Agent Chat</span> <span className="px-1.5 py-0.5 rounded bg-[#18181b] border border-[#27272a] text-zinc-400">⌘ B</span></div>
                                <div className="flex items-center justify-between w-64"><span className="text-zinc-500">Toggle Zen Mode</span> <span className="px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400">⌘ K</span></div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Compact Inline Agent Diff Panel ─────────────────────── */}
                {hasPending && pendingUpdate && (
                    <div className="absolute bottom-4 right-4 w-[480px] max-h-[55%] bg-[#18181b] border border-purple-500/30 rounded-[10px] overflow-hidden flex flex-col z-30">
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

            {/* ── Status Bar ── */}
            <div className="shrink-0 h-6 bg-[#111113] border-t border-[#1f1f24] flex items-center px-3 gap-4 text-[10px] font-mono text-zinc-500 select-none">
                <span className="flex items-center gap-1">
                    <GitBranch size={10} className="text-[#A855F7]" />
                    {branchName}
                </span>
                {activeFile && (
                    <>
                        <span className="text-zinc-600">Ln {cursorPos.line}, Col {cursorPos.col}</span>
                        <span className="text-zinc-600">{language}</span>
                        <span className="truncate text-zinc-700 ml-auto">{activeFile.path.split("/").pop()}</span>
                    </>
                )}
            </div>

            {/* ── Tab context menu ── */}
            {contextMenu && (
                <div
                    className="fixed z-[200] bg-[#18181b] border border-[#27272a] rounded-[8px] shadow-xl py-1 min-w-[160px]"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onMouseDown={e => e.stopPropagation()}
                >
                    <button
                        className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-[#27272a] transition-colors"
                        onClick={() => { onCloseFile(contextMenu.file); setContextMenu(null); }}
                    >
                        Close
                    </button>
                    <button
                        className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-[#27272a] transition-colors"
                        onClick={() => { onCloseOthers?.(contextMenu.file); setContextMenu(null); }}
                    >
                        Close Others
                    </button>
                    <div className="my-1 border-t border-[#27272a]" />
                    <button
                        className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-[#27272a] transition-colors"
                        onClick={() => { navigator.clipboard.writeText(contextMenu.file.path); setContextMenu(null); }}
                    >
                        Copy Path
                    </button>
                </div>
            )}

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
            {gameOpen && (
                <GamePIP
                    gameType={activeGame}
                    onSwitchGame={setActiveGame}
                    onClose={() => onGameChange?.(false)}
                />
            )}
        </div>
    );
}

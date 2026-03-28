import { useRef, useState, useEffect, useCallback } from "react";
import MonacoEditor, { useMonaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { Bot, Check, X } from "lucide-react";
import type { ProjectFile } from "./Workspace";
import { useSocket } from "../contexts/SocketProvider";
import type { PendingUpdate } from "../hooks/useAgentStream";

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
    pendingUpdate, onPendingResolved,
}: EditorAreaProps) {
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const monaco = useMonaco();
    const [code, setCode] = useState("");
    const [isRetro, setIsRetro] = useState(false);

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
        if (activeFile) {
            setCode(activeFile.content || "");
            decorationsRef.current?.clear();
        } else {
            setCode("");
        }
    }, [activeFile]);

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

        ed.onDidChangeCursorPosition((e) => {
            if (activeFileRef.current) {
                sendRef.current({
                    type: "cursor_move",
                    filePath: activeFileRef.current.path,
                    position: { lineNumber: e.position.lineNumber, column: e.position.column }
                });
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

    const language = activeFile?.path.endsWith(".tsx") || activeFile?.path.endsWith(".ts")
        ? "typescript"
        : activeFile?.path.endsWith(".json") ? "json"
        : activeFile?.path.endsWith(".md") ? "markdown"
        : activeFile?.path.endsWith(".css") ? "css"
        : activeFile?.path.endsWith(".html") ? "html"
        : activeFile?.path.endsWith(".py") ? "python"
        : "javascript";

    const hasPending = !!pendingUpdate && pendingUpdate.status === "pending";

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
            </div>

            <div className="flex-1 relative">
                {activeFile ? (
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
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[#09090b] select-none">
                        <div className="text-center flex flex-col items-center">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-[#09090b] text-3xl font-bold mb-6 shadow-[0_0_30px_rgba(34,211,238,0.2)]">iT</div>
                            <h2 className="text-2xl font-bold text-gray-300 mb-2 font-['Space_Grotesk']">iTECify Editor</h2>
                            <p className="text-gray-500 text-sm mb-10">Select a file from the explorer to begin coding.</p>
                            <div className="flex flex-col items-start text-xs text-gray-500 gap-3 font-mono">
                                <div className="flex items-center justify-between w-56"><span className="text-gray-600">Show Explorer</span> <span className="px-1.5 py-0.5 rounded bg-[#18181b] border border-[#27272a] text-gray-400">⌘ E</span></div>
                                <div className="flex items-center justify-between w-56"><span className="text-gray-600">Toggle Terminal</span> <span className="px-1.5 py-0.5 rounded bg-[#18181b] border border-[#27272a] text-gray-400">⌘ J</span></div>
                                <div className="flex items-center justify-between w-56"><span className="text-gray-600">Close Window</span> <span className="px-1.5 py-0.5 rounded bg-[#18181b] border border-[#27272a] text-gray-400">⌘ W</span></div>
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
        </div>
    );
}

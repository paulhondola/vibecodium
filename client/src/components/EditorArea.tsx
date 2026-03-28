import { useRef, useState, useEffect } from "react";
import MonacoEditor, { useMonaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { Bot, Check, X } from "lucide-react";
import type { ProjectFile } from "./Workspace";
import { useSocket } from "../contexts/SocketProvider";

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
}

export default function EditorArea({ 
    openFiles, onSelectFile, onCloseFile,
    activeFile, userId, remoteCodeUpdate, remoteCursorUpdate 
}: EditorAreaProps) {
	const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
	const monaco = useMonaco();
	const [showPending, setShowPending] = useState(false);
	const [code, setCode] = useState("");
    const { send } = useSocket();
    const sendRef = useRef(send);
    useEffect(() => { sendRef.current = send; }, [send]);

    const decorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null);
    const isRemoteUpdate = useRef(false);
    const injectedStyles = useRef<Set<string>>(new Set());
    // Keep activeFile in a ref so cursor/send closures always see the current value
    const activeFileRef = useRef(activeFile);
    useEffect(() => { activeFileRef.current = activeFile; }, [activeFile]);

    // Sync code when active file changes
    useEffect(() => {
        if (activeFile) {
            setCode(activeFile.content || "");
            setShowPending(false);
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
                // Determine current cursor positions
                const selections = editorRef.current.getSelections();
                
                // Directly set the value instead of relying on value={code} prop
                model.setValue(remoteCodeUpdate.content);
                
                // Restore selections if possible
                if (selections) {
                    editorRef.current.setSelections(selections);
                }
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

        // Broadcast cursor position on every move
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

        // Don't echo back remote changes
        if (isRemoteUpdate.current) return;

        // Broadcast to other users
        if (activeFileRef.current) {
            sendRef.current({
                type: "code_change",
                filePath: activeFileRef.current.path,
                content: text
            });
        }
    };

	const acceptEdit = () => setShowPending(false);
	const rejectEdit = () => setShowPending(false);

    const language = activeFile?.path.endsWith(".tsx") || activeFile?.path.endsWith(".ts")
        ? "typescript"
        : activeFile?.path.endsWith(".json") ? "json"
        : activeFile?.path.endsWith(".md") ? "markdown"
        : activeFile?.path.endsWith(".css") ? "css"
        : activeFile?.path.endsWith(".html") ? "html"
        : activeFile?.path.endsWith(".py") ? "python"
        : "javascript";

	return (
		<div className="flex flex-col h-full bg-[#09090b] text-[#c9d1d9] relative">
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
                        theme="vs-dark"
                        value={code}
                        onChange={handleCodeChange}
                        options={{
                            fontSize: 13,
                            minimap: { enabled: false },
                            automaticLayout: true,
                            scrollBeyondLastLine: false,
                            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                            padding: { top: 16 },
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

                {showPending && activeFile && (
                    <div className="absolute top-[80px] left-[40px] right-8 bg-[#09090b]/80 backdrop-blur-sm border-2 border-purple-500/50 rounded-lg overflow-hidden shadow-2xl flex flex-col z-20">
                        <div className="flex items-center justify-between bg-purple-500/10 px-3 py-2 border-b border-purple-500/20">
                            <div className="flex items-center gap-2 text-purple-300 font-medium text-xs">
                                <Bot size={14} className="text-purple-400" />
                                <span>Agent proposes changes targeting lines 5-9</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={rejectEdit} className="bg-red-500/20 hover:bg-red-500/30 text-red-300 px-2 py-1 flex items-center gap-1 rounded text-xs transition-colors border border-red-500/30">
                                    <X size={12} /> Reject
                                </button>
                                <button onClick={acceptEdit} className="bg-green-500/20 hover:bg-green-500/30 text-green-300 px-2 py-1 flex items-center gap-1 rounded text-xs transition-colors border border-green-500/30">
                                    <Check size={12} /> Accept
                                </button>
                            </div>
                        </div>
                        <div className="p-3 text-sm font-mono leading-relaxed bg-[#09090b] relative">
                            <div className="text-red-400/80 bg-red-400/10 -mx-3 px-3 py-0.5 line-through decoration-red-400/50">
                                // Mock Code removal
                            </div>
                            <div className="text-green-400 bg-green-400/10 -mx-3 px-3 py-0.5 border-l-2 border-green-400 mt-1">
                                // Neural Generated Injection<br/>
                                console.log("Refactored by iTECify Neural Agent")
                            </div>
                        </div>
                    </div>
                )}
			</div>
		</div>
	);
}

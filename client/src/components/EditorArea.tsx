import { useRef, useState, useEffect } from "react";
import MonacoEditor, { useMonaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { Bot, Check, X, Sparkles } from "lucide-react";
import type { ProjectFile } from "./Workspace";
import { useCollabSocket } from "../contexts/WebSocketProvider";

// CSS-safe class name from clientId (remove special chars)
function safeCssId(id: string) {
    return id.replace(/[^a-zA-Z0-9]/g, "_");
}

export default function EditorArea({ activeFile, projectId }: { activeFile: ProjectFile | null, projectId: string | null }) {
	const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
	const monaco = useMonaco();
	const [showPending, setShowPending] = useState(false);
	const [code, setCode] = useState("");
<<<<<<< HEAD
    
    const decorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null);
    const isRemoteUpdate = useRef(false);
    const injectedStyles = useRef<Set<string>>(new Set());
=======
	const wsRef = useRef<WebSocket | null>(null);
	const isRemoteChange = useRef(false);

    useEffect(() => {
        const ws = new WebSocket(`ws://localhost:3000/ws/editor?roomId=${projectId || "default"}`);
        wsRef.current = ws;

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if ((data.type === "init" || data.type === "update") && typeof data.content === "string") {
                    isRemoteChange.current = true;
                    setCode(data.content);
                }
            } catch (e) {
                console.error("Editor WS parse error", e);
            }
        };

        return () => ws.close();
    }, [projectId]);
>>>>>>> bc5f245de17e09394d37eb6a87dd1f40d03e64c4

    const { ws, myPermission, myClientId, sendMessage, connectedUsers } = useCollabSocket();

    // Update code when activeFile changes
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
        if (activeFile) {
            sendMessage({ type: "file_focus", filePath: activeFile.path });
        }
    }, [activeFile, sendMessage]);

    // WebSocket listener for code_update + cursor_update
    useEffect(() => {
        if (!ws || !monaco || !editorRef.current || !activeFile) return;

        const handleMessage = (e: MessageEvent) => {
            const data = JSON.parse(e.data);

            // ── CODE UPDATE ──
            if (data.type === "code_update" && data.clientId !== myClientId && data.filePath === activeFile.path) {
                isRemoteUpdate.current = true;
                setCode(data.content);
                setTimeout(() => { isRemoteUpdate.current = false; }, 50);
            }

            // ── CURSOR UPDATE ──
            if (data.type === "cursor_update" && data.clientId !== myClientId && data.filePath === activeFile.path) {
                const pos = data.position;
                const safeId = safeCssId(data.clientId);
                const color = data.color || "#A855F7";
                const userName = data.userName || "Remote";

                if (!decorationsRef.current) {
                    decorationsRef.current = editorRef.current!.createDecorationsCollection([]);
                }
                
                // Inject cursor CSS per unique remote user
                if (!injectedStyles.current.has(safeId)) {
                    const style = document.createElement("style");
                    style.id = `cursor-${safeId}`;
                    style.innerHTML = `
                        .rc-${safeId} {
                            border-left: 2px solid ${color} !important;
                            position: relative;
                            z-index: 9;
                        }
                        .rc-${safeId}::after {
                            content: "${userName}";
                            position: absolute;
                            top: -18px;
                            left: 0;
                            background: ${color};
                            color: white;
                            font-size: 10px;
                            padding: 1px 5px;
                            border-radius: 3px;
                            white-space: nowrap;
                            pointer-events: none;
                            font-family: 'Inter', sans-serif;
                        }
                    `;
                    document.head.appendChild(style);
                    injectedStyles.current.add(safeId);
                }

                decorationsRef.current.set([{
                    range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
                    options: {
                        className: `rc-${safeId}`,
                        hoverMessage: { value: `**${userName}**` }
                    }
                }]);
            }
        };

        ws.addEventListener("message", handleMessage);
        return () => ws.removeEventListener("message", handleMessage);
    }, [ws, monaco, activeFile, myClientId]);

	const handleEditorDidMount = (ed: editor.IStandaloneCodeEditor) => {
		editorRef.current = ed;
        decorationsRef.current = ed.createDecorationsCollection([]);

        // Cursor broadcast
        ed.onDidChangeCursorPosition((e) => {
            if (activeFile) {
                sendMessage({
                    type: "cursor_move",
                    filePath: activeFile.path,
                    position: { lineNumber: e.position.lineNumber, column: e.position.column }
                });
            }
        });
	};

<<<<<<< HEAD
    // Code change handler with echo prevention
    const handleCodeChange = (val: string | undefined) => {
        const text = val || "";
        setCode(text);
        
        if (isRemoteUpdate.current) return;

        if (activeFile) {
            sendMessage({
                type: "code_change",
                filePath: activeFile.path,
                content: text
            });
=======
    const handleCodeChange = (val: string | undefined) => {
        const newCode = val || "";
        setCode(newCode);

        if (isRemoteChange.current) {
            isRemoteChange.current = false;
            return;
        }

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "update", content: newCode }));
>>>>>>> bc5f245de17e09394d37eb6a87dd1f40d03e64c4
        }
    };

	const simulateAIEdit = () => {
		if (!editorRef.current || !monaco || !activeFile) return;
		setShowPending(true);
	};

	const acceptEdit = () => setShowPending(false);
	const rejectEdit = () => setShowPending(false);

    const language = activeFile?.path.endsWith(".tsx") || activeFile?.path.endsWith(".ts") 
        ? "typescript" 
        : activeFile?.path.endsWith(".json") 
        ? "json" 
        : activeFile?.path.endsWith(".md") 
        ? "markdown" 
        : activeFile?.path.endsWith(".css")
        ? "css"
        : activeFile?.path.endsWith(".html")
        ? "html"
        : "javascript";

    const isReadOnly = myPermission === "readonly";

	return (
		<div className="flex flex-col h-full bg-[#09090b] text-[#c9d1d9] relative">
			{/* Editor Header */}
			<div className="flex items-center justify-between p-2 shrink-0 bg-[#09090b] border-b border-[#27272a]">
				<div className="flex items-center gap-1">
					<div className="px-3 py-1 bg-[#18181b] border-t-2 border-cyan-500 text-white text-xs rounded-t-lg -mb-[9px] relative z-10 flex items-center gap-2">
						<span className="text-yellow-400 font-bold">JS</span>
                        {activeFile ? activeFile.path.split("/").pop() : "Welcome"}
					</div>

                    {/* Users viewing same file */}
                    {activeFile && connectedUsers.filter(u => u.currentFile === activeFile.path).length > 0 && (
                        <div className="flex -space-x-1 ml-3">
                            {connectedUsers.filter(u => u.currentFile === activeFile.path).map(u => (
                                <div key={u.id} title={u.name} className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white border border-[#09090b]" style={{ backgroundColor: u.color }}>
                                    {u.name.substring(0, 2).toUpperCase()}
                                </div>
                            ))}
                        </div>
                    )}
				</div>
                <div className="flex gap-2 mr-2 items-center">
                    {isReadOnly && (
                        <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
                            Read Only
                        </span>
                    )}
                    <button 
                        onClick={simulateAIEdit}
                        className="flex items-center gap-1.5 px-3 py-[3px] bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded text-xs font-semibold shadow-sm transition-all"
                    >
                        <Sparkles size={12} />
                        Simulate AI Edit
                    </button>
                </div>
			</div>

			{/* Monaco Editor */}
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
                            readOnly: isReadOnly,
                        }}
                        onMount={handleEditorDidMount}
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-600 font-mono text-sm max-w-sm mx-auto text-center leading-relaxed">
                        No active file.<br/><br/>If you imported a repository, click on one of the files in the left Explorer pane to render its contents inside the Monaco environment.
                    </div>
                )}

                {/* Simulated Pending Block */}
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

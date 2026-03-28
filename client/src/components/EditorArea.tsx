import { useRef, useState, useEffect } from "react";
import MonacoEditor, { useMonaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { Bot, Check, X, Sparkles } from "lucide-react";
import type { ProjectFile } from "./Workspace";
import { useSocket } from "../contexts/SocketProvider";

function safeCssId(id: string) {
    return id.replace(/[^a-zA-Z0-9]/g, "_");
}

interface RemoteCodeUpdate { filePath: string; content: string; clientId: string }
interface RemoteCursorUpdate { filePath: string; clientId: string; color: string; userName: string; position: { lineNumber: number; column: number } }

interface EditorAreaProps {
    activeFile: ProjectFile | null;
    userId?: string;
    remoteCodeUpdate?: RemoteCodeUpdate | null;
    remoteCursorUpdate?: RemoteCursorUpdate | null;
}

export default function EditorArea({ activeFile, userId, remoteCodeUpdate, remoteCursorUpdate }: EditorAreaProps) {
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

	const simulateAIEdit = () => {
		if (!editorRef.current || !monaco || !activeFile) return;
		setShowPending(true);
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
			<div className="flex items-center justify-between p-2 shrink-0 bg-[#09090b] border-b border-[#27272a]">
				<div className="flex items-center gap-1">
					<div className="px-3 py-1 bg-[#18181b] border-t-2 border-cyan-500 text-white text-xs rounded-t-lg -mb-[9px] relative z-10 flex items-center gap-2">
						<span className="text-yellow-400 font-bold">JS</span>
                        {activeFile ? activeFile.path.split("/").pop() : "Welcome"}
					</div>
				</div>
                <div className="flex gap-2 mr-2 items-center">
                    <button
                        onClick={simulateAIEdit}
                        className="flex items-center gap-1.5 px-3 py-[3px] bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded text-xs font-semibold shadow-sm transition-all"
                    >
                        <Sparkles size={12} /> Simulate AI Edit
                    </button>
                </div>
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
                    <div className="flex h-full w-full items-center justify-center text-slate-600 font-mono text-sm max-w-sm mx-auto text-center leading-relaxed">
                        No active file.<br/><br/>Click on a file in the Explorer pane to open it.
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

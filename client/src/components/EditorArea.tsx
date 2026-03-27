import { useRef, useState, useEffect } from "react";
import MonacoEditor, { useMonaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { Bot, Check, X, Sparkles } from "lucide-react";
import type { ProjectFile } from "./Workspace";

export default function EditorArea({ activeFile }: { activeFile: ProjectFile | null }) {
	const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
	const monaco = useMonaco();
	const [showPending, setShowPending] = useState(false);
	const [code, setCode] = useState("");

    useEffect(() => {
        if (activeFile) {
            setCode(activeFile.content || "");
            setShowPending(false);
        } else {
            setCode("");
        }
    }, [activeFile]);

	const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor) => {
		editorRef.current = editor;
	};

	const simulateAIEdit = () => {
		if (!editorRef.current || !monaco || !activeFile) return;
		setShowPending(true);
	};

	const acceptEdit = () => {
		setShowPending(false);
	};

	const rejectEdit = () => {
		setShowPending(false);
	};

    const language = activeFile?.path.endsWith(".tsx") || activeFile?.path.endsWith(".ts") 
        ? "typescript" 
        : activeFile?.path.endsWith(".json") 
        ? "json" 
        : activeFile?.path.endsWith(".md") 
        ? "markdown" 
        : "javascript";

	return (
		<div className="flex flex-col h-full bg-[#09090b] text-[#c9d1d9] relative">
			{/* Editor Header */}
			<div className="flex items-center justify-between p-2 shrink-0 bg-[#09090b] border-b border-[#27272a]">
				<div className="flex items-center gap-1">
					<div className="px-3 py-1 bg-[#18181b] border-t-2 border-cyan-500 text-white text-xs rounded-t-lg -mb-[9px] relative z-10 flex items-center gap-2">
						<span className="text-yellow-400 font-bold">JS</span>
                        {activeFile ? activeFile.path.split("/").pop() : "Welcome"}
					</div>
				</div>
                <div className="flex gap-2 mr-2">
                    <button 
                        onClick={simulateAIEdit}
                        className="flex items-center gap-1.5 px-3 py-[3px] bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded text-xs font-semibold shadow-sm transition-all"
                    >
                        <Sparkles size={12} />
                        Simulate AI Edit
                    </button>
                </div>
			</div>

			{/* Monaco Container */}
			<div className="flex-1 relative">
                {activeFile ? (
                    <MonacoEditor
                        height="100%"
                        language={language}
                        theme="vs-dark"
                        value={code}
                        onChange={(val) => setCode(val || "")}
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
                        No active file.<br/><br/>If you imported a repository, click on one of the files in the left Explorer pane to render its contents inside the Monaco environment.
                    </div>
                )}

                {/* Simulated Pending Block Widget Overlaid */}
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

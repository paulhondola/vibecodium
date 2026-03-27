import { useRef, useState } from "react";
import MonacoEditor, { useMonaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { Bot, Check, X, Sparkles } from "lucide-react";

const initialCode = `import { serve } from "bun";

const server = serve({
  port: 3000,
  fetch(req) {
    return new Response("Hello from Bun!");
  },
});

console.log(\`Listening on localhost:\${server.port}\`);
`;

const mockProposedCode = `import { serve } from "bun";

const server = serve({
  port: 3000,
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/api/health") {
      return Response.json({ status: "ok", uptime: process.uptime() });
    }
    return new Response("Hello from Bun!");
  },
});

console.log(\`Listening on localhost:\${server.port}\`);
`;

export default function EditorArea() {
	const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
	const monaco = useMonaco();
	const [showPending, setShowPending] = useState(false);
	const [code, setCode] = useState(initialCode);

	const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor) => {
		editorRef.current = editor;
	};

	// Mocking AI Cursor & Pending Edit Block flow
	const simulateAIEdit = () => {
		if (!editorRef.current || !monaco) return;

		// 1. We mock the "pending" block by replacing our state code with a visual mock 
		// In a real implementation we'd use view zones and decorations.
		setShowPending(true);
	};

	const acceptEdit = () => {
		setCode(mockProposedCode);
		setShowPending(false);
	};

	const rejectEdit = () => {
		setShowPending(false);
	};

	return (
		<div className="flex flex-col h-full bg-[#09090b] text-[#c9d1d9] relative">
			{/* Editor Header */}
			<div className="flex items-center justify-between p-2 shrink-0 bg-[#09090b] border-b border-[#27272a]">
				<div className="flex items-center gap-1">
					<div className="px-3 py-1 bg-[#09090b] border-t-2 border-blue-500 text-white text-xs rounded-t-lg -mb-[9px] relative z-10">
						server/index.ts
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
				<MonacoEditor
					height="100%"
					language="typescript"
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

                {/* Simulated Pending Block Widget Overlaid */}
                {showPending && (
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
                                return new Response("Hello from Bun!");
                            </div>
                            <div className="text-green-400 bg-green-400/10 -mx-3 px-3 py-0.5 border-l-2 border-green-400 mt-1">
                                const url = new URL(req.url);<br />
                                if (url.pathname === "/api/health") &#123;<br />
                                &nbsp;&nbsp;return Response.json(&#123; status: "ok", uptime: process.uptime() &#125;);<br />
                                &#125;<br />
                                return new Response("Hello from Bun!");
                            </div>
                        </div>
                    </div>
                )}
			</div>
		</div>
	);
}

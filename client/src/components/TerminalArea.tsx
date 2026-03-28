import { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { Terminal as TerminalIcon, RefreshCw, Lock } from "lucide-react";

export default function TerminalArea({ projectId }: { projectId: string | null }) {
	const terminalRef = useRef<HTMLDivElement>(null);
	const termInstance = useRef<Terminal | null>(null);
	const wsInstance = useRef<WebSocket | null>(null);
    const [activeTab, setActiveTab] = useState<"terminal" | "preview">("terminal");
    const [previewUrl, setPreviewUrl] = useState("localhost:3000");

	useEffect(() => {
		if (!terminalRef.current || activeTab !== "terminal") return;

        // Small delay to ensure the container is actually rendered and has dimensions
        const initTimeout = setTimeout(() => {
            if (!terminalRef.current) return;

            const term = new Terminal({
                theme: {
                    background: "#09090b",
                    foreground: "#d4d4d4",
                    cursor: "#22d3ee",
                    selectionBackground: "#0891b2",
                },
                fontFamily: "Menlo, Monaco, 'Courier New', monospace",
                fontSize: 13,
                cursorBlink: true,
            });

            const fitAddon = new FitAddon();
            term.loadAddon(fitAddon);
            term.open(terminalRef.current!);

            // Delay fit() so the DOM has had time to layout
            requestAnimationFrame(() => {
                try { fitAddon.fit(); } catch (_) {}
            });

            termInstance.current = term;
            term.writeln("\x1b[1;36m➜\x1b[0m \x1b[90mTerminal ready. Connecting...\x1b[0m");

            // Try connecting WS — but don't crash if server doesn't support it
            try {
                const ws = new WebSocket(`ws://localhost:3000/ws/terminal?roomId=${projectId || "default"}`);
                wsInstance.current = ws;

                ws.onopen = () => {
                    term.clear();
                };

                ws.onmessage = (event) => {
                    if (typeof event.data === "string") {
                        term.write(event.data);
                    } else if (event.data instanceof Blob) {
                        const reader = new FileReader();
                        reader.onload = () => {
                            if (typeof reader.result === "string") term.write(reader.result);
                            else if (reader.result instanceof ArrayBuffer) term.write(new Uint8Array(reader.result));
                        };
                        reader.readAsArrayBuffer(event.data);
                    }
                };

                ws.onerror = () => {
                    term.writeln("\x1b[33m⚠ Terminal WS unavailable — node-pty not installed on server.\x1b[0m");
                    term.writeln("\x1b[90mYou can still use the editor for collaboration.\x1b[0m");
                };

                const disposableData = term.onData((data) => {
                    if (ws.readyState === WebSocket.OPEN) ws.send(data);
                });

                const handleResize = () => {
                    try { fitAddon.fit(); } catch (_) {}
                };
                window.addEventListener("resize", handleResize);

                // Store cleanup refs
                (term as any)._cleanup = () => {
                    window.removeEventListener("resize", handleResize);
                    disposableData.dispose();
                    ws.close();
                    term.dispose();
                };
            } catch (_) {
                term.writeln("\x1b[33m⚠ Could not connect to terminal server.\x1b[0m");
            }
        }, 50); // 50ms delay for DOM readiness

		return () => {
            clearTimeout(initTimeout);
            if (termInstance.current) {
                const cleanup = (termInstance.current as any)._cleanup;
                if (cleanup) cleanup();
                else termInstance.current.dispose();
                termInstance.current = null;
            }
		};
	}, [activeTab, projectId]);



	return (
		<div className="flex flex-col h-full bg-[#09090b] text-white">
			<div className="flex items-center justify-between px-2 bg-[#18181b] border-b border-[#27272a] shrink-0">
				<div className="flex items-center gap-1">
                    <button
                        onClick={() => setActiveTab("terminal")}
                        className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors text-xs font-medium uppercase tracking-wider ${activeTab === "terminal" ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                    >
                        <TerminalIcon size={14} /> Terminal
                    </button>
				</div>
                
			</div>

            {activeTab === "terminal" && (
                <div className="flex-1 w-full pl-2 pb-2 relative">
                    <div ref={terminalRef} className="absolute inset-0 pt-2" />
                </div>
            )}

            {activeTab === "preview" && (
                <div className="flex-1 w-full flex flex-col bg-white overflow-hidden text-black relative">
                    <div className="h-10 bg-[#f1f5f9] border-b border-[#cbd5e1] flex items-center px-4 gap-4 shrink-0 shadow-sm">
                        <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-[#f87171]"></div>
                            <div className="w-3 h-3 rounded-full bg-[#facc15]"></div>
                            <div className="w-3 h-3 rounded-full bg-[#4ade80]"></div>
                        </div>
                        <div className="flex-1 max-w-xl mx-auto flex items-center bg-white border border-[#e2e8f0] rounded-md h-7 px-3 gap-2 shadow-inner">
                            <Lock size={12} className="text-gray-400" />
                            <input
                                type="text"
                                value={previewUrl}
                                onChange={(e) => setPreviewUrl(e.target.value)}
                                className="bg-transparent border-none outline-none text-xs w-full text-gray-600 font-mono"
                            />
                            <RefreshCw size={12} className="text-gray-400 cursor-pointer hover:text-gray-600" />
                        </div>
                    </div>
                    <div className="flex-1 bg-white p-8 overflow-y-auto w-full flex items-center justify-center">
                        <div className="text-center">
                            <h2 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-500 mb-4">Hello from Bun!</h2>
                            <p className="text-gray-500 text-sm">Status: <strong>ok</strong></p>
                            <p className="text-gray-400 text-xs mt-2 font-mono">Uptime: 142.05s</p>
                        </div>
                    </div>
                </div>
            )}
		</div>
	);
}

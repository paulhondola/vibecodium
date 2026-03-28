import { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { Terminal as TerminalIcon, StopCircle, Lock, RefreshCw } from "lucide-react";

export default function TerminalArea({ projectId }: { projectId: string | null }) {
	const terminalRef = useRef<HTMLDivElement>(null);
	const termInstance = useRef<Terminal | null>(null);
	const wsInstance = useRef<WebSocket | null>(null);
    const [activeTab, setActiveTab] = useState<"terminal" | "preview">("terminal");
    const [previewUrl, setPreviewUrl] = useState("localhost:3000");
    const [isConnected, setIsConnected] = useState(false);

	useEffect(() => {
		if (!terminalRef.current || activeTab !== "terminal") return;

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

            requestAnimationFrame(() => {
                try { fitAddon.fit(); } catch (_) {}
            });

            termInstance.current = term;
            term.writeln("\x1b[1;36m➜\x1b[0m \x1b[90mConnecting to iTECify sandbox...\x1b[0m");

            try {
                const ws = new WebSocket(`ws://localhost:3000/ws/terminal?roomId=${projectId || "default"}`);
                wsInstance.current = ws;

                ws.onopen = () => {
                    setIsConnected(true);
                    term.clear();
                    // Send initial terminal dimensions
                    sendResize(ws, term);
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

                ws.onclose = () => {
                    setIsConnected(false);
                    term.writeln("\r\n\x1b[33m[Disconnected]\x1b[0m");
                };

                ws.onerror = () => {
                    term.writeln("\x1b[31m⚠ Terminal connection failed.\x1b[0m");
                };

                // Forward keystrokes to container stdin
                const disposableData = term.onData((data) => {
                    if (ws.readyState === WebSocket.OPEN) ws.send(data);
                });

                // Send resize on window resize
                const handleResize = () => {
                    try { fitAddon.fit(); } catch (_) {}
                    if (ws.readyState === WebSocket.OPEN) sendResize(ws, term);
                };
                window.addEventListener("resize", handleResize);

                (term as any)._cleanup = () => {
                    window.removeEventListener("resize", handleResize);
                    disposableData.dispose();
                    ws.close();
                    term.dispose();
                };
            } catch (_) {
                term.writeln("\x1b[31m⚠ Could not connect to terminal server.\x1b[0m");
            }
        }, 50);

		return () => {
            clearTimeout(initTimeout);
            if (termInstance.current) {
                const cleanup = (termInstance.current as any)._cleanup;
                if (cleanup) cleanup();
                else termInstance.current.dispose();
                termInstance.current = null;
            }
            setIsConnected(false);
		};
	}, [activeTab, projectId]);

    const handleStop = () => {
        const ws = wsInstance.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "stop" }));
        }
    };

	return (
		<div className="flex flex-col h-full bg-[#09090b] text-white">
			<div className="flex items-center justify-between px-2 bg-[#18181b] border-b border-[#27272a] shrink-0">
				<div className="flex items-center gap-1">
                    <button
                        onClick={() => setActiveTab("terminal")}
                        className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors text-xs font-medium uppercase tracking-wider ${activeTab === "terminal" ? "border-cyan-400 text-cyan-400" : "border-transparent text-gray-500 hover:text-gray-300"}`}
                    >
                        <TerminalIcon size={14} /> Terminal
                    </button>
				</div>

                <div className="flex items-center gap-2 pr-2">
                    {/* Status dot */}
                    <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]" : "bg-gray-600"}`} />
                    {/* Stop button */}
                    {isConnected && (
                        <button
                            onClick={handleStop}
                            title="Stop container"
                            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors border border-transparent hover:border-red-500/20"
                        >
                            <StopCircle size={11} /> Stop
                        </button>
                    )}
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

function sendResize(ws: WebSocket, term: Terminal) {
    if (ws.readyState !== WebSocket.OPEN) return;
    try {
        ws.send(JSON.stringify({ type: "resize", rows: term.rows, cols: term.cols }));
    } catch (_) {}
}

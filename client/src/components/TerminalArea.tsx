import { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { Play, Square, Trash2, Terminal as TerminalIcon, Globe, RefreshCw, Lock } from "lucide-react";
import { useAuth0 } from "@auth0/auth0-react";

export default function TerminalArea() {
	const terminalRef = useRef<HTMLDivElement>(null);
	const termInstance = useRef<Terminal | null>(null);
	const [status, setStatus] = useState<"idle" | "running">("idle");
    const [activeTab, setActiveTab] = useState<"terminal" | "preview">("terminal");
    const [previewUrl, setPreviewUrl] = useState("localhost:3000");
    const { getAccessTokenSilently } = useAuth0();

	useEffect(() => {
		if (!terminalRef.current || activeTab !== "terminal") return;

		const term = new Terminal({
			theme: {
				background: "#09090b", // Deep dark space gray
				foreground: "#d4d4d4",
				cursor: "#22d3ee", // Cyan-400
                selectionBackground: "#0891b2", // Cyan-600
			},
			fontFamily: "Menlo, Monaco, 'Courier New', monospace",
			fontSize: 13,
			cursorBlink: true,
		});

		const fitAddon = new FitAddon();
		term.loadAddon(fitAddon);
		term.open(terminalRef.current);
		fitAddon.fit();

		term.writeln("\x1b[1;36m➜\x1b[0m \x1b[1;32m~ \x1b[0m\x1b[36mvibecodium\x1b[0m Shared Terminal Connected.");
		term.writeln("\x1b[90mSandboxed environment ready.\x1b[0m");
		term.write("\r\n$ ");

		let currentLine = "";

		term.onData(async (data) => {
			if (status === "running") return; 

			const code = data.charCodeAt(0);
			
			if (code === 13) { // Enter
				term.write("\r\n");
				if (currentLine.trim() === "clear") {
					term.clear();
				} else if (currentLine.trim() === "bun run server/index.ts") {
                    handleRun();
                } else if (currentLine.trim().startsWith("git ")) {
                    setStatus("running");
                    term.writeln("\x1b[90mExecuting git inside container...\x1b[0m");

                    try {
                        const token = await getAccessTokenSilently();
                        const res = await fetch("http://localhost:3000/api/git", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${token}`
                            },
                            body: JSON.stringify({ command: currentLine.trim(), projectId: "mock-project-id" })
                        });

                        const resData = await res.json();
                        
                        if (!res.ok) {
                            term.writeln(`\r\n\x1b[31mError:\x1b[0m ${resData.error || "Unknown server error"}`);
                        } else {
                            const lines = resData.output.split('\n');
                            for (const line of lines) {
                                term.writeln(`\r\n${line}`);
                            }
                        }
                    } catch (err: any) {
                        term.writeln(`\r\n\x1b[31mError executing git:\x1b[0m ${err.message}`);
                    }
                    setStatus("idle");
                } else if (currentLine.trim() !== "") {
					term.writeln(`\x1b[31mbash: ${currentLine}: mock command not found\x1b[0m`);
				}
				if (currentLine.trim() !== "bun run server/index.ts") {
				    term.write("\r\n$ ");
                }
				currentLine = "";
			} else if (code === 127) { // Backspace
				if (currentLine.length > 0) {
					currentLine = currentLine.slice(0, -1);
					term.write("\b \b");
				}
			} else {
				currentLine += data;
				term.write(data);
			}
		});

		termInstance.current = term;

		const handleResize = () => {
            try { fitAddon.fit(); } catch(e) {}
        };
		window.addEventListener("resize", handleResize);

		return () => {
			window.removeEventListener("resize", handleResize);
			term.dispose();
		};
	}, [activeTab]);

    const handleRun = () => {
        if (status === "running" || !termInstance.current) return;
        setStatus("running");
        termInstance.current.writeln("\x1b[38;2;34;211;238m[Running]\x1b[0m bun run server/index.ts");
        
        setTimeout(() => {
            termInstance.current?.writeln("Listening on localhost:3000");
            setActiveTab("preview"); // Auto-switch to preview on run
        }, 800);

        setTimeout(() => {
            if (activeTab === "terminal") {
                termInstance.current?.writeln("\x1b[32m[Finished in 1.2s]\x1b[0m");
                termInstance.current?.write("\r\n$ ");
            }
            setStatus("idle");
        }, 1200);
    };

    const handleClear = () => {
        termInstance.current?.clear();
        termInstance.current?.write("$ ");
    };

	return (
		<div className="flex flex-col h-full bg-[#09090b] text-white">
			{/* Shared Tabs Toolbar */}
			<div className="flex items-center justify-between px-2 bg-[#18181b] border-b border-[#27272a] shrink-0 cursor-row-resize">
				<div className="flex items-center gap-1">
                    <button 
                        onClick={() => setActiveTab("terminal")}
                        className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors text-xs font-medium uppercase tracking-wider ${activeTab === "terminal" ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                    >
                        <TerminalIcon size={14} /> Terminal
                    </button>
                    <button 
                        onClick={() => setActiveTab("preview")}
                        className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors text-xs font-medium uppercase tracking-wider ${activeTab === "preview" ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                    >
                        <Globe size={14} /> Live Preview
                    </button>
				</div>
                <div className="flex gap-2">
                    {activeTab === "terminal" && (
                        <>
                            <button onClick={handleRun} disabled={status === "running"} className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors disabled:opacity-50">
                                {status === "running" ? <Square size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
                                {status === "running" ? "Stop" : "Run Server"}
                            </button>
                            <button onClick={handleClear} className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-[#27272a] transition-colors mr-2">
                                <Trash2 size={12} />
                            </button>
                        </>
                    )}
                </div>
			</div>
			
            {/* Terminal View */}
            {activeTab === "terminal" && (
                <div className="flex-1 w-full pl-2 pb-2 relative">
                    <div ref={terminalRef} className="absolute inset-0 pt-2" />
                </div>
            )}

            {/* Live Preview View */}
            {activeTab === "preview" && (
                <div className="flex-1 w-full flex flex-col bg-white overflow-hidden text-black relative">
                    {/* Simulated Browser Address Bar */}
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
                    {/* Simulated IFrame Content */}
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

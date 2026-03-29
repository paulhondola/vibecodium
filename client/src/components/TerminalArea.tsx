import { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { Terminal as TerminalIcon, StopCircle, Plus, X, Globe, Lock, RefreshCw } from "lucide-react";
import { WS_BASE } from "@/lib/config";

interface TerminalTab {
    id: string;
    name: string;
    type: "terminal" | "preview";
}

export default function TerminalArea({ projectId }: { projectId: string | null }) {
    const [tabs, setTabs] = useState<TerminalTab[]>([
        { id: "term-1", name: "terminal", type: "terminal" }
    ]);
    const [activeTabId, setActiveTabId] = useState("term-1");
    const [isConnected, setIsConnected] = useState(false);
    const [previewUrl, setPreviewUrl] = useState("localhost:3000");

    const termInstances = useRef<Record<string, Terminal>>({});
    const fitAddons = useRef<Record<string, FitAddon>>({});
    const wsInstance = useRef<WebSocket | null>(null);

    useEffect(() => {
        try {
            const ws = new WebSocket(`${WS_BASE}/ws/terminal?roomId=${projectId || "default"}`);
            wsInstance.current = ws;

            ws.onopen = () => {
                setIsConnected(true);
                const activeTab = tabs.find(t => t.id === activeTabId);
                if (activeTab?.type === "terminal") {
                    const term = termInstances.current[activeTabId];
                    if (term) sendResize(ws, term);
                }
            };

            ws.onmessage = (event) => {
                const data = event.data;
                Object.values(termInstances.current).forEach(term => {
                    if (typeof data === "string") {
                        term.write(data);
                    } else if (data instanceof Blob) {
                        const reader = new FileReader();
                        reader.onload = () => {
                            if (typeof reader.result === "string") term.write(reader.result);
                            else if (reader.result instanceof ArrayBuffer) term.write(new Uint8Array(reader.result));
                        };
                        reader.readAsArrayBuffer(data);
                    }
                });
            };

            ws.onclose = () => {
                setIsConnected(false);
                Object.values(termInstances.current).forEach(term => {
                    term.writeln("\r\n\x1b[33m[Disconnected]\x1b[0m");
                });
            };

            return () => ws.close();
        } catch (e) {
            console.error("Terminal WS Error:", e);
        }
    }, [projectId]);

    const initTerminal = (id: string, container: HTMLDivElement | null) => {
        if (!container || termInstances.current[id]) return;

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
        term.open(container);
        
        termInstances.current[id] = term;
        fitAddons.current[id] = fitAddon;

        term.onData((data) => {
            if (wsInstance.current?.readyState === WebSocket.OPEN) {
                wsInstance.current.send(data);
            }
        });

        setTimeout(() => {
            try { fitAddon.fit(); } catch (_) {}
        }, 100);
    };
// Resize handling for window resize and tab switching
useEffect(() => {
    const handleResize = () => {
        const fitAddon = fitAddons.current[activeTabId];
        const term = termInstances.current[activeTabId];
        if (fitAddon && term) {
            // Use requestAnimationFrame to ensure the 'block' display is applied
            requestAnimationFrame(() => {
                try { 
                    fitAddon.fit(); 
                    if (wsInstance.current?.readyState === WebSocket.OPEN) {
                        sendResize(wsInstance.current, term);
                    }
                } catch (_) {}
            });
        }
    };
    window.addEventListener("resize", handleResize);
    // Small delay to ensure DOM is ready
    const timer = setTimeout(handleResize, 50);
    return () => {
        window.removeEventListener("resize", handleResize);
        clearTimeout(timer);
    };
}, [activeTabId, tabs]);


    const addTerminal = () => {
        const newId = `term-${Date.now()}`;
        const newTab: TerminalTab = { id: newId, name: `terminal ${tabs.filter(t => t.type === "terminal").length + 1}`, type: "terminal" };
        setTabs([...tabs, newTab]);
        setActiveTabId(newId);
    };

    const addPreview = () => {
        const newId = `prev-${Date.now()}`;
        const newTab: TerminalTab = { id: newId, name: `preview`, type: "preview" };
        setTabs([...tabs, newTab]);
        setActiveTabId(newId);
    };

    const removeTab = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (tabs.length === 1) return;
        
        if (termInstances.current[id]) {
            termInstances.current[id].dispose();
            delete termInstances.current[id];
            delete fitAddons.current[id];
        }

        const newTabs = tabs.filter(t => t.id !== id);
        setTabs(newTabs);
        if (activeTabId === id) {
            setActiveTabId(newTabs[newTabs.length - 1].id);
        }
    };

    const handleStop = () => {
        if (wsInstance.current?.readyState === WebSocket.OPEN) {
            wsInstance.current.send(JSON.stringify({ type: "stop" }));
        }
    };

	return (
		<div className="flex flex-col h-full bg-[#09090b] text-white">
			<div className="flex items-center justify-between px-2 bg-[#18181b] border-b border-[#27272a] shrink-0">
				<div className="flex items-center overflow-x-auto no-scrollbar">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTabId(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors text-xs font-medium uppercase tracking-wider whitespace-nowrap group ${activeTabId === tab.id ? "border-cyan-400 text-cyan-400 bg-cyan-400/5" : "border-transparent text-gray-500 hover:text-gray-300"}`}
                        >
                            {tab.type === "terminal" ? <TerminalIcon size={12} /> : <Globe size={12} />}
                            {tab.name}
                            {tabs.length > 1 && (
                                <X 
                                    size={12} 
                                    className="ml-1 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all" 
                                    onClick={(e) => removeTab(e, tab.id)}
                                />
                            )}
                        </button>
                    ))}
                    <div className="flex items-center gap-1 ml-2">
                        <button 
                            onClick={addTerminal}
                            className="p-1.5 text-gray-500 hover:text-cyan-400 transition-colors"
                            title="New Terminal"
                        >
                            <TerminalIcon size={14} />
                        </button>
                        <button 
                            onClick={addPreview}
                            className="p-1.5 text-gray-500 hover:text-cyan-400 transition-colors"
                            title="New Preview"
                        >
                            <Globe size={14} />
                        </button>
                    </div>
				</div>

                <div className="flex items-center gap-2 pr-2 shrink-0">
                    <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]" : "bg-gray-600"}`} />
                    {isConnected && (
                        <button
                            onClick={handleStop}
                            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors border border-transparent hover:border-red-500/20"
                        >
                            <StopCircle size={11} /> Stop
                        </button>
                    )}
                </div>
			</div>

            <div className="flex-1 w-full relative overflow-hidden">
                {tabs.map(tab => (
                    <div 
                        key={tab.id}
                        className={`absolute inset-0 ${activeTabId === tab.id ? "block" : "hidden"}`}
                    >
                        {tab.type === "terminal" ? (
                            <div className="w-full h-full pt-2 pl-2 pb-2">
                                <div 
                                    ref={el => initTerminal(tab.id, el)} 
                                    className="w-full h-full"
                                />
                            </div>
                        ) : (
                            <div className="flex-1 w-full h-full flex flex-col bg-white overflow-hidden text-black relative">
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
                                        <h2 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-500 mb-4">Preview Engine</h2>
                                        <p className="text-gray-500 text-sm">Status: <strong>ready</strong></p>
                                        <p className="text-gray-400 text-xs mt-2 font-mono">Service: {projectId}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
		</div>
	);
}

function sendResize(ws: WebSocket, term: Terminal) {
    if (ws.readyState !== WebSocket.OPEN) return;
    try {
        ws.send(JSON.stringify({ type: "resize", rows: term.rows, cols: term.cols }));
    } catch (_) {}
}

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, TerminalSquare, FileEdit, Search, Bot, User, Loader2, Sparkles, FilePlus, Trash2, FolderInput } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAgentStream, type PendingUpdate, type AgentFileAction } from "../hooks/useAgentStream";
import type { ProjectFile } from "./Workspace";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    tools?: ToolCall[];
    hasSuggestion?: boolean;
    fileActions?: AgentFileAction[];
}

interface ToolCall {
    id: string;
    name: "write_file" | "execute_command" | "read_file";
    args: any;
    status: "pending" | "done";
}

interface VibeChatProps {
    activeFile: ProjectFile | null;
    projectId: string | null;
    token: string | null;
    onPendingUpdate: (update: PendingUpdate) => void;
    onFileAction: (action: AgentFileAction) => void;
}

const WELCOME: Message = {
    id: "msg1",
    role: "assistant",
    content: "Hello! I'm your VibeCodium agent. Select a file and describe a change — I'll propose it inline in the editor for you to Accept or Reject.",
};

export default function VibeChat({ activeFile, projectId, token, onPendingUpdate, onFileAction }: VibeChatProps) {
    const [messages, setMessages] = useState<Message[]>([WELCOME]);
    const [input, setInput] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);
    const pendingNotifiedRef = useRef<string | null>(null);
    const executedActionsRef = useRef<Set<string>>(new Set());

    const { streamingText, isStreaming, pendingUpdate, fileActions, sendInstruction, clearPending, clearFileActions } = useAgentStream();

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, streamingText]);

    // When stream finishes, commit the streamed text as a final message
    useEffect(() => {
        if (isStreaming || !streamingText) return;

        // Only commit once per stream cycle
        setMessages(prev => {
            const withoutStream = prev.filter(m => m.id !== "__streaming__");
            return [...withoutStream, {
                id: `msg_${Date.now()}`,
                role: "assistant",
                content: streamingText,
                hasSuggestion: !!pendingUpdate,
                fileActions: fileActions.length > 0 ? [...fileActions] : undefined,
            }];
        });
    }, [isStreaming]);

    // Bubble up new pending updates once (avoid re-notifying on re-render)
    useEffect(() => {
        if (!pendingUpdate) return;
        if (pendingNotifiedRef.current === pendingUpdate.id) return;
        pendingNotifiedRef.current = pendingUpdate.id;
        onPendingUpdate(pendingUpdate);
    }, [pendingUpdate, onPendingUpdate]);

    // Execute file actions (create/delete/rename) once as they arrive
    useEffect(() => {
        for (const action of fileActions) {
            if (executedActionsRef.current.has(action.id)) continue;
            executedActionsRef.current.add(action.id);
            onFileAction(action);
        }
    }, [fileActions, onFileAction]);

    // While streaming, keep a live "streaming" message up to date
    useEffect(() => {
        if (!isStreaming) return;
        setMessages(prev => {
            const hasStream = prev.some(m => m.id === "__streaming__");
            if (hasStream) {
                return prev.map(m => m.id === "__streaming__" ? { ...m, content: streamingText } : m);
            }
            return [...prev, { id: "__streaming__", role: "assistant", content: streamingText }];
        });
    }, [streamingText, isStreaming]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isStreaming) return;

        // Easter Eggs
        const cmd = input.trim().toLowerCase();
        if (cmd === "/amarati") {
            document.body.style.filter = "grayscale(80%) sepia(30%) contrast(120%) blur(0.5px)";
            document.body.style.transition = "filter 2s";
            new Audio("https://www.myinstants.com/media/sounds/sad-violin.mp3").play().catch(() => {});
            setMessages(prev => [...prev, { id: Date.now().toString(), role: "user", content: input }, { id: Date.now().toString() + "_a", role: "assistant", content: "😭 Amarati mode activated. Life is pain. The codebase is broken. Expect random misery." }]);
            setInput("");
            return;
        }
        if (cmd === "/optimist") {
            document.body.style.filter = "none";
            setMessages(prev => [...prev, { id: Date.now().toString(), role: "user", content: input }, { id: Date.now().toString() + "_a", role: "assistant", content: "✨ Optimism restored. Everything is awesome! Back to building." }]);
            setInput("");
            return;
        }
        if (cmd === "/disco") {
            if (!document.getElementById("disco-style")) {
                const style = document.createElement("style");
                style.id = "disco-style";
                style.innerHTML = `
                    @keyframes discoBg {
                      0% { filter: hue-rotate(0deg); }
                      50% { filter: hue-rotate(180deg); }
                      100% { filter: hue-rotate(360deg); }
                    }
                    body { animation: discoBg 2s infinite linear !important; }
                `;
                document.head.appendChild(style);
                new Audio("https://www.myinstants.com/media/sounds/darude-sandstorm.mp3").play().catch(() => {});
            }
            setMessages(prev => [...prev, { id: Date.now().toString(), role: "user", content: input }, { id: Date.now().toString() + "_a", role: "assistant", content: "🪩 DISCO MODE ACTIVATED! 🪩" }]);
            setInput("");
            return;
        }
        if (cmd === "/nodisco") {
            const el = document.getElementById("disco-style");
            if (el) el.remove();
            setMessages(prev => [...prev, { id: Date.now().toString(), role: "user", content: input }, { id: Date.now().toString() + "_a", role: "assistant", content: "Music stopped. Back to work." }]);
            setInput("");
            return;
        }

        const userMsg: Message = { id: Date.now().toString(), role: "user", content: input };
        setMessages(prev => [...prev, userMsg]);
        const instruction = input;
        setInput("");
        clearPending();
        clearFileActions();
        executedActionsRef.current.clear();

        if (!activeFile || !token || !projectId) {
            setMessages(prev => [...prev, {
                id: `err_${Date.now()}`,
                role: "assistant",
                content: "⚠️ Please select a file in the editor first, then try again.",
            }]);
            return;
        }

        await sendInstruction({
            token,
            projectId,
            filePath: activeFile.path,
            fileContent: activeFile.content ?? "",
            instruction,
        });
    };

    const renderMessageContent = (content: string) => {
        // Strip all XML action blocks from display — handled visually elsewhere
        const cleaned = content
            .replace(/<suggested_change[\s\S]*?<\/suggested_change>/g, "")
            .replace(/<create_file[\s\S]*?<\/create_file>/g, "")
            .replace(/<delete_file\s[^>]*\/>/g, "")
            .replace(/<rename_file\s[^>]*\/>/g, "")
            .trim();
        return cleaned || content;
    };

    const fileActionLabel = useCallback((action: AgentFileAction) => {
        if (action.type === "create_file") return `Created ${action.filePath}`;
        if (action.type === "delete_file") return `Deleted ${action.filePath}`;
        if (action.type === "rename_file") return `Renamed ${action.filePath} → ${action.newPath}`;
        return action.filePath;
    }, []);

    return (
        <div className="flex flex-col h-full bg-[#09090b] text-[#c9d1d9] border-l border-[#27272a]">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-[#27272a] shrink-0 bg-[#09090b]">
                <div className="flex items-center gap-2">
                    <Sparkles size={13} className="text-purple-400" />
                    <h2 className="font-semibold text-xs tracking-wider uppercase text-gray-400">Agent Chat</h2>
                </div>
                {isStreaming && (
                    <span className="flex items-center gap-1.5 text-[10px] text-purple-400 font-medium px-2 py-0.5 bg-purple-500/10 rounded-full animate-pulse border border-purple-500/20">
                        <Loader2 size={10} className="animate-spin" /> THINKING
                    </span>
                )}
                {activeFile && !isStreaming && (
                    <span className="text-[10px] text-gray-600 font-mono truncate max-w-[100px]" title={activeFile.path}>
                        {activeFile.path.split("/").pop()}
                    </span>
                )}
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
                <AnimatePresence initial={false}>
                    {messages.map((msg) => (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            className={`flex flex-col gap-2 relative ${msg.role === "user" ? "items-end" : "items-start"}`}
                        >
                            <div className={`flex items-start gap-2 max-w-[90%] ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                                <div className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center border shadow-sm ${msg.role === "user" ? "bg-blue-600/20 text-blue-400 border-blue-500/30" : "bg-gradient-to-br from-purple-500/20 to-indigo-500/20 text-purple-400 border-purple-500/30"}`}>
                                    {msg.role === "user" ? <User size={14} /> : <Bot size={14} />}
                                </div>
                                <div className={`text-sm py-1.5 px-3 rounded-lg leading-relaxed shadow-sm whitespace-pre-wrap ${msg.role === "user" ? "bg-blue-500/10 text-blue-100 border border-blue-500/20" : "text-gray-300"}`}>
                                    {renderMessageContent(msg.content)}
                                    {msg.id === "__streaming__" && (
                                        <span className="inline-block w-1.5 h-3.5 bg-purple-400 ml-0.5 animate-pulse rounded-sm" />
                                    )}
                                    {msg.hasSuggestion && (
                                        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-purple-400 font-semibold bg-purple-500/10 border border-purple-500/20 rounded px-2 py-1">
                                            <Sparkles size={10} />
                                            Change proposed — see editor for Accept/Reject
                                        </div>
                                    )}
                                    {msg.fileActions && msg.fileActions.map(action => (
                                        <div key={action.id} className="mt-1.5 flex items-center gap-1.5 text-[10px] font-mono bg-[#09090b] border border-[#27272a] rounded px-2 py-1 text-gray-400">
                                            {action.type === "create_file" && <FilePlus size={10} className="text-green-400 shrink-0" />}
                                            {action.type === "delete_file" && <Trash2 size={10} className="text-red-400 shrink-0" />}
                                            {action.type === "rename_file" && <FolderInput size={10} className="text-yellow-400 shrink-0" />}
                                            <span className="truncate">{fileActionLabel(action)}</span>
                                            <span className="ml-auto text-green-500 shrink-0">✓</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Tool Calls */}
                            {msg.tools && msg.tools.length > 0 && (
                                <div className="flex flex-col gap-2 w-full mt-1 ml-8">
                                    {msg.tools.map(tool => (
                                        <div key={tool.id} className="flex items-center pr-3 py-1.5 pl-2 gap-2 text-xs font-mono bg-[#09090b] border border-[#27272a] rounded text-gray-400 max-w-[85%] relative overflow-hidden shadow-inner">
                                            {tool.status === "pending" && (
                                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent w-[200%] animate-[shimmer_1.5s_infinite]" />
                                            )}
                                            {tool.name === "write_file" && <FileEdit size={12} className="text-yellow-500" />}
                                            {tool.name === "execute_command" && <TerminalSquare size={12} className="text-green-500" />}
                                            {tool.name === "read_file" && <Search size={12} className="text-blue-500" />}
                                            <span className="text-gray-300 font-semibold">{tool.name}</span>
                                            <span className="truncate text-gray-500 max-w-[120px]">{JSON.stringify(tool.args)}</span>
                                            <div className="ml-auto flex items-center shrink-0">
                                                {tool.status === "pending" ? (
                                                    <Loader2 size={12} className="animate-spin text-purple-400" />
                                                ) : (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]"></span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Input */}
            <div className="p-3 bg-[#09090b] border-t border-[#27272a] shrink-0">
                <form onSubmit={handleSubmit} className="flex flex-col gap-2 relative">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit(e);
                            }
                        }}
                        placeholder={
                            !activeFile
                                ? "Select a file first..."
                                : isStreaming
                                ? "Agent is thinking..."
                                : "Describe a change to make..."
                        }
                        className="w-full bg-[#09090b] border border-[#27272a] rounded-lg p-3 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50 resize-none placeholder:text-gray-600 shadow-inner"
                        rows={3}
                        disabled={isStreaming}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isStreaming || !activeFile}
                        className="absolute bottom-3 right-3 p-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-md disabled:opacity-50 disabled:hover:bg-purple-600 transition-colors shadow-sm"
                    >
                        <Send size={14} />
                    </button>
                </form>
                <div className="text-center mt-2 text-[10px] text-gray-600">
                    Press <kbd className="px-1 py-0.5 bg-[#09090b] border border-[#27272a] rounded">Enter</kbd> to send, <kbd className="px-1 py-0.5 bg-[#09090b] border border-[#27272a] rounded">Shift+Enter</kbd> for newline
                </div>
            </div>
        </div>
    );
}

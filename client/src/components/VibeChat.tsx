import { useState, useRef, useEffect } from "react";
import { Send, TerminalSquare, FileEdit, Search, Bot, User, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
	id: string;
	role: "user" | "assistant";
	content: string;
	tools?: ToolCall[];
}

interface ToolCall {
	id: string;
	name: "write_file" | "execute_command" | "read_file";
	args: any;
	status: "pending" | "done";
}

const mockHistory: Message[] = [
	{
		id: "msg1",
		role: "assistant",
		content: "Hello! I am your VibeCodium agent. I can help edit files, run commands, and read from the codebase. Try asking me to add a new route or run the server.",
	},
];

export default function VibeChat() {
	const [messages, setMessages] = useState<Message[]>(mockHistory);
	const [input, setInput] = useState("");
	const [isGenerating, setIsGenerating] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);

	// Auto-scroll to bottom
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [messages]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!input.trim() || isGenerating) return;

		const userMsg: Message = { id: Date.now().toString(), role: "user", content: input };
		setMessages((prev) => [...prev, userMsg]);
		setInput("");
		setIsGenerating(true);

		// Mock the SSE stream response
		setTimeout(() => mockStreamResponse(), 600);
	};

	const mockStreamResponse = () => {
		const aid = "ast_" + Date.now();
		const responseTokens = "I will edit the server file to add a new health check route as you requested.".split(" ");
        
        // Add empty assistant message
		setMessages((prev) => [...prev, { id: aid, role: "assistant", content: "", tools: [] }]);

		let i = 0;
		const tokenInterval = setInterval(() => {
			if (i < responseTokens.length) {
				setMessages((prev) =>
					prev.map((m) =>
                        m.id === aid ? { ...m, content: m.content + (i > 0 ? " " : "") + responseTokens[i] } : m
                    )
				);
				i++;
			} else {
				clearInterval(tokenInterval);
                
                // Now simulate tool call
                setTimeout(() => mockToolCall(aid), 500);
			}
		}, 80);
	};

    const mockToolCall = (assistantId: string) => {
        const toolId = "tc_" + Date.now();
        setMessages((prev) => 
            prev.map(m => m.id === assistantId ? {
                ...m,
                tools: [...(m.tools || []), { id: toolId, name: "write_file", args: { path: "server/index.ts" }, status: "pending" }]
            } : m)
        );

        // Simulate tool complete
        setTimeout(() => {
            setMessages((prev) => 
                prev.map(m => m.id === assistantId ? {
                    ...m,
                    content: m.content + "\n\nI've proposed a change to `server/index.ts`. Please check the editor to Accept or Reject my edit.",
                    tools: m.tools?.map(t => t.id === toolId ? { ...t, status: "done" } : t)
                } : m)
            );
            setIsGenerating(false);
        }, 2000);
    }

	return (
		<div className="flex flex-col h-full bg-[#09090b] text-[#c9d1d9] border-l border-[#27272a]">
			{/* Header */}
			<div className="flex items-center justify-between p-3 border-b border-[#27272a] shrink-0 bg-[#09090b]">
				<h2 className="font-semibold text-xs tracking-wider uppercase text-gray-400">Agent Chat</h2>
                {isGenerating && (
                    <span className="flex items-center gap-1.5 text-[10px] text-purple-400 font-medium px-2 py-0.5 bg-purple-500/10 rounded-full animate-pulse border border-purple-500/20">
                        <Loader2 size={10} className="animate-spin" /> THINKING
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
								<div className={`text-sm py-1.5 px-3 rounded-lg leading-relaxed shadow-sm  ${msg.role === "user" ? "bg-blue-500/10 text-blue-100 border border-blue-500/20" : "text-gray-300"}`}>
									{msg.content}
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
						placeholder={isGenerating ? "Agent is typing..." : "Ask VibeCodium..."}
						className="w-full bg-[#09090b] border border-[#27272a] rounded-lg p-3 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50 resize-none placeholder:text-gray-600 shadow-inner"
						rows={3}
                        disabled={isGenerating}
					/>
					<button
						type="submit"
						disabled={!input.trim() || isGenerating}
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

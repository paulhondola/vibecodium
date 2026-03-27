import { Check, Eye, X, UserPlus } from "lucide-react";
import { useCollabSocket } from "../contexts/WebSocketProvider";

export default function JoinRequestModal() {
    const { joinRequests, respondToJoin, isHost } = useCollabSocket();

    if (!isHost || joinRequests.length === 0) return null;

    return (
        <div className="fixed top-16 right-4 z-[100] flex flex-col gap-2 pointer-events-auto">
            {joinRequests.map(req => (
                <div
                    key={req.id}
                    className="bg-[#18181b]/95 backdrop-blur-md border border-purple-500/30 shadow-2xl rounded-xl p-4 w-80"
                    style={{ animation: "slideInRight 0.3s ease-out" }}
                >
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                            <UserPlus size={14} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-white">Join Request</h3>
                            <p className="text-xs text-gray-400">
                                <span className="text-purple-400 font-medium">{req.name}</span> wants access
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5 mt-3">
                        <button
                            onClick={() => respondToJoin(req.id, 'edit')}
                            className="w-full text-xs font-semibold py-2 bg-green-500/15 hover:bg-green-500/25 text-green-400 rounded-lg border border-green-500/20 flex items-center justify-center gap-1.5 transition-all"
                        >
                            <Check size={14} /> Accept (Read & Edit)
                        </button>
                        <button
                            onClick={() => respondToJoin(req.id, 'readonly')}
                            className="w-full text-xs font-semibold py-2 bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 rounded-lg border border-blue-500/20 flex items-center justify-center gap-1.5 transition-all"
                        >
                            <Eye size={14} /> Accept (Read Only)
                        </button>
                        <button
                            onClick={() => respondToJoin(req.id, 'reject')}
                            className="w-full text-xs font-semibold py-2 bg-red-500/15 hover:bg-red-500/25 text-red-400 rounded-lg border border-red-500/20 flex items-center justify-center gap-1.5 transition-all"
                        >
                            <X size={14} /> Reject
                        </button>
                    </div>
                </div>
            ))}

            <style>{`
                @keyframes slideInRight {
                    from { opacity: 0; transform: translateX(20px); }
                    to { opacity: 1; transform: translateX(0); }
                }
            `}</style>
        </div>
    );
}

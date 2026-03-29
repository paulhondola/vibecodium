import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { motion } from "framer-motion";
import { Loader2, Github, ExternalLink, Users, Clock, AlertCircle } from "lucide-react";
import { API_BASE } from "@/lib/config";

export const Route = createFileRoute("/community")({
    component: CommunityPage,
});

interface HelpPost {
    _id: string;
    title: string;
    description: string;
    repoUrl: string;
    userName: string;
    createdAt: string;
}

function CommunityPage() {
    const navigate = useNavigate();
    const { getAccessTokenSilently, isAuthenticated, isLoading: authLoading, loginWithRedirect } = useAuth0();
    const [posts, setPosts] = useState<HelpPost[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [openingPostId, setOpeningPostId] = useState<string | null>(null);
    const [importError, setImportError] = useState<{ id: string; msg: string } | null>(null);

    useEffect(() => {
        fetch(`${API_BASE}/api/help`)
            .then(r => r.json())
            .then(data => {
                if (data.success) setPosts(data.posts);
                else setError(data.error || "Failed to load posts.");
            })
            .catch(e => setError(e.message))
            .finally(() => setIsLoading(false));
    }, []);

    const handleOpenProject = async (post: HelpPost) => {
        if (!isAuthenticated) {
            loginWithRedirect({ appState: { returnTo: "/community" }, authorizationParams: { connection: "github" } });
            return;
        }

        setOpeningPostId(post._id);
        setImportError(null);
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch(`${API_BASE}/api/projects/import`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ repoUrl: post.repoUrl }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Import failed");
            navigate({ to: "/", search: { w: data.projectId } });
        } catch (e: any) {
            setImportError({ id: post._id, msg: e.message });
        } finally {
            setOpeningPostId(null);
        }
    };

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    };

    return (
        <div className="min-h-screen bg-[#09090b] text-white font-sans">
            {/* Header */}
            <div className="border-b border-[#27272a] bg-[#18181b]">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <button
                        onClick={() => navigate({ to: "/" })}
                        className="flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition-colors text-sm"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                        Back to iTECify
                    </button>
                    <div className="flex items-center gap-2">
                        <Users size={16} className="text-[#A855F7]" />
                        <span className="text-sm font-semibold text-gray-200">Community Help</span>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-12">
                {/* Hero */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#A855F7]/10 border border-[#A855F7]/20 text-[#A855F7] text-xs font-bold uppercase tracking-widest mb-4">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#A855F7] animate-pulse" />
                        Live Feed
                    </div>
                    <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-[#A855F7] to-blue-500 mb-3">
                        Community Help Board
                    </h1>
                    <p className="text-gray-400 text-sm max-w-xl mx-auto">
                        Browse help requests from the community. Open any project directly in iTECify's sandbox to debug together.
                    </p>
                </div>

                {/* Content */}
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4 text-cyan-400">
                        <Loader2 size={32} className="animate-spin" />
                        <span className="text-sm tracking-widest uppercase">Loading community posts...</span>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4 text-red-400">
                        <AlertCircle size={32} />
                        <span className="text-sm">{error}</span>
                    </div>
                ) : posts.length === 0 ? (
                    <div className="text-center py-24 text-gray-500">
                        <svg className="mx-auto mb-4 opacity-30" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                        <p className="text-sm">No help requests yet. Be the first to post!</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {posts.map((post, i) => (
                            <motion.div
                                key={post._id}
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="bg-[#18181b] border border-[#27272a] rounded-2xl p-6 hover:border-[#A855F7]/30 transition-all group relative overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#A855F7]/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        {/* Meta */}
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#A855F7] to-cyan-500 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                                                {post.userName.substring(0, 2).toUpperCase()}
                                            </div>
                                            <span className="text-xs font-semibold text-gray-300">{post.userName}</span>
                                            <span className="text-gray-600">·</span>
                                            <span className="flex items-center gap-1 text-[11px] text-gray-500">
                                                <Clock size={11} />
                                                {formatDate(post.createdAt)}
                                            </span>
                                        </div>

                                        {/* Title */}
                                        <h3 className="font-bold text-white text-base mb-2 leading-snug">{post.title}</h3>

                                        {/* Description */}
                                        <p className="text-sm text-gray-400 leading-relaxed line-clamp-3">{post.description}</p>

                                        {/* Repo link */}
                                        <a
                                            href={post.repoUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 mt-3 text-[11px] text-cyan-500 hover:text-cyan-300 transition-colors font-mono"
                                            onClick={e => e.stopPropagation()}
                                        >
                                            <Github size={12} />
                                            {post.repoUrl.replace("https://github.com/", "")}
                                            <ExternalLink size={10} />
                                        </a>

                                        {importError?.id === post._id && (
                                            <p className="mt-2 text-xs text-red-400 flex items-center gap-1">
                                                <AlertCircle size={12} /> {importError.msg}
                                            </p>
                                        )}
                                    </div>

                                    {/* Open Project CTA */}
                                    <button
                                        onClick={() => handleOpenProject(post)}
                                        disabled={openingPostId === post._id || authLoading}
                                        className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#A855F7]/10 hover:bg-[#A855F7]/20 border border-[#A855F7]/20 hover:border-[#A855F7]/40 text-[#A855F7] text-xs font-bold transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {openingPostId === post._id ? (
                                            <Loader2 size={14} className="animate-spin" />
                                        ) : (
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                        )}
                                        {openingPostId === post._id ? "Cloning..." : "Open Project"}
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default CommunityPage;

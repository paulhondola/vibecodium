import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth0 } from "@auth0/auth0-react";
import { ArrowLeft, LogOut, Activity, FolderGit2, Zap, Github, Key, Save, Loader2, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { API_BASE } from "@/lib/config";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, isAuthenticated, isLoading, logout, getAccessTokenSilently } = useAuth0();
  const navigate = useNavigate();

  const [githubRepoCount, setGithubRepoCount] = useState<number | null>(null);
  const [githubCommitCount, setGithubCommitCount] = useState<number | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Token Management State
  const [githubToken, setGithubToken] = useState("");
  const [vercelToken, setVercelToken] = useState("");
  const [isSavingTokens, setIsSavingTokens] = useState(false);
  const [isFetchingTokens, setIsFetchingTokens] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (user?.nickname) {
      setIsLoadingStats(true);
      
      getAccessTokenSilently().then(token => {
        const headers = { Authorization: `Bearer ${token}` };
        return Promise.all([
          fetch(`${API_BASE}/api/github/users/${user.nickname}`, { headers }).then(res => res.json()),
          fetch(`${API_BASE}/api/github/search/commits?q=author:${user.nickname}`, { headers }).then(res => res.json())
        ]);
      })
      .then(([userData, commitData]) => {
        if (userData.public_repos !== undefined) setGithubRepoCount(userData.public_repos);
        if (commitData.total_count !== undefined) setGithubCommitCount(commitData.total_count);
      })
      .catch(err => console.error("Failed to fetch GitHub stats", err))
      .finally(() => setIsLoadingStats(false));
    }
  }, [user?.nickname]);

  // Fetch tokens on mount
  useEffect(() => {
    if (isAuthenticated) {
      setIsFetchingTokens(true);
      getAccessTokenSilently().then(token => {
        return fetch(`${API_BASE}/api/users/tokens`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          if (data.githubToken) setGithubToken(data.githubToken);
          if (data.vercelToken) setVercelToken(data.vercelToken);
        }
      })
      .catch(err => console.error("Failed to fetch tokens", err))
      .finally(() => setIsFetchingTokens(false));
    }
  }, [isAuthenticated, getAccessTokenSilently]);

  const handleSaveTokens = async () => {
    setIsSavingTokens(true);
    setSaveMessage(null);
    try {
      const token = await getAccessTokenSilently();
      const res = await fetch(`${API_BASE}/api/users/tokens`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          githubToken: githubToken.includes('****') ? undefined : githubToken, 
          vercelToken: vercelToken.includes('****') ? undefined : vercelToken 
        })
      });
      const data = await res.json();
      if (data.success) {
        setSaveMessage({ text: "Integrations updated successfully!", type: 'success' });
        // Refetch to get the masked versions
        const updatedTokens = await fetch(`${API_BASE}/api/users/tokens`, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(r => r.json());
        if (updatedTokens.githubToken) setGithubToken(updatedTokens.githubToken);
        if (updatedTokens.vercelToken) setVercelToken(updatedTokens.vercelToken);
      } else {
        setSaveMessage({ text: data.error || "Failed to update tokens", type: 'error' });
      }
    } catch (e) {
      setSaveMessage({ text: "Connection error", type: 'error' });
    }
    setIsSavingTokens(false);
    setTimeout(() => setSaveMessage(null), 3000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#02040a] flex items-center justify-center text-[#A855F7] font-['Space_Grotesk'] tracking-[0.2em] uppercase text-sm animate-pulse">
        Loading Neural Identity...
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-[#02040a] flex items-center justify-center text-white font-['Space_Grotesk']">
        <div className="text-center space-y-4">
          <div className="text-red-500 font-bold mb-4 tracking-widest text-lg">ACCESS DENIED</div>
          <button onClick={() => navigate({ to: "/", search: { w: undefined } })} className="px-6 py-2 border border-white/20 rounded-lg hover:bg-white/10 transition-colors uppercase tracking-widest text-xs">
            Return to Core
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#02040a] text-[#f8fafc] font-sans selection:bg-[rgba(168,85,247,0.3)] overflow-x-hidden relative flex justify-center items-center py-20 px-4 pt-24">
      {/* Neural Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f10_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f10_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
      <div className="absolute top-[10%] right-[10%] w-[30vw] h-[30vw] bg-[rgba(168,85,247,0.15)] blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[10%] left-[10%] w-[30vw] h-[30vw] bg-[rgba(59,130,246,0.15)] blur-[120px] rounded-full pointer-events-none" />

      {/* Navigation */}
      <nav className="fixed top-0 z-[100] flex items-center w-full px-6 h-14 bg-[#02040a]/80 backdrop-blur-md border-b border-[rgba(168,85,247,0.1)]">
        <button
          onClick={() => navigate({ to: "/", search: { w: undefined } })}
          className="flex items-center gap-2 text-slate-400 hover:text-[#A855F7] transition-colors font-['Space_Grotesk'] text-sm tracking-widest uppercase"
        >
          <ArrowLeft size={16} /> Return Home
        </button>
      </nav>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl grid md:grid-cols-3 gap-8 relative z-10"
      >
        {/* Left Column: Profile Card */}
        <div className="md:col-span-1 flex flex-col gap-6">
          <div className="bg-[rgba(10,12,20,0.6)] backdrop-blur-xl border border-[rgba(168,85,247,0.2)] rounded-2xl p-6 shadow-[0_0_30px_rgba(0,0,0,0.5)] relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 via-[#A855F7] to-blue-600" />
            
            <div className="relative mb-6 mt-4 flex justify-center">
              <div className="absolute inset-0 bg-[rgba(168,85,247,0.2)] blur-xl rounded-full animate-pulse z-0 scale-75" />
              <img 
                src={user.picture || `https://ui-avatars.com/api/?name=${user.name}&background=0D8ABC&color=fff`} 
                alt="Profile" 
                className="w-32 h-32 rounded-full border-4 border-[#A855F7]/30 shadow-[0_0_20px_rgba(168,85,247,0.4)] relative z-10 object-cover"
              />
              <div className="absolute bottom-0 right-10 bg-[#10B981] w-4 h-4 rounded-full border-2 border-[#02040a] z-20 shadow-[0_0_10px_#10B981]"></div>
            </div>

            <div className="text-center space-y-1 mb-8">
              <h2 className="text-2xl font-['Space_Grotesk'] font-bold tracking-tight text-white group-hover:text-glow transition-all">
                {user.name}
              </h2>
              <p className="text-slate-400 text-sm">{user.email}</p>
              <div className="inline-flex mt-3 items-center gap-1.5 px-3 py-1 bg-[rgba(168,85,247,0.1)] border border-[rgba(168,85,247,0.3)] text-[#A855F7] rounded-full text-[10px] font-black uppercase tracking-[0.2em]">
                <Zap size={10} className="fill-1" /> Verified Architect
              </div>
            </div>

            <div className="space-y-3 pt-6 border-t border-white/5">
              <button
                className="w-full py-3 bg-[rgba(26,31,46,0.4)] hover:bg-[rgba(168,85,247,0.1)] border border-transparent hover:border-[rgba(168,85,247,0.3)] text-white rounded-xl transition-all font-['Space_Grotesk'] tracking-widest uppercase text-xs font-bold"
              >
                Edit Profile
              </button>
              <button
                onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
                className="w-full py-3 flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-transparent hover:border-red-500/30 rounded-xl transition-all font-['Space_Grotesk'] tracking-widest uppercase text-xs font-bold"
              >
                <LogOut size={14} /> Disconnect
              </button>
            </div>
          </div>


        </div>

        {/* Right Column: Stats & Activity */}
        <div className="md:col-span-2 flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[rgba(10,12,20,0.6)] backdrop-blur-xl border border-white/5 rounded-2xl p-5 hover:border-[rgba(59,130,246,0.3)] transition-colors group">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-[rgba(59,130,246,0.1)] text-[#3B82F6] group-hover:scale-110 transition-transform">
                  <FolderGit2 size={18} />
                </div>
                <span className="text-slate-400 text-xs font-['Space_Grotesk'] uppercase tracking-widest">Repositories</span>
              </div>
              <div className="text-3xl font-bold text-white pl-12 font-['Space_Grotesk']">
                {githubRepoCount !== null ? githubRepoCount.toLocaleString() : (isLoadingStats ? (
                  <span className="animate-pulse text-[#3B82F6]">...</span>
                ) : '0')}
              </div>
            </div>
            
            <div className="bg-[rgba(10,12,20,0.6)] backdrop-blur-xl border border-white/5 rounded-2xl p-5 hover:border-[#10B981]/30 transition-colors group">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-[#10B981]/10 text-[#10B981] group-hover:scale-110 transition-transform">
                  <Activity size={18} />
                </div>
                <span className="text-slate-400 text-xs font-['Space_Grotesk'] uppercase tracking-widest">Commits</span>
              </div>
              <div className="text-3xl font-bold text-white pl-12 font-['Space_Grotesk']">
                {githubCommitCount !== null ? githubCommitCount.toLocaleString() : (isLoadingStats ? (
                  <span className="animate-pulse text-[#10B981]">...</span>
                ) : '0')}
              </div>
            </div>
          </div>

          <div className="bg-[rgba(10,12,20,0.6)] backdrop-blur-xl border border-white/5 rounded-2xl p-6 flex-1 shadow-lg">
            <h3 className="text-md font-['Space_Grotesk'] font-bold text-white tracking-tight flex items-center gap-2 mb-6">
              <Key size={18} className="text-cyan-400" />
              Integrations
            </h3>
            
            <div className="space-y-5">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <Github size={12} /> GitHub Token (Repo)
                  </label>
                  <input 
                    type="password"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxx"
                    className="w-full bg-[#02040a] border border-white/10 rounded-lg px-3 py-2 text-xs text-cyan-50 focus:border-[#A855F7]/50 focus:ring-1 focus:ring-[#A855F7]/50 outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <ShieldCheck size={12} /> Vercel Token
                  </label>
                  <input 
                    type="password"
                    value={vercelToken}
                    onChange={(e) => setVercelToken(e.target.value)}
                    placeholder="vercel_xxxxxxxxxxxx"
                    className="w-full bg-[#02040a] border border-white/10 rounded-lg px-3 py-2 text-xs text-cyan-50 focus:border-[#3B82F6]/50 focus:ring-1 focus:ring-[#3B82F6]/50 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="flex flex-col items-center gap-3 pt-2">
                <button
                  onClick={handleSaveTokens}
                  disabled={isSavingTokens || isFetchingTokens}
                  className="w-full md:w-auto px-10 py-2.5 bg-[#A855F7]/10 hover:bg-[#A855F7]/20 border border-[#A855F7]/30 text-[#A855F7] rounded-lg transition-all font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  {isSavingTokens ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {isSavingTokens ? "Syncing..." : "Secure Tokens"}
                </button>

                {saveMessage && (
                  <motion.p 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`text-center text-[10px] font-bold ${saveMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}
                  >
                    {saveMessage.text}
                  </motion.p>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

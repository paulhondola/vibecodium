import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth0 } from "@auth0/auth0-react";
import { ArrowLeft, CloudRain, FolderGit2, Loader2, Star, GitFork, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

interface GithubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  updated_at: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
}

interface DBProject {
  _id: string;
  userId: string;
  name: string;
  repoUrl: string;
  createdAt: string;
}

function DashboardPage() {
  const { user, isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();
  const navigate = useNavigate();

  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [isFetchingRepos, setIsFetchingRepos] = useState(false);
  const [savedProjects, setSavedProjects] = useState<DBProject[]>([]);
  const [isFetchingExternal, setIsFetchingExternal] = useState(false);
  const [importingRepoId, setImportingRepoId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.nickname) {
      setIsFetchingRepos(true);
      getAccessTokenSilently()
        .then(token =>
          fetch(`http://localhost:3000/api/github/users/${user.nickname}/repos?sort=updated&per_page=50`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        )
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setRepos(data);
          } else {
            console.error("Failed to fetch repos", data);
            setError("Could not fetch repositories.");
          }
        })
        .catch(err => {
          console.error(err);
          setError("Network error bridging to GitHub.");
        })
        .finally(() => setIsFetchingRepos(false));

      // Fetch saved projects from MongoDB
      setIsFetchingExternal(true);
      getAccessTokenSilently()
        .then(token => fetch("http://localhost:3000/api/projects", {
            headers: { Authorization: `Bearer ${token}` }
        }))
        .then(res => res.json())
        .then(data => {
            if (data.success && Array.isArray(data.projects)) {
                setSavedProjects(data.projects);
            }
        })
        .catch(console.error)
        .finally(() => setIsFetchingExternal(false));
    }
  }, [user?.nickname]);

  const renderRepoCard = (repo: GithubRepo) => {
      const date = new Date(repo.updated_at);
      const isImporting = importingRepoId === repo.id;

      return (
        <div 
          key={repo.id}
          className="bg-[rgba(10,12,20,0.6)] backdrop-blur-xl border border-white/5 rounded-2xl p-6 flex flex-col group hover:border-[rgba(16,185,129,0.4)] hover:shadow-[0_0_30px_rgba(16,185,129,0.1)] transition-all duration-300 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500">
            <FolderGit2 size={80} className="text-[#10B981]" />
          </div>
          
          <div className="relative z-10 flex-1 flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-bold font-['Space_Grotesk'] text-white group-hover:text-[#10B981] transition-colors truncate pr-4">
                {repo.full_name || repo.name}
              </h3>
              {repo.language && (
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-white/5 text-slate-300 border border-white/10 shrink-0">
                  {repo.language}
                </span>
              )}
            </div>
            
            <p className="text-sm text-slate-400 mb-6 flex-1 line-clamp-2">
              {repo.description || "No description provided format for this data cluster."}
            </p>

            <div className="flex items-center gap-4 text-slate-500 text-xs font-mono mb-6">
              <div className="flex items-center gap-1.5"><Star size={14} /> {repo.stargazers_count}</div>
              <div className="flex items-center gap-1.5"><GitFork size={14} /> {repo.forks_count}</div>
              <div className="flex items-center gap-1.5"><Clock size={14} /> {date.toLocaleDateString()}</div>
            </div>

            <button
              onClick={() => handleImport(repo)}
              disabled={isImporting || importingRepoId !== null}
              className={`w-full py-3 rounded-xl font-['Space_Grotesk'] font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                isImporting 
                ? "bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30 cursor-wait" 
                : importingRepoId !== null
                  ? "bg-white/5 text-slate-600 border border-transparent cursor-not-allowed"
                  : "bg-white/5 hover:bg-[#10B981] hover:text-[#02040a] text-white border border-white/10"
              }`}
            >
              {isImporting ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Extrapolating...
                </>
              ) : (
                <>Instantiate</>
              )}
            </button>
          </div>
        </div>
      );
  };

  const renderSavedProjectCard = (project: DBProject) => {
    const date = new Date(project.createdAt);

    return (
        <div 
          key={project._id}
          onClick={() => navigate({ to: "/", search: { w: project._id } })}
          className="bg-[rgba(10,12,20,0.6)] backdrop-blur-xl border border-[rgba(59,130,246,0.2)] rounded-2xl p-6 flex flex-col group hover:border-[rgba(59,130,246,0.6)] hover:shadow-[0_0_30px_rgba(59,130,246,0.15)] transition-all duration-300 relative overflow-hidden cursor-pointer"
        >
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500">
            <FolderGit2 size={80} className="text-[#3B82F6]" />
          </div>
          
          <div className="relative z-10 flex-1 flex flex-col">
            <h3 className="text-lg font-bold font-['Space_Grotesk'] text-white group-hover:text-[#3B82F6] transition-colors truncate pr-4 mb-2">
              {project.name}
            </h3>
            
            <p className="text-sm text-slate-400 mb-6 flex-1 line-clamp-2 font-mono text-[10px]">
              {project.repoUrl}
            </p>

            <div className="flex items-center gap-4 text-slate-500 text-xs font-mono mb-4">
              <div className="flex items-center gap-1.5"><Clock size={14} /> Imported on {date.toLocaleDateString()}</div>
            </div>

            <div className="w-full mt-auto py-2 rounded-xl font-['Space_Grotesk'] font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all bg-[rgba(59,130,246,0.1)] text-[#3B82F6] border border-[rgba(59,130,246,0.3)]">
              Open Workspace
            </div>
          </div>
        </div>
    );
  };

  const handleImport = async (repo: GithubRepo) => {
    setImportingRepoId(repo.id);
    setError(null);

    try {
      const token = await getAccessTokenSilently();
      const res = await fetch("http://localhost:3000/api/projects/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ repoUrl: repo.html_url }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to initialize workspace");
      }

      // Navigate to the workspace with the newly imported project
      navigate({ to: "/", search: { w: data.projectId } });
    } catch (err: any) {
      setError(err.message);
      setImportingRepoId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#02040a] flex items-center justify-center text-[#10B981] font-['Space_Grotesk'] tracking-[0.2em] uppercase text-sm animate-pulse">
        Establishing Neural Link...
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-[#02040a] flex items-center justify-center text-white font-['Space_Grotesk']">
        <div className="text-center space-y-4">
          <div className="text-red-500 font-bold mb-4 tracking-widest text-lg">UNAUTHORIZED COMPUTE</div>
          <button onClick={() => navigate({ to: "/", search: { w: undefined } })} className="px-6 py-2 border border-white/20 rounded-lg hover:bg-white/10 transition-colors uppercase tracking-widest text-xs">
            Return to Core
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#02040a] text-[#f8fafc] font-sans selection:bg-[rgba(16,185,129,0.3)] overflow-x-hidden relative flex justify-center py-20 px-4 pt-24">
      {/* Background Matrices */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f10_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f10_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
      <div className="absolute top-[10%] left-[10%] w-[40vw] h-[40vw] bg-[rgba(16,185,129,0.08)] blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[10%] right-[10%] w-[30vw] h-[30vw] bg-[rgba(59,130,246,0.08)] blur-[150px] rounded-full pointer-events-none" />

      {/* Navigation Topbar */}
      <nav className="fixed top-0 z-[100] flex items-center w-full px-6 h-14 bg-[#02040a]/80 backdrop-blur-md border-b border-[rgba(16,185,129,0.1)]">
        <button
          onClick={() => navigate({ to: "/", search: { w: undefined } })}
          className="flex items-center gap-2 text-slate-400 hover:text-[#10B981] transition-colors font-['Space_Grotesk'] text-sm tracking-widest uppercase"
        >
          <ArrowLeft size={16} /> Central Hub
        </button>
      </nav>

      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-6xl relative z-10 flex flex-col"
      >
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 pb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.2)] rounded-full mb-6">
              <CloudRain size={12} className="text-[#10B981]" />
              <span className="text-[10px] font-black text-[#10B981] uppercase tracking-[0.3em]">Command Center</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-['Space_Grotesk'] font-bold tracking-tighter text-white">
              Your Repositories
            </h1>
            <p className="text-slate-400 mt-4 max-w-xl text-sm leading-relaxed">
              Select a repository below to instantiate a high-density collaborative environment. The system will recursively clone, analyze, and build a localized edge instance for immediate coding.
            </p>
          </div>
          <div className="text-right">
             <div className="font-mono text-xs text-slate-500 mb-1">Authenticated as</div>
             <div className="font-bold text-lg text-white font-['Space_Grotesk']">{user.nickname}</div>
          </div>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 text-sm font-semibold">
            <span className="material-symbols-outlined">error</span>
            {error}
          </div>
        )}

        {/* Recently Opened Projects — shown first */}
        {(isFetchingExternal || savedProjects.length > 0) && (
            <div className="mb-16">
              <div className="flex items-center gap-3 mb-6">
                 <div className="inline-flex items-center gap-2 px-3 py-1 bg-[rgba(59,130,246,0.1)] border border-[rgba(59,130,246,0.2)] rounded-full">
                    <CloudRain size={12} className="text-[#3B82F6]" />
                    <span className="text-[10px] font-black text-[#3B82F6] uppercase tracking-[0.3em]">Recent</span>
                 </div>
                 <h2 className="text-2xl font-['Space_Grotesk'] font-bold tracking-tighter text-white">
                   Recently Opened
                 </h2>
              </div>

              {isFetchingExternal ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 size={32} className="animate-spin text-[#3B82F6] mb-4" />
                  <div className="text-slate-400 font-['Space_Grotesk'] tracking-widest uppercase text-xs">Syncing projects...</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {savedProjects.map(project => renderSavedProjectCard(project))}
                </div>
              )}
            </div>
        )}

        {/* GitHub Repositories — import section */}
        <div className="border-t border-white/10 pt-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.2)] rounded-full">
              <CloudRain size={12} className="text-[#10B981]" />
              <span className="text-[10px] font-black text-[#10B981] uppercase tracking-[0.3em]">Import</span>
            </div>
            <h2 className="text-2xl font-['Space_Grotesk'] font-bold tracking-tighter text-white">
              GitHub Repositories
            </h2>
          </div>

          {isFetchingRepos ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 size={40} className="animate-spin text-[#10B981] mb-6" />
              <div className="text-slate-400 font-['Space_Grotesk'] tracking-widest uppercase text-xs">Scanning remote clusters...</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {repos.map(repo => renderRepoCard(repo))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default DashboardPage;

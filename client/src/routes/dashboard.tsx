import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "../contexts/AuthProvider";
import { Loader2, ExternalLink } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import CoderMatchModal from "../components/CoderMatchModal";
import GamePIP, { type GameType } from "../components/GamePIP";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import DashboardSidebar from "../components/dashboard/DashboardSidebar";
import CreateRepoModal from "../components/dashboard/CreateRepoModal";
import DashboardFooter from "../components/dashboard/DashboardFooter";
import { API_BASE } from "@/lib/config";

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
  visibility?: string;
}

interface DBProject {
  _id: string;
  userId: string;
  name: string;
  repoUrl: string;
  createdAt: string;
}

interface DeployedApp {
  _id: string;
  title: string;
  project_repo: string;
  project_link: string;
  createdAt: string;
}

function DashboardPage() {
  const { user, isAuthenticated, isLoading, getAccessTokenSilently } = useAuth();
  const navigate = useNavigate();

  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [isFetchingRepos, setIsFetchingRepos] = useState(false);
  const [savedProjects, setSavedProjects] = useState<DBProject[]>([]);
  const [isFetchingExternal, setIsFetchingExternal] = useState(false);
  const [importingRepoId, setImportingRepoId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCoderMatch, setShowCoderMatch] = useState(false);
  const [activeGame, setActiveGame] = useState<GameType | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "recent">("all");
  const [deployedApps, setDeployedApps] = useState<DeployedApp[]>([]);
  const [isLoadingApps, setIsLoadingApps] = useState(false);

  const reposRef = useRef<HTMLDivElement>(null);
  const recentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user?.nickname) {
      setIsFetchingRepos(true);
      getAccessTokenSilently()
        .then(token =>
          fetch(`${API_BASE}/api/github/users/${user.nickname}/repos?sort=updated&per_page=50`, {
            headers: { Authorization: `Bearer ${token}` },
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

      setIsFetchingExternal(true);
      getAccessTokenSilently()
        .then(token => fetch(`${API_BASE}/api/projects`, {
          headers: { Authorization: `Bearer ${token}` },
        }))
        .then(res => res.json())
        .then(data => {
          if (data.success && Array.isArray(data.projects)) {
            setSavedProjects(data.projects);
          }
        })
        .catch(console.error)
        .finally(() => setIsFetchingExternal(false));

      setIsLoadingApps(true);
      getAccessTokenSilently()
        .then(token => fetch(`${API_BASE}/api/deploy`, { headers: { Authorization: `Bearer ${token}` } }))
        .then(r => r.json())
        .then(data => { if (data.success) setDeployedApps(data.apps); })
        .catch(console.error)
        .finally(() => setIsLoadingApps(false));
    }
  }, [user?.nickname, getAccessTokenSilently]);

  const handleImport = async (repo: GithubRepo) => {
    setImportingRepoId(repo.id);
    setError(null);

    try {
      const token = await getAccessTokenSilently();
      const res = await fetch(`${API_BASE}/api/projects/import`, {
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

      navigate({ to: "/", search: { w: data.projectId } });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Import failed");
      setImportingRepoId(null);
    }
  };

  const handleCreateRepo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsCreating(true);
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const repoName = formData.get("name") as string;
    const description = formData.get("description") as string;
    const isPrivate = formData.get("private") === "on";

    try {
      const token = await getAccessTokenSilently();

      const response = await fetch(`${API_BASE}/api/projects/create-repo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: repoName,
          description: description || undefined,
          isPrivate: isPrivate,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create repository");
      }

      const newRepo: GithubRepo = {
        id: data.repository.id,
        name: data.repository.name,
        full_name: data.repository.full_name,
        html_url: data.repository.html_url,
        description: data.repository.description,
        updated_at: data.repository.created_at,
        stargazers_count: 0,
        forks_count: 0,
        language: null,
        visibility: data.repository.private ? "private" : "public",
      };

      setRepos(prev => [newRepo, ...prev]);
      setShowCreateModal(false);
      form.reset();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create repository");
    } finally {
      setIsCreating(false);
    }
  };

  const scrollToSection = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const getTimeDiff = (dateString: string): string => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffMonths = Math.floor(diffDays / 30);

    if (diffMonths > 0) return `${diffMonths}M AGO`;
    if (diffDays > 0) return `${diffDays}D AGO`;
    if (diffHours > 0) return `${diffHours}H AGO`;
    return `${diffMins}M AGO`;
  };

  const getLanguageColor = (language: string | null): string => {
    const colors: Record<string, string> = {
      JavaScript: "#f1e05a",
      TypeScript: "#3178c6",
      Python: "#3572A5",
      Rust: "#dea584",
      Go: "#00ADD8",
      Java: "#b07219",
      Ruby: "#701516",
      PHP: "#4F5D95",
    };
    return colors[language || ""] || "#8b949e";
  };

  const getFilteredProjects = () => {
    if (activeFilter === "recent") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return savedProjects.filter(p => new Date(p.createdAt) > thirtyDaysAgo);
    }
    return savedProjects;
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

  const totalStars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);

  return (
    <div className="min-h-screen bg-[#02040a] text-[#f8fafc] font-['Inter'] selection:bg-[rgba(168,85,247,0.3)] selection:text-white">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#02040a_80%)]" />
        <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent_0,transparent_2px,rgba(168,85,247,0.03)_3px,transparent_4px)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(168,85,247,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(168,85,247,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />
      </div>

      <DashboardHeader user={user} onShowGame={() => setActiveGame('flappy')} />

      <DashboardSidebar
        onFilterChange={setActiveFilter}
        onShowCreate={() => setShowCreateModal(true)}
        onShowCoderMatch={() => setShowCoderMatch(true)}
        scrollToSection={scrollToSection}
        reposRef={reposRef}
        recentRef={recentRef}
      />

      {/* Main Content */}
      <main className="ml-64 pt-24 px-12 pb-24 max-w-[1600px] relative z-10">
        {/* Header Section */}
        <header className="mb-16 flex justify-between items-end">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[rgba(168,85,247,0.2)] bg-[rgba(168,85,247,0.05)] mb-2">
              <span className="text-[9px] font-black text-[#A855F7] uppercase tracking-[0.4em]">Command Center</span>
            </div>
            <h1 className="text-7xl font-bold font-['Space_Grotesk'] tracking-tighter text-[#f8fafc]" style={{ textShadow: "0 0 12px rgba(168, 85, 247, 0.6)" }}>
              Your <span className="text-[#A855F7]">Repositories</span>
            </h1>
            <p className="text-slate-400 max-w-xl text-lg font-light leading-relaxed">
              Welcome back, <span className="text-[#A855F7] font-['JetBrains_Mono']" style={{ textShadow: "0 0 12px rgba(168, 85, 247, 0.6)" }}>@{user.nickname}</span>. System shows <span className="text-[#10B981]">optimal status</span> across {repos.length} repositories.
            </p>
          </div>
          <div className="flex gap-6">
            <div className="bg-[rgba(10,12,20,0.6)] backdrop-blur-xl border border-[rgba(59,130,246,0.2)] p-6 rounded-xl min-w-[200px] group hover:border-[rgba(59,130,246,0.4)] transition-colors shadow-[0_8px_32px_0_rgba(0,0,0,0.4)]">
              <div className="text-[9px] uppercase tracking-[0.3em] font-black text-slate-500 mb-3">Total Stars</div>
              <div className="text-4xl font-['JetBrains_Mono'] font-medium text-[#3B82F6]" style={{ textShadow: "0 0 12px rgba(59, 130, 246, 0.6)" }}>
                {totalStars.toLocaleString()} <span className="text-sm opacity-50">★</span>
              </div>
            </div>
            <div className="bg-[rgba(10,12,20,0.6)] backdrop-blur-xl border border-[rgba(16,185,129,0.2)] p-6 rounded-xl min-w-[200px] group hover:border-[rgba(16,185,129,0.4)] transition-colors shadow-[0_8px_32px_0_rgba(0,0,0,0.4)]">
              <div className="text-[9px] uppercase tracking-[0.3em] font-black text-slate-500 mb-3">Repositories</div>
              <div className="text-4xl font-['JetBrains_Mono'] font-medium text-[#10B981]">{repos.length}</div>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 text-sm font-semibold">
            <span className="material-symbols-outlined">error</span>
            {error}
          </div>
        )}

        {/* Recently Opened Section */}
        {(isFetchingExternal || savedProjects.length > 0) && (
          <section className="mb-24" ref={recentRef}>
            <div className="flex items-center justify-between mb-10 border-b border-white/5 pb-4">
              <div className="flex items-center gap-5">
                <div className="w-10 h-10 rounded bg-[rgba(59,130,246,0.1)] flex items-center justify-center border border-[rgba(59,130,246,0.2)]">
                  <span className="material-symbols-outlined text-[#3B82F6]" style={{ fontVariationSettings: "'FILL' 1" }}>folder_open</span>
                </div>
                <h2 className="text-xs font-['Space_Grotesk'] font-black uppercase tracking-[0.5em] text-[rgba(248,250,252,0.8)]">
                  {activeFilter === "recent" ? "Recently Opened (Last 30 Days)" : "Your Workspaces"}
                </h2>
              </div>
              {activeFilter === "recent" && (
                <button
                  onClick={() => setActiveFilter("all")}
                  className="text-[9px] font-black uppercase tracking-[0.4em] text-[#3B82F6] hover:text-white transition-all border-b border-transparent hover:border-[#3B82F6] cursor-pointer"
                >
                  Show All
                </button>
              )}
            </div>
            {isFetchingExternal ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 size={32} className="animate-spin text-[#3B82F6] mb-4" />
                <div className="text-slate-400 font-['Space_Grotesk'] tracking-widest uppercase text-xs">Loading workspaces...</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {getFilteredProjects().slice(0, 5).map(project => (
                  <div
                    key={project._id}
                    onClick={() => navigate({ to: "/", search: { w: project._id } })}
                    className="bg-[rgba(10,12,20,0.6)] backdrop-blur-xl border border-[rgba(168,85,247,0.15)] shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] group relative p-10 rounded-xl transition-all duration-500 overflow-hidden cursor-pointer hover:border-[rgba(168,85,247,0.6)] hover:shadow-[0_0_40px_rgba(168,85,247,0.3)]"
                    style={{ animation: "pulseGlow 4s ease-in-out infinite" }}
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-[#3B82F6] opacity-30 group-hover:opacity-100 transition-opacity" />
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-8">
                        <div className="w-14 h-14 rounded-lg bg-[rgba(59,130,246,0.1)] flex items-center justify-center border border-[rgba(59,130,246,0.2)] shadow-[0_0_20px_rgba(59,130,246,0.15)]">
                          <span className="material-symbols-outlined text-[#3B82F6] text-3xl">folder</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-['JetBrains_Mono'] text-slate-500 uppercase tracking-widest">
                          <span className="material-symbols-outlined text-sm">schedule</span> {getTimeDiff(project.createdAt)}
                        </div>
                      </div>
                      <h3 className="text-2xl font-['Space_Grotesk'] font-bold mb-3 group-hover:text-[#3B82F6] transition-colors tracking-tighter" style={{ textShadow: "0 0 12px rgba(59, 130, 246, 0.6)" }}>
                        {project.name}
                      </h3>
                      <p className="text-sm text-slate-400 mb-10 leading-relaxed h-12 overflow-hidden font-['JetBrains_Mono'] text-[10px]">{project.repoUrl}</p>
                      <button className="w-full py-4 bg-[rgba(59,130,246,0.1)] border border-[rgba(59,130,246,0.3)] text-[#3B82F6] font-black text-[10px] uppercase tracking-[0.3em] rounded-lg hover:bg-[#3B82F6] hover:text-[#02040a] transition-all active:scale-95 shadow-lg">
                        Open Workspace
                      </button>
                    </div>
                  </div>
                ))}
                <div
                  onClick={() => scrollToSection(reposRef)}
                  className="bg-transparent border-2 border-dashed border-[rgba(168,85,247,0.2)] group p-10 rounded-xl flex flex-col items-center justify-center text-center hover:bg-white/5 transition-all relative overflow-hidden cursor-pointer"
                >
                  <div className="w-16 h-16 rounded-xl bg-[rgba(10,12,20,0.4)] flex items-center justify-center mb-8 text-slate-600 group-hover:text-[#A855F7] transition-colors border border-[rgba(168,85,247,0.1)]">
                    <span className="material-symbols-outlined text-4xl group-hover:rotate-90 transition-transform duration-700">add</span>
                  </div>
                  <h3 className="text-[11px] font-['Space_Grotesk'] font-black uppercase tracking-[0.4em] text-[rgba(248,250,252,0.6)] group-hover:text-[#A855F7] transition-colors">Import Project</h3>
                  <p className="text-[9px] text-slate-600 mt-4 uppercase tracking-[0.3em] font-['JetBrains_Mono']">From GitHub</p>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Deployed Apps Section */}
        {(isLoadingApps || deployedApps.length > 0) && (
          <section className="mb-24">
            <div className="flex items-center gap-5 mb-10 border-b border-white/5 pb-4">
              <div className="w-10 h-10 rounded bg-[rgba(168,85,247,0.1)] flex items-center justify-center border border-[rgba(168,85,247,0.2)]">
                <span className="material-symbols-outlined text-[#A855F7]" style={{ fontVariationSettings: "'FILL' 1" }}>rocket_launch</span>
              </div>
              <h2 className="text-xs font-['Space_Grotesk'] font-black uppercase tracking-[0.5em] text-[rgba(248,250,252,0.8)]">
                Deployed Apps
              </h2>
            </div>
            {isLoadingApps ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 size={32} className="animate-spin text-[#A855F7] mb-4" />
                <div className="text-slate-400 font-['Space_Grotesk'] tracking-widest uppercase text-xs">Loading deployments...</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {deployedApps.map(app => (
                  <div
                    key={app._id}
                    className="bg-[rgba(10,12,20,0.6)] backdrop-blur-xl border border-[rgba(168,85,247,0.15)] shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] group relative p-8 rounded-xl transition-all duration-300 overflow-hidden hover:border-[rgba(168,85,247,0.5)] hover:shadow-[0_0_30px_rgba(168,85,247,0.2)]"
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-[#A855F7] opacity-30 group-hover:opacity-100 transition-opacity" />
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-6">
                        <div className="w-12 h-12 rounded-lg bg-[rgba(168,85,247,0.1)] flex items-center justify-center border border-[rgba(168,85,247,0.2)]">
                          <span className="material-symbols-outlined text-[#A855F7] text-2xl">language</span>
                        </div>
                        <span className="flex items-center gap-1.5 text-[10px] font-['JetBrains_Mono'] text-[#10B981] uppercase tracking-widest">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] shadow-[0_0_6px_#10B981]" />
                          Live
                        </span>
                      </div>
                      <h3 className="text-lg font-['Space_Grotesk'] font-bold mb-2 tracking-tight text-white group-hover:text-[#A855F7] transition-colors">
                        {app.title}
                      </h3>
                      <a
                        href={app.project_repo}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-['JetBrains_Mono'] text-slate-500 hover:text-cyan-400 transition-colors truncate block mb-1"
                        onClick={e => e.stopPropagation()}
                      >
                        {app.project_repo.replace("https://github.com/", "github.com/")}
                      </a>
                      <div className="text-[10px] font-['JetBrains_Mono'] text-slate-600 mb-6">
                        {new Date(app.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </div>
                      <a
                        href={app.project_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-2 py-3 bg-[rgba(168,85,247,0.1)] border border-[rgba(168,85,247,0.3)] text-[#A855F7] font-black text-[10px] uppercase tracking-[0.3em] rounded-lg hover:bg-[#A855F7] hover:text-[#02040a] transition-all active:scale-95"
                      >
                        <ExternalLink size={13} /> Visit App
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* GitHub Repositories Section */}
        <section ref={reposRef}>
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-5">
              <div className="w-10 h-10 rounded bg-[rgba(16,185,129,0.1)] flex items-center justify-center border border-[rgba(16,185,129,0.2)]">
                <span className="material-symbols-outlined text-[#10B981]" style={{ fontVariationSettings: "'FILL' 1" }}>cloud_sync</span>
              </div>
              <h2 className="text-xs font-['Space_Grotesk'] font-black uppercase tracking-[0.5em] text-[rgba(248,250,252,0.8)]">GitHub Repositories</h2>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.4em] text-[#10B981] hover:text-white transition-all"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Create New
            </button>
          </div>
          {isFetchingRepos ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 size={40} className="animate-spin text-[#10B981] mb-6" />
              <div className="text-slate-400 font-['Space_Grotesk'] tracking-widest uppercase text-xs">Scanning remote clusters...</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {repos.map(repo => {
                const isImporting = importingRepoId === repo.id;
                const languageColor = getLanguageColor(repo.language);
                return (
                  <div
                    key={repo.id}
                    className="bg-[rgba(10,12,20,0.6)] backdrop-blur-xl border border-[rgba(168,85,247,0.1)] shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] flex items-center p-8 rounded-xl group transition-all duration-300 relative overflow-hidden hover:border-[rgba(168,85,247,0.6)] hover:shadow-[0_0_40px_rgba(168,85,247,0.3)]"
                    style={{ animation: "pulseGlow 4s ease-in-out infinite" }}
                  >
                    <div className="w-16 h-16 rounded-lg bg-[rgba(16,185,129,0.05)] flex items-center justify-center border border-[rgba(16,185,129,0.2)] mr-8 group-hover:scale-110 transition-transform">
                      <span className="material-symbols-outlined text-[#10B981] text-3xl">code</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-4">
                        <h4 className="font-['Space_Grotesk'] font-bold text-xl text-[#f8fafc] tracking-tight group-hover:text-[#10B981] transition-colors">
                          {repo.full_name}
                        </h4>
                      </div>
                      <div className="flex items-center gap-8 mt-3 font-['JetBrains_Mono'] text-[10px] text-slate-500 uppercase tracking-widest">
                        {repo.language && (
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: languageColor, boxShadow: `0 0 8px ${languageColor}` }} />
                            {repo.language}
                          </span>
                        )}
                        <span>Updated {getTimeDiff(repo.updated_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-10 mr-12 font-['JetBrains_Mono'] text-[11px] text-slate-500">
                      <div className="text-center">
                        <div className="font-bold text-[#f8fafc] text-lg">{repo.stargazers_count >= 1000 ? `${(repo.stargazers_count / 1000).toFixed(1)}K` : repo.stargazers_count}</div>
                        <div className="text-[8px] uppercase tracking-[0.3em] opacity-50">Stars</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-[#f8fafc] text-lg">{repo.forks_count}</div>
                        <div className="text-[8px] uppercase tracking-[0.3em] opacity-50">Forks</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleImport(repo)}
                      disabled={isImporting || importingRepoId !== null}
                      className={`px-10 py-4 font-black text-[10px] uppercase tracking-[0.3em] rounded-lg shadow-xl transition-all ${
                        isImporting
                          ? "bg-[#A855F7]/20 text-[#A855F7] border border-[#A855F7]/30 cursor-wait"
                          : importingRepoId !== null
                            ? "bg-white/5 text-slate-600 border border-transparent cursor-not-allowed"
                            : "bg-[#A855F7] text-[#02040a] hover:scale-105 hover:shadow-[0_0_30px_rgba(168,85,247,0.3)]"
                      }`}
                      style={!isImporting && importingRepoId === null ? { animation: "pulseGlow 4s ease-in-out infinite" } : undefined}
                    >
                      {isImporting ? (
                        <span className="flex items-center gap-2">
                          <Loader2 size={16} className="animate-spin" /> Loading...
                        </span>
                      ) : (
                        "Import"
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {showCoderMatch && (
        <CoderMatchModal onClose={() => setShowCoderMatch(false)} />
      )}

      {activeGame && (
        <GamePIP gameType={activeGame} onSwitchGame={setActiveGame} onClose={() => setActiveGame(null)} />
      )}

      {showCreateModal && (
        <CreateRepoModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateRepo}
          isCreating={isCreating}
        />
      )}

      <DashboardFooter repoCount={repos.length} workspaceCount={savedProjects.length} />
    </div>
  );
}

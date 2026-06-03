import FileExplorer from "./FileExplorer";
import GitPanel from "./GitPanel";
import EditorArea from "./EditorArea";
import TerminalArea from "./TerminalArea";
import VibeChat from "./VibeChat";
import CommunityHelpModal from "./CommunityHelpModal";
import WhiteboardArea from "./WhiteboardArea";
import MatrixRain from "./MatrixRain";
import SpotifySidebarPanel from "./SpotifySidebarPanel";
import YouTubeSidebarPanel from "./YouTubeSidebarPanel";
import CodeRoastModal from "./CodeRoastModal";
import WorkspaceTopBar from "./WorkspaceTopBar";
import DeploySuccessModal from "./DeploySuccessModal";
import TokenPromptModal from "./TokenPromptModal";
import { API_BASE } from "@/lib/config";
import {
	Loader2,
	Flame,
	Terminal,
	FolderOpen,
	GitBranch,
	HelpCircle,
	Sparkles,
	Music,
	Youtube,
	Search,
} from "lucide-react";
import {
	Group as PanelGroup,
	Panel,
	Separator as PanelResizeHandle,
} from "react-resizable-panels";
import {
	useState,
	useEffect,
	useCallback,
	useRef,
	useMemo,
	type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthProvider";
import { motion, AnimatePresence } from "framer-motion";
import { SocketProvider, useSocket } from "../contexts/SocketProvider";
import type { PendingUpdate, AgentFileAction } from "../hooks/useAgentStream";

export interface ProjectFile {
	id: string;
	path: string;
	content: string | null;
}

function highlightMatch(text: string, query: string) {
	const idx = text.toLowerCase().indexOf(query.toLowerCase());
	if (idx === -1) return <>{text}</>;
	return (
		<>
			{text.slice(0, idx)}
			<mark className="bg-yellow-400/25 text-yellow-200 not-italic rounded-[2px] px-px">
				{text.slice(idx, idx + query.length)}
			</mark>
			{text.slice(idx + query.length)}
		</>
	);
}

function SidebarTabBtn({
	icon,
	label,
	active,
	onClick,
	activeColor = "#A855F7",
}: {
	icon: ReactNode;
	label: string;
	active: boolean;
	onClick: () => void;
	activeColor?: string;
}) {
	return (
		<button
			onClick={onClick}
			title={label}
			style={
				active
					? { borderLeftColor: activeColor, color: activeColor }
					: undefined
			}
			className={`w-full h-10 flex items-center justify-center transition-colors border-l-2 ${
				active
					? "text-[#fafafa]"
					: "text-zinc-500 hover:text-zinc-300 hover:bg-[#1e1e24] border-l-transparent"
			}`}
		>
			{icon}
		</button>
	);
}

function WorkspaceInner({
	onBack,
	projectId,
}: {
	onBack: () => void;
	projectId: string | null;
}) {
	const [files, setFiles] = useState<ProjectFile[]>([]);
	const [openFiles, setOpenFiles] = useState<ProjectFile[]>([]);
	const [activeFile, setActiveFile] = useState<ProjectFile | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [projectName, setProjectName] = useState<string | null>(null);
	const [projectRepoUrl, setProjectRepoUrl] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [showCommunityHelp, setShowCommunityHelp] = useState(false);
	const [showMatrix, setShowMatrix] = useState(false);
	const [showRoast, setShowRoast] = useState(false);
	const [showPowerMode, setShowPowerMode] = useState(false);
	const [activeSidebarTab, setActiveSidebarTab] = useState<
		"explorer" | "search" | "git" | "fun" | "help" | "spotify" | "youtube"
	>("explorer");
	const [fileSearchQuery, setFileSearchQuery] = useState("");
	const [showEditorGame, setShowEditorGame] = useState(false);
	const [editorGameType, setEditorGameType] = useState<"subway" | "flappy">(
		"flappy",
	);
	const [showQuickOpen, setShowQuickOpen] = useState(false);
	const [quickOpenQuery, setQuickOpenQuery] = useState("");

	// Branch — kept here so EditorArea can receive it as branchName prop
	const [currentBranch, setCurrentBranch] = useState("main");

	// Deployment state
	const [isSaving, setIsSaving] = useState(false);
	const [isDeploying, setIsDeploying] = useState(false);
	const [deploySuccess, setDeploySuccess] = useState<{ url: string } | null>(
		null,
	);
	const [showConfetti, setShowConfetti] = useState(false);
	const [tokenPrompt, setTokenPrompt] = useState<{
		type: "GITHUB" | "VERCEL";
		message: string;
	} | null>(null);

	// Panel toggles
	const [showSidebar, setShowSidebar] = useState(true);
	const [showTerminal, setShowTerminal] = useState(true);
	const [showChat, setShowChat] = useState(true);
	const [showWhiteboard, setShowWhiteboard] = useState(false);

	// Collab
	const { isConnected, lastMessage } = useSocket();
	const activeFileRef = useRef<ProjectFile | null>(null);
	useEffect(() => {
		activeFileRef.current = activeFile;
	}, [activeFile]);
	const [collabUsers, setCollabUsers] = useState<
		{ id: string; name: string; color: string; isHost?: boolean }[]
	>([]);
	const [, setMyColor] = useState("#A855F7");
	const [isHost, setIsHost] = useState(false);

	// Remote editor events — set in onmessage, consumed by EditorArea via props
	const [remoteCodeUpdate, setRemoteCodeUpdate] = useState<{
		filePath: string;
		content: string;
		clientId: string;
	} | null>(null);
	const [remoteCursorUpdate, setRemoteCursorUpdate] = useState<{
		filePath: string;
		clientId: string;
		color: string;
		userName: string;
		position: { lineNumber: number; column: number };
	} | null>(null);

	// Agent diff state
	const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate | null>(
		null,
	);
	const [agentToken, setAgentToken] = useState<string | null>(null);

	const { user, getAccessTokenSilently, isAuthenticated, loginWithRedirect } =
		useAuth();
	const getTokenRef = useRef(getAccessTokenSilently);
	useEffect(() => {
		getTokenRef.current = getAccessTokenSilently;
	}, [getAccessTokenSilently]);

	// 1. Fetch project files from API + store token for agent
	useEffect(() => {
		if (!projectId || !isAuthenticated) return;
		setIsLoading(true);
		let cancelled = false;

		getAccessTokenSilently()
			.then((token) => {
				if (cancelled) return;
				setAgentToken(token);
				return fetch(`${API_BASE}/api/projects/${projectId}/files`, {
					headers: { Authorization: `Bearer ${token}` },
				});
			})
			.then((res) => res?.json())
			.then((data) => {
				if (cancelled || !data) return;
				if (data.success) {
					setFiles(data.files || []);
					if (data.projectName) setProjectName(data.projectName);
					if (data.repoUrl) setProjectRepoUrl(data.repoUrl);
				}
				setIsLoading(false);
			})
			.catch((err) => {
				if (cancelled) return;
				console.error("Fetch files error:", err);
				setIsLoading(false);
				if (
					err?.error === "consent_required" ||
					err?.message?.includes("Consent required")
				) {
					// loginWithRedirect(); // Assume it exists in scope, or omit if it causes type errors, but wait, it is extracted from useAuth!
					loginWithRedirect();
				}
			});
		return () => {
			cancelled = true;
		};
	}, [projectId, isAuthenticated, getAccessTokenSilently, loginWithRedirect]);

	// Keep openFiles and activeFile in sync with latest files array
	// (e.g. when another client updates a file or agent writes to it, so horizontal bar doesn't show stale version)
	useEffect(() => {
		if (!files.length) return;
		setOpenFiles((prev) =>
			prev.map((openFile) => {
				const latest = files.find((f) => f.path === openFile.path);
				return latest ? latest : openFile;
			}),
		);
		setActiveFile((prev) => {
			if (!prev) return prev;
			const latest = files.find((f) => f.path === prev.path);
			return latest ? latest : prev;
		});
	}, [files]);

	// 2. Consume parsed WebSocket messages from SocketProvider
	useEffect(() => {
		const data = lastMessage;
		if (!data) return;

		if (data.type === "connected") {
			setMyColor(data.color);
			setCollabUsers(data.users || []);
			setIsHost(!!data.isHost);
		} else if (data.type === "user_joined") {
			setCollabUsers((prev) =>
				prev.some((u) => u.id === data.user.id) ? prev : [...prev, data.user],
			);
		} else if (data.type === "user_left") {
			setCollabUsers((prev) => prev.filter((u) => u.id !== data.clientId));
		} else if (data.type === "code_update") {
			setRemoteCodeUpdate({
				filePath: data.filePath,
				content: data.content,
				clientId: data.clientId,
			});
		} else if (data.type === "cursor_update") {
			setRemoteCursorUpdate({
				filePath: data.filePath,
				clientId: data.clientId,
				color: data.color,
				userName: data.userName,
				position: data.position,
			});
		} else if (data.type === "agent_accepted") {
			// Another client accepted a suggestion — apply the change to our local file state
			setFiles((prev) =>
				prev.map((f) =>
					f.path === data.filePath ? { ...f, content: data.content } : f,
				),
			);
			setRemoteCodeUpdate({
				filePath: data.filePath,
				content: data.content,
				clientId: "__agent_accepted__",
			});
			setPendingUpdate(null);
		} else if (data.type === "room_state") {
			const incoming = data.files as Record<string, string>;
			setFiles((prev) => {
				const updated = [...prev];
				for (const [filePath, content] of Object.entries(incoming)) {
					const idx = updated.findIndex((f) => f.path === filePath);
					if (idx !== -1) updated[idx] = { ...updated[idx], content };
				}
				return updated;
			});
			const activeFilePath = activeFileRef.current?.path;
			if (activeFilePath && activeFilePath in incoming) {
				setRemoteCodeUpdate({
					filePath: activeFilePath,
					content: incoming[activeFilePath],
					clientId: "room_state",
				});
			}
		} else if (data.type === "host_changed") {
			// New host assignment from backend
		}
		// emoji_reaction: handled directly in ReactionOverlay via lastMessage prop
	}, [lastMessage]);

	// Keyboard shortcuts for panel toggles & Zen mode
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (
				e.target instanceof HTMLInputElement ||
				e.target instanceof HTMLTextAreaElement
			)
				return;

			if (e.metaKey || e.ctrlKey) {
				if (e.key.toLowerCase() === "p" && !e.shiftKey) {
					e.preventDefault();
					setShowQuickOpen(true);
					setQuickOpenQuery("");
				} else if (e.key.toLowerCase() === "f" && e.shiftKey) {
					e.preventDefault();
					setActiveSidebarTab("search");
					setShowSidebar(true);
				} else if (e.key.toLowerCase() === "e") {
					e.preventDefault();
					setShowSidebar((prev) => !prev);
				} else if (e.key.toLowerCase() === "j") {
					e.preventDefault();
					setShowTerminal((prev) => !prev);
				} else if (e.key.toLowerCase() === "b") {
					e.preventDefault();
					setShowChat((prev) => !prev);
				} else if (e.key.toLowerCase() === "k") {
					e.preventDefault();
					// Zen Mode / Focus Mode
					const isZen = !showSidebar && !showTerminal && !showChat;
					setShowSidebar(isZen);
					setShowTerminal(isZen);
					setShowChat(isZen);
				}
			}
			if (e.key === "Escape") {
				setShowQuickOpen(false);
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [showSidebar, showTerminal, showChat]);

	const handleFileAction = useCallback(
		async (action: AgentFileAction) => {
			if (!projectId || !agentToken) return;

			const base = `${API_BASE}/api/projects/${projectId}`;
			const headers = {
				"Content-Type": "application/json",
				Authorization: `Bearer ${agentToken}`,
			};

			if (action.type === "create_file") {
				const res = await fetch(`${base}/files/create`, {
					method: "POST",
					headers,
					body: JSON.stringify({
						path: action.filePath,
						content: action.content ?? "",
					}),
				});
				if (res.ok) {
					const newFile: ProjectFile = {
						id: crypto.randomUUID(),
						path: action.filePath,
						content: action.content ?? "",
					};
					setFiles((prev) => {
						if (prev.find((f) => f.path === action.filePath)) {
							return prev.map((f) =>
								f.path === action.filePath
									? { ...f, content: action.content ?? "" }
									: f,
							);
						}
						return [...prev, newFile];
					});
				}
			} else if (action.type === "delete_file") {
				const res = await fetch(`${base}/files`, {
					method: "DELETE",
					headers,
					body: JSON.stringify({ path: action.filePath }),
				});
				if (res.ok) {
					setFiles((prev) =>
						prev.filter(
							(f) =>
								f.path !== action.filePath &&
								!f.path.startsWith(action.filePath + "/"),
						),
					);
					setOpenFiles((prev) =>
						prev.filter(
							(f) =>
								f.path !== action.filePath &&
								!f.path.startsWith(action.filePath + "/"),
						),
					);
					setActiveFile((prev) => {
						if (!prev) return null;
						if (
							prev.path === action.filePath ||
							prev.path.startsWith(action.filePath + "/")
						)
							return null;
						return prev;
					});
				}
			} else if (action.type === "rename_file" && action.newPath) {
				const res = await fetch(`${base}/files/rename`, {
					method: "PATCH",
					headers,
					body: JSON.stringify({
						oldPath: action.filePath,
						newPath: action.newPath,
					}),
				});
				if (res.ok) {
					setFiles((prev) =>
						prev.map((f) => {
							if (f.path === action.filePath)
								return { ...f, path: action.newPath! };
							if (f.path.startsWith(action.filePath + "/"))
								return {
									...f,
									path: action.newPath! + f.path.slice(action.filePath.length),
								};
							return f;
						}),
					);
					setOpenFiles((prev) =>
						prev.map((f) => {
							if (f.path === action.filePath)
								return { ...f, path: action.newPath! };
							if (f.path.startsWith(action.filePath + "/"))
								return {
									...f,
									path: action.newPath! + f.path.slice(action.filePath.length),
								};
							return f;
						}),
					);
					setActiveFile((prev) => {
						if (!prev) return null;
						if (prev.path === action.filePath)
							return { ...prev, path: action.newPath! };
						if (prev.path.startsWith(action.filePath + "/"))
							return {
								...prev,
								path: action.newPath! + prev.path.slice(action.filePath.length),
							};
						return prev;
					});
				}
			}
		},
		[projectId, agentToken],
	);

	const copyCollabLink = () => {
		const url = `${window.location.origin}/?w=${projectId}`;
		navigator.clipboard.writeText(url);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const handleSave = async () => {
		if (!projectId || !isAuthenticated) return;
		setIsSaving(true);
		try {
			const token = await getAccessTokenSilently();
			const res = await fetch(`${API_BASE}/api/projects/${projectId}/push`, {
				method: "POST",
				headers: { Authorization: `Bearer ${token}` },
			});
			const data = await res.json();
			if (!data.success) {
				if (data.error === "GITHUB_TOKEN_REQUIRED") {
					setTokenPrompt({ type: "GITHUB", message: data.message });
				} else {
					console.error("Save failed:", data.error);
				}
			}
		} catch (e) {
			console.error("Save error:", e);
		}
		setIsSaving(false);
	};

	const handleDeploy = async () => {
		if (!projectId || !isAuthenticated) return;
		setIsDeploying(true);
		setShowTerminal(true);
		try {
			const token = await getAccessTokenSilently();
			const res = await fetch(`${API_BASE}/api/deploy/${projectId}`, {
				method: "POST",
				headers: { Authorization: `Bearer ${token}` },
			});
			const data = await res.json();
			if (data.success) {
				setDeploySuccess({ url: data.url });
				setShowConfetti(true);
				setTimeout(() => setShowConfetti(false), 5000);
			} else {
				if (data.error === "VERCEL_TOKEN_REQUIRED") {
					setTokenPrompt({ type: "VERCEL", message: data.message });
				} else {
					console.error("Deploy failed:", data.error);
				}
			}
		} catch (e) {
			console.error("Deploy error:", e);
		}
		setIsDeploying(false);
	};

	const fileSearchResults = useMemo(() => {
		const q = fileSearchQuery.trim().toLowerCase();
		if (q.length < 2) return [];
		return files
			.filter((f) => f.content && f.content.toLowerCase().includes(q))
			.map((f) => {
				const lines = (f.content || "").split("\n");
				const matches = lines
					.map((text, i) => ({ lineNumber: i + 1, text: text.trim() }))
					.filter(({ text }) => text.toLowerCase().includes(q))
					.slice(0, 4);
				return { file: f, matches };
			});
	}, [files, fileSearchQuery]);

	const handlePendingUpdate = useCallback((update: PendingUpdate) => {
		setPendingUpdate(update);
		// S4: switch back from whiteboard so the diff panel is visible
		setShowWhiteboard(false);
		// S3: auto-open the target file
		setFiles(prev => {
			const target = prev.find(f => f.path === update.filePath);
			if (target) {
				setOpenFiles(o => o.find(f => f.path === target.path) ? o : [...o, target]);
				setActiveFile(target);
			}
			return prev;
		});
	}, []);

	const handleAcceptFromChat = useCallback(() => {
		if (!pendingUpdate) return;
		setFiles(prev => {
			const target = prev.find(f => f.path === pendingUpdate.filePath);
			const currentContent = target?.content ?? "";
			const newContent = currentContent.includes(pendingUpdate.originalContent)
				? currentContent.replace(pendingUpdate.originalContent, pendingUpdate.suggestedContent)
				: pendingUpdate.suggestedContent;
			const updated = prev.map(f =>
				f.path === pendingUpdate.filePath ? { ...f, content: newContent } : f
			);
			setOpenFiles(o => o.map(f =>
				f.path === pendingUpdate.filePath ? { ...f, content: newContent } : f
			));
			setActiveFile(a => a?.path === pendingUpdate.filePath ? { ...a, content: newContent } : a);
			setRemoteCodeUpdate({ filePath: pendingUpdate.filePath, content: newContent, clientId: "__chat_accepted__" });
			return updated;
		});
		setPendingUpdate(null);
	}, [pendingUpdate]);

	const handleRejectFromChat = useCallback(() => {
		setPendingUpdate(null);
	}, []);

	const handleSelectFile = (file: ProjectFile) => {
		setOpenFiles((prev) => {
			if (!prev.find((f) => f.path === file.path)) {
				return [...prev, file];
			}
			return prev;
		});
		setActiveFile(file);
	};

	const handleCloseFile = (file: ProjectFile, e?: React.MouseEvent) => {
		if (e) e.stopPropagation();

		if (activeFile?.path === file.path) {
			const closedIndex = openFiles.findIndex((f) => f.path === file.path);
			const nextOpenFiles = openFiles.filter((f) => f.path !== file.path);

			if (nextOpenFiles.length === 0) {
				setActiveFile(null);
			} else {
				const defaultIndex = Math.max(0, closedIndex - 1);
				setActiveFile(nextOpenFiles[defaultIndex]);
			}
		}

		setOpenFiles((prev) => prev.filter((f) => f.path !== file.path));
	};

	const handleCloseOthers = (file: ProjectFile) => {
		setOpenFiles([file]);
		setActiveFile(file);
	};

	if (isLoading) {
		return (
			<div className="h-screen w-full bg-[#09090b] flex flex-col items-center justify-center gap-4">
				<Loader2 size={32} className="animate-spin text-[#A855F7]" />
				<span className="text-sm text-[#71717a] tracking-[0.15em] uppercase font-medium">
					Parsing Repository Data...
				</span>
			</div>
		);
	}

	return (
		<div className="h-screen w-full bg-[#09090b] text-[#c9d1d9] font-sans flex flex-col overflow-hidden selection:bg-cyan-500/30">
			{/* Top Bar */}
			<WorkspaceTopBar
				projectName={projectName}
				projectId={projectId}
				showWhiteboard={showWhiteboard}
				setShowWhiteboard={setShowWhiteboard}
				showSidebar={showSidebar}
				setShowSidebar={setShowSidebar}
				showTerminal={showTerminal}
				setShowTerminal={setShowTerminal}
				showChat={showChat}
				setShowChat={setShowChat}
				isHost={isHost}
				isConnected={isConnected}
				isDeploying={isDeploying}
				collabUsers={collabUsers}
				copied={copied}
				onBack={onBack}
				onDeploy={handleDeploy}
				onCopyCollabLink={copyCollabLink}
			/>

			<div className="flex-1 flex overflow-hidden">
				{/* Activity Bar — always visible, VS Code-style */}
				<div className="w-10 flex flex-col shrink-0 bg-[#09090b] border-r border-[#27272a] select-none py-1 z-20">
					<SidebarTabBtn
						icon={<FolderOpen size={17} />}
						label="Explorer"
						active={showSidebar && activeSidebarTab === "explorer"}
						onClick={() => {
							if (showSidebar && activeSidebarTab === "explorer") {
								setShowSidebar(false);
							} else {
								setActiveSidebarTab("explorer");
								setShowSidebar(true);
							}
						}}
					/>
					<SidebarTabBtn
						icon={<Search size={17} />}
						label="Search"
						active={showSidebar && activeSidebarTab === "search"}
						onClick={() => {
							if (showSidebar && activeSidebarTab === "search") {
								setShowSidebar(false);
							} else {
								setActiveSidebarTab("search");
								setShowSidebar(true);
							}
						}}
					/>
					<SidebarTabBtn
						icon={<GitBranch size={17} />}
						label="Git"
						active={showSidebar && activeSidebarTab === "git"}
						onClick={() => {
							if (showSidebar && activeSidebarTab === "git") {
								setShowSidebar(false);
							} else {
								setActiveSidebarTab("git");
								setShowSidebar(true);
							}
						}}
					/>
					<SidebarTabBtn
						icon={<Sparkles size={17} />}
						label="Fun"
						active={showSidebar && activeSidebarTab === "fun"}
						onClick={() => {
							if (showSidebar && activeSidebarTab === "fun") {
								setShowSidebar(false);
							} else {
								setActiveSidebarTab("fun");
								setShowSidebar(true);
							}
						}}
					/>
					<SidebarTabBtn
						icon={<HelpCircle size={17} />}
						label="Help"
						active={showSidebar && activeSidebarTab === "help"}
						onClick={() => {
							if (showSidebar && activeSidebarTab === "help") {
								setShowSidebar(false);
							} else {
								setActiveSidebarTab("help");
								setShowSidebar(true);
							}
						}}
					/>
					<div className="flex-1" />
					<div className="border-t border-[#27272a] my-1" />
					<SidebarTabBtn
						icon={<Music size={17} />}
						label="Spotify"
						active={showSidebar && activeSidebarTab === "spotify"}
						activeColor="#1db954"
						onClick={() => {
							if (showSidebar && activeSidebarTab === "spotify") {
								setShowSidebar(false);
							} else {
								setActiveSidebarTab("spotify");
								setShowSidebar(true);
							}
						}}
					/>
					<SidebarTabBtn
						icon={<Youtube size={17} />}
						label="YouTube"
						active={showSidebar && activeSidebarTab === "youtube"}
						activeColor="#FF0000"
						onClick={() => {
							if (showSidebar && activeSidebarTab === "youtube") {
								setShowSidebar(false);
							} else {
								setActiveSidebarTab("youtube");
								setShowSidebar(true);
							}
						}}
					/>
				</div>

				<PanelGroup orientation="horizontal" className="w-full h-full">
					{/* Left Sidebar Panel Content */}
					{showSidebar && (
						<>
							<Panel
								defaultSize={22}
								minSize={16}
								className="bg-[#09090b] relative z-10 border-r border-[#27272a]"
							>
								{/* Tab Content */}
								<div className="h-full overflow-hidden flex flex-col">
									{activeSidebarTab === "explorer" && (
										<FileExplorer
											files={files}
											activeFile={activeFile}
											onSelect={handleSelectFile}
											projectId={projectId}
											token={agentToken}
											onFilesChange={setFiles}
										/>
									)}
									{activeSidebarTab === "search" && (
										<div className="flex flex-col h-full overflow-hidden">
											<div className="px-3 pt-3 pb-2 border-b border-[#27272a] shrink-0 space-y-2">
												<p className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
													Search in Files
												</p>
												<div className="relative">
													<Search
														size={12}
														className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none"
													/>
													<input
														autoFocus
														value={fileSearchQuery}
														onChange={(e) => setFileSearchQuery(e.target.value)}
														placeholder="Search text..."
														className="w-full bg-[#111113] border border-[#27272a] focus:border-purple-500/40 rounded-[5px] pl-7 pr-2.5 py-1.5 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none transition-colors"
													/>
												</div>
												{fileSearchQuery.trim().length >= 2 && (
													<p className="text-[10px] text-zinc-600">
														{fileSearchResults.length === 0
															? "No results"
															: `${fileSearchResults.length} file${fileSearchResults.length !== 1 ? "s" : ""}`}
													</p>
												)}
											</div>
											<div className="flex-1 overflow-y-auto">
												{fileSearchResults.length === 0 &&
													fileSearchQuery.trim().length >= 2 && (
														<div className="flex flex-col items-center justify-center h-32 text-zinc-600">
															<Search size={20} className="mb-2 opacity-30" />
															<p className="text-[10px]">No files match</p>
														</div>
													)}
												{fileSearchResults.map(({ file, matches }) => (
													<div
														key={file.id}
														className="border-b border-[#27272a] last:border-b-0"
													>
														<button
															onClick={() => handleSelectFile(file)}
															className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#1e1e24] transition-colors text-left group"
														>
															<span className="w-1.5 h-1.5 rounded-full bg-[#A855F7] shrink-0" />
															<span className="text-[11px] font-medium text-zinc-300 truncate group-hover:text-zinc-100">
																{file.path.split("/").pop()}
															</span>
															<span className="text-[10px] text-zinc-600 truncate shrink-0 ml-auto">
																{matches.length} match
																{matches.length !== 1 ? "es" : ""}
															</span>
														</button>
														{matches.map(({ lineNumber, text }) => (
															<button
																key={lineNumber}
																onClick={() => handleSelectFile(file)}
																className="w-full flex items-baseline gap-2 px-3 py-1 hover:bg-[#1e1e24] transition-colors text-left"
															>
																<span className="text-[9px] text-zinc-600 font-mono w-6 shrink-0 text-right">
																	{lineNumber}
																</span>
																<span className="text-[10px] text-zinc-500 font-mono truncate">
																	{highlightMatch(text, fileSearchQuery)}
																</span>
															</button>
														))}
													</div>
												))}
											</div>
										</div>
									)}
									{activeSidebarTab === "git" && (
										<GitPanel
											projectId={projectId}
											getToken={getAccessTokenSilently}
											onBranchChange={setCurrentBranch}
											onTokenRequired={(type, message) =>
												setTokenPrompt({ type, message })
											}
											onSave={handleSave}
											isSavingProject={isSaving}
										/>
									)}
									{activeSidebarTab === "fun" && (
										<div className="flex flex-col h-full">
											<div className="px-3 py-2 border-b border-[#27272a] shrink-0">
												<p className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
													Fun &amp; Easter Eggs
												</p>
											</div>
											<div className="flex-1 overflow-y-auto p-2 space-y-1">
												<div
													className="flex items-center justify-between px-3 py-2.5 rounded-[5px] hover:bg-[#1e1e24] transition-colors cursor-pointer"
													onClick={() => setShowPowerMode((p) => !p)}
												>
													<div className="flex items-center gap-2.5">
														<span className="text-sm leading-none">⚡</span>
														<div>
															<div className="text-xs font-medium text-zinc-300">
																Power Mode
															</div>
															<div className="text-[10px] text-zinc-600">
																Keystroke sparks
															</div>
														</div>
													</div>
													<div
														className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-150 ${showPowerMode ? "bg-orange-500" : "bg-[#3f3f46]"}`}
													>
														<span
															className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow-sm transition-transform duration-150 ${showPowerMode ? "translate-x-[18px]" : "translate-x-0.5"}`}
														/>
													</div>
												</div>
												<div
													className="flex items-center justify-between px-3 py-2.5 rounded-[5px] hover:bg-[#1e1e24] transition-colors cursor-pointer"
													onClick={() => setShowMatrix((p) => !p)}
												>
													<div className="flex items-center gap-2.5">
														<Terminal
															size={13}
															className="text-green-500 shrink-0"
														/>
														<div>
															<div className="text-xs font-medium text-zinc-300">
																Hacker Mode
															</div>
															<div className="text-[10px] text-zinc-600">
																Matrix rain overlay
															</div>
														</div>
													</div>
													<div
														className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-150 ${showMatrix ? "bg-green-500" : "bg-[#3f3f46]"}`}
													>
														<span
															className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow-sm transition-transform duration-150 ${showMatrix ? "translate-x-[18px]" : "translate-x-0.5"}`}
														/>
													</div>
												</div>
												<button
													onClick={() => {
														setEditorGameType("flappy");
														setShowEditorGame(true);
													}}
													className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-[5px] text-left hover:bg-[#1e1e24] transition-colors ${showEditorGame && editorGameType === "flappy" ? "bg-orange-500/10" : ""}`}
												>
													<span className="text-sm leading-none shrink-0">
														🐦
													</span>
													<div>
														<div
															className={`text-xs font-medium ${showEditorGame && editorGameType === "flappy" ? "text-orange-400" : "text-zinc-300"}`}
														>
															Flappy Bird
														</div>
														<div className="text-[10px] text-zinc-600 mt-0.5">
															Play in a PIP window
														</div>
													</div>
												</button>
												<button
													onClick={() => {
														setEditorGameType("subway");
														setShowEditorGame(true);
													}}
													className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-[5px] text-left hover:bg-[#1e1e24] transition-colors ${showEditorGame && editorGameType === "subway" ? "bg-orange-500/10" : ""}`}
												>
													<span className="text-sm leading-none shrink-0">
														🏃
													</span>
													<div>
														<div
															className={`text-xs font-medium ${showEditorGame && editorGameType === "subway" ? "text-orange-400" : "text-zinc-300"}`}
														>
															Subway Surfer
														</div>
														<div className="text-[10px] text-zinc-600 mt-0.5">
															Play in a PIP window
														</div>
													</div>
												</button>
												{activeFile && (
													<button
														onClick={() => setShowRoast(true)}
														className="w-full flex items-start gap-2.5 px-3 py-2.5 rounded-[5px] text-left hover:bg-[#1e1e24] transition-colors"
													>
														<span className="text-sm leading-none shrink-0">
															🔥
														</span>
														<div>
															<div className="text-xs font-medium text-orange-400">
																Roast My Code
															</div>
															<div className="text-[10px] text-zinc-600 mt-0.5">
																Brutal AI code review
															</div>
														</div>
													</button>
												)}
												<button
													onClick={() => setActiveSidebarTab("youtube")}
													className="w-full flex items-start gap-2.5 px-3 py-2.5 rounded-[5px] text-left hover:bg-[#1e1e24] transition-colors"
												>
													<Flame
														size={13}
														className="text-pink-400 shrink-0 mt-0.5"
													/>
													<div>
														<div className="text-xs font-medium text-pink-400">
															Vibe Reels
														</div>
														<div className="text-[10px] text-zinc-600 mt-0.5">
															Watch dev content
														</div>
													</div>
												</button>
											</div>
										</div>
									)}
									{activeSidebarTab === "help" && (
										<div className="flex flex-col h-full">
											<div className="px-3 py-2 border-b border-[#27272a] shrink-0">
												<p className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
													Community Help
												</p>
											</div>
											<div className="p-3 space-y-3">
												<p className="text-[11px] text-zinc-500 leading-relaxed">
													Post your issue to the community and get help from
													other developers.
												</p>
												<button
													className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium bg-[#A855F7]/20 hover:bg-[#A855F7]/30 text-purple-300 rounded-md transition-colors"
													onClick={() => setShowCommunityHelp(true)}
												>
													<svg
														width="14"
														height="14"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														strokeWidth="2"
														strokeLinecap="round"
														strokeLinejoin="round"
													>
														<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
													</svg>
													Request Help
												</button>
											</div>
										</div>
									)}
									{activeSidebarTab === "spotify" && <SpotifySidebarPanel />}
									{activeSidebarTab === "youtube" && <YouTubeSidebarPanel />}
								</div>
							</Panel>
							<PanelResizeHandle className="w-1 hover:bg-purple-500/30 transition-colors z-50 cursor-col-resize" />
						</>
					)}

					{/* Center Area */}
					<Panel
						defaultSize={55}
						className="flex flex-col min-w-0 bg-[#09090b] relative"
					>
						<PanelGroup orientation="vertical" className="w-full h-full">
							<Panel
								defaultSize={showTerminal ? 70 : 100}
								minSize={30}
								className="relative overflow-hidden"
							>
								{showWhiteboard ? (
									<div className="w-full h-full bg-[#1e1e24] overflow-hidden flex flex-col">
										<WhiteboardArea projectId={projectId} />
									</div>
								) : (
									<EditorArea
										openFiles={openFiles}
										activeFile={activeFile}
										onSelectFile={handleSelectFile}
										onCloseFile={handleCloseFile}
										onCloseOthers={handleCloseOthers}
										userId={
											user?._raw.id ? `${user._raw.id}_local` : "anon_local"
										}
										remoteCodeUpdate={remoteCodeUpdate}
										remoteCursorUpdate={remoteCursorUpdate}
										pendingUpdate={pendingUpdate}
										onPendingResolved={() => setPendingUpdate(null)}
										powerModeEnabled={showPowerMode}
										gameOpen={showEditorGame}
										onGameChange={setShowEditorGame}
										initialGameType={editorGameType}
										branchName={currentBranch}
									/>
								)}
							</Panel>

							{showTerminal && (
								<>
									<PanelResizeHandle className="h-1 bg-[#27272a] hover:bg-purple-500/30 transition-colors z-50 cursor-row-resize" />
									<Panel
										defaultSize={30}
										minSize={15}
										className="relative bg-[#09090b] overflow-hidden"
									>
										<TerminalArea projectId={projectId} />
									</Panel>
								</>
							)}
						</PanelGroup>
					</Panel>

					{/* Right Sidebar */}
					{showChat && (
						<>
							<PanelResizeHandle className="w-1 hover:bg-purple-500/30 transition-colors z-50 cursor-col-resize border-l border-[#27272a]" />
							<Panel
								defaultSize={25}
								minSize={20}
								className="flex flex-col bg-[#18181b] relative z-10 shadow-[-5px_0_15px_rgba(0,0,0,0.5)]"
							>
								<VibeChat
									activeFile={activeFile}
									projectId={projectId}
									token={agentToken}
									onPendingUpdate={handlePendingUpdate}
									onFileAction={handleFileAction}
									activePendingUpdate={pendingUpdate}
									onAcceptPending={handleAcceptFromChat}
									onRejectPending={handleRejectFromChat}
								/>
							</Panel>
						</>
					)}
				</PanelGroup>
			</div>

			{/* Token Requirement Prompt */}
			<TokenPromptModal
				tokenPrompt={tokenPrompt}
				onClose={() => setTokenPrompt(null)}
			/>

			<DeploySuccessModal
				deploySuccess={deploySuccess}
				onClose={() => setDeploySuccess(null)}
				showConfetti={showConfetti}
			/>

			{/* Code Roast Modal */}
			{showRoast && activeFile && (
				<CodeRoastModal
					code={activeFile.content || "// No content"}
					fileName={activeFile.path.split("/").pop() || activeFile.path}
					onClose={() => setShowRoast(false)}
				/>
			)}

			{showMatrix && <MatrixRain />}

			{/* Community Help Modal */}
			<CommunityHelpModal
				isOpen={showCommunityHelp}
				onClose={() => setShowCommunityHelp(false)}
				repoUrl={projectRepoUrl ?? `${window.location.origin}/?w=${projectId}`}
			/>

			{/* ── Quick Open (Ctrl+P) ── */}
			<AnimatePresence>
				{showQuickOpen && (
					<motion.div
						key="quick-open-backdrop"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="fixed inset-0 z-[150] bg-black/60 flex items-start justify-center pt-[20vh]"
						onMouseDown={() => setShowQuickOpen(false)}
					>
						<motion.div
							key="quick-open-panel"
							initial={{ y: -12, opacity: 0 }}
							animate={{ y: 0, opacity: 1 }}
							exit={{ y: -12, opacity: 0 }}
							transition={{ duration: 0.15 }}
							className="w-full max-w-[520px] bg-[#18181b] border border-[#3f3f46] rounded-[10px] overflow-hidden shadow-2xl"
							onMouseDown={(e) => e.stopPropagation()}
						>
							<div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#27272a]">
								<Search size={14} className="text-zinc-500 shrink-0" />
								<input
									autoFocus
									value={quickOpenQuery}
									onChange={(e) => setQuickOpenQuery(e.target.value)}
									placeholder="Go to file…"
									className="flex-1 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 outline-none"
								/>
								<kbd className="text-[10px] text-zinc-600 bg-[#111113] border border-[#27272a] rounded px-1 py-0.5">
									Esc
								</kbd>
							</div>
							<div className="max-h-64 overflow-y-auto py-1">
								{files
									.filter(
										(f) =>
											!quickOpenQuery.trim() ||
											f.path
												.toLowerCase()
												.includes(quickOpenQuery.toLowerCase()),
									)
									.slice(0, 20)
									.map((file) => (
										<button
											key={file.path}
											className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[#27272a] transition-colors group"
											onClick={() => {
												handleSelectFile(file);
												setShowQuickOpen(false);
											}}
										>
											<span className="text-[10px] font-bold text-zinc-600 group-hover:text-zinc-400 w-6 text-right shrink-0">
												{file.path
													.split(".")
													.pop()
													?.toUpperCase()
													?.substring(0, 3) || ""}
											</span>
											<span className="text-xs text-zinc-300 truncate flex-1">
												{file.path.split("/").pop()}
											</span>
											<span className="text-[10px] text-zinc-600 truncate max-w-[160px] hidden group-hover:block">
												{file.path.split("/").slice(0, -1).join("/")}
											</span>
										</button>
									))}
								{files.filter(
									(f) =>
										!quickOpenQuery.trim() ||
										f.path.toLowerCase().includes(quickOpenQuery.toLowerCase()),
								).length === 0 && (
									<div className="px-3 py-4 text-xs text-zinc-600 text-center">
										No files match
									</div>
								)}
							</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}

export default function Workspace(props: {
	onBack: () => void;
	projectId: string | null;
}) {
	return (
		<SocketProvider projectId={props.projectId}>
			<WorkspaceInner {...props} />
		</SocketProvider>
	);
}

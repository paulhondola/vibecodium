import FileExplorer from "./FileExplorer";
import ActivityFeed from "./ActivityFeed";
import EditorArea from "./EditorArea";
import TerminalArea from "./TerminalArea";
import VibeChat from "./VibeChat";
import ReelsWidget from "./ReelsWidget";
import CommunityHelpModal from "./CommunityHelpModal";
import RubberDuck from "./RubberDuck";
import WhiteboardArea from "./WhiteboardArea";
import SpotifyPlayer from "./SpotifyPlayer";
import MatrixRain from "./MatrixRain";
import CodeRoastModal from "./CodeRoastModal";
import WorkspaceTopBar from "./WorkspaceTopBar";
import DeploySuccessModal from "./DeploySuccessModal";
import TokenPromptModal from "./TokenPromptModal";
import { API_BASE } from "@/lib/config";
import { Loader2 } from "lucide-react";
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from "react-resizable-panels";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthProvider";
import { SocketProvider, useSocket } from "../contexts/SocketProvider";
import type { PendingUpdate, AgentFileAction } from "../hooks/useAgentStream";

export interface ProjectFile {
	id: string;
	path: string;
	content: string | null;
}

function WorkspaceInner({ onBack, projectId }: { onBack: () => void; projectId: string | null }) {
	const [files, setFiles] = useState<ProjectFile[]>([]);
	const [openFiles, setOpenFiles] = useState<ProjectFile[]>([]);
	const [activeFile, setActiveFile] = useState<ProjectFile | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [projectName, setProjectName] = useState<string | null>(null);
	const [projectRepoUrl, setProjectRepoUrl] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [showCommunityHelp, setShowCommunityHelp] = useState(false);
	const [showReels, setShowReels] = useState(false);
	const [showMatrix, setShowMatrix] = useState(false);
	const [showRoast, setShowRoast] = useState(false);
	const [showPowerMode, setShowPowerMode] = useState(false);
	const [isSaving, setIsSaving] = useState(false);

	// Deployment state
	const [isDeploying, setIsDeploying] = useState(false);
	const [deploySuccess, setDeploySuccess] = useState<{ url: string } | null>(null);
	const [showConfetti, setShowConfetti] = useState(false);
	const [tokenPrompt, setTokenPrompt] = useState<{ type: "GITHUB" | "VERCEL"; message: string } | null>(null);

	// Panel toggles
	const [showSidebar, setShowSidebar] = useState(true);
	const [showTerminal, setShowTerminal] = useState(true);
	const [showChat, setShowChat] = useState(true);
	const [showWhiteboard, setShowWhiteboard] = useState(false);

	// Collab
	const { isConnected, lastMessage, send } = useSocket();
	const [collabUsers, setCollabUsers] = useState<{ id: string; name: string; color: string; isHost?: boolean }[]>([]);
	const [, setMyColor] = useState("#A855F7");
	const [isHost, setIsHost] = useState(false);

	// Remote editor events — set in onmessage, consumed by EditorArea via props
	const [remoteCodeUpdate, setRemoteCodeUpdate] = useState<{ filePath: string; content: string; clientId: string } | null>(null);
	const [remoteCursorUpdate, setRemoteCursorUpdate] = useState<{ filePath: string; clientId: string; color: string; userName: string; position: { lineNumber: number; column: number } } | null>(null);

	// Agent diff state
	const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate | null>(null);
	const [agentToken, setAgentToken] = useState<string | null>(null);

	const { user, getAccessTokenSilently, isAuthenticated, loginWithRedirect } = useAuth();
	const getTokenRef = useRef(getAccessTokenSilently);
	useEffect(() => { getTokenRef.current = getAccessTokenSilently; }, [getAccessTokenSilently]);

	// 1. Fetch project files from API + store token for agent
	useEffect(() => {
		if (!projectId || !isAuthenticated) return;
		setIsLoading(true);
		let cancelled = false;

		getAccessTokenSilently()
			.then(token => {
				if (cancelled) return;
				setAgentToken(token);
				return fetch(`${API_BASE}/api/projects/${projectId}/files`, {
					headers: { Authorization: `Bearer ${token}` },
				});
			})
			.then(res => res?.json())
			.then(data => {
				if (cancelled || !data) return;
				if (data.success) {
					setFiles(data.files || []);
					if (data.files?.length > 0) setActiveFile(data.files[0]);
					if (data.projectName) setProjectName(data.projectName);
					if (data.repoUrl) setProjectRepoUrl(data.repoUrl);
				}
				setIsLoading(false);
			})
			.catch(err => {
				if (cancelled) return;
				console.error("Fetch files error:", err);
				setIsLoading(false);
				if (err?.error === "consent_required" || err?.message?.includes("Consent required")) {
					loginWithRedirect();
				}
			});

		return () => { cancelled = true; };
	}, [projectId, isAuthenticated, getAccessTokenSilently, loginWithRedirect]);

	// 2. Consume parsed WebSocket messages from SocketProvider
	useEffect(() => {
		const data = lastMessage;
		if (!data) return;

		if (data.type === "connected") {
			setMyColor(data.color);
			setCollabUsers(data.users || []);
			setIsHost(!!data.isHost);
		} else if (data.type === "user_joined") {
			setCollabUsers(prev => prev.some(u => u.id === data.user.id) ? prev : [...prev, data.user]);
		} else if (data.type === "user_left") {
			setCollabUsers(prev => prev.filter(u => u.id !== data.clientId));
		} else if (data.type === "code_update") {
			setRemoteCodeUpdate({ filePath: data.filePath, content: data.content, clientId: data.clientId });
		} else if (data.type === "cursor_update") {
			setRemoteCursorUpdate({ filePath: data.filePath, clientId: data.clientId, color: data.color, userName: data.userName, position: data.position });
		} else if (data.type === "agent_accepted") {
			setFiles(prev => prev.map(f =>
				f.path === data.filePath ? { ...f, content: data.content } : f
			));
			setRemoteCodeUpdate({ filePath: data.filePath, content: data.content, clientId: data.appliedBy ?? "agent" });
			setPendingUpdate(null);
		}
		// emoji_reaction: handled directly in ReactionOverlay via lastMessage prop
		// host_changed: no action needed
	}, [lastMessage]);

	// Keyboard shortcuts for panel toggles & Zen mode
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

			if (e.metaKey || e.ctrlKey) {
				if (e.key.toLowerCase() === "e") {
					e.preventDefault();
					setShowSidebar(prev => !prev);
				} else if (e.key.toLowerCase() === "j") {
					e.preventDefault();
					setShowTerminal(prev => !prev);
				} else if (e.key.toLowerCase() === "b") {
					e.preventDefault();
					setShowChat(prev => !prev);
				} else if (e.key.toLowerCase() === "k") {
					e.preventDefault();
					const isZen = !showSidebar && !showTerminal && !showChat;
					setShowSidebar(isZen);
					setShowTerminal(isZen);
					setShowChat(isZen);
				}
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [showSidebar, showTerminal, showChat]);

	const handlePendingUpdate = useCallback((update: PendingUpdate) => {
		setPendingUpdate(update);
	}, []);

	const handleFileAction = useCallback(async (action: AgentFileAction) => {
		if (!projectId || !agentToken) return;

		const base = `${API_BASE}/api/projects/${projectId}`;
		const headers = { "Content-Type": "application/json", Authorization: `Bearer ${agentToken}` };

		if (action.type === "create_file") {
			const res = await fetch(`${base}/files/create`, {
				method: "POST",
				headers,
				body: JSON.stringify({ path: action.filePath, content: action.content ?? "" }),
			});
			if (res.ok) {
				const newFile: ProjectFile = { id: crypto.randomUUID(), path: action.filePath, content: action.content ?? "" };
				setFiles(prev => {
					if (prev.find(f => f.path === action.filePath)) {
						return prev.map(f => f.path === action.filePath ? { ...f, content: action.content ?? "" } : f);
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
				setFiles(prev => prev.filter(f => f.path !== action.filePath && !f.path.startsWith(action.filePath + "/")));
				setOpenFiles(prev => prev.filter(f => f.path !== action.filePath && !f.path.startsWith(action.filePath + "/")));
				setActiveFile(prev => {
					if (!prev) return null;
					if (prev.path === action.filePath || prev.path.startsWith(action.filePath + "/")) return null;
					return prev;
				});
			}
		} else if (action.type === "rename_file" && action.newPath) {
			const res = await fetch(`${base}/files/rename`, {
				method: "PATCH",
				headers,
				body: JSON.stringify({ oldPath: action.filePath, newPath: action.newPath }),
			});
			if (res.ok) {
				setFiles(prev => prev.map(f => {
					if (f.path === action.filePath) return { ...f, path: action.newPath! };
					if (f.path.startsWith(action.filePath + "/")) return { ...f, path: action.newPath! + f.path.slice(action.filePath.length) };
					return f;
				}));
				setOpenFiles(prev => prev.map(f => {
					if (f.path === action.filePath) return { ...f, path: action.newPath! };
					if (f.path.startsWith(action.filePath + "/")) return { ...f, path: action.newPath! + f.path.slice(action.filePath.length) };
					return f;
				}));
				setActiveFile(prev => {
					if (!prev) return null;
					if (prev.path === action.filePath) return { ...prev, path: action.newPath! };
					if (prev.path.startsWith(action.filePath + "/")) return { ...prev, path: action.newPath! + prev.path.slice(action.filePath.length) };
					return prev;
				});
			}
		}
	}, [projectId, agentToken]);

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

	const handleSelectFile = (file: ProjectFile) => {
		setOpenFiles(prev => {
			if (!prev.find(f => f.path === file.path)) {
				return [...prev, file];
			}
			return prev;
		});
		setActiveFile(file);
	};

	const handleCloseFile = (file: ProjectFile, e?: React.MouseEvent) => {
		if (e) e.stopPropagation();

		if (activeFile?.path === file.path) {
			const closedIndex = openFiles.findIndex(f => f.path === file.path);
			const nextOpenFiles = openFiles.filter(f => f.path !== file.path);

			if (nextOpenFiles.length === 0) {
				setActiveFile(null);
			} else {
				const defaultIndex = Math.max(0, closedIndex - 1);
				setActiveFile(nextOpenFiles[defaultIndex]);
			}
		}

		setOpenFiles(prev => prev.filter(f => f.path !== file.path));
	};

	if (isLoading) {
		return (
			<div className="h-screen w-full bg-[#09090b] flex flex-col items-center justify-center text-cyan-400 gap-4">
				<Loader2 size={32} className="animate-spin text-[#A855F7]" />
				<span className="text-sm font-['Space_Grotesk'] tracking-[0.2em] uppercase">Parsing Repository Data...</span>
			</div>
		);
	}

	return (
		<div className="h-screen w-full bg-[#09090b] text-[#c9d1d9] font-sans flex flex-col overflow-hidden selection:bg-cyan-500/30">
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
				isSaving={isSaving}
				collabUsers={collabUsers}
				copied={copied}
				onBack={onBack}
				onDeploy={handleDeploy}
				onSave={handleSave}
				onCopyCollabLink={copyCollabLink}
				onShowCommunityHelp={() => setShowCommunityHelp(true)}
				activeFile={activeFile}
				send={send}
				user={user}
				lastMessage={lastMessage}
				showPowerMode={showPowerMode}
				setShowPowerMode={setShowPowerMode}
				showMatrix={showMatrix}
				setShowMatrix={setShowMatrix}
				onShowReels={() => setShowReels(true)}
				onShowRoast={() => setShowRoast(true)}
			/>

			<div className="flex-1 flex overflow-hidden">
				<PanelGroup orientation="horizontal" className="w-full h-full">
					{showSidebar && (
						<>
							<Panel defaultSize={20} minSize={15} className="flex flex-col bg-[#09090b] relative z-10 border-r border-[#27272a]">
								<PanelGroup orientation="vertical" className="h-full">
									<Panel defaultSize={70} minSize={20} className="overflow-y-auto">
										<FileExplorer
											files={files}
											activeFile={activeFile}
											onSelect={handleSelectFile}
											projectId={projectId}
											token={agentToken}
											onFilesChange={setFiles}
										/>
									</Panel>
									<PanelResizeHandle className="h-1 bg-[#27272a] hover:bg-cyan-500/50 transition-colors cursor-row-resize" />
									<Panel defaultSize={30} minSize={10} className="overflow-y-auto border-t border-[#27272a] shadow-[0_-5px_15px_rgba(0,0,0,0.5)]">
										<ActivityFeed projectId={projectId} />
									</Panel>
								</PanelGroup>
							</Panel>
							<PanelResizeHandle className="w-1 hover:bg-cyan-500/50 transition-colors z-50 cursor-col-resize" />
						</>
					)}

					<Panel defaultSize={55} className="flex flex-col min-w-0 bg-[#09090b] relative">
						<PanelGroup orientation="vertical" className="w-full h-full">
							<Panel defaultSize={showTerminal ? 70 : 100} minSize={30} className="relative overflow-hidden">
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
										userId={user?._raw.id ? `${user._raw.id}_local` : "anon_local"}
										remoteCodeUpdate={remoteCodeUpdate}
										remoteCursorUpdate={remoteCursorUpdate}
										pendingUpdate={pendingUpdate}
										onPendingResolved={() => setPendingUpdate(null)}
										projectId={projectId}
										agentToken={agentToken}
										powerModeEnabled={showPowerMode}
									/>
								)}
							</Panel>

							{showTerminal && (
								<>
									<PanelResizeHandle className="h-1 bg-[#27272a] hover:bg-cyan-500/50 transition-colors z-50 cursor-row-resize" />
									<Panel defaultSize={30} minSize={15} className="relative bg-[#09090b] overflow-hidden">
										<TerminalArea projectId={projectId} />
									</Panel>
								</>
							)}
						</PanelGroup>
					</Panel>

					{showChat && (
						<>
							<PanelResizeHandle className="w-1 hover:bg-cyan-500/50 transition-colors z-50 cursor-col-resize border-l border-[#27272a]" />
							<Panel defaultSize={25} minSize={20} className="flex flex-col bg-[#18181b] relative z-10 shadow-[-5px_0_15px_rgba(0,0,0,0.5)]">
								<VibeChat
									activeFile={activeFile}
									projectId={projectId}
									token={agentToken}
									onPendingUpdate={handlePendingUpdate}
									onFileAction={handleFileAction}
								/>
							</Panel>
						</>
					)}
				</PanelGroup>
			</div>

			<RubberDuck />

			<TokenPromptModal tokenPrompt={tokenPrompt} onClose={() => setTokenPrompt(null)} />

			<DeploySuccessModal
				deploySuccess={deploySuccess}
				onClose={() => setDeploySuccess(null)}
				showConfetti={showConfetti}
			/>

			{showReels && (
				<ReelsWidget
					onClose={() => setShowReels(false)}
					onMinimize={() => setShowReels(false)}
					isAgentLoading={isLoading}
				/>
			)}

			{showRoast && activeFile && (
				<CodeRoastModal
					code={activeFile.content || "// No content"}
					fileName={activeFile.path.split("/").pop() || activeFile.path}
					onClose={() => setShowRoast(false)}
				/>
			)}

			{showMatrix && <MatrixRain />}

			<SpotifyPlayer />

			<CommunityHelpModal
				isOpen={showCommunityHelp}
				onClose={() => setShowCommunityHelp(false)}
				repoUrl={projectRepoUrl ?? `${window.location.origin}/?w=${projectId}`}
			/>
		</div>
	);
}

export default function Workspace(props: { onBack: () => void; projectId: string | null }) {
	return (
		<SocketProvider projectId={props.projectId}>
			<WorkspaceInner {...props} />
		</SocketProvider>
	);
}

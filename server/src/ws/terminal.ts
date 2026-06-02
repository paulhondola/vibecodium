import type Docker from "dockerode";
import { docker } from "../utils/docker";
import { syncProjectFilesToDisk } from "../utils/sync";
import { supabase } from "../db/supabase";
import * as nodePath from "node:path";

// ──────────────────────────────────────────
// Docker Terminal Engine
// ──────────────────────────────────────────

/** Extension → Docker image mapping (uses local custom images) */
const EXT_TO_IMAGE: Record<string, string> = {
	".py": "vibecodium-python:latest",
	".rs": "vibecodium-rust:latest",
	".cpp": "vibecodium-cpp:latest",
	".cc": "vibecodium-cpp:latest",
	".c": "vibecodium-cpp:latest",
	".go": "vibecodium-go:latest",
};

export function detectTerminalImage(filePaths: string[]): string {
	for (const fp of filePaths) {
		const ext = nodePath.extname(fp).toLowerCase();
		if (EXT_TO_IMAGE[ext]) return EXT_TO_IMAGE[ext]!;
	}
	return "vibecodium-node:latest"; // default for JS/TS projects
}

/** Per-room state for the collaborative Docker terminal */
export interface TerminalRoom {
	container: Docker.Container;
	proc: ReturnType<typeof Bun.spawn>;
	sink: import("bun").FileSink; // typed stdin pipe
}

export interface WSData {
	projectId: string;
	clientId: string;
	userName: string;
	isHost: boolean;
	color: string;
	type: "collab" | "terminal" | "match";
}

export const termClients = new Map<string, Set<import("bun").ServerWebSocket<WSData>>>();
export const termRooms = new Map<string, TerminalRoom>();
const termLineBuffers = new Map<string, string>(); // per-room line edit buffer

export function broadcastToTerminal(roomId: string, message: string) {
	termClients.get(roomId)?.forEach(c => { try { c.send(message); } catch (_) { } });
}

export async function stopTerminal(roomId: string): Promise<void> {
	const room = termRooms.get(roomId);
	const clients = termClients.get(roomId);
	termRooms.delete(roomId);
	termClients.delete(roomId);
	termLineBuffers.delete(roomId);

	clients?.forEach(c => {
		try { c.send("\r\n\x1b[33m[Container stopped]\x1b[0m\r\n"); } catch (_) { }
	});

	if (room) {
		try { room.proc?.kill(); } catch (_) { }
		try { await room.container.stop({ t: 5 }); } catch (_) { }
		try { await room.container.remove(); } catch (_) { }
		console.log(`[Terminal] Cleaned up container for room ${roomId}`);
	}
}

// ──────────────────────────────────────────
// WebSocket Handlers
// ──────────────────────────────────────────

export function handleTerminalOpen(ws: import("bun").ServerWebSocket<WSData>) {
	const data = ws.data;
	ws.subscribe(`term_${data.projectId}`);
	const roomId = data.projectId;

	// Register client
	if (!termClients.has(roomId)) termClients.set(roomId, new Set());
	termClients.get(roomId)!.add(ws);

	// If room already running, just attach to the broadcast stream
	if (termRooms.has(roomId)) {
		ws.send("\x1b[90m[Joined existing terminal session]\x1b[0m\r\n");
		return;
	}

	// ── First client: bootstrap Docker container ──
	(async () => {
		const broadcastToRoom = (msg: string) =>
			termClients.get(roomId)?.forEach(c => { try { c.send(msg); } catch (_) { } });

		let container: Docker.Container | null = null;
		try {
			broadcastToRoom("\x1b[1;36m[VibeCodium]\x1b[0m Syncing project files...\r\n");
			const hostDir = await syncProjectFilesToDisk(roomId);

			// Load file list for language detection
			const { data: projectFiles } = await supabase
				.from("files")
				.select("path, content")
				.eq("project_id", roomId);


			// Pick image from file extensions
			const image = detectTerminalImage((projectFiles ?? []).map(f => f.path));
			broadcastToRoom(`\x1b[90mImage: ${image}  |  ${hostDir} → /usr/src/app\x1b[0m\r\n`);

			// Pull image (instant if already cached)
			// NOTE: docker.modem.followProgress hangs in Bun — drain raw stream events instead
			if (!image.startsWith("vibecodium-")) {
				broadcastToRoom("\x1b[90mPulling image...\x1b[0m\r\n");
				await new Promise<void>((res, rej) => {
					docker.pull(image, (err: Error | null, pullStream: any) => {
						if (err) return rej(err);
						pullStream.on("data", () => { }); // drain
						pullStream.on("end", res);
						pullStream.on("error", rej);
					});
				});
			}

			// Create container — sleep infinity as PID 1 (keeps it alive for docker exec)
			// NOTE: container.attach({hijack:true}) hangs in Bun — use Bun.spawn docker exec instead
			container = await docker.createContainer({
				Image: image,
				Cmd: ["sleep", "infinity"],
				Tty: false,
				WorkingDir: "/usr/src/app",
				HostConfig: {
					Memory: 2048 * 1024 * 1024,
					MemorySwap: 2048 * 1024 * 1024,
					CpuQuota: 50000,
					CpuPeriod: 100000,
					PidsLimit: 50,
					Binds: [`${hostDir}:/usr/src/app`],
					AutoRemove: false,
				},
			});
			await container.start();

			// Spawn interactive shell via docker exec (Bun-compatible approach)
			const proc = Bun.spawn(
				["docker", "exec", "-i", container.id, "/bin/sh", "-i"],
				{ stdin: "pipe", stdout: "pipe", stderr: "pipe" }
			);

			const sink = proc.stdin as import("bun").FileSink;
			termRooms.set(roomId, { container, proc, sink });

			// Pipe stdout → clients (normalize bare LF → CRLF for xterm)
			(async () => {
				const reader = proc.stdout.getReader();
				const dec = new TextDecoder();
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					broadcastToRoom(dec.decode(value).replace(/\r?\n/g, "\r\n"));
				}
				broadcastToRoom("\r\n\x1b[33m[Shell exited]\x1b[0m\r\n");
				stopTerminal(roomId);
			})();

			// Pipe stderr → clients
			(async () => {
				const reader = proc.stderr.getReader();
				const dec = new TextDecoder();
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					broadcastToRoom(dec.decode(value).replace(/\r?\n/g, "\r\n"));
				}
			})();

			broadcastToRoom("\x1b[1;32m[Ready]\x1b[0m Sandbox started. Working dir: \x1b[33m/usr/src/app\x1b[0m\r\n\r\n");

		} catch (e: any) {
			// Cleanup partially-created container on error
			if (container) {
				try { await container.stop({ t: 0 }); } catch (_) { }
				try { await container.remove(); } catch (_) { }
			}
			termClients.get(roomId)?.forEach(c => {
				try { c.send(`\x1b[1;31m[Error]\x1b[0m ${e.message}\r\n`); } catch (_) { }
				c.close(1011, e.message);
			});
			console.error("[Terminal] Container start failed:", e.message);
		}
	})();
}

export function handleTerminalMessage(ws: import("bun").ServerWebSocket<WSData>, message: string) {
	const room = termRooms.get(ws.data.projectId);
	if (!room) return;

	// JSON control messages
	try {
		const msg = JSON.parse(message);
		if (msg.type === "resize") {
			// No PTY — resize is a no-op; ignore silently
			return;
		}
		if (msg.type === "stop") {
			stopTerminal(ws.data.projectId);
			return;
		}
	} catch { /* not JSON — treat as raw stdin */ }

	// Server-side line buffering (no PTY = no kernel line discipline)
	// We echo characters locally and only flush the line to the shell on Enter.
	const broadcastAll = (msg: string) =>
		termClients.get(ws.data.projectId)?.forEach(c => { try { c.send(msg); } catch (_) { } });

	const roomId = ws.data.projectId;

	if (message === "\r" || message === "\n") {
		// Enter — flush buffered line to shell
		const line = (termLineBuffers.get(roomId) ?? "") + "\n";
		termLineBuffers.set(roomId, "");
		broadcastAll("\r\n");
		try { room.sink.write(line); } catch (_) { }
	} else if (message === "\x7f" || message === "\b") {
		// Backspace — pop last char from buffer, erase on screen
		const buf = termLineBuffers.get(roomId) ?? "";
		if (buf.length > 0) {
			termLineBuffers.set(roomId, buf.slice(0, -1));
			broadcastAll("\b \b");
		}
	} else if (message.startsWith("\x1b")) {
		// Escape sequences (arrow keys, etc.) — forward directly, don't buffer
		try { room.sink.write(message); } catch (_) { }
	} else if (message.length === 1 && message.charCodeAt(0) < 32) {
		// Other control chars (Ctrl+C, Ctrl+D, etc.) — forward directly
		try { room.sink.write(message); } catch (_) { }
	} else {
		// Printable chars — append to buffer and echo
		const buf = termLineBuffers.get(roomId) ?? "";
		termLineBuffers.set(roomId, buf + message);
		broadcastAll(message);
	}
}

export function handleTerminalClose(ws: import("bun").ServerWebSocket<WSData>) {
	ws.unsubscribe(`term_${ws.data.projectId}`);
	const roomId = ws.data.projectId;
	const clients = termClients.get(roomId);
	if (clients) {
		clients.delete(ws);
		// Stop container when the last client disconnects
		if (clients.size === 0) stopTerminal(roomId);
	}
}

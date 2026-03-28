import { Hono } from "hono";
import { cors } from "hono/cors";
import Docker from "dockerode";
import { Writable } from "stream";
import type { ApiResponse, ExecuteRequest, ExecuteResponse } from "shared";
import gitRoutes from "./routes/git";
import projectsRoutes from "./routes/projects";
import sessionsRoutes from "./routes/sessions";

const LLM_BASE_URL = process.env.LLM_BASE_URL ?? "https://api.groq.com/openai/v1";
const LLM_API_KEY = process.env.LLM_API_KEY ?? "";
const LLM_MODEL = process.env.LLM_MODEL ?? "llama-3.3-70b-versatile";

const LOCAL_BASE_URL = "http://localhost:1234/v1";
const LOCAL_MODEL = process.env.LOCAL_MODEL ?? "qwen2.5-coder-32b-instruct";
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const GROQ_API_KEY = process.env.GROQ_API_KEY ?? process.env.LLM_API_KEY ?? "";
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

async function pingProvider(baseURL: string, apiKey: string, model: string) {
	const res = await fetch(`${baseURL}/chat/completions`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model,
			messages: [{ role: "user", content: "Reply with exactly: pong" }],
			max_tokens: 10,
		}),
		signal: AbortSignal.timeout(8_000),
	});

	if (!res.ok) throw new Error(await res.text());

	const data = await res.json() as { choices: { message: { content: string } }[] };
	return data.choices[0]?.message?.content?.trim();
}

const docker = new Docker();

const LANGUAGE_IMAGES: Record<string, string> = {
	python: "python:3.10-alpine",
	node: "node:20-alpine",
	"c++": "gcc:10.2.0",
	rust: "rust:1.68.2-alpine"
};

const EXEC_COMMANDS: Record<string, () => string[]> = {
	python: () => ["python", "-c", "import os\nexec(os.environ.get('USER_CODE', ''))"],
	node: () => ["node", "-e", "eval(process.env.USER_CODE)"],
	"c++": () => ["sh", "-c", "printenv USER_CODE > main.cpp && g++ main.cpp && ./a.out"],
	rust: () => ["sh", "-c", "printenv USER_CODE > main.rs && rustc main.rs && ./main"] 
};

export const app = new Hono()
	.use(cors({
		origin: (origin) => origin ?? "http://localhost:5173",
		allowHeaders: ["Content-Type", "Authorization"],
		allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
		credentials: true,
	}))
	.route("/api/git", gitRoutes)
	.route("/api/projects", projectsRoutes)
	.route("/api/sessions", sessionsRoutes)
	.get("/", c => c.text("Hello Hono!"))
	.get("/hello", async (c) => c.json({ message: "Hello BHVR!", success: true }, 200))
    .get("/api/ping-llm", async (c) => {
        if (!LLM_API_KEY) return c.json({ success: false, error: "LLM_API_KEY is not set" }, 500);
        const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${LLM_API_KEY}` },
            body: JSON.stringify({ model: LLM_MODEL, messages: [{ role: "user", content: "Reply with exactly: pong" }], max_tokens: 10 }),
            signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) {
            const error = await res.text();
            return c.json({ success: false, error }, res.status as any);
        }
        const data = await res.json() as { choices: { message: { content: string } }[] };
        return c.json({ success: true, model: LLM_MODEL, reply: data.choices[0]?.message?.content?.trim() });
    })
    .get("/api/ping-llm/auto", async (c) => {
        try {
            const reply = await pingProvider(LOCAL_BASE_URL, "lm-studio", LOCAL_MODEL);
            return c.json({ success: true, provider: "local", model: LOCAL_MODEL, reply });
        } catch (localErr) {
            if (!GROQ_API_KEY) return c.json({ success: false, error: "Local LM Studio unreachable and GROQ_API_KEY is not set" }, 503);
            try {
                const reply = await pingProvider(GROQ_BASE_URL, GROQ_API_KEY, GROQ_MODEL);
                return c.json({ success: true, provider: "groq", model: GROQ_MODEL, reply });
            } catch (remoteErr) {
                return c.json({ success: false, error: "Both providers failed", local: String(localErr), groq: String(remoteErr) }, 503);
            }
        }
    })
    .post("/execute", async (c) => {
        // [Docker Execute Code Redacted for brevity but identical]
        try {
            const body = await c.req.json<ExecuteRequest>();
            if (!body.language || !body.version || !body.code) return c.json<ExecuteResponse>({ success: false, stdout: "", stderr: "", error: "Missing language, version, or code." }, 400);
            
            const imageName = LANGUAGE_IMAGES[body.language];
            const getCmd = EXEC_COMMANDS[body.language];
            if (!imageName || !getCmd) return c.json<ExecuteResponse>({ success: false, stdout: "", stderr: "", error: `Unsupported language: ${body.language}` }, 400);

            const container = await docker.createContainer({
                Image: imageName, Cmd: getCmd(), Env: [`USER_CODE=${body.code}`],
                HostConfig: { Memory: 256 * 1024 * 1024, NetworkMode: "none" }, Tty: false
            });

            try {
                const stream = await container.attach({ stream: true, stdout: true, stderr: true });
                let stdoutData = ""; let stderrData = "";
                container.modem.demuxStream(stream, new Writable({ write(c, e, n) { stdoutData += c.toString(); n(); } }), new Writable({ write(c, e, n) { stderrData += c.toString(); n(); } }));
                await container.start();

                const waitPromise = container.wait();
                let timeoutTrigged = false;
                const timeoutPromise = new Promise<{ StatusCode: number }>((resolve) => setTimeout(() => { timeoutTrigged = true; resolve({ StatusCode: 137 }); }, 3000));
                
                const waitResult = await Promise.race([waitPromise, timeoutPromise]);
                if (timeoutTrigged) {
                    await container.kill().catch(() => {});
                    return c.json<ExecuteResponse>({ success: false, stdout: stdoutData, stderr: stderrData, error: "Execution Timeout: Killed." });
                }
                return c.json<ExecuteResponse>({ success: waitResult.StatusCode === 0, stdout: stdoutData, stderr: stderrData, compileOutput: "" });
            } finally {
                await container.remove({ force: true }).catch(() => {});
            }
        } catch (err: any) {
            console.error(err);
            if (err.statusCode === 404) return c.json<ExecuteResponse>({ success: false, stdout: "", stderr: "", error: "Docker image missing!" }, 500);
            return c.json<ExecuteResponse>({ success: false, stdout: "", stderr: "", error: "Internal Error executing code." }, 500);
        }
    });

// ──────────────────────────────────────────
// Bun.serve Engine
// ──────────────────────────────────────────
const COLORS = ["#A855F7", "#3B82F6", "#10B981", "#F59E0B", "#EC4899", "#EF4444", "#14B8A6", "#F97316"];

interface WSData {
    projectId: string;
    clientId: string;
    userName: string;
    isHost: boolean;
    color: string;
    type: "collab" | "terminal";
    termProc?: ReturnType<typeof import("bun").spawn>;
}

// Room tracking for host resolution
const roomHosts = new Map<string, string>(); // projectId -> hostClientId
const activeClients = new Map<string, WSData>(); // clientId -> WSData

export default {
	port: process.env.PORT || 3000,
	
    // Manual routing wrapper around Hono to sniff WS connections instantly
	async fetch(req: Request, server: import("bun").Server<WSData>) {
        const url = new URL(req.url);

        // Terminals
        if (url.pathname === "/ws/terminal") {
            const roomId = url.searchParams.get("roomId") || "default";
            // Spawn shell instantly
            const shells = [process.env.SHELL, "/bin/zsh", "/bin/bash", "/bin/sh"].filter(Boolean) as string[];
            let proc: ReturnType<typeof import("bun").spawn> | null = null;
            for (const shell of shells) {
                try {
                    proc = Bun.spawn([shell, "-i"], { stdin: "pipe", stdout: "pipe", stderr: "pipe", env: { ...process.env, TERM: "xterm-256color" }, cwd: process.cwd(), });
                    break;
                } catch {}
            }
            if (proc && server.upgrade(req, { data: { type: "terminal", projectId: roomId, clientId: crypto.randomUUID(), userName: "terminal", termProc: proc, color: "", isHost: false } })) {
                return; 
            }
            return new Response("Upgrade failed", { status: 500 });
        }

        // Collaboration
        if (url.pathname.startsWith("/ws/collab/")) {
            const projectId = url.pathname.split("/").pop();
            const clientId = url.searchParams.get("userId") || "anon";
            const userName = url.searchParams.get("userName") || "Anonymous";

            if (!projectId) return new Response("Bad Request", { status: 400 });

            if (server.upgrade(req, {
                data: { type: "collab", projectId, clientId, userName, isHost: false, color: "" }
            })) {
                return;
            }
            return new Response("Upgrade failed", { status: 500 });
        }

        // Standard Hono API
        return app.fetch(req, server);
	},

    // Raw Bun WS Interface
	websocket: {
        open(ws: import("bun").ServerWebSocket<WSData>) {
            const data = ws.data;
            if (data.type === "terminal") {
                ws.subscribe(`term_${data.projectId}`);
                // Pipe terminal output to websocket manually using async loops:
                (async () => {
                    const proc = data.termProc!;
                    try { for await (const chunk of proc.stdout as AsyncIterable<Uint8Array>) { ws.send(new TextDecoder().decode(chunk)); } } catch {}
                })();
                (async () => {
                    const proc = data.termProc!;
                    try { for await (const chunk of proc.stderr as AsyncIterable<Uint8Array>) { ws.send(new TextDecoder().decode(chunk)); } } catch {}
                })();
                return;
            }

            // Collab handling
            ws.subscribe(data.projectId);
            activeClients.set(data.clientId, data);

            // Host Assignment Logic
            if (!roomHosts.has(data.projectId)) {
                roomHosts.set(data.projectId, data.clientId);
                data.isHost = true;
            } else {
                data.isHost = (roomHosts.get(data.projectId) === data.clientId);
            }
            data.color = COLORS[activeClients.size % COLORS.length]!;

            // Send standard connect ACK
            ws.send(JSON.stringify({
                type: "connected",
                clientId: data.clientId,
                color: data.color,
                isHost: data.isHost,
                hostId: roomHosts.get(data.projectId),
                users: Array.from(activeClients.values()).filter(c => c.projectId === data.projectId).map(c => ({
                    id: c.clientId, name: c.userName, color: c.color, isHost: c.isHost
                }))
            }));

            // Tell others
            ws.publish(data.projectId, JSON.stringify({
                type: "user_joined",
                user: { id: data.clientId, name: data.userName, color: data.color, isHost: data.isHost }
            }));
            
            console.log(`[WS] ${data.userName} joined ${data.projectId} (Host: ${data.isHost})`);
        },

        message(ws: import("bun").ServerWebSocket<WSData>, message: string) {
            if (ws.data.type === "terminal") {
                const sink = ws.data.termProc!.stdin as import("bun").FileSink;
                sink.write(message);
                sink.flush();
                return;
            }

            try {
                const payload = JSON.parse(message);
                const data = ws.data;

                // Host Permission Overrides
                if (payload.type === "JOIN_REQUEST") {
                    console.log(`[WS] Client ${data.clientId} requesting join to ${data.projectId}`);
                    ws.publish(data.projectId, JSON.stringify({ ...payload, fromClient: data.clientId }));
                    return;
                }
                if (payload.type === "JOIN_RESPONSE") {
                    if (data.isHost) {
                        ws.publish(data.projectId, JSON.stringify(payload)); // Send approval
                    }
                    return;
                }

                // Standard pub/sub forward
                if (payload.type === "code_change" || payload.type === "cursor_move" || payload.type === "file_focus") {
                    // Normalize standard schema implicitly replacing "data.type" to "_update" pattern exactly as UI expects
                    const outType = payload.type === "code_change" ? "code_update" : payload.type === "cursor_move" ? "cursor_update" : "file_focus_update";
                    const outbound = {
                        type: outType,
                        clientId: data.clientId,
                        userName: data.userName,
                        color: data.color,
                        ...payload
                    };
                    delete outbound.type; // strip generic type
                    outbound.type = outType; 
                    
                    ws.publish(data.projectId, JSON.stringify(outbound));
                }

            } catch (err) {
                console.error("[WS] JSON Parse Error or Unhandled Message:", err);
            }
        },

        close(ws: import("bun").ServerWebSocket<WSData>) {
            if (ws.data.type === "terminal") {
                ws.unsubscribe(`term_${ws.data.projectId}`);
                try { ws.data.termProc!.kill(); } catch {}
                return;
            }

            const data = ws.data;
            ws.unsubscribe(data.projectId);
            activeClients.delete(data.clientId);

            ws.publish(data.projectId, JSON.stringify({
                type: "user_left",
                clientId: data.clientId
            }));

            if (data.isHost) {
                // Determine new host if old host left
                const remaining = Array.from(activeClients.values()).filter(c => c.projectId === data.projectId);
                if (remaining.length > 0) {
                    const newHost = remaining[0];
                    if (newHost) {
                        newHost.isHost = true;
                        roomHosts.set(data.projectId, newHost.clientId);
                        // Broadcast host change
                        ws.publish(data.projectId, JSON.stringify({ type: "host_changed", defaultApproved: true, hostId: newHost.clientId }));
                    }
                } else {
                    roomHosts.delete(data.projectId);
                }
            }
            console.log(`[WS] ${data.userName} left ${data.projectId}`);
        }
    }
};
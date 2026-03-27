import { Hono } from "hono";
import { cors } from "hono/cors";
import Docker from "dockerode";
import { Writable } from "stream";
import type { ApiResponse, ExecuteRequest, ExecuteResponse } from "shared";
import gitRoutes from "./routes/git";
import projectsRoutes from "./routes/projects";
import { attachCollaborationWS } from "./ws/collaboration";

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
	.use(cors())
	.route("/api/git", gitRoutes)
	.route("/api/projects", projectsRoutes)
	.get("/", (c) => {
	return c.text("Hello Hono!");
})

.get("/hello", async (c) => {
	const data: ApiResponse = {
		message: "Hello BHVR!",
		success: true,
	};

	return c.json(data, { status: 200 });
})

.get("/api/ping-llm", async (c) => {
	if (!LLM_API_KEY) {
		return c.json({ success: false, error: "LLM_API_KEY is not set" }, 500);
	}

	const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${LLM_API_KEY}`,
		},
		body: JSON.stringify({
			model: LLM_MODEL,
			messages: [{ role: "user", content: "Reply with exactly: pong" }],
			max_tokens: 10,
		}),
		signal: AbortSignal.timeout(15_000),
	});

	if (!res.ok) {
		const error = await res.text();
		return c.json({ success: false, error }, res.status as 400 | 401 | 403 | 429 | 500 | 503);
	}

	const data = await res.json() as { choices: { message: { content: string } }[] };
	const reply = data.choices[0]?.message?.content?.trim();

	return c.json({ success: true, model: LLM_MODEL, reply });
})

.get("/api/ping-llm/auto", async (c) => {
	// Try local LM Studio first, fall back to Groq
	try {
		const reply = await pingProvider(LOCAL_BASE_URL, "lm-studio", LOCAL_MODEL);
		return c.json({ success: true, provider: "local", model: LOCAL_MODEL, reply });
	} catch (localErr) {
		if (!GROQ_API_KEY) {
			return c.json({ success: false, error: "Local LM Studio unreachable and GROQ_API_KEY is not set" }, 503);
		}
		try {
			const reply = await pingProvider(GROQ_BASE_URL, GROQ_API_KEY, GROQ_MODEL);
			return c.json({ success: true, provider: "groq", model: GROQ_MODEL, reply });
		} catch (remoteErr) {
			return c.json({
				success: false,
				error: "Both providers failed",
				local: String(localErr),
				groq: String(remoteErr),
			}, 503);
		}
	}
})

.post("/execute", async (c) => {
	try {
		const body = await c.req.json<ExecuteRequest>();
		
		if (!body.language || !body.version || !body.code) {
			return c.json<ExecuteResponse>({ 
				success: false, 
				stdout: "", 
				stderr: "", 
				error: "Missing language, version, or code in request." 
			}, 400);
		}

		const imageName = LANGUAGE_IMAGES[body.language];
		const getCmd = EXEC_COMMANDS[body.language];

		if (!imageName || !getCmd) {
			return c.json<ExecuteResponse>({
				success: false,
				stdout: "",
				stderr: "",
				error: `Unsupported language mapping for: ${body.language}`
			}, 400);
		}

		const container = await docker.createContainer({
			Image: imageName,
			Cmd: getCmd(),
			Env: [`USER_CODE=${body.code}`],
			HostConfig: {
				Memory: 256 * 1024 * 1024,
				NetworkMode: "none",
			},
			Tty: false
		});

		try {
			const stream = await container.attach({ stream: true, stdout: true, stderr: true });

			let stdoutData = "";
			let stderrData = "";

			const stdoutStream = new Writable({
				write(chunk, enc, next) {
					stdoutData += chunk.toString();
					next();
				}
			});

			const stderrStream = new Writable({
				write(chunk, enc, next) {
					stderrData += chunk.toString();
					next();
				}
			});

			container.modem.demuxStream(stream, stdoutStream, stderrStream);

			await container.start();

			// Race between actual wait and our 3000ms timeout logic
			const waitPromise = container.wait();
			let timeoutTrigged = false;
			const timeoutPromise = new Promise<{ StatusCode: number }>((resolve) => 
				setTimeout(() => {
					timeoutTrigged = true;
					resolve({ StatusCode: 137 }); // Killed
				}, 3000)
			);
			
			const waitResult = await Promise.race([waitPromise, timeoutPromise]);
			
			if (timeoutTrigged) {
				await container.kill().catch(() => {});
				return c.json<ExecuteResponse>({
					success: false,
					stdout: stdoutData,
					stderr: stderrData,
					error: "Execution Timeout: Code ran longer than 3 seconds. Preemptively killed."
				});
			}

			return c.json<ExecuteResponse>({
				success: waitResult.StatusCode === 0,
				stdout: stdoutData,
				stderr: stderrData,
				compileOutput: ""
			});

		} finally {
			// Wipe container
			await container.remove({ force: true }).catch(() => {});
		}

	} catch (err: any) {
		console.error("Execute error:", err);
		if (err.statusCode === 404) {
			return c.json<ExecuteResponse>({
				success: false,
				stdout: "",
				stderr: "",
				error: "Docker image missing! Please run `docker pull python:3.10-alpine` (or requested language) on the host machine first.",
			}, 500);
		}
		
		return c.json<ExecuteResponse>({
			success: false,
			stdout: "",
			stderr: "",
			error: "Internal Server Error executing code directly via Docker",
		}, 500);
	}
});

const websocket = attachCollaborationWS(app);

export default {
    port: process.env.PORT || 3000,
    fetch: app.fetch,
    websocket,
};
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { ApiResponse } from "shared";
import gitRoutes from "./routes/git";
import projectsRoutes from "./routes/projects";

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
});

export default app;
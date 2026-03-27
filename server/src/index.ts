import { Hono } from "hono";
import { cors } from "hono/cors";
import type { ApiResponse } from "shared";
import gitRoutes from "./routes/git";
import projectsRoutes from "./routes/projects";

const LLM_BASE_URL = process.env.LLM_BASE_URL ?? "https://openrouter.ai/api/v1";
const LLM_API_KEY = process.env.LLM_API_KEY ?? "";
const LLM_MODEL = process.env.LLM_MODEL ?? "mistralai/devstral-2512:free";

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
});

export default app;
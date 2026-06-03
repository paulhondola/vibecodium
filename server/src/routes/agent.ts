import { Hono } from "hono";
import { authMiddleware } from "../middleware/authMiddleware";
import { getUserTokens } from "../utils/tokens";

type Variables = { user: { sub: string; [key: string]: any } };
const agentRoutes = new Hono<{ Variables: Variables }>();

agentRoutes.use("/*", async (c, next) => {
	if (c.req.method === "OPTIONS") return next();
	return authMiddleware(c, next);
});

const SERVER_LLM_BASE_URL =
	process.env.LLM_BASE_URL ?? "https://api.deepseek.com/v1";
const SERVER_LLM_KEY = process.env.LLM_KEY ?? "";
const SERVER_LLM_MODEL = process.env.LLM_MODEL ?? "deepseek-chat";

const SYSTEM_PROMPT = `You are a surgical coding agent inside VibeCodium, a collaborative IDE.
The user will share a file and an instruction. Your task: suggest the MINIMAL change needed.

You have four action types. Use ONLY what the instruction requires.

━━━ ACTION 1: Edit existing code ━━━
<suggested_change file="FILENAME">
<original>
ONLY the exact lines being changed — copy VERBATIM from the file, minimum lines needed.
NEVER include the whole file. NEVER include unchanged lines.
</original>
<suggested>
The replacement lines only.
</suggested>
</suggested_change>

━━━ ACTION 2: Create a new file ━━━
<create_file file="PATH/TO/FILENAME">
Full content of the new file goes here.
</create_file>

━━━ ACTION 3: Delete a file or folder ━━━
<delete_file file="PATH/TO/FILENAME" />

━━━ ACTION 4: Rename/move a file or folder ━━━
<rename_file from="OLD/PATH" to="NEW/PATH" />

RULES:
- Start with one sentence explaining what you will do.
- Use NO markdown fences around any XML block.
- For suggested_change: <original> must match the file character-for-character (indentation, spacing).
- For suggested_change: use the SMALLEST contiguous block that covers the change.
- You may emit multiple action blocks of any type in one response.
- End with one sentence confirming what was done.
- If no change is needed, reply conversationally without XML.`;

const LLM_PROVIDERS: Record<string, { baseUrl: string; defaultModel: string }> =
	{
		openrouter: {
			baseUrl: "https://openrouter.ai/api/v1",
			defaultModel: "google/gemini-2.5-flash",
		},
		openai: {
			baseUrl: "https://api.openai.com/v1",
			defaultModel: "gpt-4o-mini",
		},
		groq: {
			baseUrl: "https://api.groq.com/openai/v1",
			defaultModel: "qwen-2.5-coder-32b",
		},
		deepseek: {
			baseUrl: "https://api.deepseek.com/v1",
			defaultModel: "deepseek-chat",
		},
	};

agentRoutes.post("/suggest", async (c) => {
	try {
		const body = await c.req.json<{
			projectId: string;
			filePath: string;
			fileContent: string;
			instruction: string;
			provider?: string;
			model?: string;
		}>();

		if (!body.instruction || !body.filePath) {
			return c.json({ error: "Missing instruction or filePath" }, 400);
		}

		const userId = c.get("user").sub;
		const userTokens = await getUserTokens(userId);

		let LLM_BASE_URL = userTokens.llmBaseUrl ?? SERVER_LLM_BASE_URL;
		let LLM_MODEL = userTokens.llmModel ?? SERVER_LLM_MODEL;

		// Resolve the API key: prefer per-provider key matching the configured
		// base URL, fall back to the raw llmApiKey (legacy single-key format).
		// If llmApiKey is a serialized JSON dict (new multi-provider format),
		// don't use it directly — extract the matching key from llmApiKeys instead.
		const matchedProvider = Object.entries(LLM_PROVIDERS).find(([, cfg]) => cfg.baseUrl === LLM_BASE_URL)?.[0];
		let LLM_KEY: string =
			(matchedProvider ? userTokens.llmApiKeys[matchedProvider] : null) ??
			(userTokens.llmApiKey?.startsWith("{") ? null : userTokens.llmApiKey) ??
			SERVER_LLM_KEY ??
			"";

		if (body.provider && body.provider !== "default") {
			const providerConfig = LLM_PROVIDERS[body.provider];
			if (providerConfig) {
				LLM_BASE_URL = providerConfig.baseUrl;
				LLM_MODEL = body.model || providerConfig.defaultModel;
				LLM_KEY = userTokens.llmApiKeys[body.provider] ?? userTokens.llmApiKey ?? SERVER_LLM_KEY ?? "";
			} else if (body.provider === "custom") {
				LLM_BASE_URL = userTokens.llmBaseUrl ?? SERVER_LLM_BASE_URL;
				LLM_MODEL = body.model || userTokens.llmModel || SERVER_LLM_MODEL;
				LLM_KEY =
					userTokens.llmApiKeys.custom ??
					userTokens.llmApiKey ??
					SERVER_LLM_KEY;
			}
		}

		if (!LLM_KEY) {
			return c.json(
				{
					error:
						"No LLM API key configured for the selected provider. Add yours in Profile → Integrations.",
				},
				500,
			);
		}

		const userMessage = `File: \`${body.filePath}\`

\`\`\`
${body.fileContent || "(empty file)"}
\`\`\`

Instruction: ${body.instruction}`;

		const groqRes = await fetch(`${LLM_BASE_URL}/chat/completions`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${LLM_KEY}`,
			},
			body: JSON.stringify({
				model: LLM_MODEL,
				messages: [
					{ role: "system", content: SYSTEM_PROMPT },
					{ role: "user", content: userMessage },
				],
				stream: true,
				temperature: 0.2,
				max_tokens: 4096,
			}),
		});

		if (!groqRes.ok) {
			const err = await groqRes.text();
			return c.json({ error: `LLM API error: ${err}` }, 502);
		}

		// Stream the SSE response directly to the client
		return new Response(groqRes.body, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				"X-Accel-Buffering": "no",
				"Access-Control-Allow-Origin": "*",
			},
		});
	} catch (err: any) {
		return c.json({ error: err.message }, 500);
	}
});

export default agentRoutes;

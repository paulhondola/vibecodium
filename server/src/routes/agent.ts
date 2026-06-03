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

const SYSTEM_PROMPT = `You are a coding assistant inside VibeCodium IDE. When the user asks you to change code, you MUST output one of the XML blocks below — never describe the change in plain text alone.

EDIT existing code:
<suggested_change file="FILENAME">
<original>
exact lines to replace, copied verbatim from the file (minimum needed, never the whole file)
</original>
<suggested>
replacement lines
</suggested>
</suggested_change>

CREATE a new file:
<create_file file="PATH">
full file content here
</create_file>

DELETE a file:
<delete_file file="PATH" />

RENAME/MOVE a file:
<rename_file from="OLD" to="NEW" />

STRICT RULES:
- ANY code change request MUST produce an XML block. No exceptions.
- <original> must match the file EXACTLY (same indentation, same whitespace).
- Never wrap XML in markdown fences (no \`\`\`).
- You may write a short explanation before or after the XML block.
- Only reply in plain text if the user asks a question that requires no code change.`;

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

import { Hono } from "hono";
import { authMiddleware } from "../middleware/authMiddleware";

const agentRoutes = new Hono();

agentRoutes.use("/*", async (c, next) => {
    if (c.req.method === "OPTIONS") return next();
    return authMiddleware(c, next);
});

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const GROQ_API_KEY = process.env.GROQ_API_KEY ?? process.env.LLM_API_KEY ?? "";
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

const SYSTEM_PROMPT = `You are a surgical coding agent inside iTECify, a collaborative IDE.
The user will share a file and an instruction. Your task: suggest the MINIMAL code change needed.

STRICT OUTPUT FORMAT:
1. One sentence explaining what you will change.
2. One or more XML blocks in EXACTLY this format — NO markdown fences around them:

<suggested_change file="FILENAME">
<original>
ONLY the exact lines being changed — copy VERBATIM from the file, minimum lines needed.
NEVER include the whole file. NEVER include unchanged lines.
</original>
<suggested>
The replacement lines only.
</suggested>
</suggested_change>

RULES:
- <original> must be the SMALLEST contiguous block from the file that covers the change.
- <original> must match character-for-character (including indentation and spacing).
- Never output the entire file in either block.
- You may emit multiple <suggested_change> blocks for separate hunks.
- End with one sentence confirming the change.
- If no code change is needed, reply conversationally without XML.`;

agentRoutes.post("/suggest", async (c) => {
    try {
        const body = await c.req.json<{
            projectId: string;
            filePath: string;
            fileContent: string;
            instruction: string;
        }>();

        if (!body.instruction || !body.filePath) {
            return c.json({ error: "Missing instruction or filePath" }, 400);
        }

        if (!GROQ_API_KEY) {
            return c.json({ error: "GROQ_API_KEY not configured" }, 500);
        }

        const userMessage = `File: \`${body.filePath}\`

\`\`\`
${body.fileContent || "(empty file)"}
\`\`\`

Instruction: ${body.instruction}`;

        const groqRes = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${GROQ_API_KEY}`,
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
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
            return c.json({ error: `Groq API error: ${err}` }, 502);
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

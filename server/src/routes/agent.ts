import { Hono } from "hono";
import { authMiddleware } from "../middleware/authMiddleware";

const agentRoutes = new Hono();

agentRoutes.use("/*", async (c, next) => {
    if (c.req.method === "OPTIONS") return next();
    return authMiddleware(c, next);
});

const LLM_BASE_URL = process.env.LLM_BASE_URL ?? "https://api.deepseek.com/v1";
const LLM_KEY = process.env.LLM_KEY ?? "";
const LLM_MODEL = process.env.LLM_MODEL ?? "deepseek-chat";

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

        if (!LLM_KEY) {
            return c.json({ error: "LLM_KEY not configured" }, 500);
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

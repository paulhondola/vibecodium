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

const SYSTEM_PROMPT = `You are an expert coding agent embedded in a collaborative IDE called iTECify.
The user will give you a file's content and an instruction. Your job is to suggest code changes.

CRITICAL OUTPUT FORMAT RULES:
1. First, briefly explain what you will change in plain text (1-3 sentences max).
2. Then, for EVERY code change, output it in this EXACT XML block:

<suggested_change file="FILENAME">
<original>
EXACT original lines to be replaced (copy verbatim from the file)
</original>
<suggested>
New replacement lines
</suggested>
</suggested_change>

3. You may output multiple <suggested_change> blocks if needed.
4. Do NOT wrap the XML in markdown code fences.
5. After the XML block(s), add a short closing remark.
6. If no code change is needed, just respond conversationally.`;

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

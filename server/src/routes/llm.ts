import { Hono } from "hono";

const llmRoutes = new Hono();

const LLM_BASE_URL = process.env.LLM_BASE_URL ?? "https://api.deepseek.com/v1";
const LLM_KEY = process.env.LLM_KEY ?? "";
const LLM_MODEL = process.env.LLM_MODEL ?? "deepseek-chat";

const LOCAL_BASE_URL = "http://localhost:1234/v1";
const LOCAL_MODEL = process.env.LOCAL_MODEL ?? "qwen2.5-coder-32b-instruct";

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

// Roast My Code Endpoint
llmRoutes.post("/roast", async (c) => {
    try {
        const body = await c.req.json<{ code: string; fileName?: string }>();
        if (!body.code) return c.json({ success: false, error: "No code to roast" }, 400);

        if (!LLM_KEY) {
            // Fallback roast when no LLM key is configured
            const fallbacks = [
                "I've seen better code in COBOL tutorials from 1985. Your variable names are so cryptic, even you don't know what they mean anymore. The indentation looks like you coded this during an earthquake. Congrats on shipping it though, I guess.",
                "This code has more nested callbacks than a Russian doll convention. Stack Overflow would close your question as 'unclear what you're asking'. Your future self will hate you for this, as they should.",
                "Whoever wrote this comment — '// TODO: fix later' — that was 3 years ago, wasn't it? The cyclomatic complexity of this file is higher than your coffee intake, and that's saying something.",
            ];
            return c.json({ success: true, roast: fallbacks[Math.floor(Math.random() * fallbacks.length)] });
        }

        const systemPrompt = `You are a savage but ultimately well-meaning senior software engineer with 20 years of experience and zero patience for bad code. You will roast the submitted code mercilessly but with humor and specificity. Point out real issues (bad naming, complexity, potential bugs, style violations, missing error handling, etc.) in an entertaining, exaggerated, comedic way. Keep it under 200 words. Don't be cruel about the person, only the code. End with one genuine small compliment buried in sarcasm.`;

        const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${LLM_KEY}` },
            body: JSON.stringify({
                model: LLM_MODEL,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Roast this code from file "${body.fileName || "unknown"}":\n\n\`\`\`\n${body.code.slice(0, 3000)}\n\`\`\`` },
                ],
                max_tokens: 350,
                temperature: 0.9,
            }),
            signal: AbortSignal.timeout(20_000),
        });

        if (!res.ok) {
            const err = await res.text();
            return c.json({ success: false, error: err }, 500);
        }

        const data = await res.json() as { choices: { message: { content: string } }[] };
        return c.json({ success: true, roast: data.choices[0]?.message?.content?.trim() });
    } catch (error: any) {
        console.error("Roast error:", error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

llmRoutes.get("/ping-llm", async (c) => {
    if (!LLM_KEY) return c.json({ success: false, error: "LLM_KEY is not set" }, 500);
    const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${LLM_KEY}` },
        body: JSON.stringify({ model: LLM_MODEL, messages: [{ role: "user", content: "Reply with exactly: pong" }], max_tokens: 10 }),
        signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
        const error = await res.text();
        return c.json({ success: false, error }, res.status as any);
    }
    const data = await res.json() as { choices: { message: { content: string } }[] };
    return c.json({ success: true, model: LLM_MODEL, reply: data.choices[0]?.message?.content?.trim() });
});

llmRoutes.get("/ping-llm/auto", async (c) => {
    try {
        const reply = await pingProvider(LOCAL_BASE_URL, "lm-studio", LOCAL_MODEL);
        return c.json({ success: true, provider: "local", model: LOCAL_MODEL, reply });
    } catch (localErr) {
        if (!LLM_KEY) return c.json({ success: false, error: "Local LM Studio unreachable and LLM_KEY is not set" }, 503);
        try {
            const reply = await pingProvider(LLM_BASE_URL, LLM_KEY, LLM_MODEL);
            return c.json({ success: true, provider: "deepseek", model: LLM_MODEL, reply });
        } catch (remoteErr) {
            return c.json({ success: false, error: "Both providers failed", local: String(localErr), deepseek: String(remoteErr) }, 503);
        }
    }
});

export default llmRoutes;

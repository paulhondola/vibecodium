import { Hono } from "hono";
import { authMiddleware } from "../middleware/authMiddleware";
import { connectMongo } from "../db/mongoose";
import { TimelineEvent } from "../db/models/TimelineEvent";

const LLM_BASE_URL = process.env.LLM_BASE_URL ?? "https://api.deepseek.com/v1";
const LLM_KEY      = process.env.LLM_KEY ?? "";
const LLM_MODEL    = process.env.LLM_MODEL ?? "deepseek-chat";

const timelineRoutes = new Hono();

// ──────────────────────────────────────────────────────────────────
// GET /api/timeline/:projectId
// Returns all timeline events for a project (optionally filtered by file path),
// sorted oldest → newest (ASC). This is the inverse of the existing
// GET /api/projects/:id/snapshots endpoint which returns DESC.
// ──────────────────────────────────────────────────────────────────
timelineRoutes.get("/:projectId", authMiddleware, async (c) => {
    try {
        await connectMongo();

        const projectId = c.req.param("projectId");
        const filePath  = c.req.query("path");
        const limit     = Math.min(parseInt(c.req.query("limit") ?? "200", 10), 500);
        const before    = c.req.query("before"); // optional ISO timestamp cursor for pagination

        if (!projectId) {
            return c.json({ success: false, error: "Missing projectId" }, 400);
        }

        const filter: Record<string, unknown> = { projectId };
        if (filePath) filter.filePath = filePath;
        if (before)   filter.createdAt = { $lt: new Date(before) };

        const events = await TimelineEvent
            .find(filter)
            .sort({ createdAt: 1 }) // oldest first so array index === timeline position
            .limit(limit + 1)       // fetch one extra to determine hasMore
            .select("-__v")
            .lean();

        const hasMore = events.length > limit;
        if (hasMore) events.pop();

        return c.json({ success: true, events, hasMore }, 200);
    } catch (error: any) {
        console.error("GET /api/timeline error:", error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// ──────────────────────────────────────────────────────────────────
// POST /api/timeline/:projectId/analyze
// Fetches up to 10 named events, builds a diff summary prompt,
// calls the configured LLM, and returns a plain-text analysis.
// ──────────────────────────────────────────────────────────────────
timelineRoutes.post("/:projectId/analyze", authMiddleware, async (c) => {
    if (!LLM_KEY) {
        return c.json({ success: false, error: "LLM_KEY not configured" }, 500);
    }

    try {
        await connectMongo();

        const projectId = c.req.param("projectId");
        const body = await c.req.json<{
            filePath: string;
            eventIds: string[];
            instruction?: string;
        }>();

        if (!body.filePath || !body.eventIds?.length) {
            return c.json({ success: false, error: "filePath and eventIds are required" }, 400);
        }

        const ids = body.eventIds.slice(0, 10);
        const events = await TimelineEvent
            .find({ _id: { $in: ids }, projectId })
            .sort({ createdAt: 1 })
            .select("eventType userName userColor content createdAt filePath")
            .lean();

        if (events.length === 0) {
            return c.json({ success: false, error: "No events found for given IDs" }, 404);
        }

        // Build diff summary: compare each event's content against the previous
        const LINES = 200;
        const truncate = (s: string) => s.split("\n").slice(0, LINES).join("\n");

        const diffSections = events.map((ev, i) => {
            const prev  = i === 0 ? "" : truncate((events[i - 1] as any).content ?? "");
            const curr  = truncate((ev as any).content ?? "");
            const actor = (ev as any).eventType === "agent_accepted"
                ? `🤖 AI Agent`
                : `👤 ${(ev as any).userName}`;
            const ts    = new Date((ev as any).createdAt).toLocaleTimeString();

            return [
                `--- Change ${i + 1} at ${ts} by ${actor} ---`,
                `BEFORE (first ${LINES} lines):\n\`\`\`\n${prev || "(empty)"}\n\`\`\``,
                `AFTER  (first ${LINES} lines):\n\`\`\`\n${curr}\n\`\`\``,
            ].join("\n");
        });

        const systemPrompt = [
            "You are an expert code reviewer performing time-travel debugging analysis.",
            "You will receive a sequence of code changes from a collaborative coding session.",
            "For each change, identify: what was added/removed, who made it, whether it looks like a bug introduction or a fix, and any patterns across changes.",
            "Be concise and specific. Focus on logic, not style. Format your response in clear sections.",
        ].join(" ");

        const userMessage = [
            `File: ${body.filePath}`,
            body.instruction ? `\nFocus: ${body.instruction}\n` : "",
            "\nCode change history (oldest → newest):\n",
            diffSections.join("\n\n"),
            "\nProvide a clear analysis of what changed, who changed it, and flag any bugs or regressions.",
        ].join("\n");

        const llmRes = await fetch(`${LLM_BASE_URL}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${LLM_KEY}`,
            },
            body: JSON.stringify({
                model: LLM_MODEL,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user",   content: userMessage },
                ],
                max_tokens: 800,
                temperature: 0.3,
            }),
            signal: AbortSignal.timeout(30_000),
        });

        if (!llmRes.ok) {
            const err = await llmRes.text();
            return c.json({ success: false, error: err }, 500);
        }

        const llmData = await llmRes.json() as {
            choices: { message: { content: string } }[];
        };
        const analysis = llmData.choices[0]?.message?.content?.trim() ?? "";

        return c.json({ success: true, analysis, analyzedCount: events.length }, 200);
    } catch (error: any) {
        console.error("POST /api/timeline/analyze error:", error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

export default timelineRoutes;

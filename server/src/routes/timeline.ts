import { Hono } from "hono";
import { authMiddleware } from "../middleware/authMiddleware";
import { supabase } from "../db/supabase";

const LLM_BASE_URL = process.env.LLM_BASE_URL ?? "https://api.deepseek.com/v1";
const LLM_KEY      = process.env.LLM_KEY ?? "";
const LLM_MODEL    = process.env.LLM_MODEL ?? "deepseek-chat";

const timelineRoutes = new Hono();

// GET /api/timeline/:projectId
timelineRoutes.get("/:projectId", authMiddleware, async (c) => {
    try {
        const projectId = c.req.param("projectId");
        const filePath  = c.req.query("path");
        const limit     = Math.min(parseInt(c.req.query("limit") ?? "200", 10), 500);
        const before    = c.req.query("before"); // ISO timestamp cursor

        if (!projectId) {
            return c.json({ success: false, error: "Missing projectId" }, 400);
        }

        let query = supabase
            .from("timeline_events")
            .select("id, project_id, file_path, event_type, user_id, user_name, user_color, content, cursor_line, cursor_column, is_checkpoint, created_at")
            .eq("project_id", projectId)
            .order("created_at", { ascending: true })
            .limit(limit + 1);

        if (filePath) query = query.eq("file_path", filePath);
        if (before)   query = query.lt("created_at", before);

        const { data: events, error } = await query;
        if (error) throw error;

        const rows = events ?? [];
        const hasMore = rows.length > limit;
        if (hasMore) rows.pop();

        return c.json({ success: true, events: rows, hasMore }, 200);
    } catch (error: any) {
        console.error("GET /api/timeline error:", error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// POST /api/timeline/:projectId/analyze — LLM diff analysis
timelineRoutes.post("/:projectId/analyze", authMiddleware, async (c) => {
    if (!LLM_KEY) {
        return c.json({ success: false, error: "LLM_KEY not configured" }, 500);
    }

    try {
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
        const { data: events, error } = await supabase
            .from("timeline_events")
            .select("id, event_type, user_name, user_color, content, created_at, file_path")
            .in("id", ids)
            .eq("project_id", projectId)
            .order("created_at", { ascending: true });

        if (error) throw error;
        if (!events?.length) {
            return c.json({ success: false, error: "No events found for given IDs" }, 404);
        }

        const LINES = 200;
        const truncate = (s: string) => s.split("\n").slice(0, LINES).join("\n");

        const diffSections = events.map((ev, i) => {
            const prev  = i === 0 ? "" : truncate(events[i - 1]!.content ?? "");
            const curr  = truncate(ev.content ?? "");
            const actor = ev.event_type === "agent_accepted" ? "🤖 AI Agent" : `👤 ${ev.user_name}`;
            const ts    = new Date(ev.created_at).toLocaleTimeString();

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

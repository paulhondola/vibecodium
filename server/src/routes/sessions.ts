import { Hono } from "hono";
import { authMiddleware } from "../middleware/authMiddleware";
import { supabase } from "../db/supabase";

const sessionsRoutes = new Hono();

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// POST /api/sessions — create a session token for a project (auth required)
sessionsRoutes.post("/", authMiddleware, async (c) => {
    try {
        const user = (c.get as any)("user");
        const body = await c.req.json<{ projectId: string; label?: string; expiresInDays?: number }>();

        if (!body.projectId) {
            return c.json({ error: "Missing projectId" }, 400);
        }

        const now = Date.now();
        const expiresAt = now + (body.expiresInDays ?? 7) * 24 * 60 * 60 * 1000;
        const token = crypto.randomUUID();

        const { error } = await supabase.from("sessions").insert({
            token,
            project_id: body.projectId,
            created_at: now,
            expires_at: expiresAt,
            created_by: user.sub,
            label: body.label ?? null,
        });

        if (error) throw error;

        const origin = c.req.header("origin") ?? "http://localhost:5173";
        const shareUrl = `${origin}/?session=${token}`;

        return c.json({ token, projectId: body.projectId, label: body.label ?? null, expiresAt, shareUrl }, 201);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// GET /api/sessions/:token — validate token, return project info (no auth required)
sessionsRoutes.get("/:token", async (c) => {
    try {
        const token = c.req.param("token");
        const { data: session, error } = await supabase
            .from("sessions")
            .select("project_id, label, expires_at")
            .eq("token", token)
            .maybeSingle();

        if (error) throw error;
        if (!session) return c.json({ error: "Session not found" }, 404);
        if (session.expires_at < Date.now()) return c.json({ error: "Session expired" }, 410);

        return c.json({ projectId: session.project_id, label: session.label, expiresAt: session.expires_at });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// GET /api/sessions/:token/files — file list for guests (no auth required)
sessionsRoutes.get("/:token/files", async (c) => {
    try {
        const token = c.req.param("token");
        const { data: session, error: sErr } = await supabase
            .from("sessions")
            .select("project_id, expires_at")
            .eq("token", token)
            .maybeSingle();

        if (sErr) throw sErr;
        if (!session) return c.json({ error: "Session not found" }, 404);
        if (session.expires_at < Date.now()) return c.json({ error: "Session expired" }, 410);

        const { data: projectFiles, error: fErr } = await supabase
            .from("files")
            .select("id, path, content")
            .eq("project_id", session.project_id);

        if (fErr) throw fErr;

        return c.json({ success: true, files: projectFiles ?? [] });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// DELETE /api/sessions/:token — revoke (owner only, auth required)
sessionsRoutes.delete("/:token", authMiddleware, async (c) => {
    try {
        const user = (c.get as any)("user");
        const token = c.req.param("token");

        const { data: session, error: sErr } = await supabase
            .from("sessions")
            .select("created_by")
            .eq("token", token)
            .maybeSingle();

        if (sErr) throw sErr;
        if (!session) return c.json({ error: "Session not found" }, 404);
        if (session.created_by !== user.sub) return c.json({ error: "Forbidden" }, 403);

        const { error } = await supabase.from("sessions").delete().eq("token", token);
        if (error) throw error;

        return c.body(null, 204);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// GET /api/sessions?projectId=... — list active sessions for a project (auth required)
sessionsRoutes.get("/", authMiddleware, async (c) => {
    try {
        const user = (c.get as any)("user");
        const projectId = c.req.query("projectId");

        if (!projectId) return c.json({ error: "Missing projectId query param" }, 400);

        const now = Date.now();
        const { data, error } = await supabase
            .from("sessions")
            .select("*")
            .eq("project_id", projectId)
            .eq("created_by", user.sub)
            .gt("expires_at", now);

        if (error) throw error;

        return c.json({ sessions: data ?? [] });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export default sessionsRoutes;

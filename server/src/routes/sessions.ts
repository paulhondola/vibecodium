import { Hono } from "hono";
import { authMiddleware } from "../middleware/authMiddleware";
import { db } from "../db";
import { sessions, files } from "../db/schema";
import { eq, and } from "drizzle-orm";

type Variables = { user: { sub: string; [key: string]: unknown } };

const sessionsRoutes = new Hono<{ Variables: Variables }>();

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// POST /api/sessions — create a session token for a project (auth required)
sessionsRoutes.post("/", authMiddleware, async (c) => {
    try {
        const user = c.get("user");
        const body = await c.req.json<{ projectId: string; label?: string; expiresInDays?: number }>();

        if (!body.projectId) {
            return c.json({ error: "Missing projectId" }, 400);
        }

        const now = Date.now();
        const expiresAt = now + (body.expiresInDays ?? 7) * 24 * 60 * 60 * 1000;
        const token = crypto.randomUUID();

        await db.insert(sessions).values({
            token,
            projectId: body.projectId,
            createdAt: now,
            expiresAt,
            createdBy: user.sub,
            label: body.label ?? null,
        });

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
        const [session] = await db.select().from(sessions).where(eq(sessions.token, token));

        if (!session) {
            return c.json({ error: "Session not found" }, 404);
        }

        if (session.expiresAt < Date.now()) {
            return c.json({ error: "Session expired" }, 410);
        }

        return c.json({ projectId: session.projectId, label: session.label, expiresAt: session.expiresAt });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// GET /api/sessions/:token/files — file list for guests (no auth required)
sessionsRoutes.get("/:token/files", async (c) => {
    try {
        const token = c.req.param("token");
        const [session] = await db.select().from(sessions).where(eq(sessions.token, token));

        if (!session) {
            return c.json({ error: "Session not found" }, 404);
        }

        if (session.expiresAt < Date.now()) {
            return c.json({ error: "Session expired" }, 410);
        }

        const projectFiles = await db
            .select({ id: files.id, path: files.path, content: files.content })
            .from(files)
            .where(eq(files.projectId, session.projectId));

        return c.json({ success: true, files: projectFiles });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// DELETE /api/sessions/:token — revoke (owner only, auth required)
sessionsRoutes.delete("/:token", authMiddleware, async (c) => {
    try {
        const user = c.get("user");
        const token = c.req.param("token");

        const [session] = await db.select().from(sessions).where(eq(sessions.token, token));

        if (!session) {
            return c.json({ error: "Session not found" }, 404);
        }

        if (session.createdBy !== user.sub) {
            return c.json({ error: "Forbidden" }, 403);
        }

        await db.delete(sessions).where(eq(sessions.token, token));

        return c.body(null, 204);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// GET /api/sessions?projectId=... — list active sessions for a project (auth required)
sessionsRoutes.get("/", authMiddleware, async (c) => {
    try {
        const user = c.get("user");
        const projectId = c.req.query("projectId");

        if (!projectId) {
            return c.json({ error: "Missing projectId query param" }, 400);
        }

        const now = Date.now();
        const projectSessions = await db
            .select()
            .from(sessions)
            .where(and(eq(sessions.projectId, projectId), eq(sessions.createdBy, user.sub)));

        const active = projectSessions.filter((s) => s.expiresAt > now);

        return c.json({ sessions: active });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export default sessionsRoutes;

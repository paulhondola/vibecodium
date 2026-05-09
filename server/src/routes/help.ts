import { Hono } from "hono";
import { authMiddleware } from "../middleware/authMiddleware";
import { supabase } from "../db/supabase";

const helpRoutes = new Hono();

// POST /api/help — create a new help post
helpRoutes.post("/", authMiddleware, async (c) => {
    try {
        const user = (c.get as any)("user");
        const body = await c.req.json<{ title: string; description: string; repoUrl: string; difficulty?: string }>();

        if (!body.title || !body.description || !body.repoUrl) {
            return c.json({ success: false, error: "Title, Description, and RepoUrl are required." }, 400);
        }

        const difficulty = ["easy", "medium", "hard"].includes(body.difficulty ?? "") ? body.difficulty : "medium";

        const { data, error } = await supabase
            .from("help_posts")
            .insert({
                user_id: user.sub,
                user_name: user.nickname || user.name || "Anonymous",
                title: body.title,
                description: body.description,
                repo_url: body.repoUrl,
                difficulty,
            })
            .select()
            .single();

        if (error) throw error;

        // Normalise response shape for client (camelCase repoUrl / userName)
        const post = {
            _id: data.id,
            title: data.title,
            description: data.description,
            repoUrl: data.repo_url,
            userName: data.user_name,
            difficulty: data.difficulty,
            createdAt: data.created_at,
        };

        return c.json({ success: true, post }, 201);
    } catch (error: any) {
        console.error("Create help post error:", error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// GET /api/help — list all help posts newest first
helpRoutes.get("/", async (c) => {
    try {
        const { data, error } = await supabase
            .from("help_posts")
            .select("id, title, description, repo_url, user_name, difficulty, created_at")
            .order("created_at", { ascending: false });

        if (error) throw error;

        // Normalise to the camelCase shape the client already expects
        const posts = (data ?? []).map((p) => ({
            _id: p.id,
            title: p.title,
            description: p.description,
            repoUrl: p.repo_url,
            userName: p.user_name,
            difficulty: p.difficulty,
            createdAt: p.created_at,
        }));

        return c.json({ success: true, posts }, 200);
    } catch (error: any) {
        console.error("Fetch help posts error:", error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

export default helpRoutes;

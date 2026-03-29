import { Hono } from "hono";
import { authMiddleware } from "../middleware/authMiddleware";
import { connectMongo } from "../db/mongoose";
import { HelpPost } from "../db/models/HelpPost";

const helpRoutes = new Hono();

// POST /api/help: Save a new help post
helpRoutes.post("/", authMiddleware, async (c) => {
    try {
        await connectMongo();
        const user = (c.get as any)("user");
        const body = await c.req.json<{ title: string; description: string; repoUrl: string; difficulty?: string }>();

        if (!body.title || !body.description || !body.repoUrl) {
            return c.json({ success: false, error: "Title, Description, and RepoUrl are required." }, 400);
        }

        const difficulty = ["easy", "medium", "hard"].includes(body.difficulty ?? "") ? body.difficulty : "medium";

        const newPost = await HelpPost.create({
            title: body.title,
            description: body.description,
            repoUrl: body.repoUrl,
            userName: user.nickname || user.name || "Anonymous",
            auth0_id: user.sub,
            difficulty,
        });

        return c.json({ success: true, post: newPost }, 201);
    } catch (error: any) {
        console.error("Create help post error:", error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// GET /api/help: Fetch all help posts
helpRoutes.get("/", async (c) => {
    try {
        await connectMongo();
        const posts = await HelpPost.find().sort({ createdAt: -1 });
        return c.json({ success: true, posts }, 200);
    } catch (error: any) {
        console.error("Fetch help posts error:", error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

export default helpRoutes;

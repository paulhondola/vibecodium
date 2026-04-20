import { Hono } from "hono";
import { supabase } from "../db/supabase";
import { authMiddleware } from "../middleware/authMiddleware";
import { getUserTokens } from "../utils/tokens";

type Variables = { user: { sub: string; [key: string]: any } };
const router = new Hono<{ Variables: Variables }>();

// GET /api/users/match — return other users for coder-match feature
router.get("/match", authMiddleware, async (c) => {
    try {
        const currentUser = c.get("user");

        const { data, error } = await supabase
            .from("users")
            .select("id, name, email, picture, bio, language, location")
            .neq("id", currentUser.sub)
            .limit(20);

        if (error) throw error;

        // Shuffle for randomised matching
        const shuffled = (data ?? []).sort(() => 0.5 - Math.random());
        return c.json({ success: true, users: shuffled });
    } catch (error: any) {
        console.error("Fetch match users error:", error);
        return c.json({ success: false, error: "Failed to fetch users" }, 500);
    }
});

// GET /api/users/tokens — show masked stored PATs
router.get("/tokens", authMiddleware, async (c) => {
    try {
        const currentUser = c.get("user");
        const tokens = await getUserTokens(currentUser.sub);

        return c.json({
            success: true,
            githubToken: tokens.githubToken ? "****" + tokens.githubToken.slice(-4) : null,
            vercelToken: tokens.vercelToken ? "****" + tokens.vercelToken.slice(-4) : null,
        });
    } catch (error: any) {
        return c.json({ success: false, error: error.message }, 500);
    }
});

// POST /api/users/tokens — save PATs
router.post("/tokens", authMiddleware, async (c) => {
    try {
        const currentUser = c.get("user");
        const body = await c.req.json<{ githubToken?: string; vercelToken?: string }>();

        const { error } = await supabase.from("user_tokens").upsert(
            {
                user_id: currentUser.sub,
                github_token: body.githubToken ?? null,
                vercel_token: body.vercelToken ?? null,
                updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
        );

        if (error) throw error;
        return c.json({ success: true, message: "Tokens updated successfully" });
    } catch (error: any) {
        return c.json({ success: false, error: error.message }, 500);
    }
});

export default router;

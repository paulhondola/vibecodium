import { Hono } from "hono";
import { db } from "../db";
import { users, user_tokens } from "../db/schema";
import { authMiddleware } from "../middleware/authMiddleware";
import { eq, ne } from "drizzle-orm";

type Variables = { user: { sub: string; [key: string]: any } };
const router = new Hono<{ Variables: Variables }>();

router.get("/match", authMiddleware, async (c) => {
    try {
        const currentUser = c.get("user");

        // Fetch all users except the current user
        const matchUsers = await db.select().from(users).where(ne(users.auth0Id, currentUser.sub));

        // Shuffle users to randomize matches
        const shuffled = matchUsers.sort(() => 0.5 - Math.random());
        
        // Return top 20 randomized users
        return c.json({ success: true, users: shuffled.slice(0, 20) });
    } catch (error: any) {
        console.error("Fetch match users error:", error);
        return c.json({ success: false, error: "Failed to fetch users" }, 500);
    }
});

router.get("/tokens", authMiddleware, async (c) => {
    try {
        const currentUser = c.get("user");
        const [token] = await db.select().from(user_tokens).where(eq(user_tokens.auth0Id, currentUser.sub));
        
        if (!token) {
            return c.json({ success: true, githubToken: null, vercelToken: null });
        }

        return c.json({ 
            success: true, 
            githubToken: token.githubToken ? "****" + token.githubToken.slice(-4) : null,
            vercelToken: token.vercelToken ? "****" + token.vercelToken.slice(-4) : null
        });
    } catch (error: any) {
        return c.json({ success: false, error: error.message }, 500);
    }
});

router.post("/tokens", authMiddleware, async (c) => {
    try {
        const currentUser = c.get("user");
        const body = await c.req.json<{ githubToken?: string; vercelToken?: string }>();

        await db.insert(user_tokens).values({
            auth0Id: currentUser.sub,
            githubToken: body.githubToken,
            vercelToken: body.vercelToken,
        }).onConflictDoUpdate({
            target: user_tokens.auth0Id,
            set: {
                githubToken: body.githubToken ?? undefined,
                vercelToken: body.vercelToken ?? undefined,
            }
        });

        return c.json({ success: true, message: "Tokens updated successfully" });
    } catch (error: any) {
        return c.json({ success: false, error: error.message }, 500);
    }
});

export default router;

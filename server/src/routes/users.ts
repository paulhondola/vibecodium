import { Hono } from "hono";
import { db } from "../db";
import { users } from "../db/schema";
import { authMiddleware } from "../middleware/authMiddleware";
import { ne } from "drizzle-orm";

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

export default router;

import { Hono } from "hono";
import { db } from "../db";
import { authMiddleware } from "../middleware/authMiddleware";
import { ne } from "drizzle-orm";
import { connectMongo } from "../db/mongoose";
import { UserToken } from "../db/models/UserToken";
import { User } from "../db/models/User";

type Variables = { user: { sub: string; [key: string]: any } };
const router = new Hono<{ Variables: Variables }>();

router.get("/match", authMiddleware, async (c) => {
    try {
        const currentUser = c.get("user");

        await connectMongo();
        // Fetch all users except the current user from MongoDB
        const matchUsers = await User.find({ auth0Id: { $ne: currentUser.sub } });

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
        await connectMongo();
        const tokens = await UserToken.findOne({ auth0Id: currentUser.sub });
        
        if (!tokens) {
            return c.json({ success: true, githubToken: null, vercelToken: null });
        }

        return c.json({ 
            success: true, 
            githubToken: tokens.githubToken ? "****" + tokens.githubToken.slice(-4) : null,
            vercelToken: tokens.vercelToken ? "****" + tokens.vercelToken.slice(-4) : null
        });
    } catch (error: any) {
        return c.json({ success: false, error: error.message }, 500);
    }
});

router.post("/tokens", authMiddleware, async (c) => {
    try {
        const currentUser = c.get("user");
        const body = await c.req.json<{ githubToken?: string; vercelToken?: string }>();

        await connectMongo();
        await UserToken.findOneAndUpdate(
            { auth0Id: currentUser.sub },
            { 
                githubToken: body.githubToken,
                vercelToken: body.vercelToken
            },
            { upsert: true, new: true }
        );

        return c.json({ success: true, message: "Tokens updated successfully" });
    } catch (error: any) {
        return c.json({ success: false, error: error.message }, 500);
    }
});

export default router;

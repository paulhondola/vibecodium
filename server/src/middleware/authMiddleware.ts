import { createMiddleware } from "hono/factory";
import { db } from "../db";
import { users } from "../db/schema";

const FUN_BIOS = [
    "I use Arch btw.",
    "Looking for a partner to rewrite my Node backend in Rust.",
    "React developer. Swipe left if no functional components.",
    "I like long walks on the beach and abstractSingletonProxyFactoryBeans.",
    "Python enthusiast. My code is indent-pendent.",
    "If you don't write tests, we already share a philosophy."
];
const LANGUAGES = ["Rust", "TypeScript", "Java", "Python", "Go", "C++", "JavaScript", "HTML (yes, it's a language)"];
const LOCATIONS = ["2 miles away", "5 miles away", "Right behind you", "In your node_modules", "Localhost", "Cloud9"];

export const authMiddleware = createMiddleware(async (c, next) => {
	const authHeader = c.req.header("Authorization");

	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return c.json({ error: "Missing or invalid authorization header" }, 401);
	}

	const token = authHeader.split(" ")[1];

	if (!token) {
		return c.json({ error: "Malformed authorization header" }, 401);
	}

	try {
        const auth0Domain = process.env.AUTH0_DOMAIN;
        if (!auth0Domain) {
            throw new Error("Critical Configuration Error: AUTH0_DOMAIN is missing in backend .env");
        }

        // We use the direct /userinfo endpoint to validate the token.
        // Extremely aggressively cache the validated token in-memory to prevent Auth0 429 Too Many Requests
        if (!(globalThis as any).tokenCache) {
            (globalThis as any).tokenCache = new Map<string, { user: any, expiresAt: number }>();
        }
        
        const cache = (globalThis as any).tokenCache as Map<string, { user: any, expiresAt: number }>;
        const now = Date.now();
        const cached = cache.get(token);

        if (cached && cached.expiresAt > now) {
            c.set("user", cached.user);
            return await next();
        }

        const response = await fetch(`https://${auth0Domain}/userinfo`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (!response.ok) {
            return c.json({ error: "Unauthorized: Invalid or expired Auth0 token" }, 401);
        }

        const user = (await response.json()) as any;
        
        cache.set(token, { user, expiresAt: now + 15 * 60 * 1000 }); // 15 minutes
        
        // Upsert user into database
        const randomBio = FUN_BIOS[Math.floor(Math.random() * FUN_BIOS.length)];
        const randomLang = LANGUAGES[Math.floor(Math.random() * LANGUAGES.length)];
        const randomLoc = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];

        try {
            await db.insert(users).values({
                auth0Id: user.sub,
                name: user.name || user.nickname || "Anonymous Coder",
                email: user.email || "no-email@vibecodium.com",
                picture: user.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.sub}`,
                bio: randomBio,
                language: randomLang,
                location: randomLoc,
                createdAt: Date.now()
            }).onConflictDoUpdate({
                target: users.auth0Id,
                set: {
                    name: user.name || user.nickname || "Anonymous Coder",
                    picture: user.picture
                }
            });
        } catch (e) {
            console.error("Failed to upsert user:", e);
        }
        
        // Set the valid decoded user payload in context
		c.set("user", user);
		await next();

	} catch (error: any) {
		console.error("Token Verification failed:", error.message);
		return c.json({ error: "Unauthorized", details: error.message }, 401);
	}
});

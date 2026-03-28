import { createMiddleware } from "hono/factory";

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

        const user = await response.json();
        
        cache.set(token, { user, expiresAt: now + 15 * 60 * 1000 }); // 15 minutes
        
        // Set the valid decoded user payload in context
		c.set("user", user);
		await next();

	} catch (error: any) {
		console.error("Token Verification failed:", error.message);
		return c.json({ error: "Unauthorized", details: error.message }, 401);
	}
});

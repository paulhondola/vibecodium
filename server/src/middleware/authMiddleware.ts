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
        // This is a foolproof strategy that works universally for both Opaque Tokens and JWTs
        // without requiring the user to manually configure separate API Audiences.
        const response = await fetch(`https://${auth0Domain}/userinfo`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (!response.ok) {
            return c.json({ error: "Unauthorized: Invalid or expired Auth0 token" }, 401);
        }

        const user = await response.json();
        
        // Set the valid decoded user payload in context
		c.set("user", user);
		await next();

	} catch (error: any) {
		console.error("Token Verification failed:", error.message);
		return c.json({ error: "Unauthorized", details: error.message }, 401);
	}
});

import { createMiddleware } from "hono/factory";
import { createRemoteJWKSet, jwtVerify } from "jose";

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

		const JWKS = createRemoteJWKSet(
			new URL(`https://${auth0Domain}/.well-known/jwks.json`),
		);

		const { payload } = await jwtVerify(token, JWKS, {
			issuer: `https://${auth0Domain}/`,
            // Optional audience validation could be added here
            // audience: process.env.AUTH0_AUDIENCE
		});

        // Set the valid decoded user payload in context
		c.set("user", payload);
		await next();

	} catch (error: any) {
		console.error("JWT Verification failed:", error.message);
		return c.json({ error: "Unauthorized", details: error.message }, 401);
	}
});

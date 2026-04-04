import { Hono } from "hono";
import { authMiddleware } from "../middleware/authMiddleware";
import { getUserTokens } from "../utils/tokens";

const githubRoutes = new Hono();

// Require Auth0 login but skip OPTIONS preflight
githubRoutes.use("/*", async (c, next) => {
    if (c.req.method === "OPTIONS") return next();
    return authMiddleware(c, next);
});

async function ghHeaders(auth0Id?: string): Promise<Record<string, string>> {
    const h: Record<string, string> = {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "VibeCodium-App",
    };
    
    let token = process.env.GITHUB_TOKEN;
    
    if (auth0Id) {
        const userTokens = await getUserTokens(auth0Id);
        if (userTokens.githubToken) {
            token = userTokens.githubToken;
        }
    }

    if (token && token !== "undefined") {
        h["Authorization"] = `Bearer ${token}`;
    }
    return h;
}

// GET /api/github/users/:username — proxy for user info
githubRoutes.get("/users/:username", async (c) => {
    const user = (c.get as any)("user");
    const username = c.req.param("username");
    const headers = await ghHeaders(user?.sub);
    const res = await fetch(`https://api.github.com/users/${username}`, { headers });
    const data = await res.json();
    return c.json(data, res.ok ? 200 : 500);
});

// GET /api/github/users/:username/repos — proxy for user repos
githubRoutes.get("/users/:username/repos", async (c) => {
    const user = (c.get as any)("user");
    const username = c.req.param("username");
    const sort = c.req.query("sort") || "updated";
    const perPage = c.req.query("per_page") || "50";
    const headers = await ghHeaders(user?.sub);
    const res = await fetch(
        `https://api.github.com/users/${username}/repos?sort=${sort}&per_page=${perPage}`,
        { headers }
    );
    const data = await res.json();
    return c.json(data, res.ok ? 200 : 500);
});

// GET /api/github/search/commits — proxy for commit search
githubRoutes.get("/search/commits", async (c) => {
    const user = (c.get as any)("user");
    const q = c.req.query("q") || "";
    const headers = await ghHeaders(user?.sub);
    headers["Accept"] = "application/vnd.github.cloak-preview+json";
    const res = await fetch(
        `https://api.github.com/search/commits?q=${encodeURIComponent(q)}`,
        { headers }
    );
    const data = await res.json();
    return c.json(data, res.ok ? 200 : 500);
});

export default githubRoutes;

import { Hono } from "hono";
import { authMiddleware } from "../middleware/authMiddleware";

const githubRoutes = new Hono();

// Require Auth0 login but skip OPTIONS preflight
githubRoutes.use("/*", async (c, next) => {
    if (c.req.method === "OPTIONS") return next();
    return authMiddleware(c, next);
});

function ghHeaders(): Record<string, string> {
    const h: Record<string, string> = {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "iTECify-App",
    };
    const token = process.env.GITHUB_TOKEN;
    if (token && token !== "undefined") {
        h["Authorization"] = `Bearer ${token}`;
    }
    return h;
}

// GET /api/github/users/:username — proxy for user info
githubRoutes.get("/users/:username", async (c) => {
    const username = c.req.param("username");
    const res = await fetch(`https://api.github.com/users/${username}`, { headers: ghHeaders() });
    const data = await res.json();
    return c.json(data, res.ok ? 200 : 500);
});

// GET /api/github/users/:username/repos — proxy for user repos
githubRoutes.get("/users/:username/repos", async (c) => {
    const username = c.req.param("username");
    const sort = c.req.query("sort") || "updated";
    const perPage = c.req.query("per_page") || "50";
    const res = await fetch(
        `https://api.github.com/users/${username}/repos?sort=${sort}&per_page=${perPage}`,
        { headers: ghHeaders() }
    );
    const data = await res.json();
    return c.json(data, res.ok ? 200 : 500);
});

// GET /api/github/search/commits — proxy for commit search
githubRoutes.get("/search/commits", async (c) => {
    const q = c.req.query("q") || "";
    const headers = ghHeaders();
    headers["Accept"] = "application/vnd.github.cloak-preview+json";
    const res = await fetch(
        `https://api.github.com/search/commits?q=${encodeURIComponent(q)}`,
        { headers }
    );
    const data = await res.json();
    return c.json(data, res.ok ? 200 : 500);
});

export default githubRoutes;

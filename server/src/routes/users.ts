import { Hono } from "hono";
import { supabase } from "../db/supabase";
import { authMiddleware } from "../middleware/authMiddleware";
import { getUserTokens } from "../utils/tokens";

type Variables = { user: { sub: string; [key: string]: any } };
const router = new Hono<{ Variables: Variables }>();

// GET /api/users/match — return other users for coder-match feature
// ?order=random|language|location|active|new
router.get("/match", authMiddleware, async (c) => {
    try {
        const currentUser = c.get("user");
        const order = c.req.query("order") ?? "random";

        // Collect already-swiped IDs to exclude from feed
        const { data: swiped } = await supabase
            .from("swipes")
            .select("swiped_id")
            .eq("swiper_id", currentUser.sub);

        const excludeIds = [(currentUser.sub as string), ...((swiped ?? []).map((s: { swiped_id: string }) => s.swiped_id))];

        let baseQuery = supabase
            .from("users")
            .select("id, name, email, picture, bio, language, location, created_at")
            .limit(20);

        // Exclude self + already-swiped (each neq is AND'd by PostgREST)
        for (const id of excludeIds) {
            baseQuery = baseQuery.neq("id", id);
        }

        switch (order) {
            case "active":
                // Fall back to created_at if updated_at doesn't exist
                baseQuery = baseQuery.order("created_at", { ascending: false });
                break;
            case "new":
                baseQuery = baseQuery.order("created_at", { ascending: false });
                break;
            case "language": {
                // Fetch my language, then sort matches-first in JS
                const { data: me } = await supabase
                    .from("users")
                    .select("language")
                    .eq("id", currentUser.sub)
                    .maybeSingle();
                const { data, error } = await baseQuery;
                if (error) throw error;
                const myLang = me?.language ?? null;
                const sorted = (data ?? []).sort((a, b) => {
                    const aMatch = myLang && a.language === myLang ? 0 : 1;
                    const bMatch = myLang && b.language === myLang ? 0 : 1;
                    return aMatch - bMatch;
                });
                return c.json({ success: true, users: sorted });
            }
            case "location": {
                const { data: me } = await supabase
                    .from("users")
                    .select("location")
                    .eq("id", currentUser.sub)
                    .maybeSingle();
                const { data, error } = await baseQuery;
                if (error) throw error;
                const myLoc = me?.location ?? null;
                const sorted = (data ?? []).sort((a, b) => {
                    const aMatch = myLoc && a.location === myLoc ? 0 : 1;
                    const bMatch = myLoc && b.location === myLoc ? 0 : 1;
                    return aMatch - bMatch;
                });
                return c.json({ success: true, users: sorted });
            }
            default: // random — no DB ordering, shuffle in JS
                break;
        }

        const { data, error } = await baseQuery;
        if (error) throw error;

        const result = order === "random"
            ? (data ?? []).sort(() => 0.5 - Math.random())
            : (data ?? []);

        return c.json({ success: true, users: result });
    } catch (error: any) {
        console.error("Fetch match users error:", error);
        return c.json({ success: false, error: "Failed to fetch users" }, 500);
    }
});

// GET /api/users/tokens — show masked stored PATs + LLM config
router.get("/tokens", authMiddleware, async (c) => {
    try {
        const currentUser = c.get("user");
        const tokens = await getUserTokens(currentUser.sub);

        return c.json({
            success: true,
            githubToken: tokens.githubToken ? "****" + tokens.githubToken.slice(-4) : null,
            vercelToken: tokens.vercelToken ? "****" + tokens.vercelToken.slice(-4) : null,
            llmApiKey:   tokens.llmApiKey   ? "****" + tokens.llmApiKey.slice(-4)   : null,
            llmBaseUrl:  tokens.llmBaseUrl  ?? null,
            llmModel:    tokens.llmModel    ?? null,
        });
    } catch (error: any) {
        return c.json({ success: false, error: error.message }, 500);
    }
});

// POST /api/users/tokens — save PATs + LLM config (encrypted in Supabase Vault)
router.post("/tokens", authMiddleware, async (c) => {
    try {
        const currentUser = c.get("user");
        const body = await c.req.json<{
            githubToken?: string;
            vercelToken?: string;
            llmApiKey?:   string;
            llmBaseUrl?:  string;
            llmModel?:    string;
        }>();

        // Fetch existing vault secret IDs to update in-place rather than create duplicates
        const { data: existing } = await supabase
            .from("user_tokens")
            .select("github_secret_id, vercel_secret_id, llm_secret_id")
            .eq("user_id", currentUser.sub)
            .maybeSingle();

        const patch: Record<string, unknown> = {
            user_id:    currentUser.sub,
            updated_at: new Date().toISOString(),
        };

        if (body.githubToken !== undefined) {
            if (body.githubToken) {
                const { data: secretId, error } = await supabase.rpc("upsert_vault_secret", {
                    p_existing_id: existing?.github_secret_id ?? null,
                    p_secret:      body.githubToken,
                    p_name:        `github_token_${currentUser.sub}`,
                });
                if (error) throw error;
                patch.github_secret_id = secretId;
            } else {
                patch.github_secret_id = null;
            }
        }

        if (body.vercelToken !== undefined) {
            if (body.vercelToken) {
                const { data: secretId, error } = await supabase.rpc("upsert_vault_secret", {
                    p_existing_id: existing?.vercel_secret_id ?? null,
                    p_secret:      body.vercelToken,
                    p_name:        `vercel_token_${currentUser.sub}`,
                });
                if (error) throw error;
                patch.vercel_secret_id = secretId;
            } else {
                patch.vercel_secret_id = null;
            }
        }

        if (body.llmApiKey !== undefined) {
            if (body.llmApiKey) {
                const { data: secretId, error } = await supabase.rpc("upsert_vault_secret", {
                    p_existing_id: existing?.llm_secret_id ?? null,
                    p_secret:      body.llmApiKey,
                    p_name:        `llm_api_key_${currentUser.sub}`,
                });
                if (error) throw error;
                patch.llm_secret_id = secretId;
            } else {
                patch.llm_secret_id = null;
            }
        }

        if (body.llmBaseUrl !== undefined) patch.llm_base_url = body.llmBaseUrl || null;
        if (body.llmModel   !== undefined) patch.llm_model    = body.llmModel   || null;

        const { error } = await supabase
            .from("user_tokens")
            .upsert(patch, { onConflict: "user_id" });

        if (error) throw error;
        return c.json({ success: true, message: "Tokens updated successfully" });
    } catch (error: any) {
        return c.json({ success: false, error: error.message }, 500);
    }
});

const VALID_LANGUAGES = [
    "TypeScript", "JavaScript", "Python", "Go", "Rust", "C++",
    "Java", "C#", "Kotlin", "Swift", "PHP", "Ruby", "Scala",
    "Elixir", "Haskell", "Dart", "Zig", "C", "R", "Lua",
];

// GET /api/users/profile — return current user's bio, language, location
router.get("/profile", authMiddleware, async (c) => {
    try {
        const currentUser = c.get("user");
        const { data, error } = await supabase
            .from("users")
            .select("bio, language, location")
            .eq("id", currentUser.sub)
            .maybeSingle();
        if (error) throw error;
        return c.json({
            success:  true,
            bio:      data?.bio      ?? "",
            language: data?.language ?? "",
            location: data?.location ?? "",
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return c.json({ success: false, error: message }, 500);
    }
});

// PUT /api/users/profile — update bio, language, location
router.put("/profile", authMiddleware, async (c) => {
    try {
        const currentUser = c.get("user");
        const body = await c.req.json<{ bio?: string; language?: string; location?: string }>();
        const patch: Record<string, unknown> = {};

        if (body.bio !== undefined) {
            if (body.bio.length > 200)
                return c.json({ success: false, error: "Bio must be 200 characters or fewer" }, 400);
            patch.bio = body.bio || null;
        }
        if (body.language !== undefined) {
            if (body.language && !VALID_LANGUAGES.includes(body.language))
                return c.json({ success: false, error: "Invalid language selection" }, 400);
            patch.language = body.language || null;
        }
        if (body.location !== undefined) {
            if (body.location.length > 100)
                return c.json({ success: false, error: "Location must be 100 characters or fewer" }, 400);
            patch.location = body.location || null;
        }

        if (Object.keys(patch).length === 0)
            return c.json({ success: false, error: "No fields to update" }, 400);

        const { error } = await supabase.from("users").update(patch).eq("id", currentUser.sub);
        if (error) throw error;
        return c.json({ success: true, message: "Profile updated successfully" });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return c.json({ success: false, error: message }, 500);
    }
});

export default router;

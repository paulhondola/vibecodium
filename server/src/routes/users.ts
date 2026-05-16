import { Hono } from "hono";
import { supabase } from "../db/supabase";
import { authMiddleware } from "../middleware/authMiddleware";
import { getUserTokens } from "../utils/tokens";

type Variables = { user: { sub: string; [key: string]: any } };
const router = new Hono<{ Variables: Variables }>();

// GET /api/users/match — return other users for coder-match feature
router.get("/match", authMiddleware, async (c) => {
    try {
        const currentUser = c.get("user");

        const { data, error } = await supabase
            .from("users")
            .select("id, name, email, picture, bio, language, location")
            .neq("id", currentUser.sub)
            .limit(20);

        if (error) throw error;

        // Shuffle for randomised matching
        const shuffled = (data ?? []).sort(() => 0.5 - Math.random());
        return c.json({ success: true, users: shuffled });
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

export default router;

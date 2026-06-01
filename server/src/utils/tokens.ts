import { supabase } from "../db/supabase";

/**
 * Upserts a user into public.users (fire-and-forget safe to call from middleware).
 */
export async function upsertUser(payload: {
  sub: string;
  email?: string;
  name?: string;
  nickname?: string;
  picture?: string;
}): Promise<void> {
  const { error } = await supabase.from("users").upsert(
    {
      id: payload.sub,
      name: payload.name || payload.nickname || "Anonymous Coder",
      email: payload.email || "no-email@vibecodium.com",
      picture:
        payload.picture ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(
          payload.name || payload.email || "U"
        )}&background=0D8ABC&color=fff`,
      github_username: payload.nickname || null,
      created_at: new Date().toISOString(),
    },
    { onConflict: "id", ignoreDuplicates: false }
  );
  if (error) console.error("[upsertUser]", error.message);
}

/**
 * Decrypts a single vault secret by its UUID reference.
 */
async function readVaultSecret(id: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("read_vault_secret", { p_id: id });
  if (error) console.error("[readVaultSecret]", error.message);
  return (data as string | null) ?? null;
}

/**
 * Returns the stored GitHub / Vercel / LLM tokens for a user, decrypted from Vault.
 */
export async function getUserTokens(userId: string): Promise<{
  githubToken: string | null;
  vercelToken: string | null;
  llmApiKey:   string | null;
  llmBaseUrl:  string | null;
  llmModel:    string | null;
}> {
  const { data, error } = await supabase
    .from("user_tokens")
    .select("github_secret_id, vercel_secret_id, llm_secret_id, llm_base_url, llm_model")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) console.error("[getUserTokens]", error.message);
  if (!data) return { githubToken: null, vercelToken: null, llmApiKey: null, llmBaseUrl: null, llmModel: null };

  const [githubToken, vercelToken, llmApiKey] = await Promise.all([
    data.github_secret_id ? readVaultSecret(data.github_secret_id) : Promise.resolve(null),
    data.vercel_secret_id ? readVaultSecret(data.vercel_secret_id) : Promise.resolve(null),
    data.llm_secret_id    ? readVaultSecret(data.llm_secret_id)    : Promise.resolve(null),
  ]);

  return {
    githubToken,
    vercelToken,
    llmApiKey,
    llmBaseUrl: (data.llm_base_url as string | null) ?? null,
    llmModel:   (data.llm_model   as string | null) ?? null,
  };
}

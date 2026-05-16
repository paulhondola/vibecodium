# LLM API Key on Profile Page

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each user save their own LLM API key (encrypted in Supabase Vault) on the profile page alongside their GitHub and Vercel tokens, with a provider selector that auto-fills the base URL so they can access any OpenAI-compatible model provider (OpenRouter recommended for broadest model coverage).

**Architecture:** Extend the existing `user_tokens` table with three new columns — `llm_secret_id UUID` (vault reference to the encrypted key), `llm_base_url TEXT` (provider endpoint, not a secret), and `llm_model TEXT` (model name, not a secret). The server reads these columns in `getUserTokens()` and passes them down to `agent.ts` and `timeline.ts`, which now prefer the user's own LLM config over the server-wide env vars. The profile page UI gains a provider dropdown + API key input + model field inside the existing Integrations card.

**Tech Stack:** Supabase Vault (existing `upsert_vault_secret` RPC), Hono (server), React + TanStack Router (client), Lucide React icons.

---

## Model Provider Recommendation

**Use OpenRouter as the recommended/default provider.**

OpenRouter (`https://openrouter.ai/api/v1`) is OpenAI-compatible, requires a single API key, and gives access to 100+ models: Claude (Anthropic), GPT-4o (OpenAI), Gemini (Google), Llama 3 (Meta), Mistral, Groq-hosted models, and more. Model names follow the pattern `anthropic/claude-opus-4`, `openai/gpt-4o`, `google/gemini-2.5-pro`, etc.

The UI provider dropdown auto-fills the base URL for each preset:

| Provider | Base URL | Example model |
|---|---|---|
| OpenRouter | `https://openrouter.ai/api/v1` | `anthropic/claude-opus-4` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o` |
| Groq | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| Local / Custom | (user fills in) | (user fills in) |

---

## Files Changed

| Action | File | What changes |
|---|---|---|
| Create | `supabase/migrations/20260516_add_llm_token.sql` | ALTER TABLE adds 3 columns |
| Modify | `server/src/utils/tokens.ts:56–74` | `getUserTokens()` return type + vault decrypt |
| Modify | `server/src/routes/users.ts:31–102` | GET/POST handle `llmApiKey`, `llmBaseUrl`, `llmModel` |
| Modify | `server/src/routes/agent.ts:11–13,64–66,76–91` | Prefer user LLM config, fall back to env |
| Modify | `server/src/routes/timeline.ts:5–7,49–51,109–130` | Same as agent.ts |
| Modify | `client/src/routes/profile.tsx:1–101,222–278` | State, fetch, save, and UI for LLM fields |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260516_add_llm_token.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Add LLM API key support to user_tokens
ALTER TABLE public.user_tokens
  ADD COLUMN IF NOT EXISTS llm_secret_id UUID,
  ADD COLUMN IF NOT EXISTS llm_base_url  TEXT,
  ADD COLUMN IF NOT EXISTS llm_model     TEXT;
```

- [ ] **Step 2: Apply the migration via Supabase MCP or CLI**

```bash
# Option A: Supabase CLI (preferred for local dev)
supabase db push

# Option B: paste the SQL into Supabase Dashboard → SQL Editor
```

Expected: no errors, `\d public.user_tokens` shows three new columns.

- [ ] **Step 3: Verify columns exist**

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'user_tokens'
ORDER BY ordinal_position;
```

Expected output includes `llm_secret_id`, `llm_base_url`, `llm_model`.

---

## Task 2: Extend `getUserTokens()` Utility

**Files:**
- Modify: `server/src/utils/tokens.ts`

- [ ] **Step 1: Update the return type and query**

Replace the entire `getUserTokens` function (lines 56–74) with:

```typescript
export async function getUserTokens(userId: string): Promise<{
  githubToken: string | null;
  vercelToken: string | null;
  llmApiKey: string | null;
  llmBaseUrl: string | null;
  llmModel: string | null;
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: no errors.

---

## Task 3: Update Token Routes (GET + POST)

**Files:**
- Modify: `server/src/routes/users.ts`

- [ ] **Step 1: Update GET /api/users/tokens to return LLM fields**

Replace lines 31–45 with:

```typescript
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
```

- [ ] **Step 2: Update POST /api/users/tokens to accept LLM fields**

Replace line 51 (body type) and add handling after the `vercelToken` block (before the final upsert). Full updated POST handler replacing lines 47–102:

```typescript
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
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: no errors.

---

## Task 4: Use User LLM Config in `agent.ts`

**Files:**
- Modify: `server/src/routes/agent.ts`

The user's personal key takes priority; server env vars are the fallback. Add `Variables` typing and call `getUserTokens`.

- [ ] **Step 1: Update imports and remove module-level constants**

Replace lines 1–13:

```typescript
import { Hono } from "hono";
import { authMiddleware } from "../middleware/authMiddleware";
import { getUserTokens } from "../utils/tokens";

type Variables = { user: { sub: string; [key: string]: any } };
const agentRoutes = new Hono<{ Variables: Variables }>();

agentRoutes.use("/*", async (c, next) => {
    if (c.req.method === "OPTIONS") return next();
    return authMiddleware(c, next);
});

const SERVER_LLM_BASE_URL = process.env.LLM_BASE_URL ?? "https://api.deepseek.com/v1";
const SERVER_LLM_KEY      = process.env.LLM_KEY ?? "";
const SERVER_LLM_MODEL    = process.env.LLM_MODEL ?? "deepseek-chat";
```

- [ ] **Step 2: Inside the POST /suggest handler, resolve LLM config per user**

Replace lines 64–66 (the `!LLM_KEY` check) with:

```typescript
        const userId = c.get("user").sub;
        const userTokens = await getUserTokens(userId);

        const LLM_BASE_URL = userTokens.llmBaseUrl ?? SERVER_LLM_BASE_URL;
        const LLM_KEY      = userTokens.llmApiKey  ?? SERVER_LLM_KEY;
        const LLM_MODEL    = userTokens.llmModel   ?? SERVER_LLM_MODEL;

        if (!LLM_KEY) {
            return c.json({ error: "No LLM API key configured. Add yours in Profile → Integrations." }, 500);
        }
```

- [ ] **Step 3: Fix the error message on line ~96** (still references "Groq")

Replace:
```typescript
            return c.json({ error: `Groq API error: ${err}` }, 502);
```
With:
```typescript
            return c.json({ error: `LLM API error: ${err}` }, 502);
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: no errors.

---

## Task 5: Use User LLM Config in `timeline.ts`

**Files:**
- Modify: `server/src/routes/timeline.ts`

Same pattern as Task 4.

- [ ] **Step 1: Update imports and rename module-level constants**

At the top of the file, replace the three `const LLM_*` lines with:

```typescript
import { getUserTokens } from "../utils/tokens";

const SERVER_LLM_BASE_URL = process.env.LLM_BASE_URL ?? "https://api.deepseek.com/v1";
const SERVER_LLM_KEY      = process.env.LLM_KEY ?? "";
const SERVER_LLM_MODEL    = process.env.LLM_MODEL ?? "deepseek-chat";
```

> Note: keep the existing `import { Hono }` and other imports intact; only replace/add the LLM-related lines.

- [ ] **Step 2: In each handler that calls the LLM, resolve per-user config**

Find the block that checks `if (!LLM_KEY)` and replace it with:

```typescript
        const userId = c.get("user")?.sub;
        const userTokens = userId ? await getUserTokens(userId) : null;

        const LLM_BASE_URL = userTokens?.llmBaseUrl ?? SERVER_LLM_BASE_URL;
        const LLM_KEY      = userTokens?.llmApiKey  ?? SERVER_LLM_KEY;
        const LLM_MODEL    = userTokens?.llmModel   ?? SERVER_LLM_MODEL;

        if (!LLM_KEY) {
            return c.json({ success: false, error: "No LLM API key configured. Add yours in Profile → Integrations." });
        }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: no errors.

---

## Task 6: Profile Page UI

**Files:**
- Modify: `client/src/routes/profile.tsx`

Add three new state fields, include them in fetch/save calls, and render a provider dropdown + API key input + model input in the Integrations card.

- [ ] **Step 1: Add state variables after line 26**

Add after `const [saveMessage, setSaveMessage] ...`:

```typescript
  // LLM config
  const [llmApiKey,  setLlmApiKey]  = useState("");
  const [llmBaseUrl, setLlmBaseUrl] = useState("https://openrouter.ai/api/v1");
  const [llmModel,   setLlmModel]   = useState("anthropic/claude-opus-4");
  const [llmProvider, setLlmProvider] = useState("openrouter");
```

- [ ] **Step 2: Populate from GET /api/users/tokens**

Inside the `.then(data => {` block (after line 60), add:

```typescript
          if (data.llmApiKey)  setLlmApiKey(data.llmApiKey);
          if (data.llmBaseUrl) setLlmBaseUrl(data.llmBaseUrl);
          if (data.llmModel)   setLlmModel(data.llmModel);
```

- [ ] **Step 3: Include LLM fields in the save call**

Inside `handleSaveTokens`, update the `body` passed to POST (around line 82):

```typescript
        body: JSON.stringify({ 
          githubToken: githubToken.includes('****') ? undefined : githubToken, 
          vercelToken: vercelToken.includes('****') ? undefined : vercelToken,
          llmApiKey:   llmApiKey.includes('****')   ? undefined : llmApiKey   || undefined,
          llmBaseUrl:  llmBaseUrl  || undefined,
          llmModel:    llmModel    || undefined,
        })
```

- [ ] **Step 4: Also update `setLlmApiKey` after the refetch (like GitHub/Vercel)**

Inside the refetch block (around line 92):

```typescript
          if (updatedTokens.llmApiKey)  setLlmApiKey(updatedTokens.llmApiKey);
          if (updatedTokens.llmBaseUrl) setLlmBaseUrl(updatedTokens.llmBaseUrl);
          if (updatedTokens.llmModel)   setLlmModel(updatedTokens.llmModel);
```

- [ ] **Step 5: Add `Bot` to Lucide import on line 3**

```typescript
import { ArrowLeft, LogOut, Activity, FolderGit2, Zap, Github, Key, Save, Loader2, ShieldCheck, Bot } from "lucide-react";
```

- [ ] **Step 6: Add provider presets constant (before `function ProfilePage()`)**

```typescript
const LLM_PROVIDERS = [
  { id: "openrouter", label: "OpenRouter",   baseUrl: "https://openrouter.ai/api/v1",      placeholder: "sk-or-v1-..." },
  { id: "openai",     label: "OpenAI",       baseUrl: "https://api.openai.com/v1",          placeholder: "sk-proj-..."  },
  { id: "groq",       label: "Groq",         baseUrl: "https://api.groq.com/openai/v1",     placeholder: "gsk_..."      },
  { id: "deepseek",   label: "DeepSeek",     baseUrl: "https://api.deepseek.com/v1",        placeholder: "sk-..."       },
  { id: "custom",     label: "Local / Custom", baseUrl: "",                                 placeholder: "Enter key"    },
] as const;
```

- [ ] **Step 7: Add provider-change handler (inside `ProfilePage`, before `return`)**

```typescript
  const handleProviderChange = (providerId: string) => {
    setLlmProvider(providerId);
    const preset = LLM_PROVIDERS.find(p => p.id === providerId);
    if (preset && preset.baseUrl) setLlmBaseUrl(preset.baseUrl);
  };
```

- [ ] **Step 8: Add the LLM section in the Integrations card UI**

After the existing `</div>` that closes the `grid md:grid-cols-2` with GitHub + Vercel inputs (around line 255), and before the save button div, insert:

```tsx
              {/* ── LLM / AI Provider ── */}
              <div className="pt-4 border-t border-white/5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2 mb-4">
                  <Bot size={12} className="text-[#A855F7]" /> AI Model Provider
                </p>

                <div className="grid md:grid-cols-2 gap-6 mb-4">
                  {/* Provider selector */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Provider
                    </label>
                    <select
                      value={llmProvider}
                      onChange={(e) => handleProviderChange(e.target.value)}
                      className="w-full bg-[#02040a] border border-white/10 rounded-lg px-3 py-2 text-xs text-cyan-50 focus:border-[#A855F7]/50 focus:ring-1 focus:ring-[#A855F7]/50 outline-none transition-all"
                    >
                      {LLM_PROVIDERS.map(p => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Model name */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Model
                    </label>
                    <input
                      type="text"
                      value={llmModel}
                      onChange={(e) => setLlmModel(e.target.value)}
                      placeholder="e.g. anthropic/claude-opus-4"
                      className="w-full bg-[#02040a] border border-white/10 rounded-lg px-3 py-2 text-xs text-cyan-50 focus:border-[#A855F7]/50 focus:ring-1 focus:ring-[#A855F7]/50 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* API Key */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      API Key
                    </label>
                    <input
                      type="password"
                      value={llmApiKey}
                      onChange={(e) => setLlmApiKey(e.target.value)}
                      placeholder={LLM_PROVIDERS.find(p => p.id === llmProvider)?.placeholder ?? "Enter key"}
                      className="w-full bg-[#02040a] border border-white/10 rounded-lg px-3 py-2 text-xs text-cyan-50 focus:border-[#A855F7]/50 focus:ring-1 focus:ring-[#A855F7]/50 outline-none transition-all"
                    />
                  </div>

                  {/* Base URL (editable for custom) */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Base URL
                    </label>
                    <input
                      type="text"
                      value={llmBaseUrl}
                      onChange={(e) => setLlmBaseUrl(e.target.value)}
                      placeholder="https://openrouter.ai/api/v1"
                      className="w-full bg-[#02040a] border border-white/10 rounded-lg px-3 py-2 text-xs text-cyan-50 focus:border-[#A855F7]/50 focus:ring-1 focus:ring-[#A855F7]/50 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>
```

- [ ] **Step 9: Verify TypeScript compiles and UI looks correct**

```bash
cd client && npx tsc --noEmit
```

Then start dev server and open Profile → check Integrations card shows the new section.

---

## Verification

- [ ] Open Profile page → Integrations card shows GitHub, Vercel, and LLM sections
- [ ] Select "OpenRouter" from dropdown → Base URL auto-fills to `https://openrouter.ai/api/v1`
- [ ] Enter an OpenRouter key + model (`anthropic/claude-opus-4`) → click Secure Tokens → response is success
- [ ] Reload page — LLM API key shows as `****xxxx`, base URL and model persist
- [ ] Open workspace → use Agent tab with instruction → response comes from user's LLM key (check server logs)
- [ ] Remove LLM key from profile → agent falls back to server env var `LLM_KEY`
- [ ] `server/npx tsc --noEmit` passes
- [ ] `client/npx tsc --noEmit` passes

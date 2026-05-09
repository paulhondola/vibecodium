# Auth0 + MongoDB + SQLite → Supabase (Full Migration)

## Context

The app currently uses **three separate data stores**:

| Store       | Tech                                                | Data                                                                          |
| ----------- | --------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Auth**    | Auth0 (`@auth0/auth0-react` + `/userinfo` endpoint) | Login, JWT tokens                                                             |
| **MongoDB** | Mongoose                                            | Users, UserTokens, HelpPosts, DeployedApps, Projects metadata, TimelineEvents |
| **SQLite**  | Drizzle ORM (`bun:sqlite`)                          | projects, files, snapshots, sessions                                          |

**Goal:** Consolidate **everything** into **Supabase** — auth via `@supabase/supabase-js` on the frontend, all data in Supabase PostgreSQL, Postgres trigger for auto-populating user profiles.

---

## Architecture

```text
Frontend (supabase-js)          Supabase                     Backend (Hono)
   |                               |                            |
   | supabase.auth.signInWithOAuth |                            |
   | (provider: 'github')         |                            |
   |------------------------------>| GitHub OAuth               |
   |                               |  ↕                        |
   |  onAuthStateChange fires      |                            |
   |  → session with access_token  |                            |
   |<------------------------------|                            |
   |                               |                            |
   |                               | TRIGGER on auth.users      |
   |                               | → INSERT into public.users |
   |                               |                            |
   | GET /api/... Bearer <jwt>     |                            |
   |---------------------------------------------->|            |
   |                          Verify JWT (jose)    |            |
   |                          Query Supabase PG    |            |
```

**What's eliminated:**
- Auth0 entirely (frontend + backend)
- MongoDB / Mongoose entirely
- SQLite / Drizzle entirely
- `server/src/db/mongoose.ts`, `server/src/db/index.ts`, `server/src/db/schema.ts`
- All Mongoose models (`server/src/db/models/*`)

**What replaces them:**
- `@supabase/supabase-js` on frontend for auth
- `@supabase/supabase-js` (service role) on backend for all DB queries
- `jose` for JWT verification in middleware (kept from original plan)
- Supabase PostgreSQL for ALL tables

---

## Prerequisites (Manual)

> [!WARNING]
> **Supabase GitHub OAuth provider** must be enabled in Supabase dashboard → Authentication → Providers → GitHub. Configure a GitHub OAuth App with callback URL: `https://<project-ref>.supabase.co/auth/v1/callback`.

> [!IMPORTANT]
> You need these values from Supabase dashboard → Settings → API:
> - `SUPABASE_URL` (e.g. `https://zaeqbsoxorivttvkyucu.supabase.co`)
> - `SUPABASE_ANON_KEY` (public/anon key)
> - `SUPABASE_SERVICE_ROLE_KEY` (secret, server only)
> - `SUPABASE_JWT_SECRET` (Settings → API → JWT Secret)

---

## Database Schema (Supabase Migration)

### [NEW] `supabase/migrations/<timestamp>_full_schema.sql`

All tables consolidated into one migration. Replaces MongoDB models + SQLite schema.

```sql
-- ═══════════════════════════════════════════
-- AUTH-TRIGGERED TABLES
-- ═══════════════════════════════════════════

-- public.users (replaces MongoDB User model)
CREATE TABLE public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT 'Anonymous Coder',
  email       TEXT NOT NULL DEFAULT '',
  picture     TEXT,
  bio         TEXT,
  language    TEXT,
  location    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users readable by authenticated" ON public.users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE TO authenticated USING (id = auth.uid());

-- public.user_tokens (replaces MongoDB UserToken model)
CREATE TABLE public.user_tokens (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  github_token  TEXT,
  vercel_token  TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own tokens" ON public.user_tokens FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can manage own tokens" ON public.user_tokens FOR ALL TO authenticated USING (id = auth.uid());

-- ═══════════════════════════════════════════
-- TRIGGER: auto-populate public.users on signup
-- ═══════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  bios TEXT[] := ARRAY[
    'I use Arch btw.', 'Looking for a partner to rewrite my Node backend in Rust.',
    'React developer. Swipe left if no functional components.',
    'Python enthusiast. My code is indent-pendent.',
    'If you don''t write tests, we already share a philosophy.'
  ];
  langs TEXT[] := ARRAY['Rust','TypeScript','Java','Python','Go','C++','JavaScript','HTML (yes, it''s a language)'];
  locs TEXT[] := ARRAY['2 miles away','5 miles away','Right behind you','In your node_modules','Localhost','Cloud9'];
BEGIN
  INSERT INTO public.users (id, name, email, picture, bio, language, location)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'user_name', 'Anonymous Coder'),
    COALESCE(NEW.email, 'no-email@vibecodium.com'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://api.dicebear.com/7.x/avataaars/svg?seed=' || NEW.id::text),
    bios[1 + floor(random() * array_length(bios, 1))::int],
    langs[1 + floor(random() * array_length(langs, 1))::int],
    locs[1 + floor(random() * array_length(locs, 1))::int]
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, email = EXCLUDED.email, picture = EXCLUDED.picture, updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ═══════════════════════════════════════════
-- PROJECT DATA (replaces SQLite + MongoDB Project)
-- ═══════════════════════════════════════════

-- public.projects (replaces SQLite projects + MongoDB Project)
CREATE TABLE public.projects (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  name         TEXT NOT NULL,
  repo_url     TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('cloning','ready','error')),
  local_path   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Projects readable by authenticated" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Projects insertable by authenticated" ON public.projects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Projects updatable by owner" ON public.projects FOR UPDATE TO authenticated USING (true);

-- public.files (replaces SQLite files)
CREATE TABLE public.files (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  path         TEXT NOT NULL,
  content      TEXT,
  updated_at   BIGINT,
  UNIQUE(project_id, path)
);
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Files readable by authenticated" ON public.files FOR SELECT TO authenticated USING (true);
CREATE POLICY "Files writable by authenticated" ON public.files FOR ALL TO authenticated USING (true);

-- public.snapshots (replaces SQLite snapshots)
CREATE TABLE public.snapshots (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  path         TEXT NOT NULL,
  content      TEXT,
  timestamp    BIGINT NOT NULL
);
ALTER TABLE public.snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Snapshots readable by authenticated" ON public.snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Snapshots writable by authenticated" ON public.snapshots FOR ALL TO authenticated USING (true);

-- public.sessions (replaces SQLite sessions)
CREATE TABLE public.sessions (
  token        TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at   BIGINT NOT NULL,
  expires_at   BIGINT NOT NULL,
  created_by   TEXT NOT NULL,
  label        TEXT
);
CREATE INDEX idx_sessions_project ON public.sessions(project_id);
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sessions readable by all" ON public.sessions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Sessions writable by authenticated" ON public.sessions FOR ALL TO authenticated USING (true);

-- ═══════════════════════════════════════════
-- COMMUNITY / SOCIAL (replaces MongoDB models)
-- ═══════════════════════════════════════════

-- public.help_posts (replaces MongoDB HelpPost)
CREATE TABLE public.help_posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  repo_url    TEXT NOT NULL,
  user_name   TEXT NOT NULL,
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  difficulty  TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.help_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Help posts readable by all" ON public.help_posts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Help posts creatable by authenticated" ON public.help_posts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- public.deployed_apps (replaces MongoDB DeployedApp)
CREATE TABLE public.deployed_apps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id),
  title         TEXT NOT NULL,
  project_repo  TEXT NOT NULL DEFAULT '',
  project_link  TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.deployed_apps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deployments readable by owner" ON public.deployed_apps FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Deployments creatable by authenticated" ON public.deployed_apps FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- public.timeline_events (replaces MongoDB TimelineEvent)
CREATE TABLE public.timeline_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     TEXT NOT NULL,
  file_path      TEXT NOT NULL,
  event_type     TEXT NOT NULL CHECK (event_type IN ('code_update','agent_accepted')),
  user_id        TEXT NOT NULL,
  user_name      TEXT NOT NULL,
  user_color     TEXT NOT NULL DEFAULT '',
  content        TEXT NOT NULL DEFAULT '',
  cursor_line    INT,
  cursor_column  INT,
  is_checkpoint  BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_timeline_project_file ON public.timeline_events(project_id, file_path, created_at);
CREATE INDEX idx_timeline_checkpoint ON public.timeline_events(is_checkpoint) WHERE is_checkpoint = true;
ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Timeline readable by authenticated" ON public.timeline_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Timeline writable by authenticated" ON public.timeline_events FOR ALL TO authenticated USING (true);
```

---

## File Map

### Files to CREATE

| File                                       | Purpose                              |
| ------------------------------------------ | ------------------------------------ |
| `supabase/migrations/<ts>_full_schema.sql` | All PostgreSQL tables + trigger      |
| `client/src/lib/supabase.ts`               | Frontend Supabase client init        |
| `client/src/contexts/AuthContext.tsx`      | Auth context replacing Auth0Provider |
| `server/src/db/supabase.ts`                | Server-side Supabase admin client    |

### Files to MODIFY (Frontend)

| File                                           | Change                                                   |
| ---------------------------------------------- | -------------------------------------------------------- |
| `client/src/main.tsx`                          | Replace `Auth0Provider` → `AuthProvider`                 |
| `client/src/routes/login.tsx`                  | `useAuth0()` → `useAuth()`                               |
| `client/src/routes/index.tsx`                  | `useAuth0()` → `useAuth()`                               |
| `client/src/routes/dashboard.tsx`              | `useAuth0()` → `useAuth()`                               |
| `client/src/routes/profile.tsx`                | `useAuth0()` → `useAuth()`                               |
| `client/src/routes/community.tsx`              | `useAuth0()` → `useAuth()`                               |
| `client/src/components/Workspace.tsx`          | `useAuth0()` → `useAuth()`                               |
| `client/src/components/LandingPage.tsx`        | `useAuth0()` → `useAuth()`                               |
| `client/src/components/ImportModal.tsx`        | `useAuth0()` → `useAuth()`                               |
| `client/src/components/ActivityFeed.tsx`       | `useAuth0()` → `useAuth()`                               |
| `client/src/components/CoderMatchModal.tsx`    | `useAuth0()` → `useAuth()`                               |
| `client/src/components/CommunityHelpModal.tsx` | `useAuth0()` → `useAuth()`                               |
| `client/src/contexts/SocketProvider.tsx`       | `useAuth0()` → `useAuth()`                               |
| `client/src/contexts/WebSocketProvider.tsx`    | `useAuth0()` → `useAuth()`                               |
| `client/package.json`                          | Remove `@auth0/auth0-react`, add `@supabase/supabase-js` |
| `client/.env`                                  | Replace Auth0 vars with Supabase vars                    |

### Files to MODIFY (Backend)

| File                                      | Change                                                                                                                              |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `server/src/middleware/authMiddleware.ts` | Auth0 `/userinfo` → `jose` JWT verify. Remove Mongoose upsert.                                                                      |
| `server/src/index.ts`                     | Remove Mongoose imports/error handler. Replace SQLite `db` imports with Supabase client. Update `logTimelineEvent` to use Supabase. |
| `server/src/routes/users.ts`              | Mongoose → Supabase queries. `auth0Id` → `user.sub`.                                                                                |
| `server/src/routes/help.ts`               | Mongoose → Supabase queries. `auth0_id` → `user_id`.                                                                                |
| `server/src/routes/deploy.ts`             | Mongoose → Supabase queries. `auth0_id` → `user_id`.                                                                                |
| `server/src/routes/projects.ts`           | Replace BOTH Mongoose `Project` AND Drizzle `db` with Supabase queries.                                                             |
| `server/src/routes/sessions.ts`           | Drizzle `db` → Supabase queries.                                                                                                    |
| `server/src/routes/timeline.ts`           | Mongoose `TimelineEvent` → Supabase queries.                                                                                        |
| `server/src/routes/github.ts`             | `auth0Id` → `userId` param rename.                                                                                                  |
| `server/src/utils/tokens.ts`              | Mongoose → Supabase query.                                                                                                          |
| `server/src/utils/sync.ts`                | Drizzle `db` → Supabase queries for file fetching.                                                                                  |
| `server/package.json`                     | Remove `mongoose`, `@types/mongoose`, `drizzle-orm`, `drizzle-kit`. Add `@supabase/supabase-js`.                                    |
| `server/.env`                             | Remove `AUTH0_DOMAIN`, `MONGO_URI`. Add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`.    |

### Files to DELETE

| File                                    | Reason                                          |
| --------------------------------------- | ----------------------------------------------- |
| `server/src/db/index.ts`                | SQLite/Drizzle init — replaced by `supabase.ts` |
| `server/src/db/schema.ts`               | Drizzle schema — replaced by Supabase migration |
| `server/src/db/mongoose.ts`             | Mongoose connection — eliminated                |
| `server/src/db/models/User.ts`          | Mongoose model → Supabase table + trigger       |
| `server/src/db/models/UserToken.ts`     | Mongoose model → Supabase table                 |
| `server/src/db/models/HelpPost.ts`      | Mongoose model → Supabase table                 |
| `server/src/db/models/DeployedApp.ts`   | Mongoose model → Supabase table                 |
| `server/src/db/models/Project.ts`       | Mongoose model → Supabase table                 |
| `server/src/db/models/TimelineEvent.ts` | Mongoose model → Supabase table                 |
| `server/vibecodium.db`                  | SQLite database file — no longer needed         |

---

## Key Implementation Details

### `client/src/lib/supabase.ts`

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### `client/src/contexts/AuthContext.tsx`

```typescript
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Session, User } from "@supabase/supabase-js";

interface AuthUser {
  sub: string;        // Supabase UUID — same shape as old Auth0 user.sub
  email: string;
  name: string;
  nickname: string;   // GitHub username
  picture: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  getAccessTokenSilently: () => Promise<string>;
  loginWithRedirect: (opts?: { appState?: { returnTo?: string } }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function mapUser(u: User): AuthUser {
  const meta = u.user_metadata ?? {};
  return {
    sub: u.id,
    email: u.email ?? "",
    name: meta.full_name || meta.name || meta.user_name || "Anonymous Coder",
    nickname: meta.user_name || meta.preferred_username || "",
    picture: meta.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.id}`,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ? mapUser(session.user) : null);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ? mapUser(session.user) : null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const getAccessTokenSilently = useCallback(async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Not authenticated");
    return session.access_token;
  }, []);

  const loginWithRedirect = useCallback(async (opts?: { appState?: { returnTo?: string } }) => {
    if (opts?.appState?.returnTo) {
      sessionStorage.setItem("auth_return_to", opts.appState.returnTo);
    }
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: window.location.origin },
    });
  }, []);

  const logout = useCallback(() => {
    supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, getAccessTokenSilently, loginWithRedirect, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
```

### `server/src/db/supabase.ts`

```typescript
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

// Service role client — bypasses RLS for server-side operations
export const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});
```

### `server/src/middleware/authMiddleware.ts` (new version)

```typescript
import { createMiddleware } from "hono/factory";
import { jwtVerify } from "jose";

const tokenCache = new Map<string, { user: any; expiresAt: number }>();

export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid authorization header" }, 401);
  }

  const token = authHeader.split(" ")[1];
  if (!token) return c.json({ error: "Malformed authorization header" }, 401);

  const now = Date.now();
  const cached = tokenCache.get(token);
  if (cached && cached.expiresAt > now) {
    c.set("user", cached.user);
    return next();
  }

  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (!jwtSecret) throw new Error("SUPABASE_JWT_SECRET not configured");

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(jwtSecret), { algorithms: ["HS256"] });
    const meta = (payload as any).user_metadata ?? {};
    const user = {
      sub: payload.sub as string,
      email: (payload as any).email as string,
      name: meta.full_name || meta.name || "Anonymous Coder",
      nickname: meta.user_name || meta.preferred_username || "",
      picture: meta.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${payload.sub}`,
    };

    const jwtExp = (payload.exp ?? 0) * 1000;
    const cacheUntil = Math.min(jwtExp, now + 15 * 60 * 1000);
    tokenCache.set(token, { user, expiresAt: cacheUntil });

    c.set("user", user);
    return next();
  } catch (err: any) {
    console.error("JWT verification failed:", err.message);
    return c.json({ error: "Unauthorized: Invalid or expired token" }, 401);
  }
});
```

---

## Environment Variables

### `client/.env`

```
VITE_SUPABASE_URL=https://zaeqbsoxorivttvkyucu.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key-from-dashboard>
VITE_BACKEND_URL=http://localhost:3000
```

### `server/.env` (additions/replacements)

```
# Replace AUTH0_DOMAIN and MONGO_URI with:
SUPABASE_URL=https://zaeqbsoxorivttvkyucu.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_JWT_SECRET=<jwt-secret>
```

---

## Migration Strategy for Route Files

All route files follow the same pattern. Replace:

```typescript
// OLD: Drizzle/SQLite
import { db } from "../db";
import { files, projects } from "../db/schema";
import { eq } from "drizzle-orm";
const rows = await db.select().from(files).where(eq(files.projectId, id));

// OLD: Mongoose
import { connectMongo } from "../db/mongoose";
import { Project } from "../db/models/Project";
await connectMongo();
const project = await Project.findById(id);
```

With:

```typescript
// NEW: Supabase
import { supabase } from "../db/supabase";
const { data: rows } = await supabase.from("files").select("*").eq("project_id", id);
const { data: project } = await supabase.from("projects").select("*").eq("id", id).single();
```

> [!NOTE]
> The Supabase service role client bypasses RLS, so server-side queries work exactly like direct DB access. Column names use `snake_case` in PostgreSQL (e.g. `project_id` not `projectId`).

---

## Verification Plan

1. **Migration runs**: `supabase db push` or apply migration — all tables created
2. **Trigger works**: Sign up via GitHub → `public.users` row auto-created with name/picture
3. **Backend starts**: No Mongoose/Drizzle/Auth0 references, no SQLite file created
4. **Login flow**: `/login` → GitHub OAuth → app authenticated → session persists on refresh
5. **Data operations**: Import repo → files/snapshots stored in Supabase PG, not SQLite
6. **Protected routes**: Dashboard, profile, deploy — all work with Supabase JWT
7. **Logout**: Session cleared, redirected to login

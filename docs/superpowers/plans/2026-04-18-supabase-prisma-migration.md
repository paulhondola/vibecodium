# Supabase / Prisma Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dual SQLite/Drizzle + MongoDB/Mongoose database stack with a single Prisma client backed by Supabase (PostgreSQL).

**Architecture:** The Prisma schema (`server/prisma/schema.prisma`) already consolidates both databases. The migration removes all Drizzle ORM and Mongoose code, replacing every query with a `prisma.*` call. No data migration — Supabase starts fresh.

**Tech Stack:** Prisma 7, `@prisma/adapter-pg`, `pg`, Supabase PostgreSQL, Bun runtime

---

## File Map

| Status | File | Change |
|--------|------|--------|
| MODIFY | `server/src/utils/tokens.ts` | Replace Mongoose → Prisma |
| MODIFY | `server/src/utils/sync.ts` | Replace Drizzle → Prisma |
| MODIFY | `server/src/middleware/authMiddleware.ts` | Replace Mongoose upsert → Prisma |
| MODIFY | `server/src/routes/sessions.ts` | Replace Drizzle → Prisma + DateTime conversions |
| MODIFY | `server/src/routes/help.ts` | Replace Mongoose → Prisma |
| MODIFY | `server/src/routes/timeline.ts` | Replace Mongoose → Prisma |
| MODIFY | `server/src/routes/users.ts` | Replace Mongoose → Prisma |
| MODIFY | `server/src/routes/projects.ts` | Replace both Drizzle + Mongoose → Prisma |
| MODIFY | `server/src/routes/deploy.ts` | Replace both Drizzle + Mongoose → Prisma |
| MODIFY | `server/src/index.ts` | Replace WS auto-save + timeline → Prisma |
| MODIFY | `server/package.json` | Remove old deps, verify new deps |
| DELETE | `server/src/db/index.ts` | SQLite/Drizzle bootstrap |
| DELETE | `server/src/db/schema.ts` | Drizzle schema |
| DELETE | `server/src/db/mongoose.ts` | MongoDB connection |
| DELETE | `server/src/db/models/*.ts` | All 6 Mongoose models |

---

## Task 1: Prerequisites — Run migration, generate client, add nanoid

**Files:**
- Modify: `server/package.json`

- [ ] **Step 1: Verify `.env` has DATABASE_URL pointing to Supabase**

  The `server/.env.example` shows `DATABASE_URL=` (connection pooler URL) and `DIRECT_URL=` (direct connection). Prisma 7 + `@prisma/adapter-pg` only needs `DATABASE_URL`. Ensure `server/.env` has the Supabase pooler `DATABASE_URL` set.

- [ ] **Step 2: Add missing dependencies to `server/package.json`**

  The `@prisma/adapter-pg` and `pg` packages are imported in `server/src/db/prisma.ts` but not listed in `server/package.json`. Add them:

  ```json
  {
    "dependencies": {
      "@prisma/adapter-pg": "^7.0.0",
      "@prisma/client": "^7.0.0",
      "nanoid": "^5.1.5",
      "pg": "^8.16.0",
      ...
    },
    "devDependencies": {
      "@types/pg": "^8.11.14",
      ...
    }
  }
  ```

  Remove `drizzle-orm`, `mongoose`, `@types/mongoose` from dependencies and `drizzle-kit` from devDependencies.

- [ ] **Step 3: Install dependencies**

  ```bash
  cd /Users/paulhondola/Developer/vibecodium
  bun install
  ```

  Expected: lock file updated, no errors.

- [ ] **Step 4: Run Prisma migration to create tables in Supabase**

  ```bash
  cd /Users/paulhondola/Developer/vibecodium/server
  bun --bun run prisma migrate dev --name init
  ```

  Expected output: Migration created and applied, tables visible in Supabase dashboard.

- [ ] **Step 5: Generate Prisma client**

  ```bash
  cd /Users/paulhondola/Developer/vibecodium/server
  bun --bun run prisma generate
  ```

  Expected: `server/src/generated/prisma/` updated.

- [ ] **Step 6: Commit**

  ```bash
  cd /Users/paulhondola/Developer/vibecodium
  git add server/package.json server/prisma/ bun.lock
  git commit -m "chore: add prisma/pg/nanoid deps, run init migration"
  ```

---

## Task 2: Update `server/src/utils/tokens.ts`

**Files:**
- Modify: `server/src/utils/tokens.ts`

- [ ] **Step 1: Replace the entire file**

  ```typescript
  import { prisma } from "../db/prisma";

  export async function getUserTokens(auth0Id: string) {
      const tokens = await prisma.userToken.findUnique({ where: { auth0Id } });
      if (!tokens) {
          return { githubToken: null, vercelToken: null };
      }
      return {
          githubToken: tokens.githubToken,
          vercelToken: tokens.vercelToken,
      };
  }
  ```

- [ ] **Step 2: Type-check**

  ```bash
  cd /Users/paulhondola/Developer/vibecodium/server
  bun run tsc --noEmit --pretty false 2>&1 | grep "utils/tokens"
  ```

  Expected: no errors for this file.

- [ ] **Step 3: Commit**

  ```bash
  git add server/src/utils/tokens.ts
  git commit -m "feat: migrate tokens util to Prisma"
  ```

---

## Task 3: Update `server/src/utils/sync.ts`

**Files:**
- Modify: `server/src/utils/sync.ts`

- [ ] **Step 1: Replace the entire file**

  ```typescript
  import * as fs from "node:fs";
  import * as path from "node:path";
  import { prisma } from "../db/prisma";

  export async function syncProjectFilesToDisk(projectId: string): Promise<string> {
      const targetDir = `/tmp/vibecodium/${projectId}`;

      if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
      }

      const projectFiles = await prisma.file.findMany({
          where: { projectId },
          select: { path: true, content: true },
      });

      for (const f of projectFiles) {
          if (!f.content) continue;

          const fullPath = path.join(targetDir, f.path);
          const dir = path.dirname(fullPath);

          if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
          }

          fs.writeFileSync(fullPath, f.content, "utf-8");
      }

      return targetDir;
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add server/src/utils/sync.ts
  git commit -m "feat: migrate sync util to Prisma"
  ```

---

## Task 4: Update `server/src/middleware/authMiddleware.ts`

**Files:**
- Modify: `server/src/middleware/authMiddleware.ts`

- [ ] **Step 1: Replace the entire file**

  ```typescript
  import { createMiddleware } from "hono/factory";
  import { prisma } from "../db/prisma";

  const FUN_BIOS = [
      "I use Arch btw.",
      "Looking for a partner to rewrite my Node backend in Rust.",
      "React developer. Swipe left if no functional components.",
      "I like long walks on the beach and abstractSingletonProxyFactoryBeans.",
      "Python enthusiast. My code is indent-pendent.",
      "If you don't write tests, we already share a philosophy."
  ];
  const LANGUAGES = ["Rust", "TypeScript", "Java", "Python", "Go", "C++", "JavaScript", "HTML (yes, it's a language)"];
  const LOCATIONS = ["2 miles away", "5 miles away", "Right behind you", "In your node_modules", "Localhost", "Cloud9"];

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

          const userPayload = (await response.json()) as any;

          cache.set(token, { user: userPayload, expiresAt: now + 15 * 60 * 1000 });

          // Upsert user into Supabase via Prisma
          const randomBio = FUN_BIOS[Math.floor(Math.random() * FUN_BIOS.length)]!;
          const randomLang = LANGUAGES[Math.floor(Math.random() * LANGUAGES.length)]!;
          const randomLoc = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)]!;

          try {
              await prisma.user.upsert({
                  where: { auth0Id: userPayload.sub },
                  update: {
                      name: userPayload.name || userPayload.nickname || "Anonymous Coder",
                      email: userPayload.email || "no-email@vibecodium.com",
                      picture: userPayload.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userPayload.sub}`,
                      bio: randomBio,
                      language: randomLang,
                      location: randomLoc,
                  },
                  create: {
                      auth0Id: userPayload.sub,
                      name: userPayload.name || userPayload.nickname || "Anonymous Coder",
                      email: userPayload.email || "no-email@vibecodium.com",
                      picture: userPayload.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userPayload.sub}`,
                      bio: randomBio,
                      language: randomLang,
                      location: randomLoc,
                  },
              });
          } catch (e) {
              console.error("Failed to upsert user in Supabase:", e);
          }

          c.set("user", userPayload);
          await next();

      } catch (error: any) {
          console.error("Token Verification failed:", error.message);
          return c.json({ error: "Unauthorized", details: error.message }, 401);
      }
  });
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add server/src/middleware/authMiddleware.ts
  git commit -m "feat: migrate auth middleware to Prisma"
  ```

---

## Task 5: Update `server/src/routes/sessions.ts`

**Files:**
- Modify: `server/src/routes/sessions.ts`

**Key DateTime note:** Prisma `Session.createdAt` and `expiresAt` are `DateTime` columns. We store `new Date(ms)` and read back `.getTime()` when returning ms to clients.

- [ ] **Step 1: Replace the entire file**

  ```typescript
  import { Hono } from "hono";
  import { authMiddleware } from "../middleware/authMiddleware";
  import { prisma } from "../db/prisma";

  type Variables = { user: { sub: string; [key: string]: unknown } };

  const sessionsRoutes = new Hono<{ Variables: Variables }>();

  // POST /api/sessions — create a session token for a project (auth required)
  sessionsRoutes.post("/", authMiddleware, async (c) => {
      try {
          const user = c.get("user");
          const body = await c.req.json<{ projectId: string; label?: string; expiresInDays?: number }>();

          if (!body.projectId) {
              return c.json({ error: "Missing projectId" }, 400);
          }

          const now = Date.now();
          const expiresAtMs = now + (body.expiresInDays ?? 7) * 24 * 60 * 60 * 1000;
          const token = crypto.randomUUID();

          await prisma.session.create({
              data: {
                  token,
                  projectId: body.projectId,
                  createdAt: new Date(now),
                  expiresAt: new Date(expiresAtMs),
                  createdBy: user.sub,
                  label: body.label ?? null,
              },
          });

          const origin = c.req.header("origin") ?? "http://localhost:5173";
          const shareUrl = `${origin}/?session=${token}`;

          return c.json({ token, projectId: body.projectId, label: body.label ?? null, expiresAt: expiresAtMs, shareUrl }, 201);
      } catch (e: any) {
          return c.json({ error: e.message }, 500);
      }
  });

  // GET /api/sessions/:token — validate token, return project info (no auth required)
  sessionsRoutes.get("/:token", async (c) => {
      try {
          const token = c.req.param("token");
          const session = await prisma.session.findUnique({ where: { token } });

          if (!session) {
              return c.json({ error: "Session not found" }, 404);
          }

          if (session.expiresAt.getTime() < Date.now()) {
              return c.json({ error: "Session expired" }, 410);
          }

          return c.json({ projectId: session.projectId, label: session.label, expiresAt: session.expiresAt.getTime() });
      } catch (e: any) {
          return c.json({ error: e.message }, 500);
      }
  });

  // GET /api/sessions/:token/files — file list for guests (no auth required)
  sessionsRoutes.get("/:token/files", async (c) => {
      try {
          const token = c.req.param("token");
          const session = await prisma.session.findUnique({ where: { token } });

          if (!session) {
              return c.json({ error: "Session not found" }, 404);
          }

          if (session.expiresAt.getTime() < Date.now()) {
              return c.json({ error: "Session expired" }, 410);
          }

          const projectFiles = await prisma.file.findMany({
              where: { projectId: session.projectId },
              select: { id: true, path: true, content: true },
          });

          return c.json({ success: true, files: projectFiles });
      } catch (e: any) {
          return c.json({ error: e.message }, 500);
      }
  });

  // DELETE /api/sessions/:token — revoke (owner only, auth required)
  sessionsRoutes.delete("/:token", authMiddleware, async (c) => {
      try {
          const user = c.get("user");
          const token = c.req.param("token");

          const session = await prisma.session.findUnique({ where: { token } });

          if (!session) {
              return c.json({ error: "Session not found" }, 404);
          }

          if (session.createdBy !== user.sub) {
              return c.json({ error: "Forbidden" }, 403);
          }

          await prisma.session.delete({ where: { token } });

          return c.body(null, 204);
      } catch (e: any) {
          return c.json({ error: e.message }, 500);
      }
  });

  // GET /api/sessions?projectId=... — list active sessions for a project (auth required)
  sessionsRoutes.get("/", authMiddleware, async (c) => {
      try {
          const user = c.get("user");
          const projectId = c.req.query("projectId");

          if (!projectId) {
              return c.json({ error: "Missing projectId query param" }, 400);
          }

          const projectSessions = await prisma.session.findMany({
              where: { projectId, createdBy: user.sub },
          });

          const active = projectSessions.filter((s) => s.expiresAt.getTime() > Date.now());

          return c.json({ sessions: active });
      } catch (e: any) {
          return c.json({ error: e.message }, 500);
      }
  });

  export default sessionsRoutes;
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add server/src/routes/sessions.ts
  git commit -m "feat: migrate sessions route to Prisma"
  ```

---

## Task 6: Update `server/src/routes/help.ts`

**Files:**
- Modify: `server/src/routes/help.ts`

**Note:** Prisma enum `Difficulty` uses uppercase: `EASY`, `MEDIUM`, `HARD`. The old Mongoose code stored lowercase. Normalize on write.

- [ ] **Step 1: Replace the entire file**

  ```typescript
  import { Hono } from "hono";
  import { authMiddleware } from "../middleware/authMiddleware";
  import { prisma } from "../db/prisma";
  import type { Difficulty } from "../generated/prisma";

  const helpRoutes = new Hono();

  // POST /api/help: Save a new help post
  helpRoutes.post("/", authMiddleware, async (c) => {
      try {
          const user = (c.get as any)("user");
          const body = await c.req.json<{ title: string; description: string; repoUrl: string; difficulty?: string }>();

          if (!body.title || !body.description || !body.repoUrl) {
              return c.json({ success: false, error: "Title, Description, and RepoUrl are required." }, 400);
          }

          const difficultyMap: Record<string, Difficulty> = {
              easy: "EASY",
              medium: "MEDIUM",
              hard: "HARD",
          };
          const difficulty: Difficulty = difficultyMap[body.difficulty?.toLowerCase() ?? ""] ?? "MEDIUM";

          const newPost = await prisma.helpPost.create({
              data: {
                  title: body.title,
                  description: body.description,
                  repoUrl: body.repoUrl,
                  userName: user.nickname || user.name || "Anonymous",
                  auth0Id: user.sub,
                  difficulty,
              },
          });

          return c.json({ success: true, post: newPost }, 201);
      } catch (error: any) {
          console.error("Create help post error:", error);
          return c.json({ success: false, error: error.message }, 500);
      }
  });

  // GET /api/help: Fetch all help posts
  helpRoutes.get("/", async (c) => {
      try {
          const posts = await prisma.helpPost.findMany({ orderBy: { createdAt: "desc" } });
          return c.json({ success: true, posts }, 200);
      } catch (error: any) {
          console.error("Fetch help posts error:", error);
          return c.json({ success: false, error: error.message }, 500);
      }
  });

  export default helpRoutes;
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add server/src/routes/help.ts
  git commit -m "feat: migrate help route to Prisma"
  ```

---

## Task 7: Update `server/src/routes/timeline.ts`

**Files:**
- Modify: `server/src/routes/timeline.ts`

**Note:** Prisma enum `TimelineEventType` uses uppercase: `CODE_UPDATE`, `AGENT_ACCEPTED`. The `.lean()` call is Mongoose-specific — Prisma returns plain objects natively.

- [ ] **Step 1: Replace the entire file**

  ```typescript
  import { Hono } from "hono";
  import { authMiddleware } from "../middleware/authMiddleware";
  import { prisma } from "../db/prisma";

  const LLM_BASE_URL = process.env.LLM_BASE_URL ?? "https://api.deepseek.com/v1";
  const LLM_KEY      = process.env.LLM_KEY ?? "";
  const LLM_MODEL    = process.env.LLM_MODEL ?? "deepseek-chat";

  const timelineRoutes = new Hono();

  // GET /api/timeline/:projectId
  timelineRoutes.get("/:projectId", authMiddleware, async (c) => {
      try {
          const projectId = c.req.param("projectId");
          const filePath  = c.req.query("path");
          const limit     = Math.min(parseInt(c.req.query("limit") ?? "200", 10), 500);
          const before    = c.req.query("before");

          if (!projectId) {
              return c.json({ success: false, error: "Missing projectId" }, 400);
          }

          const events = await prisma.timelineEvent.findMany({
              where: {
                  projectId,
                  ...(filePath ? { filePath } : {}),
                  ...(before ? { createdAt: { lt: new Date(before) } } : {}),
              },
              orderBy: { createdAt: "asc" },
              take: limit + 1,
              select: {
                  id: true,
                  projectId: true,
                  filePath: true,
                  eventType: true,
                  userId: true,
                  userName: true,
                  userColor: true,
                  content: true,
                  cursorLine: true,
                  cursorColumn: true,
                  isCheckpoint: true,
                  createdAt: true,
              },
          });

          const hasMore = events.length > limit;
          if (hasMore) events.pop();

          return c.json({ success: true, events, hasMore }, 200);
      } catch (error: any) {
          console.error("GET /api/timeline error:", error);
          return c.json({ success: false, error: error.message }, 500);
      }
  });

  // POST /api/timeline/:projectId/analyze
  timelineRoutes.post("/:projectId/analyze", authMiddleware, async (c) => {
      if (!LLM_KEY) {
          return c.json({ success: false, error: "LLM_KEY not configured" }, 500);
      }

      try {
          const projectId = c.req.param("projectId");
          const body = await c.req.json<{
              filePath: string;
              eventIds: string[];
              instruction?: string;
          }>();

          if (!body.filePath || !body.eventIds?.length) {
              return c.json({ success: false, error: "filePath and eventIds are required" }, 400);
          }

          const ids = body.eventIds.slice(0, 10);
          const events = await prisma.timelineEvent.findMany({
              where: { id: { in: ids }, projectId },
              orderBy: { createdAt: "asc" },
              select: {
                  eventType: true,
                  userName: true,
                  userColor: true,
                  content: true,
                  createdAt: true,
                  filePath: true,
              },
          });

          if (events.length === 0) {
              return c.json({ success: false, error: "No events found for given IDs" }, 404);
          }

          const LINES = 200;
          const truncate = (s: string) => s.split("\n").slice(0, LINES).join("\n");

          const diffSections = events.map((ev, i) => {
              const prev  = i === 0 ? "" : truncate(events[i - 1]!.content ?? "");
              const curr  = truncate(ev.content ?? "");
              const actor = ev.eventType === "AGENT_ACCEPTED"
                  ? `🤖 AI Agent`
                  : `👤 ${ev.userName}`;
              const ts    = new Date(ev.createdAt).toLocaleTimeString();

              return [
                  `--- Change ${i + 1} at ${ts} by ${actor} ---`,
                  `BEFORE (first ${LINES} lines):\n\`\`\`\n${prev || "(empty)"}\n\`\`\``,
                  `AFTER  (first ${LINES} lines):\n\`\`\`\n${curr}\n\`\`\``,
              ].join("\n");
          });

          const systemPrompt = [
              "You are an expert code reviewer performing time-travel debugging analysis.",
              "You will receive a sequence of code changes from a collaborative coding session.",
              "For each change, identify: what was added/removed, who made it, whether it looks like a bug introduction or a fix, and any patterns across changes.",
              "Be concise and specific. Focus on logic, not style. Format your response in clear sections.",
          ].join(" ");

          const userMessage = [
              `File: ${body.filePath}`,
              body.instruction ? `\nFocus: ${body.instruction}\n` : "",
              "\nCode change history (oldest → newest):\n",
              diffSections.join("\n\n"),
              "\nProvide a clear analysis of what changed, who changed it, and flag any bugs or regressions.",
          ].join("\n");

          const llmRes = await fetch(`${LLM_BASE_URL}/chat/completions`, {
              method: "POST",
              headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${LLM_KEY}`,
              },
              body: JSON.stringify({
                  model: LLM_MODEL,
                  messages: [
                      { role: "system", content: systemPrompt },
                      { role: "user",   content: userMessage },
                  ],
                  max_tokens: 800,
                  temperature: 0.3,
              }),
              signal: AbortSignal.timeout(30_000),
          });

          if (!llmRes.ok) {
              const err = await llmRes.text();
              return c.json({ success: false, error: err }, 500);
          }

          const llmData = await llmRes.json() as {
              choices: { message: { content: string } }[];
          };
          const analysis = llmData.choices[0]?.message?.content?.trim() ?? "";

          return c.json({ success: true, analysis, analyzedCount: events.length }, 200);
      } catch (error: any) {
          console.error("POST /api/timeline/analyze error:", error);
          return c.json({ success: false, error: error.message }, 500);
      }
  });

  export default timelineRoutes;
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add server/src/routes/timeline.ts
  git commit -m "feat: migrate timeline route to Prisma"
  ```

---

## Task 8: Update `server/src/routes/users.ts`

**Files:**
- Modify: `server/src/routes/users.ts`

- [ ] **Step 1: Replace the entire file**

  ```typescript
  import { Hono } from "hono";
  import { authMiddleware } from "../middleware/authMiddleware";
  import { prisma } from "../db/prisma";

  type Variables = { user: { sub: string; [key: string]: any } };
  const router = new Hono<{ Variables: Variables }>();

  router.get("/match", authMiddleware, async (c) => {
      try {
          const currentUser = c.get("user");

          const matchUsers = await prisma.user.findMany({
              where: { auth0Id: { not: currentUser.sub } },
          });

          // Shuffle users to randomize matches
          const shuffled = matchUsers.sort(() => 0.5 - Math.random());

          return c.json({ success: true, users: shuffled.slice(0, 20) });
      } catch (error: any) {
          console.error("Fetch match users error:", error);
          return c.json({ success: false, error: "Failed to fetch users" }, 500);
      }
  });

  router.get("/tokens", authMiddleware, async (c) => {
      try {
          const currentUser = c.get("user");
          const tokens = await prisma.userToken.findUnique({ where: { auth0Id: currentUser.sub } });

          if (!tokens) {
              return c.json({ success: true, githubToken: null, vercelToken: null });
          }

          return c.json({
              success: true,
              githubToken: tokens.githubToken ? "****" + tokens.githubToken.slice(-4) : null,
              vercelToken: tokens.vercelToken ? "****" + tokens.vercelToken.slice(-4) : null,
          });
      } catch (error: any) {
          return c.json({ success: false, error: error.message }, 500);
      }
  });

  router.post("/tokens", authMiddleware, async (c) => {
      try {
          const currentUser = c.get("user");
          const body = await c.req.json<{ githubToken?: string; vercelToken?: string }>();

          await prisma.userToken.upsert({
              where: { auth0Id: currentUser.sub },
              update: {
                  githubToken: body.githubToken ?? null,
                  vercelToken: body.vercelToken ?? null,
              },
              create: {
                  auth0Id: currentUser.sub,
                  githubToken: body.githubToken ?? null,
                  vercelToken: body.vercelToken ?? null,
              },
          });

          return c.json({ success: true, message: "Tokens updated successfully" });
      } catch (error: any) {
          return c.json({ success: false, error: error.message }, 500);
      }
  });

  export default router;
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add server/src/routes/users.ts
  git commit -m "feat: migrate users route to Prisma"
  ```

---

## Task 9: Update `server/src/routes/projects.ts`

**Files:**
- Modify: `server/src/routes/projects.ts`

**Key changes:**
- Project IDs: `new mongoose.Types.ObjectId().toString()` → `"proj_" + nanoid(20)`
- File IDs: `crypto.randomUUID()` → `"file_" + nanoid(20)` (kept as UUID for now, prefixed for convention)
- `db.insert(files).values(...).onConflictDoUpdate(...)` → `prisma.file.upsert(...)`
- `db.insert(projects).values(...).onConflictDoNothing()` → `prisma.project.upsert(...)` with no-op update
- `db.insert(snapshots).values(...)` → `prisma.snapshot.create(...)`
- `Project.findById()` / `Project.find()` / `Project.create()` / `Project.findByIdAndUpdate()` → Prisma equivalents
- Snapshot `timestamp` must be a `Date`, not a number
- Files `updatedAt` is `@updatedAt` in Prisma — no need to set it manually

- [ ] **Step 1: Write the new file**

  ```typescript
  import { Hono } from "hono";
  import { authMiddleware } from "../middleware/authMiddleware";
  import { prisma } from "../db/prisma";
  import * as fs from "node:fs";
  import * as path from "node:path";
  import { syncProjectFilesToDisk } from "../utils/sync";
  import { getUserTokens } from "../utils/tokens";
  import { nanoid } from "nanoid";

  const projectsRoutes = new Hono();

  projectsRoutes.use("/*", async (c, next) => {
      if (c.req.method === "OPTIONS") return next();
      return authMiddleware(c, next);
  });

  function getAllFilesRecursive(dir: string, baseDir: string): { path: string; content: string }[] {
      const results: { path: string; content: string }[] = [];
      const items = fs.readdirSync(dir);

      for (const item of items) {
          if (item === ".git" || item === "node_modules") continue;

          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
              results.push(...getAllFilesRecursive(fullPath, baseDir));
          } else {
              if (stat.size > 2 * 1024 * 1024) continue;
              try {
                  const content = fs.readFileSync(fullPath, "utf-8");
                  if (content.includes("\x00")) continue;
                  const relativePath = path.relative(baseDir, fullPath);
                  results.push({ path: relativePath, content });
              } catch (e) {
                  // skip unreadable files gracefully
              }
          }
      }

      return results;
  }

  projectsRoutes.get("/", async (c) => {
      try {
          const user = (c.get as any)("user");
          if (!user || (!user.sub && !user.nickname)) {
              return c.json({ error: "Unauthorized user" }, 401);
          }

          const userId = user.sub || user.nickname;
          const userProjects = await prisma.project.findMany({
              where: { userId },
              orderBy: { createdAt: "desc" },
          });

          return c.json({ success: true, projects: userProjects }, 200);
      } catch (err: any) {
          return c.json({ error: `Failed to fetch projects: ${err.message}` }, 500);
      }
  });

  projectsRoutes.get("/user/:userId", async (c) => {
      try {
          const userId = c.req.param("userId");
          if (!userId) return c.json({ error: "Missing userId" }, 400);

          const userProjects = await prisma.project.findMany({
              where: { userId },
              orderBy: { createdAt: "desc" },
          });
          return c.json({ success: true, projects: userProjects }, 200);
      } catch (err: any) {
          return c.json({ error: `Failed to fetch user projects: ${err.message}` }, 500);
      }
  });

  projectsRoutes.post("/import", async (c) => {
      try {
          const payload = await c.req.json();
          const repoUrl = payload.repoUrl as string;

          if (!repoUrl) {
              return c.json({ error: "Missing repoUrl parameter" }, 400);
          }

          if (!repoUrl.startsWith("https://github.com/")) {
              return c.json({ error: "Only GitHub URLs are supported." }, 400);
          }

          const user = (c.get as any)("user");
          const userId = user ? (user.sub || user.nickname) : "anonymous";

          // Check if the user already imported this repository
          const existingProject = await prisma.project.findFirst({
              where: { userId, repoUrl },
          });

          if (existingProject) {
              const projectId = existingProject.id;
              const targetDir = existingProject.localPath || `/tmp/vibecodium/${projectId}`;

              const sqliteFiles = await prisma.file.findMany({
                  where: { projectId },
                  select: { id: true },
                  take: 1,
              });

              if (sqliteFiles.length === 0) {
                  if (fs.existsSync(targetDir)) {
                      console.log(`Re-indexing existing project ${projectId} from disk...`);

                      const allFiles = getAllFilesRecursive(targetDir, targetDir);
                      const BATCH_SIZE = 100;
                      for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
                          const batch = allFiles.slice(i, i + BATCH_SIZE);
                          await prisma.$transaction(
                              batch.map(f => prisma.file.upsert({
                                  where: { projectId_path: { projectId, path: f.path } },
                                  update: { content: f.content },
                                  create: { id: "file_" + nanoid(20), projectId, path: f.path, content: f.content },
                              }))
                          );
                      }

                      return c.json({
                          success: true,
                          message: "Repository re-indexed successfully",
                          projectId,
                          name: existingProject.name,
                          filesCount: allFiles.length,
                      }, 200);
                  } else {
                      // Disk dir gone — re-clone
                      console.log(`Re-cloning project ${projectId} (disk dir missing)...`);
                      await prisma.project.update({ where: { id: projectId }, data: { status: "CLONING" } });

                      fs.mkdirSync("/tmp/vibecodium", { recursive: true });
                      const cloneProc = Bun.spawn(["git", "clone", repoUrl, targetDir], { stdout: "pipe", stderr: "pipe" });
                      const cloneExit = await cloneProc.exited;

                      if (cloneExit !== 0) {
                          const errText = await new Response(cloneProc.stderr).text();
                          await prisma.project.update({ where: { id: projectId }, data: { status: "ERROR" } });
                          return c.json({ error: `Re-clone failed: ${errText}` }, 500);
                      }

                      await prisma.project.update({ where: { id: projectId }, data: { status: "READY", localPath: targetDir } });

                      const allFiles = getAllFilesRecursive(targetDir, targetDir);
                      const BATCH_SIZE = 100;
                      for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
                          const batch = allFiles.slice(i, i + BATCH_SIZE);
                          await prisma.$transaction(
                              batch.map(f => prisma.file.upsert({
                                  where: { projectId_path: { projectId, path: f.path } },
                                  update: { content: f.content },
                                  create: { id: "file_" + nanoid(20), projectId, path: f.path, content: f.content },
                              }))
                          );
                      }

                      return c.json({
                          success: true,
                          message: "Repository re-cloned and indexed successfully",
                          projectId,
                          name: existingProject.name,
                          filesCount: allFiles.length,
                      }, 200);
                  }
              }

              return c.json({
                  success: true,
                  message: "Repository already imported",
                  projectId,
                  name: existingProject.name,
              }, 200);
          }

          const projectId = "proj_" + nanoid(20);
          const targetDir = `/tmp/vibecodium/${projectId}`;
          const projectName = repoUrl.split("/").pop()?.replace(".git", "") || "Untitled";

          console.log(`Cloning ${repoUrl} to ${targetDir}...`);

          await prisma.project.create({
              data: { id: projectId, name: projectName, repoUrl, status: "CLONING", userId },
          });

          fs.mkdirSync("/tmp/vibecodium", { recursive: true });

          const proc = Bun.spawn(["git", "clone", repoUrl, targetDir], { stdout: "pipe", stderr: "pipe" });
          const exitCode = await proc.exited;

          if (exitCode !== 0) {
              const errorText = await new Response(proc.stderr).text();
              await prisma.project.update({ where: { id: projectId }, data: { status: "ERROR" } });
              return c.json({ error: `Failed to clone repository: ${errorText}` }, 500);
          }

          await prisma.project.update({ where: { id: projectId }, data: { status: "READY", localPath: targetDir } });

          const allFiles = getAllFilesRecursive(targetDir, targetDir);
          const BATCH_SIZE = 100;
          for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
              const batch = allFiles.slice(i, i + BATCH_SIZE);
              await prisma.$transaction(
                  batch.map(f => prisma.file.upsert({
                      where: { projectId_path: { projectId, path: f.path } },
                      update: { content: f.content },
                      create: { id: "file_" + nanoid(20), projectId, path: f.path, content: f.content },
                  }))
              );
          }

          return c.json({
              success: true,
              message: "Repository imported and indexed successfully",
              projectId,
              name: projectName,
              filesCount: allFiles.length,
          }, 200);

      } catch (error: any) {
          return c.json({ error: `Internal Server Error: ${error.message}` }, 500);
      }
  });

  projectsRoutes.get("/:id/files", async (c) => {
      try {
          const projectId = c.req.param("id");
          if (!projectId) return c.json({ error: "Missing projectId" }, 400);

          const project = await prisma.project.findUnique({
              where: { id: projectId },
              select: { name: true, repoUrl: true, localPath: true },
          });

          const projectName = project?.name
              || project?.repoUrl?.split("/").pop()?.replace(".git", "")
              || "Untitled";

          let projectFiles = await prisma.file.findMany({
              where: { projectId },
              select: { id: true, path: true, content: true },
          });

          // Auto-recover: DB is empty but disk still has the files
          if (projectFiles.length === 0 && project) {
              const diskDir = project.localPath || `/tmp/vibecodium/${projectId}`;
              if (fs.existsSync(diskDir)) {
                  console.log(`[files] Re-indexing ${projectId} from disk on read...`);

                  const diskFiles = getAllFilesRecursive(diskDir, diskDir);
                  const BATCH_SIZE = 100;
                  for (let i = 0; i < diskFiles.length; i += BATCH_SIZE) {
                      const batch = diskFiles.slice(i, i + BATCH_SIZE);
                      await prisma.$transaction(
                          batch.map(f => prisma.file.upsert({
                              where: { projectId_path: { projectId, path: f.path } },
                              update: { content: f.content },
                              create: { id: "file_" + nanoid(20), projectId, path: f.path, content: f.content },
                          }))
                      );
                  }

                  projectFiles = await prisma.file.findMany({
                      where: { projectId },
                      select: { id: true, path: true, content: true },
                  });
              }
          }

          return c.json({ success: true, files: projectFiles, projectName, repoUrl: project?.repoUrl ?? null });
      } catch (e: any) {
          return c.json({ error: e.message }, 500);
      }
  });

  projectsRoutes.get("/:id/snapshots", async (c) => {
      try {
          const projectId = c.req.param("id");
          const filePath = c.req.query("path");
          if (!projectId) return c.json({ error: "Missing projectId" }, 400);

          const projectSnapshots = await prisma.snapshot.findMany({
              where: {
                  projectId,
                  ...(filePath ? { path: filePath } : {}),
              },
              select: { id: true, path: true, content: true, timestamp: true },
              orderBy: { timestamp: "desc" },
          });

          return c.json({ success: true, snapshots: projectSnapshots });
      } catch (e: any) {
          return c.json({ error: e.message }, 500);
      }
  });

  projectsRoutes.post("/:id/push", async (c) => {
      try {
          const projectId = c.req.param("id");
          if (!projectId) return c.json({ error: "Missing projectId" }, 400);

          const user = (c.get as any)("user");
          const userId = user?.sub || user?.nickname;

          if (!userId) {
              return c.json({ error: "Unauthorized" }, 401);
          }

          const tokens = await getUserTokens(userId);
          let githubToken = tokens.githubToken || process.env.GITHUB_TOKEN_REPO || process.env.GITHUB_TOKEN;

          if (!githubToken || githubToken === "undefined") {
              return c.json({
                  success: false,
                  error: "GITHUB_TOKEN_REQUIRED",
                  message: "You need to register your GitHub Token in your profile to commit and push changes.",
              }, 403);
          }

          const project = await prisma.project.findUnique({
              where: { id: projectId },
              select: { repoUrl: true },
          });
          if (!project) return c.json({ error: "Project not found" }, 404);

          const targetDir = await syncProjectFilesToDisk(projectId);

          const gitConfigUser = Bun.spawn(["git", "config", "user.name", "VibeCodium Live Collaboration"], { cwd: targetDir });
          await gitConfigUser.exited;
          const gitConfigEmail = Bun.spawn(["git", "config", "user.email", "live@vibecodium.cloud"], { cwd: targetDir });
          await gitConfigEmail.exited;

          const gitAdd = Bun.spawn(["git", "add", "."], { cwd: targetDir });
          await gitAdd.exited;

          const gitCommit = Bun.spawn(["git", "commit", "-m", "Auto-Save Sandbox Commit"], { cwd: targetDir });
          await gitCommit.exited;

          const repoUrl = project.repoUrl;
          let authenticatedUrl = repoUrl;
          if (repoUrl.startsWith("https://github.com/")) {
              authenticatedUrl = repoUrl.replace("https://github.com/", `https://${githubToken}@github.com/`);
          }

          const gitPush = Bun.spawn(["git", "push", authenticatedUrl, "HEAD:main", "--force"], {
              cwd: targetDir,
              stdout: "pipe",
              stderr: "pipe",
          });
          const exitCode = await gitPush.exited;
          const stdout = await new Response(gitPush.stdout).text();
          const stderr = await new Response(gitPush.stderr).text();

          if (exitCode !== 0) {
              return c.json({ error: "Failed to push to GitHub", details: stderr }, 500);
          }

          return c.json({ success: true, message: "Successfully pushed to GitHub", output: stdout });

      } catch (e: any) {
          return c.json({ error: e.message }, 500);
      }
  });

  // ── File Management ──────────────────────────────────────────────────────────

  projectsRoutes.post("/:id/files/create", async (c) => {
      try {
          const projectId = c.req.param("id");
          const { path: filePath, content = "" } = await c.req.json<{ path: string; content?: string }>();
          if (!projectId || !filePath) return c.json({ error: "Missing projectId or path" }, 400);

          await prisma.file.upsert({
              where: { projectId_path: { projectId, path: filePath } },
              update: { content },
              create: { id: "file_" + nanoid(20), projectId, path: filePath, content },
          });

          return c.json({ success: true, path: filePath });
      } catch (e: any) {
          return c.json({ error: e.message }, 500);
      }
  });

  projectsRoutes.delete("/:id/files", async (c) => {
      try {
          const projectId = c.req.param("id");
          const { path: filePath } = await c.req.json<{ path: string }>();
          if (!projectId || !filePath) return c.json({ error: "Missing projectId or path" }, 400);

          const allFiles = await prisma.file.findMany({
              where: { projectId },
              select: { id: true, path: true },
          });

          const toDelete = allFiles.filter(f => f.path === filePath || f.path.startsWith(filePath + "/"));

          await prisma.file.deleteMany({
              where: { id: { in: toDelete.map(f => f.id) } },
          });

          return c.json({ success: true, deleted: toDelete.length });
      } catch (e: any) {
          return c.json({ error: e.message }, 500);
      }
  });

  projectsRoutes.patch("/:id/files/rename", async (c) => {
      try {
          const projectId = c.req.param("id");
          const { oldPath, newPath } = await c.req.json<{ oldPath: string; newPath: string }>();
          if (!projectId || !oldPath || !newPath) return c.json({ error: "Missing fields" }, 400);

          const allFiles = await prisma.file.findMany({ where: { projectId } });

          const toRename = allFiles.filter(f => f.path === oldPath || f.path.startsWith(oldPath + "/"));

          for (const f of toRename) {
              const renamedPath = newPath + f.path.slice(oldPath.length);
              await prisma.file.upsert({
                  where: { projectId_path: { projectId, path: renamedPath } },
                  update: { content: f.content },
                  create: { id: "file_" + nanoid(20), projectId, path: renamedPath, content: f.content },
              });
              await prisma.file.delete({ where: { id: f.id } });
          }

          return c.json({ success: true, renamed: toRename.length });
      } catch (e: any) {
          return c.json({ error: e.message }, 500);
      }
  });

  // ── GitHub Integration ───────────────────────────────────────────────────────

  projectsRoutes.post("/create-repo", async (c) => {
      try {
          const user = (c.get as any)("user");
          const userId = user ? (user.sub || user.nickname) : null;
          if (!userId) return c.json({ error: "Unauthorized" }, 401);

          const { name, description, isPrivate } = await c.req.json<{
              name: string;
              description?: string;
              isPrivate?: boolean;
          }>();

          if (!name) return c.json({ error: "Repository name is required" }, 400);

          const tokens = await getUserTokens(userId);
          const githubToken = tokens.githubToken || process.env.GITHUB_TOKEN_REPO || process.env.GITHUB_TOKEN;

          if (!githubToken || githubToken === "undefined") {
              return c.json({
                  success: false,
                  error: "GITHUB_TOKEN_REQUIRED",
                  message: "You need to register your GitHub Token in your profile to create repositories.",
              }, 403);
          }

          const githubUsername = user.nickname;
          if (!githubUsername) {
              return c.json({ error: "GitHub username not found in profile" }, 400);
          }

          const response = await fetch("https://api.github.com/user/repos", {
              method: "POST",
              headers: {
                  "Authorization": `Bearer ${githubToken}`,
                  "Content-Type": "application/json",
                  "Accept": "application/vnd.github.v3+json",
                  "User-Agent": "VibeCodium-App",
              },
              body: JSON.stringify({
                  name,
                  description: description || undefined,
                  private: isPrivate || false,
                  auto_init: true,
              }),
          });

          if (!response.ok) {
              const errorData = await response.json() as any;
              return c.json({ error: errorData.message || "Failed to create repository on GitHub" }, response.status as any);
          }

          const repoData = await response.json() as any;

          return c.json({
              success: true,
              repository: {
                  id: repoData.id,
                  name: repoData.name,
                  full_name: repoData.full_name,
                  html_url: repoData.html_url,
                  description: repoData.description,
                  private: repoData.private,
                  created_at: repoData.created_at,
              },
          }, 201);

      } catch (err: any) {
          return c.json({ error: err.message }, 500);
      }
  });

  projectsRoutes.get("/:id/commits", async (c) => {
      try {
          const projectId = c.req.param("id");
          if (!projectId) return c.json({ error: "Missing projectId" }, 400);

          const project = await prisma.project.findUnique({
              where: { id: projectId },
              select: { repoUrl: true },
          });

          if (!project || !project.repoUrl) {
              return c.json({ error: "Project or repoUrl not found" }, 404);
          }

          const urlStr = project.repoUrl.replace(".git", "");
          const urlParams = urlStr.split("github.com/");
          if (urlParams.length < 2) {
              return c.json({ error: "Invalid GitHub URL format" }, 400);
          }

          const [owner, repo] = urlParams[1]!.split("/");
          if (!owner || !repo) {
              return c.json({ error: "Could not extract owner/repo from URL" }, 400);
          }

          const headers: Record<string, string> = {
              "Accept": "application/vnd.github.v3+json",
              "User-Agent": "VibeCodium-App",
          };

          if (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN !== "undefined") {
              headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
          }

          const ghResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits`, { headers });

          if (!ghResponse.ok) {
              return c.json({ error: `GitHub API error: ${ghResponse.statusText}` }, 500);
          }

          const commitsData = await ghResponse.json() as any[];

          const parsedCommits = commitsData.slice(0, 50).map((commitItem: any) => ({
              sha: commitItem.sha,
              message: commitItem.commit?.message?.split("\n")[0] || "No message",
              author: {
                  name: commitItem.commit?.author?.name || "Unknown",
                  avatar: commitItem.author?.avatar_url || null,
              },
              date: commitItem.commit?.author?.date || null,
          }));

          return c.json({ success: true, commits: parsedCommits }, 200);

      } catch (err: any) {
          return c.json({ error: err.message }, 500);
      }
  });

  export default projectsRoutes;
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add server/src/routes/projects.ts
  git commit -m "feat: migrate projects route to Prisma"
  ```

---

## Task 10: Update `server/src/routes/deploy.ts`

**Files:**
- Modify: `server/src/routes/deploy.ts`

- [ ] **Step 1: Replace the entire file**

  ```typescript
  import { Hono } from "hono";
  import { prisma } from "../db/prisma";
  import { scanCode } from "../security/scanner";
  import { rooms, broadcast } from "../ws/collaboration";
  import { getUserTokens } from "../utils/tokens";
  import { authMiddleware } from "../middleware/authMiddleware";

  const deployRoutes = new Hono();

  deployRoutes.use("/*", async (c, next) => {
      if (c.req.method === "OPTIONS") return next();
      return authMiddleware(c, next);
  });

  const VERCEL_API = "https://api.vercel.com";

  deployRoutes.post("/:projectId", async (c) => {
      const projectId = c.req.param("projectId");
      const user = (c.get as any)("user");
      const userId = user?.sub || user?.nickname;

      if (!userId) {
          return c.json({ error: "Unauthorized" }, 401);
      }

      const tokens = await getUserTokens(userId);
      const token = tokens.vercelToken || process.env.VERCEL_TOKEN;

      if (!token) {
          return c.json({
              success: false,
              error: "VERCEL_TOKEN_REQUIRED",
              message: "You need to register your Vercel Token in your profile to deploy websites.",
          }, 403);
      }

      const room = rooms.get(projectId);
      const sendLog = (message: string, type: "info" | "error" | "success" = "info") => {
          console.log(`[Deploy] ${message}`);
          if (room) {
              broadcast(room, {
                  type: "terminal_output",
                  data: `\r\n\x1b[36m[ShipToCloud]\x1b[0m ${type === "error" ? "\x1b[31m" : type === "success" ? "\x1b[32m" : ""}${message}\x1b[0m\r\n`,
              });
          }
      };

      try {
          sendLog("🚀 Starting deployment to Vercel...");

          sendLog("📦 Collecting project files...");
          const projectFiles = await prisma.file.findMany({ where: { projectId } });
          if (projectFiles.length === 0) throw new Error("No files found for this project.");

          const projectRow = await prisma.project.findUnique({
              where: { id: projectId },
              select: { name: true, repoUrl: true },
          });
          if (!projectRow) throw new Error("Project not found in database.");
          const projectName = projectRow.name
              || projectRow.repoUrl?.split("/").pop()?.replace(".git", "")
              || "vibecodium-app";

          sendLog("🛡️ Running pre-deploy security scan...");
          const scanResult = await scanCode(projectFiles.map(f => ({ path: f.path, content: f.content || "" })));
          if (!scanResult.safe) {
              const criticals = scanResult.vulnerabilities.filter(v => v.severity === "critical" || v.severity === "high");
              sendLog(`❌ Security scan failed: ${criticals.length} high/critical vulnerabilities found.`, "error");
              return c.json({ success: false, error: "Security scan failed", vulnerabilities: criticals }, 400);
          }
          sendLog("✅ Security scan passed.");

          sendLog("📡 Preparing files for Vercel...");
          const vercelFiles = projectFiles.map(f => ({
              file: f.path,
              data: Buffer.from(f.content || "").toString("base64"),
              encoding: "base64",
          }));

          const meRes = await fetch(`${VERCEL_API}/v2/user`, {
              headers: { "Authorization": `Bearer ${token}` },
          });
          const meData = await meRes.json() as any;
          if (!meRes.ok) {
              throw new Error(`Invalid VERCEL_TOKEN: ${meData?.error?.message ?? meRes.status}`);
          }
          sendLog(`✅ Authenticated as ${meData.user?.email ?? meData.user?.username}`);

          sendLog("☁️ Deploying to Vercel...");
          const safeName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 52);

          const teamId = process.env.VERCEL_TEAM_ID;
          const params = new URLSearchParams({ skipAutoDetectionConfirmation: "1" });
          if (teamId) params.set("teamId", teamId);
          const deployUrl = `${VERCEL_API}/v13/deployments?${params}`;

          const deployRes = await fetch(deployUrl, {
              method: "POST",
              headers: {
                  "Authorization": `Bearer ${token}`,
                  "Content-Type": "application/json",
              },
              body: JSON.stringify({ name: safeName, files: vercelFiles }),
          });

          const deployData = await deployRes.json() as any;

          if (!deployRes.ok) {
              console.error("[Deploy] Vercel error response:", JSON.stringify(deployData, null, 2));
              const errMsg = deployData?.error?.message ?? JSON.stringify(deployData);
              throw new Error(`Vercel deployment failed (${deployRes.status}): ${errMsg}`);
          }

          const liveUrl = `https://${deployData.url}`;
          sendLog(`✨ Deployment successful! Live at: ${liveUrl}`, "success");

          await prisma.deployedApp.create({
              data: {
                  auth0Id: userId,
                  title: projectName,
                  projectRepo: projectRow.repoUrl || "",
                  projectLink: liveUrl,
              },
          });

          return c.json({
              success: true,
              url: liveUrl,
              deploymentId: deployData.id,
              message: "Project deployed to Vercel!",
          });

      } catch (err: any) {
          sendLog(`❌ Deployment failed: ${err.message}`, "error");
          return c.json({ success: false, error: err.message }, 500);
      }
  });

  deployRoutes.get("/", async (c) => {
      const user = (c.get as any)("user");
      const userId = user?.sub || user?.nickname;
      if (!userId) return c.json({ error: "Unauthorized" }, 401);

      const apps = await prisma.deployedApp.findMany({
          where: { auth0Id: userId },
          orderBy: { createdAt: "desc" },
      });
      return c.json({ success: true, apps });
  });

  export default deployRoutes;
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add server/src/routes/deploy.ts
  git commit -m "feat: migrate deploy route to Prisma"
  ```

---

## Task 11: Update `server/src/index.ts`

**Files:**
- Modify: `server/src/index.ts`

**Changes:**
1. Remove `connectMongo`, `TimelineEvent`, `db`, `files`, `snapshots` imports
2. Import `prisma` from `./db/prisma`
3. Import `nanoid` from `nanoid`
4. Replace `logTimelineEvent` internals to use `prisma.timelineEvent.create()`
5. Replace `/api/scan` inline query to use `prisma.file.findMany()`
6. Replace WS `agent_accepted` / `code_update` auto-save to use `prisma.file.upsert()` + `prisma.snapshot.create()`
7. Replace WS `close` cleanup to use `prisma.timelineEvent.deleteMany()`
8. Update error handler to remove Mongoose error name check
9. Update `open` terminal handler scan query to use `prisma.file.findMany()`

- [ ] **Step 1: Replace all DB imports at the top of index.ts**

  Find the imports block:
  ```typescript
  import { connectMongo } from "./db/mongoose";
  import { TimelineEvent } from "./db/models/TimelineEvent";
  import { syncProjectFilesToDisk } from "./utils/sync";
  import { db } from "./db";
  import { files, snapshots } from "./db/schema";
  import * as nodePath from "node:path";
  import { eq } from "drizzle-orm";
  ```

  Replace with:
  ```typescript
  import { syncProjectFilesToDisk } from "./utils/sync";
  import { prisma } from "./db/prisma";
  import * as nodePath from "node:path";
  import { nanoid } from "nanoid";
  ```

- [ ] **Step 2: Update the error handler — remove Mongoose error check**

  Find:
  ```typescript
  .onError((err, c) => {
      const name = (err as any)?.name ?? "";
      if (name === "MongooseServerSelectionError" || name === "MongooseError" || name.includes("Mongo")) {
          return c.json({ success: false, error: "Database unavailable", details: err.message }, 503);
      }
      console.error("Unhandled error:", err);
      return c.json({ success: false, error: "Internal server error" }, 500);
  })
  ```

  Replace with:
  ```typescript
  .onError((err, c) => {
      console.error("Unhandled error:", err);
      return c.json({ success: false, error: "Internal server error" }, 500);
  })
  ```

- [ ] **Step 3: Update `/api/scan` endpoint**

  Find:
  ```typescript
  const projectFiles = await db
      .select({ path: files.path, content: files.content })
      .from(files)
      .where(eq(files.projectId, body.projectId));
  ```

  Replace with:
  ```typescript
  const projectFiles = await prisma.file.findMany({
      where: { projectId: body.projectId },
      select: { path: true, content: true },
  });
  ```

- [ ] **Step 4: Update `logTimelineEvent` function**

  Find:
  ```typescript
  function logTimelineEvent(
      ...
  ): void {
      if (content.length > 500_000) return;
      (async () => {
          try {
              await connectMongo();
              const key = `${projectId}::${filePath}`;
              const count = (timelineEventCounters.get(key) ?? 0) + 1;
              timelineEventCounters.set(key, count);

              if (eventType === "code_update" && count % TIMELINE_SAVE_INTERVAL !== 0) return;

              await TimelineEvent.create({
                  projectId,
                  filePath,
                  eventType,
                  userId,
                  userName,
                  userColor,
                  content,
                  isCheckpoint: count % 50 === 0,
                  createdAt: new Date(),
              });
          } catch (e) {
              console.error("[Timeline log error]:", e);
          }
      })();
  }
  ```

  Replace with:
  ```typescript
  function logTimelineEvent(
      projectId: string,
      filePath: string,
      content: string,
      eventType: "code_update" | "agent_accepted",
      userId: string,
      userName: string,
      userColor: string,
  ): void {
      if (content.length > 500_000) return;
      (async () => {
          try {
              const key = `${projectId}::${filePath}`;
              const count = (timelineEventCounters.get(key) ?? 0) + 1;
              timelineEventCounters.set(key, count);

              if (eventType === "code_update" && count % TIMELINE_SAVE_INTERVAL !== 0) return;

              await prisma.timelineEvent.create({
                  data: {
                      projectId,
                      filePath,
                      eventType: eventType === "code_update" ? "CODE_UPDATE" : "AGENT_ACCEPTED",
                      userId,
                      userName,
                      userColor,
                      content,
                      isCheckpoint: count % 50 === 0,
                      createdAt: new Date(),
                  },
              });
          } catch (e) {
              console.error("[Timeline log error]:", e);
          }
      })();
  }
  ```

- [ ] **Step 5: Update terminal `open` handler — file scan query**

  Find (inside the terminal open async block):
  ```typescript
  const projectFiles = await db
      .select({ path: files.path, content: files.content })
      .from(files)
      .where(eq(files.projectId, roomId));
  ```

  Replace with:
  ```typescript
  const projectFiles = await prisma.file.findMany({
      where: { projectId: roomId },
      select: { path: true, content: true },
  });
  ```

- [ ] **Step 6: Update WebSocket `agent_accepted` auto-save**

  Find (inside the `agent_accepted` setImmediate block):
  ```typescript
  const timestamp = Date.now();
  await db.insert(files).values({
      id: crypto.randomUUID(),
      projectId: data.projectId,
      path: payload.filePath,
      content: payload.content,
      updatedAt: timestamp
  }).onConflictDoUpdate({
      target: [files.projectId, files.path],
      set: { content: payload.content, updatedAt: Math.floor(timestamp / 1000) }
  });
  await db.insert(snapshots).values({
      id: crypto.randomUUID(),
      projectId: data.projectId,
      path: payload.filePath,
      content: payload.content,
      timestamp
  });
  ```

  Replace with:
  ```typescript
  await prisma.file.upsert({
      where: { projectId_path: { projectId: data.projectId, path: payload.filePath } },
      update: { content: payload.content },
      create: {
          id: "file_" + nanoid(20),
          projectId: data.projectId,
          path: payload.filePath,
          content: payload.content,
      },
  });
  await prisma.snapshot.create({
      data: {
          id: "snap_" + nanoid(20),
          projectId: data.projectId,
          path: payload.filePath,
          content: payload.content,
          timestamp: new Date(),
      },
  });
  ```

- [ ] **Step 7: Update WebSocket `code_update` auto-save** (same block structure, inside the `code_update` setImmediate block)

  Find (inside the `code_update` setImmediate block):
  ```typescript
  const timestamp = Date.now();
  await db.insert(files).values({
      id: crypto.randomUUID(),
      projectId: data.projectId,
      path: payload.filePath,
      content: payload.content,
      updatedAt: timestamp
  }).onConflictDoUpdate({
      target: [files.projectId, files.path],
      set: { content: payload.content, updatedAt: Math.floor(timestamp / 1000) }
  });

  // Insert snapshot for time-travel feature
  await db.insert(snapshots).values({
      id: crypto.randomUUID(),
      projectId: data.projectId,
      path: payload.filePath,
      content: payload.content,
      timestamp
  });
  ```

  Replace with:
  ```typescript
  await prisma.file.upsert({
      where: { projectId_path: { projectId: data.projectId, path: payload.filePath } },
      update: { content: payload.content },
      create: {
          id: "file_" + nanoid(20),
          projectId: data.projectId,
          path: payload.filePath,
          content: payload.content,
      },
  });
  await prisma.snapshot.create({
      data: {
          id: "snap_" + nanoid(20),
          projectId: data.projectId,
          path: payload.filePath,
          content: payload.content,
          timestamp: new Date(),
      },
  });
  ```

- [ ] **Step 8: Update WebSocket `close` handler — timeline cleanup**

  Find (inside the `close` handler, `remaining.length === 0` block):
  ```typescript
  (async () => {
      try {
          await connectMongo();
          await TimelineEvent.deleteMany({ projectId: data.projectId });
          console.log(`[Timeline] Purged events for project ${data.projectId}`);
      } catch (e) {
          console.error("[Timeline purge error]:", e);
      }
  })();
  ```

  Replace with:
  ```typescript
  (async () => {
      try {
          await prisma.timelineEvent.deleteMany({ where: { projectId: data.projectId } });
          console.log(`[Timeline] Purged events for project ${data.projectId}`);
      } catch (e) {
          console.error("[Timeline purge error]:", e);
      }
  })();
  ```

- [ ] **Step 9: Commit**

  ```bash
  git add server/src/index.ts
  git commit -m "feat: migrate index.ts WebSocket/scan handlers to Prisma"
  ```

---

## Task 12: Delete old DB files

**Files:**
- Delete: `server/src/db/index.ts`
- Delete: `server/src/db/schema.ts`
- Delete: `server/src/db/mongoose.ts`
- Delete: `server/src/db/models/User.ts`
- Delete: `server/src/db/models/UserToken.ts`
- Delete: `server/src/db/models/Project.ts`
- Delete: `server/src/db/models/TimelineEvent.ts`
- Delete: `server/src/db/models/HelpPost.ts`
- Delete: `server/src/db/models/DeployedApp.ts`

- [ ] **Step 1: Delete the old DB layer**

  ```bash
  cd /Users/paulhondola/Developer/vibecodium/server/src/db
  rm index.ts schema.ts mongoose.ts
  rm models/User.ts models/UserToken.ts models/Project.ts
  rm models/TimelineEvent.ts models/HelpPost.ts models/DeployedApp.ts
  ```

  Expected: only `prisma.ts` and `models/` (empty directory) remain under `db/`.

- [ ] **Step 2: Commit**

  ```bash
  cd /Users/paulhondola/Developer/vibecodium
  git add -A server/src/db/
  git commit -m "chore: remove Drizzle, SQLite, and Mongoose DB layer"
  ```

---

## Task 13: Update `server/package.json` — clean old dependencies

**Files:**
- Modify: `server/package.json`

- [ ] **Step 1: Write final package.json**

  ```json
  {
    "name": "server",
    "version": "0.0.1",
    "main": "dist/index.js",
    "types": "dist/index.d.ts",
    "exports": {
      ".": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "./client": {
        "types": "./dist/client.d.ts",
        "default": "./dist/client.js"
      }
    },
    "scripts": {
      "build": "tsc",
      "dev": "npx concurrently \"bun --watch run src/index.ts\" \"tsc --watch\""
    },
    "dependencies": {
      "@prisma/adapter-pg": "^7.0.0",
      "@prisma/client": "^7.0.0",
      "dockerode": "^4.0.10",
      "hono": "^4.10.8",
      "jose": "^6.2.2",
      "nanoid": "^5.1.5",
      "node-pty": "^1.1.0",
      "pg": "^8.16.0",
      "shared": "workspace:*"
    },
    "devDependencies": {
      "@types/bun": "latest",
      "@types/dockerode": "^4.0.1",
      "@types/pg": "^8.11.14"
    }
  }
  ```

- [ ] **Step 2: Install (clean up lockfile)**

  ```bash
  cd /Users/paulhondola/Developer/vibecodium
  bun install
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add server/package.json bun.lock
  git commit -m "chore: remove drizzle/mongoose deps, add prisma/pg/nanoid"
  ```

---

## Task 14: Type-check and fix errors

- [ ] **Step 1: Run the TypeScript compiler**

  ```bash
  cd /Users/paulhondola/Developer/vibecodium/server
  bun run tsc --noEmit --pretty false 2>&1
  ```

  Expected: Zero errors. Common issues to watch for:
  - `prisma` import path wrong → check `server/src/db/prisma.ts` exports `export const prisma`
  - `Difficulty` or `TimelineEventType` enum values cased wrong → check `server/src/generated/prisma/index.d.ts`
  - `projectId_path` compound key name → verify against generated client (may be `files_project_id_path_key` in older Prisma — check the generated types)

- [ ] **Step 2: Fix any type errors found**

  For compound unique key naming: Open `server/src/generated/prisma/index.d.ts` and search for `FilesWhereUniqueInput` to find the exact key name for the `[projectId, path]` unique constraint. It will be one of:
  - `projectId_path` (most common in Prisma 7)
  - `project_id_path`

  Update all `upsert` calls with `where: { projectId_path: ... }` to match.

- [ ] **Step 3: Start the dev server and verify**

  ```bash
  cd /Users/paulhondola/Developer/vibecodium
  bun run dev:server
  ```

  Expected:
  - Server starts on `:3000`
  - No `SQLite`, `Drizzle`, or `mongoose` in log output
  - `GET /hello` returns `{ message: "Hello BHVR!", success: true }`

- [ ] **Step 4: Commit**

  ```bash
  git add -A
  git commit -m "fix: type errors from Prisma migration"
  ```

---

## Self-Review Checklist

**Spec coverage:**
- [x] SQLite `projects` table → `prisma.project` (Task 9)
- [x] SQLite `files` table → `prisma.file` (Tasks 3, 9, 10, 11)
- [x] SQLite `snapshots` table → `prisma.snapshot` (Tasks 9, 11)
- [x] SQLite `sessions` table → `prisma.session` (Task 5)
- [x] MongoDB `User` → `prisma.user` (Task 4)
- [x] MongoDB `UserToken` → `prisma.userToken` (Tasks 2, 8)
- [x] MongoDB `Project` → merged into `prisma.project` (Task 9)
- [x] MongoDB `TimelineEvent` → `prisma.timelineEvent` (Tasks 7, 11)
- [x] MongoDB `HelpPost` → `prisma.helpPost` (Task 6)
- [x] MongoDB `DeployedApp` → `prisma.deployedApp` (Task 10)
- [x] All `connectMongo()` calls removed (Tasks 2–11)
- [x] All Drizzle `db.*` calls removed (Tasks 3, 5, 9, 10, 11)
- [x] DateTime conversions: `expiresAt.getTime()`, `new Date(ms)` (Task 5)
- [x] Enum casing: `CLONING/READY/ERROR`, `CODE_UPDATE/AGENT_ACCEPTED`, `EASY/MEDIUM/HARD` (Tasks 6, 7, 9, 11)
- [x] Project IDs use `proj_` prefix via nanoid (Task 9)
- [x] File IDs use `file_` prefix via nanoid (Tasks 9, 11)
- [x] Snapshot IDs use `snap_` prefix via nanoid (Task 11)
- [x] Old DB files deleted (Task 12)
- [x] Old dependencies removed from package.json (Task 13)

**No placeholders:** All steps contain actual code or commands.

**Type consistency:** `prisma.file.upsert` uses `projectId_path` compound key throughout Tasks 9 and 11.

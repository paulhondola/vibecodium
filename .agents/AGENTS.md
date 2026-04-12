# AGENTS.md

This file provides guidance to AI agents when working with code in this repository.
It is read by **Gemini (Antigravity)**, **Claude Code**, and **GitHub Copilot**.

## 🚨 Agent Context Routing (MANDATORY STEP)

Before executing a task or generating code, you MUST read the relevant rule sets for your domain. Use your file reading tools (e.g., `view_file`) to scan these directories based on what you are doing:

| Domain                          | Read this first                                                                           |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| **Frontend / UI**               | `.agents/skills/web/` (all files)                                                         |
| **Backend / APIs**              | `.agents/skills/api-design/SKILL.md` + `.agents/skills/backend-patterns/SKILL.md`         |
| **Security / Auth**             | `.agents/skills/security-review/SKILL.md`                                                 |
| **TypeScript / General**        | `.agents/skills/typescript/coding-style.md`                                               |
| **Database (SQLite/Drizzle)**   | Review `server/src/db/schema.ts` — no migrations, schema is static                        |
| **Database (MongoDB/Mongoose)** | Review `server/src/db/models/`                                                            |
| **Real-time / WebSocket / Yjs** | Review `server/src/ws/collaboration.ts` before making changes                             |
| **AI Agent / SSE tool loop**    | Review `server/src/routes/agent.ts` — understand the SSE stream + tool call pattern first |
| **Docker / Code Execution**     | Review `scripts/setup_docker.sh` before touching sandbox images                           |
| **Deployment / CI**             | `.agents/skills/deployment-patterns/SKILL.md` (see Bun/Vercel notes)                      |

Do NOT proceed with major architecture implementations before consuming these domain modules.

---

## What is this project?

VibeCodium is a collaborative code editor and sandboxing platform. Real-time multi-user editing via Yjs CRDT, AI agent with SSE streaming, sandboxed code execution via Docker, and Vercel deployment integration.

---

## Stack

| Layer       | Tech                                  | Notes                                                                                                                |
| ----------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Runtime     | **Bun**                               | Use Bun APIs everywhere — `Bun.spawn`, `Bun.serve`, `Bun.sqlite`. No Node-specific APIs.                             |
| Monorepo    | **Turborepo** + Bun workspaces        | Three packages: `client`, `server`, `shared`                                                                         |
| Server      | **Hono**                              | Lightweight. SSE via `streamText()`. WebSocket via Bun adapter.                                                      |
| Frontend    | **React 19 + Vite + TanStack Router** | File-based routing in `client/src/routes/`.                                                                          |
| Local DB    | **Bun.sqlite + Drizzle ORM**          | SQLite for files/projects/sessions/snapshots. Schema in `server/src/db/schema.ts`. No migrations — schema is static. |
| Cloud DB    | **MongoDB + Mongoose**                | Users, timeline events, help posts, deployed apps. Models in `server/src/db/models/`.                                |
| Auth        | **Auth0**                             | JWKS-validated JWTs in `server/src/middleware/authMiddleware.ts`.                                                    |
| Editor      | **Monaco** (`@monaco-editor/react`)   | In `client/src/components/EditorArea.tsx`.                                                                           |
| Terminal    | **Xterm.js + node-pty**               | PTY multiplexed via WebSocket. Real interactive shell.                                                               |
| Real-time   | **Yjs CRDT**                          | Editor sync via `ws/collaboration.ts`.                                                                               |
| AI Agent    | **OpenAI-compatible API**             | Default: DeepSeek (`https://api.deepseek.com/v1`). Provider-agnostic via env vars.                                   |
| Execution   | **Docker**                            | 6 sandbox images built by `scripts/setup_docker.sh`.                                                                 |
| Lint/Format | **Biome**                             | `bun run lint`, `bun run format`. Not ESLint.                                                                        |

---

## Commands

```bash
# Install all workspace dependencies
bun install

# Start all packages (client + server) in dev mode
bun run dev

# Start client or server only
bun run dev:client
bun run dev:server

# Build all packages
bun run build

# Lint (Biome)
bun run lint

# Format (Biome)
bun run format

# Type-check all packages
bun run type-check

# Build Docker sandbox images (also runs on postinstall)
./scripts/setup_docker.sh
# or
bun run setup:docker
```

Client dev server runs on `:5173`. Server runs on `:3000`.

---

## Environment variables

Copy `server/.env.example` to `server/.env`. The client reads from `client/.env`.

**Server (`server/.env`):**

```
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_KEY=your-deepseek-key-here
LLM_MODEL=deepseek-chat
LOCAL_MODEL=qwen2.5-coder-32b-instruct

AUTH0_DOMAIN=dev-fftg10nqdhqosrbj.us.auth0.com
MONGO_URI=your-mongodb-atlas-uri

VERCEL_TOKEN=your-vercel-token
VERCEL_TEAM_ID=                    # optional, team accounts only

GITHUB_TOKEN=                      # optional
YOUTUBE_API_KEY=                   # optional, for reels feature
PORT=3000
```

**Client (`client/.env`):**

```
VITE_AUTH0_DOMAIN=...
VITE_AUTH0_CLIENT_ID=...
VITE_BACKEND_URL=http://localhost:3000
```

Note: `LLM_KEY` (not `LLM_API_KEY`) is the correct env var name.

---

## Architecture

### Monorepo layout

```
vibecodium/
├── client/        # React 19 + Vite + TanStack Router SPA
├── server/        # Hono API server (Bun runtime)
├── shared/        # Shared TypeScript types (imported by both)
├── turbo.json
└── package.json   # Root workspace scripts
```

### Backend architecture

**Entry point:** `server/src/index.ts` — mounts all routes, sets up WebSocket upgrade handlers.

**Routes:** `server/src/routes/`

- `projects.ts` — CRUD for projects + files (SQLite). Also handles GitHub import.
- `agent.ts` — SSE streaming AI agent loop with tool calling.
- `deploy.ts` — Vercel deployment orchestration.
- `git.ts` — Git clone/operations.
- `sessions.ts` — Share token generation/validation.
- `timeline.ts` — Checkpoint history + AI diff analysis.
- `users.ts` — GitHub/Vercel token management.
- `help.ts` — Community help posts (MongoDB).
- `github.ts` — GitHub API proxy.
- `reels.ts` — YouTube Shorts caching.
- `scan` / `roast` / `ping-llm` — in `index.ts` directly.

**WebSocket handlers:** `server/src/ws/collaboration.ts`

- `/ws/collab/:id` — Yjs CRDT sync for real-time editor collaboration.
- `/ws/terminal` — PTY terminal multiplexed to all clients in a session.

**Database split:**

- SQLite (Drizzle): `projects`, `files`, `snapshots`, `sessions` — local, per-instance data.
- MongoDB (Mongoose): `User`, `Project`, `TimelineEvent`, `HelpPost`, `DeployedApp`, `UserToken` — cloud, user-owned data.

**Auth middleware:** `server/src/middleware/authMiddleware.ts` validates Auth0 JWTs via JWKS and upserts users into MongoDB on first login.

**AI agent:** `server/src/routes/agent.ts` — streams tokens via SSE, detects tool calls, executes tools, loops back. Tools: `read_file`, `write_file`, `execute_command`.

**Code execution:** Docker sandbox images (built by `scripts/setup_docker.sh`) for Python, Node, C++, Rust, Go, Bun. Each run gets an isolated container.

### Frontend architecture

**Routing:** TanStack Router with file-based routes in `client/src/routes/`:

- `/` — Landing page
- `/login` — Auth0 callback handler
- `/dashboard` — Main IDE workspace (large: `dashboard.tsx` ~39KB)
- `/community` — Help posts + CoderMatch
- `/profile` — User profile + token settings

**Main workspace:** `client/src/components/Workspace.tsx` orchestrates the 3-column layout. Heavy lifting is in `dashboard.tsx`.

**Key components:**

- `EditorArea.tsx` — Monaco editor wrapper
- `TerminalArea.tsx` — Xterm.js + WebSocket PTY connection
- `VibeChat.tsx` — SSE streaming AI chat
- `FileExplorer.tsx` — File tree from SQLite
- `TimelineBar.tsx` — Checkpoint/snapshot history

**Real-time contexts:** `client/src/contexts/SocketProvider.tsx` and `WebSocketProvider.tsx` manage Yjs and terminal WebSocket connections.

**API config:** `client/src/lib/config.ts` exports `API_BASE` from `VITE_BACKEND_URL`.

### Shared package

`shared/src/types/index.ts` exports types used by both client and server:

- `WsEditorUpdate` / `WsServerUpdate` — Yjs sync messages
- `ExecuteRequest` / `ExecuteResponse` — code execution
- `ApiResponse` — standard API response shape

---

## Code conventions

- TypeScript everywhere. No `any` unless unavoidable.
- Bun APIs over Node equivalents (`Bun.spawn`, `Bun.sqlite`).
- Named exports. One component per file.
- IDs via `nanoid`, prefixed: `proj_`, `file_`, `msg_`, `snap_`.
- Timestamps: Unix ms integers in SQLite.
- Agent tool executor returns error strings — never throws.
- Execution engines return `{ stdout, stderr, exitCode }` — never throw on non-zero exit.
- SSE events: newline-delimited JSON.
- WebSocket messages: JSON with a `type` field.
- Biome config: tab indentation, double quotes for JS/TS.

---

## UI layout

CSS Grid 3 columns: `220px | 1fr | 300px`

```
┌──────────────┬────────────────────────────────┬───────────────┐
│  File        │  Monaco editor (+ AI cursor,   │  Vibe chat    │
│  explorer    │   pending edit blocks)          │  (SSE stream) │
│  ──────────  │  ──────────────────────────    │               │
│  Timeline    │  Xterm.js terminal (PTY/WS)    │               │
│  (snapshots) │                                │               │
└──────────────┴────────────────────────────────┴───────────────┘
```

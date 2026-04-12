<div align="center">

<img src="client/public/vibecodium_icon.svg" alt="VibeCodium" width="80" />

# VibeCodium

**A collaborative cloud IDE where AI writes code beside you — in real time.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.2-fbf0df?style=flat-square&logo=bun&logoColor=black)](https://bun.sh/)
[![Hono](https://img.shields.io/badge/Hono-4.12-e36002?style=flat-square&logo=hono&logoColor=white)](https://hono.dev/)
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7.2-646cff?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![SQLite](https://img.shields.io/badge/SQLite-3.45-00376b?style=flat-square&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47a248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![Docker](https://img.shields.io/badge/Docker-Sandbox-2496ed?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com/)

_Built for the iTEC 2026 Web Development track._

</div>

---

## What is this?

VibeCodium is a **real-time collaborative code editor** with an embedded AI agent, sandboxed multi-language execution, a live terminal, and social features — all in the browser. Think VS Code meets Figma, with an AI pair programmer that shows its work before committing it.

---

## System Architecture

```text
╔══════════════════════════════════════════════════════════════════════════════════════╗
║                                  VIBECODIUM PLATFORM                                 ║
╚══════════════════════════════════════════════════════════════════════════════════════╝

  ┌──────────────────────────────────────────────────────────────────────────────────┐
  │                             CLIENTS (Browsers)                                   │
  │                                                                                  │
  │   User A (Alice)           User B (Bob)              Guest (share token)         │
  │   ┌─────────────┐          ┌─────────────┐           ┌─────────────┐             │
  │   │  React SPA  │          │  React SPA  │           │  React SPA  │             │
  │   │  Monaco Ed. │          │  Monaco Ed. │           │  (read-only)│             │
  │   │  xterm.js   │          │  xterm.js   │           └─────────────┘             │
  │   └──────┬──────┘          └──────┬──────┘                  │                    │
  │          │  HTTPS / WSS           │  HTTPS / WSS            │ HTTPS              │
  └──────────┼────────────────────────┼─────────────────────────┼────────────────────┘
             │                        │                          │
             ▼                        ▼                          ▼
  ┌──────────────────────────────────────────────────────────────────────────────────┐
  │                         VERCEL  (Frontend CDN)                                   │
  │                    React 19 + Vite · TanStack Router                             │
  │              VITE_BACKEND_URL → Cloudflare Tunnel URL                            │
  └───────────────────────────────────────┬──────────────────────────────────────────┘
                                          │ REST + SSE + WebSocket
                                          │ (Cloudflare Tunnel — zero-config HTTPS)
  ════════════════════════════════════════╪════════════════════════════════════════════
                                          ▼
  ┌──────────────────────────────────────────────────────────────────────────────────┐
  │                       BACKEND  (Hono · Bun runtime)                              │
  │                     localhost:3000  ◄──  cloudflared tunnel                      │
  │                                                                                  │
  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
  │  │  Auth        │  │  Projects    │  │  Agent       │  │  Execution Router    │  │
  │  │  Middleware  │  │  /api/proj.. │  │  /api/agent  │  │  /execute            │  │
  │  │  Auth0 JWKS  │  │  Import repo │  │  SSE stream  │  │  Language → Engine   │  │
  │  │  Token cache │  │  File CRUD   │  │  Tool loop   │  │  Security pre-scan   │  │
  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
  │         │                 │                 │                     │              │
  │  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────▼───────┐             │              │
  │  │  Sessions    │  │  Timeline    │  │  Deploy      │             │              │
  │  │  Share tokens│  │  Checkpoints │  │  /api/deploy │             │              │
  │  │  7-day expiry│  │  AI analysis │  │  Vercel API  │             │              │
  │  └──────────────┘  └──────────────┘  └──────────────┘             │              │
  │                                                                   │              │
  │  ┌─────────────────────────────────────────┐                      │              │
  │  │          WebSocket Handlers             │                      │              │
  │  │  /ws/collab/:id   /ws/terminal          │                      │              │
  │  │  Yjs CRDT sync    PTY shell (node-pty)  │                      │              │
  │  │  Cursor broadcast Multi-user I/O        │                      │              │
  │  └─────────────────────────────────────────┘                      │              │
  └────────────────────────────────────────────────────┬──────────────┼──────────────┘
                                                       │              │
               ┌───────────────────────────────────────┘              │
               ▼                                                      ▼
  ┌────────────────────────────┐              ┌──────────────────────────────────────┐
  │   MONGODB ATLAS  (Cloud)   │              │   DOCKER DESKTOP  (Local daemon)     │
  │                            │              │                                      │
  │  ● projects                │              │  ┌─────────┐  ┌─────────┐            │
  │  ● users (Auth0 upsert)    │              │  │ Python  │  │  Node   │            │
  │  ● userTokens              │              │  │ sandbox │  │ sandbox │            │
  │  ● timelineEvents          │              │  └─────────┘  └─────────┘            │
  │  ● helpPosts               │              │  ┌─────────┐  ┌─────────┐            │
  │                            │              │  │  C++    │  │  Rust   │            │
  │  + SQLite (local)          │              │  │ sandbox │  │ sandbox │            │
  │    ● files (content)       │              │  └─────────┘  └─────────┘            │
  │    ● snapshots             │              │  ┌─────────┐  ┌─────────┐            │
  │    ● sessions              │              │  │   Go    │  │   Bun   │            │
  │                            │              │  │ sandbox │  │ sandbox │            │
  └────────────────────────────┘              │  └─────────┘  └─────────┘            │
                                              │                                      │
                                              │  Per container:                      │
                                              │  • 2 GB RAM limit                    │
                                              │  • Network isolated                  │
                                              │  • 3s execution timeout              │
                                              │  • Code injected via env var         │
                                              └──────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────────────────┐
  │                           EXTERNAL SERVICES                                     │
  │                                                                                 │
  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐     │
  │  │   AUTH0      │  │  DEEPSEEK /  │  │  GITHUB API  │  │  VERCEL API      │     │
  │  │  JWKS auth   │  │  LM Studio   │  │  Repo import │  │  One-click       │     │
  │  │  User upsert │  │  LLM backend │  │  User lookup │  │  project deploy  │     │
  │  │  Token cache │  │  Code agent  │  │  Commit feed │  │  Base64 files    │     │
  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────────┘     │
  └─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Features

### Real-Time Collaboration

- **Yjs CRDT** — conflict-free merges with no operational transform complexity
- **Y-Monaco** bindings — every keystroke syncs across all connected clients instantly
- **Cursor presence** — colored cursors per user with name labels
- **File focus awareness** — see which file each collaborator is editing
- **WebSocket room isolation** — per-project rooms, zero cross-contamination

### AI Agent

- **SSE streaming** — tokens appear word-by-word, never a loading spinner
- **Tool loop** — agent calls `read_file → write_file → execute_command` in cycles until done
- **Accept/Reject diffs** — AI edits surface as a highlighted diff overlay in Monaco; user decides
- **Timeline analysis** — pick two checkpoints, get an AI explanation of what changed and why
- **Code Roaster** — LLM-powered sarcastic code review (morale-destroying, accuracy guaranteed)

### Sandboxed Code Execution

Six custom Docker images (`vibecodium-{python,node,cpp,rust,go,bun}:latest`) built with `scripts/setup_docker.sh`:

| Language   | Runtime     | Compile Step                |
| ---------- | ----------- | --------------------------- |
| Python     | CPython 3.x | —                           |
| JavaScript | Node 20     | —                           |
| TypeScript | Bun         | —                           |
| C++        | GCC         | `g++ -o binary source.cpp`  |
| Rust       | rustc       | `rustc -o binary source.rs` |
| Go         | go1.21      | `go build`                  |

Every execution: security pre-scan → fresh container → inject code → capture stdout/stderr → destroy container. Hard limits: **2 GB RAM**, **network off**, **3-second wall-clock timeout**.

### Security Scanner

Regex-based static analysis runs before every execution:

| Severity | Examples                               | Action          |
| -------- | -------------------------------------- | --------------- |
| Critical | `rm -rf /`, fork bombs, `mkfs`         | Block execution |
| High     | `eval()`, `shell=True`, path traversal | Warn            |
| Medium   | SQL concatenation, hardcoded secrets   | Warn            |
| Low      | Code quality patterns                  | Info            |

### Timeline & Checkpoints

- Every **7th code edit** is persisted to MongoDB as a `TimelineEvent`
- Every **50th edit** is flagged as a `checkpoint` (heavier diff marker)
- Filterable by file path, paginated, orderable oldest-first
- Click any event → restore that file state instantly
- "Analyze" button → AI summarizes the diff between two checkpoints

### One-Click Vercel Deployment

- User stores their Vercel token in profile (masked, stored in MongoDB)
- `/api/deploy/:projectId` pulls all files from SQLite, encodes as base64, calls Vercel Files API
- Deployment logs stream back over WebSocket in real time
- Returns live deployment URL when done

### Session Sharing

- Generate a shareable link with a signed token (7-day TTL by default)
- Token-holders can access project files without an Auth0 account
- Owner can revoke tokens at any time

### Community & Discovery

- **Help Posts** — post your repo for code review / collaboration requests
- **CoderMatch** — random-match with 20 other users (think blind dev dating)
- **Activity Feed** — who's editing what, right now, across your project

---

## Technical Stack

```text
┌─────────────────────────────────────────────────────────────────┐
│  MONOREPO  (Bun workspaces + Turborepo)                         │
│                                                                 │
│  packages/                                                      │
│  ├── client/    React 19 · Vite · TanStack Router               │
│  ├── server/    Hono · Bun runtime · Drizzle ORM                │
│  └── shared/    TypeScript types (ExecuteRequest/Response)      │
└─────────────────────────────────────────────────────────────────┘
```

| Layer      | Technology                   | Why                                               |
| ---------- | ---------------------------- | ------------------------------------------------- |
| Runtime    | **Bun 1.2**                  | Native WebSocket, SQLite, spawn — no extra deps   |
| HTTP       | **Hono 4**                   | 5× faster than Express, first-class Bun adapter   |
| Frontend   | **React 19 + Vite**          | Concurrent features, fastest HMR                  |
| Routing    | **TanStack Router**          | Type-safe file-based routing, search params typed |
| Editor     | **Monaco**                   | VS Code engine in the browser                     |
| CRDT       | **Yjs + Y-Monaco**           | Proven CRDT used by major collab editors          |
| Terminal   | **xterm.js + node-pty**      | Real PTY, full ANSI support                       |
| Whiteboard | **tldraw**                   | Infinite canvas, battle-tested                    |
| ORM        | **Drizzle + SQLite**         | Type-safe queries, zero runtime overhead          |
| Cloud DB   | **MongoDB Atlas + Mongoose** | Flexible docs for users, events, posts            |
| Auth       | **Auth0**                    | JWKS validation, token caching                    |
| AI         | **DeepSeek / LM Studio**     | OpenAI-compatible, swappable via env              |
| Sandbox    | **Docker + Dockerode**       | Hard isolation per execution                      |
| Animations | **Framer Motion**            | Physics-based UI transitions                      |
| Icons      | **Lucide React**             | Tree-shakeable, consistent                        |
| Linting    | **Biome**                    | 10× faster than ESLint + Prettier combined        |

---

## Data Flow

```text
Auth flow
  Browser → Auth0 → JWT → server authMiddleware → MongoDB upsert → context.user

Project import
  GitHub URL → git clone /tmp/vibecodium/{id} → recursive file index → SQLite batch insert

Live editing
  Keystroke → Yjs delta → /ws/collab/:id → broadcast → all Monaco instances

Agent cycle
  User prompt → POST /api/agent/suggest → LLM stream → tool calls
    → read_file (SQLite) │ write_file (diff overlay) │ execute_command (Docker)
    → loop until no tool calls → SSE close

Code execution
  Run button → security scan → Dockerode.createContainer()
    → inject code via env var → capture stdout/stderr → destroy → return

One-click deploy
  Deploy button → fetch user Vercel token → collect files from SQLite
    → Vercel Files API (base64) → WS log stream → live URL
```

---

## Project Structure

```text
vibecodium/
├── client/
│   └── src/
│       ├── routes/          # File-based pages (TanStack Router)
│       │   ├── index.tsx    # Landing
│       │   ├── dashboard.tsx
│       │   ├── community.tsx
│       │   └── profile.tsx
│       ├── components/
│       │   ├── Workspace.tsx       # Main IDE orchestrator
│       │   ├── EditorArea.tsx      # Monaco + Y-Monaco
│       │   ├── TerminalArea.tsx    # xterm.js + WS
│       │   ├── VibeChat.tsx        # Real-time chat
│       │   ├── TimelineBar.tsx     # Checkpoint history
│       │   ├── FileExplorer.tsx    # File tree
│       │   ├── WhiteboardArea.tsx  # tldraw
│       │   ├── ReelsWidget.tsx     # YouTube Shorts
│       │   └── ...easter eggs
│       └── lib/
│           └── config.ts           # API_BASE / WS_BASE from env
│
├── server/
│   └── src/
│       ├── index.ts         # Hono app, Docker setup, WS handlers
│       ├── routes/
│       │   ├── projects.ts  # CRUD + GitHub import
│       │   ├── agent.ts     # LLM tool loop (SSE)
│       │   ├── deploy.ts    # Vercel deployment
│       │   ├── sessions.ts  # Share tokens
│       │   ├── timeline.ts  # Checkpoint history + AI analysis
│       │   ├── users.ts     # Token management
│       │   ├── github.ts    # GitHub proxy
│       │   ├── git.ts       # Git command runner
│       │   ├── reels.ts     # YouTube Shorts proxy + cache
│       │   └── help.ts      # Community posts
│       ├── db/
│       │   ├── index.ts     # SQLite (Drizzle) — files, snapshots, sessions
│       │   ├── mongoose.ts  # MongoDB — users, events, projects, posts
│       │   └── models/      # Mongoose schemas
│       ├── middleware/
│       │   └── authMiddleware.ts  # Auth0 JWKS + user upsert
│       ├── security/
│       │   └── scanner.ts   # Regex vulnerability detection
│       └── ws/
│           └── collaboration.ts  # Yjs relay + terminal PTY
│
├── shared/
│   └── src/types/index.ts   # ExecuteRequest, ExecuteResponse, WS message types
│
├── Dockerfile.{python,node,cpp,rust,go,bun}
├── scripts/
│   └── setup_docker.sh      # Build all sandbox images
└── turbo.json
```

---

## Setup

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.2
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) running
- [MongoDB Atlas](https://www.mongodb.com/atlas) cluster (free tier works)
- [Auth0](https://auth0.com) application (SPA type)
- DeepSeek API key or [LM Studio](https://lmstudio.ai) running locally

### 1. Clone & install

```bash
git clone https://github.com/Alex110506/vibecodium
cd vibecodium
bun install
```

### 2. Configure environment

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

**`server/.env`**

```env
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_KEY=sk-...
LLM_MODEL=deepseek-chat
AUTH0_DOMAIN=your-tenant.us.auth0.com
MONGO_URI=mongodb+srv://...
```

**`client/.env`**

```env
VITE_AUTH0_DOMAIN=your-tenant.us.auth0.com
VITE_AUTH0_CLIENT_ID=...
VITE_BACKEND_URL=http://localhost:3000
```

### 3. Build sandbox images

```bash
bun run setup:docker
# Builds: vibecodium-{python,node,cpp,rust,go,bun}:latest
```

### 4. Start dev servers

```bash
bun run dev
# Client → http://localhost:5173
# Server → http://localhost:3000
```

### Cloudflare tunnel (for collaboration across machines)

```bash
cloudflared tunnel --url http://localhost:3000
# Copy the *.trycloudflare.com URL into client/.env as VITE_BACKEND_URL
```

---

## Deployment

| Part     | Platform              | Notes                                                                                                                                                           |
| -------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend | **Vercel**            | Root dir: `client` · Install: `cd .. && bun install --frozen-lockfile --ignore-scripts && cd shared && bun run build` · Build: `bun run build` · Output: `dist` |
| Backend  | **Cloudflare Tunnel** | `cloudflared tunnel --url http://localhost:3000` — exposes local server via HTTPS, no port forwarding needed                                                    |
| Database | **MongoDB Atlas**     | Set Network Access → `0.0.0.0/0` to allow tunnel exit IPs                                                                                                       |
| Sandbox  | **Docker Desktop**    | Must run on the same machine as the backend                                                                                                                     |

---

<div align="center">

Built with obsession for **iTEC 2026** · Web Development Track

</div>

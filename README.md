<div align="center">

<img src="client/public/vibecodium_icon.svg" alt="VibeCodium" width="80" />

# VibeCodium

**A collaborative cloud IDE where AI writes code beside you — in real time.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.2-fbf0df?style=flat-square&logo=bun&logoColor=black)](https://bun.sh/)
[![Hono](https://img.shields.io/badge/Hono-4.12-e36002?style=flat-square&logo=hono&logoColor=white)](https://hono.dev/)
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7.2-646cff?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
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
  │  │  Supabase    │  │  Import repo │  │  SSE stream  │  │  Language → Engine   │  │
  │  │  JWT (JWKS)  │  │  File CRUD   │  │  Tool loop   │  │  Security pre-scan   │  │
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
  ┌─────────────────────────────┐             ┌──────────────────────────────────────┐
  │   SUPABASE  (Cloud)         │             │   DOCKER DESKTOP  (Local daemon)     │
  │   PostgreSQL + Vault        │             │                                      │
  │                             │             │  ┌─────────┐  ┌─────────┐            │
  │  ● projects                 │             │  │ Python  │  │  Node   │            │
  │  ● users (Supabase JWT)     │             │  │ sandbox │  │ sandbox │            │
  │  ● user_tokens (Vault UUIDs)│             │  └─────────┘  └─────────┘            │
  │  ● files                    │             │  ┌─────────┐  ┌─────────┐            │
  │  ● snapshots                │             │  │  C++    │  │  Rust   │            │
  │  ● sessions                 │             │  │ sandbox │  │ sandbox │            │
  │  ● timeline_events          │             │  └─────────┘  └─────────┘            │
  │  ● help_posts               │             │  ┌─────────┐  ┌─────────┐            │
  │                             │             │  │   Go    │  │   Bun   │            │
  │  vault.secrets (encrypted)  │             │  │ sandbox │  │ sandbox │            │
  └─────────────────────────────┘             │  └─────────┘  └─────────┘            │
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
  │  │  SUPABASE    │  │  DEEPSEEK /  │  │  GITHUB API  │  │  VERCEL API      │     │
  │  │  Auth (JWT)  │  │  LM Studio   │  │  Repo import │  │  One-click       │     │
  │  │  PostgreSQL  │  │  LLM backend │  │  User lookup │  │  project deploy  │     │
  │  │  Vault (enc) │  │  Code agent  │  │  Commit feed │  │  Base64 files    │     │
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

- Every **7th code edit** is persisted to Supabase as a `timeline_event`
- Every **50th edit** is flagged as a `checkpoint` (heavier diff marker)
- Filterable by file path, paginated, orderable oldest-first
- Click any event → restore that file state instantly
- "Analyze" button → AI summarizes the diff between two checkpoints

### One-Click Vercel Deployment

- User stores their Vercel token in profile — encrypted in Supabase Vault, only a UUID reference is stored in the DB
- `/api/deploy/:projectId` pulls all files from Supabase, encodes as base64, calls Vercel Files API
- Deployment logs stream back over WebSocket in real time
- Returns live deployment URL when done

### Session Sharing

- Generate a shareable link with a signed token (7-day TTL by default)
- Token-holders can access project files without a Supabase account
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
│  ├── server/    Hono · Bun runtime · Supabase client            │
│  └── shared/    TypeScript types (ExecuteRequest/Response)      │
└─────────────────────────────────────────────────────────────────┘
```

| Layer      | Technology                   | Why                                               |
| ---------- | ---------------------------- | ------------------------------------------------- |
| Runtime    | **Bun 1.2**                  | Native WebSocket, spawn — no extra deps           |
| HTTP       | **Hono 4**                   | 5× faster than Express, first-class Bun adapter   |
| Frontend   | **React 19 + Vite**          | Concurrent features, fastest HMR                  |
| Routing    | **TanStack Router**          | Type-safe file-based routing, search params typed |
| Editor     | **Monaco**                   | VS Code engine in the browser                     |
| CRDT       | **Yjs + Y-Monaco**           | Proven CRDT used by major collab editors          |
| Terminal   | **xterm.js + node-pty**      | Real PTY, full ANSI support                       |
| Whiteboard | **tldraw**                   | Infinite canvas, battle-tested                    |
| Database   | **Supabase (PostgreSQL)**    | Unified cloud DB — files, users, sessions, events |
| Auth       | **Supabase JWT (JWKS)**      | JWKS-based verification, service-role for backend |
| Secrets    | **Supabase Vault (pgsodium)**| AES-256-GCM encrypted token storage              |
| AI         | **DeepSeek / LM Studio**     | OpenAI-compatible, swappable via env              |
| Sandbox    | **Docker + Dockerode**       | Hard isolation per execution                      |
| Animations | **Framer Motion**            | Physics-based UI transitions                      |
| Icons      | **Lucide React**             | Tree-shakeable, consistent                        |
| Linting    | **Biome**                    | 10× faster than ESLint + Prettier combined        |

---

## Data Flow

```text
Auth flow
  Browser → Supabase Auth → JWT → server authMiddleware (JWKS verify) → context.user

Project import
  GitHub URL → git clone /tmp/vibecodium/{id} → recursive file index → Supabase batch upsert

Live editing
  Keystroke → Yjs delta → /ws/collab/:id (projectId validated) → broadcast → all Monaco instances

Agent cycle
  User prompt → POST /api/agent/suggest → LLM stream → tool calls
    → read_file (Supabase) │ write_file (diff overlay) │ execute_command (Docker)
    → loop until no tool calls → SSE close

Code execution
  Run button → security scan → Dockerode.createContainer()
    → inject code via env var → capture stdout/stderr → destroy → return

Token access
  getUserTokens(user.sub) → fetch github_secret_id / vercel_secret_id UUIDs
    → vault.read_secret(uuid) → plaintext token (never stored in app DB)

One-click deploy
  Deploy button → getUserTokens() → decrypt Vercel token from Vault → collect files from Supabase
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
│       │   └── supabase.ts  # Supabase client (service-role) — all tables
│       ├── utils/
│       │   └── tokens.ts    # Supabase Vault — read/write encrypted tokens
│       ├── middleware/
│       │   └── authMiddleware.ts  # Supabase JWT (JWKS) verification
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
- [Supabase](https://supabase.com) project with the `supabase_vault` extension enabled
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
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # service-role key (never expose to client)
SUPABASE_JWT_SECRET=your-jwt-secret
GITHUB_TOKEN=ghp_...               # optional fallback; users supply their own via profile
```

**`client/.env`**

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
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

The backend needs Docker daemon access (for sandbox execution and `docker exec` terminals), which rules out serverless platforms. The supported production layout is a single VPS running both the Bun server and Docker, fronted by a Cloudflare Tunnel.

| Part     | Platform                              | Cost              |
| -------- | ------------------------------------- | ----------------- |
| Frontend | **Vercel** (free tier) — Root dir `client` · Install: `cd .. && bun install --frozen-lockfile --ignore-scripts` · Build: `bun run build` · Output: `dist` | $0                |
| Backend  | **Single VPS** with Docker installed  | $0 or €4–8/mo     |
| Database | **Supabase** (free tier)              | $0                |
| Sandbox  | **Docker daemon on the same VPS**     | included          |
| TLS / DNS| **Cloudflare Tunnel** (named tunnel)  | $0                |

Recommended hosts (cheapest first):

| Host                                | Specs              | Cost     | Notes                                                                  |
| ----------------------------------- | ------------------ | -------- | ---------------------------------------------------------------------- |
| **Oracle Cloud — Always Free Ampere A1** | 4 vCPU ARM, 24 GB RAM | $0  | ARM64; all six sandbox base images publish arm64 variants              |
| **Hetzner CX22 / CPX21**            | 2–3 vCPU, 4 GB RAM | €4.51–7.55/mo | x86_64; fastest to provision                                       |

### Files in this repo that drive deployment

- `Dockerfile` — server image (Bun + Hono + docker CLI)
- `.dockerignore` — keeps the build context small
- `docker-compose.yml` — server service with the Docker socket bind-mounted; optional `cloudflared` sidecar
- `scripts/deploy.sh` — idempotent host-side deploy (pull → ensure sandbox images → `docker compose up -d --build`)
- `scripts/setup_docker.sh` — builds the six sandbox images locally on the host
- `.env.production.example` — every env var the server reads, with annotations

### Deployment workflow

```bash
# --- on the VPS, one-time setup ---
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-plugin git
git clone https://github.com/Alex110506/vibecodium
cd vibecodium
cp .env.production.example .env
# fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET, LLM_KEY

# --- every deploy ---
bash scripts/deploy.sh
```

### Cloudflare Tunnel (named tunnel, stable URL)

```bash
# on the VPS
cloudflared tunnel login
cloudflared tunnel create vibecodium
cloudflared tunnel route dns vibecodium api.your-domain.com
# capture the token, paste into .env as CLOUDFLARE_TUNNEL_TOKEN,
# then uncomment the cloudflared service in docker-compose.yml
docker compose up -d
```

Finally, set `VITE_BACKEND_URL=https://api.your-domain.com` in the Vercel project and redeploy the frontend.

### Smoke test

```bash
curl https://api.your-domain.com/health
# → { "ok": true, "ts": "..." }
```

---

## Security

| Area | Implementation |
| ---- | -------------- |
| Authentication | Supabase JWT verified server-side via JWKS on every request |
| Authorization | Every file-management route verifies `project.user_id === jwt.sub` before mutating |
| Token storage | GitHub and Vercel tokens encrypted with AES-256-GCM via Supabase Vault — the app DB stores only UUID references, never plaintext |
| Session expiry | Supabase ISO timestamps compared with `new Date()` — no integer/string coercion bugs |
| WebSocket gate | WS collab upgrade validates projectId exists in Supabase before accepting the connection |
| Code execution | Docker containers are network-isolated with 2 GB RAM cap and a 3-second wall-clock timeout; static security scanner runs before container creation |

---

<div align="center">

Built with obsession for **iTEC 2026** · Web Development Track

</div>

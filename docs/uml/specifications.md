# VibeCodium - Specificații Tehnice Complete

---

## 1. Prezentare Generală

### 1.1 Descriere

VibeCodium este o platformă colaborativă de editare și execuție de cod în cloud, care combină:

- **Editare colaborativă în timp real** prin CRDT (Yjs)
- **Agent AI integrat** cu streaming SSE pentru asistență la programare
- **Execuție în sandbox** de cod în Docker pentru câteva limbaje
- **Deploy automat** pe Vercel
- **Terminal interactiv** multiplexat prin WebSocket
- **Timeline & Snapshots** pentru versioning rapid
- **Community features** (Help Posts, CoderMatch)

### 1.2 Obiective

1. Simplificarea workflow-ului: cod → testare → deploy
2. Crearea unui mediu de lucru colaborativ în timp real, system-agnostic

### 1.3 Public țintă

- Studenți și începători în programare
- Echipe mici care lucrează remote
- Developeri care vor rapid prototyping fără setup local

---

## 2. Arhitectură Sistem

### 2.1 Stack Tehnologic

| Componentă    | Tehnologie                 | Justificare                                         |
| ------------- | -------------------------- | --------------------------------------------------- |
| **Runtime**   | Bun 1.x                    | Viteză superioară Node.js, API-uri moderne          |
| **Monorepo**  | Turborepo + Bun workspaces | Build caching, task orchestration                   |
| **Backend**   | Hono                       | Framework ultra-light, ~50x mai rapid decât Express |
| **Frontend**  | React 19 + Vite            | Latest features (compiler, actions), HMR rapid      |
| **Routing**   | TanStack Router            | Type-safe, file-based routing                       |
| **DB Local**  | Bun.sqlite + Drizzle ORM   | Zero latency, embedded, typesafe                    |
| **DB Cloud**  | MongoDB + Mongoose         | Scalabilitate, schema flexibil pentru user data     |
| **Auth**      | Auth0                      | Industry standard, JWKS validation                  |
| **Editor**    | Monaco Editor              | Same as VS Code, full LSP support                   |
| **Terminal**  | Xterm.js + node-pty        | True PTY, nu simulare                               |
| **Real-time** | Yjs CRDT                   | Conflict-free merge, proven (Google Docs, Figma)    |
| **AI**        | OpenAI-compatible API      | Provider-agnostic (DeepSeek, Groq, local Ollama)    |
| **Execution** | Docker                     | Izolare completă, 6 limbaje suportate               |
| **Deploy**    | Vercel API                 | Automatic GitHub integration                        |
| **Lint**      | Biome                      | 100x mai rapid decât ESLint+Prettier                |

### 2.2 Arhitectura la Nivel Înalt

```text
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT (SPA)                          │
│  React 19 + TanStack Router + Monaco + Xterm.js             │
│  ┌──────────────┬─────────────────┬────────────────┐       │
│  │ File Explorer│  Editor + Term  │  AI Chat (SSE) │       │
│  │ Timeline     │  (Yjs sync)     │  Community     │       │
│  └──────────────┴─────────────────┴────────────────┘       │
└─────────────────────────────────────────────────────────────┘
                          ↕ HTTP/WS/SSE
┌─────────────────────────────────────────────────────────────┐
│                       SERVER (Hono)                          │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐  │
│  │ Projects │  Agent   │  Deploy  │  Git     │  Help    │  │
│  │ CRUD     │  (SSE)   │  (Vercel)│  Import  │  Posts   │  │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ WebSocket Handlers: /ws/collab (Yjs) + /ws/terminal │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
        ↕ SQLite (local)           ↕ MongoDB (cloud)
┌──────────────────────┐    ┌────────────────────────────┐
│ projects, files,     │    │ User, Project, Timeline,   │
│ snapshots, sessions  │    │ HelpPost, DeployedApp      │
└──────────────────────┘    └────────────────────────────┘
        ↕ Docker API                ↕ External APIs
┌──────────────────────┐    ┌────────────────────────────┐
│ Sandbox Containers:  │    │ Vercel, GitHub, YouTube,   │
│ Python, Node, Bun,   │    │ Auth0, DeepSeek/OpenAI     │
│ C++, Rust, Go        │    │                            │
└──────────────────────┘    └────────────────────────────┘
```

### 2.3 Structura Monorepo

```text
vibecodium/
├── client/              # Frontend SPA
│   ├── src/
│   │   ├── routes/      # TanStack Router file-based routes
│   │   ├── components/  # React components
│   │   ├── contexts/    # WebSocket, Auth providers
│   │   ├── lib/         # API client, config
│   │   └── styles/      # Global CSS
│   └── public/          # Static assets
├── server/              # Backend API
│   ├── src/
│   │   ├── routes/      # Hono route handlers
│   │   ├── ws/          # WebSocket handlers
│   │   ├── db/          # Drizzle schema + Mongoose models
│   │   ├── middleware/  # Auth, CORS
│   │   ├── execution/   # Docker sandbox engines
│   │   └── index.ts     # Entry point
│   └── .env             # Environment variables
├── shared/              # Shared TypeScript types
│   └── src/types/
├── turbo.json           # Turborepo config
└── package.json         # Workspace root
```

---

## 3. Funcționalități Principale

### 3.1 Autentificare și Utilizatori

**Actori:**

- Utilizator Anonim
- Utilizator Autentificat
- Administrator (implicit, orice user autentificat poate modera help posts)

**Flow:**

1. User face click pe "Login" → redirect la Auth0
2. Auth0 returnează JWT token
3. Server validează token via JWKS
4. User se upsert-ează în MongoDB cu `sub`, `email`, `name`, `picture`
5. Token salvat în `localStorage`, folosit pentru toate API calls

**Date stocate:**

- MongoDB: `User { sub, email, name, picture, githubToken, vercelToken }`
- Nu stocăm parole (Auth0 managed)

### 3.2 Managementul Proiectelor

**Entități:**

- `Project`: container pentru fișiere, are `name`, `description`, `language`
- `File`: conținut text, path relativ în proiect
- `Snapshot`: checkpoint salvat manual/automat din editor
- `Session`: token share pentru colaborare

**Operații CRUD:**

- `POST /api/projects` → creează proiect nou cu template implicit
- `GET /api/projects` → listă proiecte (SQLite local)
- `GET /api/projects/:id` → detalii proiect + fișiere
- `PATCH /api/projects/:id` → update name/description
- `DELETE /api/projects/:id` → șterge proiect + cascade fișiere

**Import GitHub:**

- `POST /api/git/clone` cu `repoUrl` → clonare locală → parsare fișiere → inserare în SQLite
- Limitare: max 100 fișiere, max 1MB/fișier

### 3.3 Editor Colaborativ

**Tehnologie:** Yjs CRDT + WebSocket

**Flow:**

1. Client conectează la `ws://server/ws/collab/:projectId`
2. Server creează sau returnează `Y.Doc` existent pentru proiect
3. Orice editare în Monaco trigger `doc.getText().insert/delete`
4. Yjs propagă delta-uri la toți clienții conectați
5. Monaco aplică remote changes fără conflict

**Caracteristici:**

- **Operational Transformation** nu e necesar (CRDT rezolvă conflicte automat)
- **Cursor sharing** prin Yjs Awareness (culori per user)
- **Latență:** <50ms în LAN, <200ms intercontinental

**Limitări:**

- Max 10 utilizatori simultan pe proiect (configurable)
- History limit: 1000 operații (garbage collection după)

### 3.4 Terminal Interactiv

**Tehnologie:** node-pty + Xterm.js

**Flow:**

1. Client conectează la `ws://server/ws/terminal`
2. Server spawn PTY bash/zsh (pe Linux/Mac) sau cmd (Windows)
3. Client scrie în xterm → WS message → pty.write()
4. PTY output → broadcast la toți clienții în sesiune

**Security:**

- PTY rulează cu user permissions (non-root)
- Timeout: 30 min inactivitate → kill PTY
- Rate limiting: max 100 comenzi/minut

**Multiplexing:**

- Un singur PTY per proiect session
- Toți clienții văd același output (true collaboration)

### 3.5 Agent AI Integrat

**Provider:** DeepSeek (default), compatibil OpenAI API

**Flow:**

1. User scrie mesaj în VibeChat → `POST /api/agent/chat`
2. Server trimite history + system prompt la LLM
3. LLM răspunde cu SSE stream (`data: {"token": "..."}\n\n`)
4. Dacă LLM cere tool call → server execută → reinject rezultat → continuă stream
5. Client afișează tokens incremental în chat

**Tools disponibile:**

- `read_file(path)` → citește fișier din proiect
- `write_file(path, content)` → creează/suprascrie fișier
- `execute_command(command)` → rulează în Docker sandbox

**System Prompt:**

```text
You are an AI coding assistant integrated in VibeCodium.
Current project: {projectName}
Language: {language}
Available files: {fileList}

Use tools to read/write code. Be concise. Suggest best practices.
```

**Rate Limits:**

- Max 50 mesaje/user/oră
- Max 10 tool calls/mesaj

### 3.6 Execuție Sandboxată

**Limbaje suportate:**

1. Python 3.11
2. Node.js 20
3. Bun 1.x
4. C++ (g++ 12)
5. Rust (rustc 1.75)
6. Go 1.21

**Flow:**

1. User apasă "Run" → `POST /api/execute`
2. Server creează temp dir cu toate fișierele proiectului
3. Spawn Docker container cu timeout 30s, memory limit 512MB
4. Execute entry point (main.py, index.js, etc.)
5. Capturare stdout/stderr/exitCode
6. Cleanup container + temp dir
7. Return rezultat la client

**Security:**

- Network disabled în container (`--network none`)
- Read-only filesystem except `/tmp`
- No privileged access
- CPU limit: 1 core

**Exemple comenzi:**

```bash
# Python
docker run --rm -v /tmp/proj:/code python:3.11 python /code/main.py

# Bun
docker run --rm -v /tmp/proj:/code oven/bun bun run /code/index.ts

# C++
docker run --rm -v /tmp/proj:/code gcc:12 g++ /code/main.cpp -o /tmp/a.out && /tmp/a.out
```

### 3.7 Deploy pe Vercel

**Flow:**

1. User configurează `vercelToken` în `/profile`
2. Click "Deploy" în dashboard → `POST /api/deploy`
3. Server:
   - Creează repo GitHub privat via GitHub API (dacă user are `githubToken`)
   - Push fișierele proiectului
   - Trigger Vercel deployment via Vercel API
   - Polling status până la `READY` sau `ERROR`
4. Salvează `DeployedApp` în MongoDB cu URL-ul live
5. Return deployment URL la client

**Limitări:**

- Doar proiecte Node.js/Bun/Next.js (Vercel native support)
- Max 10 deployments/user/zi (Vercel free tier)

### 3.8 Timeline & Snapshots

**Concept:** Git-like checkpoints fără overhead Git

**Entități:**

- `Snapshot`: salvare stare completă proiect (`{ id, projectId, name, timestamp, files }`)
- `TimelineEvent`: eveniment în MongoDB (`{ userId, projectId, type, message, timestamp }`)

**Operații:**

1. **Salvare snapshot:** click "Save checkpoint" → serialize toate fișierele ca JSON → insert în SQLite
2. **Restore snapshot:** click pe checkpoint în TimelineBar → load fișiere → update Yjs doc
3. **AI Diff Analysis:** compară două snapshots → trimite diff la LLM → generează summary

**Auto-snapshots:**

- La fiecare deploy
- La fiecare 50 edit operations (configurable)

### 3.9 Community Features

#### Help Posts

- User poate posta întrebări cu tag-uri (`react`, `python`, etc.)
- Alți useri răspund
- AI poate sugera răspunsuri bazate pe context
- Upvote/downvote pe răspunsuri

#### CoderMatch

- Matchmaking bazat pe skills și interese
- Algoritm: Jaccard similarity între skill sets
- Chat direct între matched users (planned feature)

---

## 4. Modele de Date

### 4.1 SQLite (Drizzle ORM) - Local Data

**Schema:** `server/src/db/schema.ts`

```typescript
// Proiecte locale
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(), // proj_xxxxxx
  name: text("name").notNull(),
  description: text("description"),
  language: text("language").notNull(), // python, javascript, etc.
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// Fișiere proiect
export const files = sqliteTable("files", {
  id: text("id").primaryKey(), // file_xxxxxx
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  path: text("path").notNull(), // src/index.ts
  content: text("content").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// Snapshots (checkpoints)
export const snapshots = sqliteTable("snapshots", {
  id: text("id").primaryKey(), // snap_xxxxxx
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  files: text("files").notNull(), // JSON serialized [{path, content}]
  createdAt: integer("created_at").notNull(),
});

// Sesiuni share
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // session_xxxxxx
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(), // Share token
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
});
```

### 4.2 MongoDB (Mongoose) - Cloud Data

**Models:** `server/src/db/models/`

```typescript
// User account
interface IUser {
  sub: string; // Auth0 subject (unique)
  email: string;
  name: string;
  picture: string;
  githubToken?: string; // Encrypted
  vercelToken?: string; // Encrypted
  createdAt: Date;
  updatedAt: Date;
}

// Project metadata (cloud sync)
interface IProject {
  _id: ObjectId;
  userId: string; // Auth0 sub
  name: string;
  description: string;
  language: string;
  localProjectId?: string; // Reference la SQLite project
  isPublic: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Timeline events
interface ITimelineEvent {
  _id: ObjectId;
  userId: string;
  projectId: string;
  type: "create" | "edit" | "deploy" | "snapshot" | "share";
  message: string;
  metadata: Record<string, any>;
  timestamp: Date;
}

// Help posts (community)
interface IHelpPost {
  _id: ObjectId;
  userId: string;
  title: string;
  content: string;
  code?: string; // Optional code snippet
  tags: string[];
  answers: IAnswer[];
  views: number;
  upvotes: number;
  createdAt: Date;
  updatedAt: Date;
}

interface IAnswer {
  userId: string;
  content: string;
  code?: string;
  upvotes: number;
  isAccepted: boolean;
  createdAt: Date;
}

// Deployed apps
interface IDeployedApp {
  _id: ObjectId;
  userId: string;
  projectId: string;
  url: string; // Vercel URL
  status: "building" | "ready" | "error";
  deploymentId: string; // Vercel deployment ID
  createdAt: Date;
}

// User tokens (encrypted storage)
interface IUserToken {
  _id: ObjectId;
  userId: string;
  service: "github" | "vercel";
  encryptedToken: string; // AES-256 encrypted
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 5. API Endpoints

### 5.1 Projects

| Method | Endpoint                          | Auth | Descriere                 |
| ------ | --------------------------------- | ---- | ------------------------- |
| GET    | `/api/projects`                   | -    | Lista proiecte locale     |
| POST   | `/api/projects`                   | -    | Creează proiect nou       |
| GET    | `/api/projects/:id`               | -    | Detalii proiect + fișiere |
| PATCH  | `/api/projects/:id`               | -    | Update proiect            |
| DELETE | `/api/projects/:id`               | -    | Șterge proiect            |
| GET    | `/api/projects/:id/files`         | -    | Lista fișiere             |
| POST   | `/api/projects/:id/files`         | -    | Adaugă fișier             |
| PUT    | `/api/projects/:id/files/:fileId` | -    | Update fișier             |
| DELETE | `/api/projects/:id/files/:fileId` | -    | Șterge fișier             |

### 5.2 Agent AI

| Method | Endpoint                        | Auth | Descriere                   |
| ------ | ------------------------------- | ---- | --------------------------- |
| POST   | `/api/agent/chat`               | ✓    | SSE stream chat cu AI       |
| GET    | `/api/agent/history/:projectId` | ✓    | Chat history pentru proiect |
| DELETE | `/api/agent/history/:projectId` | ✓    | Șterge history              |

### 5.3 Execution

| Method | Endpoint       | Auth | Descriere                     |
| ------ | -------------- | ---- | ----------------------------- |
| POST   | `/api/execute` | -    | Execută cod în sandbox Docker |

**Request:**

```json
{
  "projectId": "proj_abc123",
  "language": "python",
  "entrypoint": "main.py"
}
```

**Response:**

```json
{
  "stdout": "Hello, World!\n",
  "stderr": "",
  "exitCode": 0,
  "executionTime": 145
}
```

### 5.4 Deployment

| Method | Endpoint                           | Auth | Descriere                |
| ------ | ---------------------------------- | ---- | ------------------------ |
| POST   | `/api/deploy`                      | ✓    | Deploy proiect pe Vercel |
| GET    | `/api/deploy/:deploymentId/status` | ✓    | Status deployment        |
| GET    | `/api/deploy/user`                 | ✓    | Lista deployments user   |

### 5.5 Git

| Method | Endpoint         | Auth | Descriere              |
| ------ | ---------------- | ---- | ---------------------- |
| POST   | `/api/git/clone` | ✓    | Clone repo GitHub      |
| POST   | `/api/git/push`  | ✓    | Push project to GitHub |

### 5.6 Sessions (Share)

| Method | Endpoint               | Auth | Descriere              |
| ------ | ---------------------- | ---- | ---------------------- |
| POST   | `/api/sessions`        | -    | Generează share token  |
| GET    | `/api/sessions/:token` | -    | Join sesiune via token |
| DELETE | `/api/sessions/:id`    | -    | Revoke session         |

### 5.7 Timeline

| Method | Endpoint                             | Auth | Descriere         |
| ------ | ------------------------------------ | ---- | ----------------- |
| GET    | `/api/timeline/:projectId`           | ✓    | Eventi timeline   |
| POST   | `/api/snapshots`                     | ✓    | Salvează snapshot |
| GET    | `/api/snapshots/:projectId`          | ✓    | Lista snapshots   |
| POST   | `/api/snapshots/restore/:snapshotId` | ✓    | Restore snapshot  |
| POST   | `/api/snapshots/diff`                | ✓    | AI diff analysis  |

### 5.8 Community

| Method | Endpoint                | Auth | Descriere            |
| ------ | ----------------------- | ---- | -------------------- |
| GET    | `/api/help`             | -    | Lista help posts     |
| POST   | `/api/help`             | ✓    | Creează help post    |
| GET    | `/api/help/:id`         | -    | Detalii post         |
| POST   | `/api/help/:id/answers` | ✓    | Adaugă răspuns       |
| POST   | `/api/help/:id/upvote`  | ✓    | Upvote post          |
| POST   | `/api/help/match`       | ✓    | CoderMatch algorithm |

### 5.9 Users

| Method | Endpoint                     | Auth | Descriere             |
| ------ | ---------------------------- | ---- | --------------------- |
| GET    | `/api/users/me`              | ✓    | Current user profile  |
| PATCH  | `/api/users/me`              | ✓    | Update profile        |
| POST   | `/api/users/tokens/github`   | ✓    | Salvează GitHub token |
| POST   | `/api/users/tokens/vercel`   | ✓    | Salvează Vercel token |
| DELETE | `/api/users/tokens/:service` | ✓    | Șterge token          |

### 5.10 Utility

| Method | Endpoint        | Auth | Descriere             |
| ------ | --------------- | ---- | --------------------- |
| GET    | `/api/ping-llm` | -    | Test LLM connectivity |
| POST   | `/api/scan`     | ✓    | AI security scan      |
| POST   | `/api/roast`    | ✓    | AI code roast (fun)   |
| GET    | `/api/reels`    | -    | YouTube Shorts cache  |

---

## 6. WebSocket Protocols

### 6.1 Collaboration (`/ws/collab/:projectId`)

**Message Types (Client → Server):**

```typescript
{
  type: 'sync-step-1' | 'sync-step-2' | 'update',
  data: Uint8Array  // Yjs encoded update
}
```

**Message Types (Server → Client):**

```typescript
{
  type: 'sync-step-1' | 'sync-step-2' | 'update' | 'awareness',
  data: Uint8Array
}
```

**Flow:**

1. Client conectează → trimite `sync-step-1` cu state vector
2. Server răspunde cu `sync-step-1` (state vector) + `sync-step-2` (missing updates)
3. Client aplică updates → sync complet
4. Orice editare → `update` message broadcast la toți clienții

### 6.2 Terminal (`/ws/terminal`)

**Message Types (Client → Server):**

```typescript
{
  type: 'input',
  data: string  // User input (ex: "ls -la\n")
}
```

**Message Types (Server → Client):**

```typescript
{
  type: 'output',
  data: string  // PTY output
}
{
  type: 'exit',
  code: number
}
```

---

## 7. Securitate și Autorizare

### 7.1 Autentificare

- **Auth0 JWT:** Bearer token în header `Authorization: Bearer <token>`
- **Validare:** JWKS endpoint (`https://{AUTH0_DOMAIN}/.well-known/jwks.json`)
- **Claims verificate:** `iss`, `aud`, `exp`, `sub`
- **Token lifespan:** 24h (refresh automat prin Auth0 SDK)

### 7.2 Autorizare

**Reguli:**

- Proiectele locale (SQLite) sunt **publice** (oricine le poate accesa pe instanța locală)
- Proiectele cloud (MongoDB) sunt **private** (doar user-ul owner poate accesa)
- Help posts sunt publice
- Timeline events sunt private (doar owner)
- Deploy-urile sunt private (doar owner vede lista)

**Middleware:**

```typescript
// Verifică dacă user este owner
const isOwner = async (c: Context, projectId: string) => {
  const user = c.get("user"); // Din Auth middleware
  const project = await Project.findOne({ _id: projectId, userId: user.sub });
  return !!project;
};
```

### 7.3 Rate Limiting

| Endpoint              | Limit                  |
| --------------------- | ---------------------- |
| `/api/agent/chat`     | 50/oră per user        |
| `/api/execute`        | 100/oră per IP         |
| `/api/deploy`         | 10/zi per user         |
| `/api/git/clone`      | 20/oră per user        |
| WebSocket connections | 10 concurente per user |

### 7.4 Sandbox Security

**Docker containers:**

- `--network none` (no internet access)
- `--memory 512m` (prevent memory bombs)
- `--cpus 1` (prevent CPU hogging)
- `--read-only` (filesystem immutable except /tmp)
- `--security-opt no-new-privileges`
- Timeout: 30s (kill după)

**Blocked operations:**

- File I/O outside `/code` și `/tmp`
- Network syscalls
- Privileged syscalls (mount, etc.)

---

## 8. Performance și Scalabilitate

### 8.1 Optimizări Client

- **Code splitting:** TanStack Router lazy loading
- **Virtualizare:** react-window pentru file explorer (>100 files)
- **Debouncing:** 300ms pentru Yjs updates
- **Memoization:** React.memo pentru Monaco, Xterm
- **Service Worker:** Cache static assets (planned)

### 8.2 Optimizări Server

- **Connection pooling:** MongoDB max 10 connections
- **Yjs document cleanup:** Garbage collection după 1000 ops
- **Docker image caching:** Prebuilt images (no build time)
- **SSE compression:** gzip pentru streams >1KB

### 8.3 Scalability Limits (Current)

| Resource                     | Limit         | Reason                 |
| ---------------------------- | ------------- | ---------------------- |
| Concurrent users per project | 10            | Yjs broadcast overhead |
| Max file size                | 1MB           | Monaco performance     |
| Max files per project        | 100           | UI rendering           |
| Docker containers            | 50 concurrent | Host resources         |
| SQLite database size         | 1GB           | Embedded DB limits     |

**Soluții viitoare:**

- Microservices pentru execution (Kubernetes cluster)
- PostgreSQL cu Drizzle pentru scalability
- Redis pentru Yjs state caching
- CDN pentru static assets

---

## 9. Deployment și DevOps

### 9.1 Deployment Architecture (Production)

```
┌─────────────────────┐
│   Vercel (Client)   │  Static SPA
│   CDN: Cloudflare  │
└─────────────────────┘
          ↓ API calls
┌─────────────────────┐
│  Railway (Server)   │  Hono + WebSocket
│  Docker: Enabled   │
└─────────────────────┘
     ↓              ↓
┌──────────┐   ┌──────────────┐
│ MongoDB  │   │ External APIs│
│  Atlas   │   │ (Vercel,     │
└──────────┘   │  GitHub, etc)│
               └──────────────┘
```

### 9.2 CI/CD Pipeline

**GitHub Actions:**

```yaml
name: CI/CD

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: bun install
      - run: bun run lint

  type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: bun install
      - run: bun run type-check

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: bun install
      - run: bun run build

  deploy:
    needs: [lint, type-check, build]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - run: vercel deploy --prod
```

### 9.3 Environment Variables (Production)

**Server (.env):**

```bash
NODE_ENV=production
PORT=3000

# Database
MONGO_URI=mongodb+srv://...

# Auth
AUTH0_DOMAIN=...
AUTH0_AUDIENCE=https://vibecodium.com/api

# LLM
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_KEY=sk-...
LLM_MODEL=deepseek-chat

# External APIs
VERCEL_TOKEN=...
GITHUB_TOKEN=...
YOUTUBE_API_KEY=...

# Encryption
ENCRYPTION_KEY=...  # AES-256 key pentru user tokens
```

**Client (.env.production):**

```bash
VITE_AUTH0_DOMAIN=...
VITE_AUTH0_CLIENT_ID=...
VITE_BACKEND_URL=https://api.vibecodium.com
```

### 9.4 Monitoring

**Planned integrations:**

- **Sentry:** Error tracking (frontend + backend)
- **LogTail:** Log aggregation
- **Vercel Analytics:** Page views, performance
- **Railway Metrics:** CPU, memory, request rate

---

## 10. Testing Strategy

### 10.1 Unit Tests

**Framework:** Bun test (built-in)

**Coverage:**

- `server/src/execution/*.ts` → test sandbox engines
- `server/src/db/schema.ts` → test Drizzle queries
- `shared/src/types/*.ts` → test type guards

**Example:**

```typescript
import { test, expect } from "bun:test";
import { executePython } from "./execution/python";

test("Python execution returns stdout", async () => {
  const result = await executePython("print('hello')");
  expect(result.stdout).toBe("hello\n");
  expect(result.exitCode).toBe(0);
});
```

### 10.2 Integration Tests

**Tools:** Playwright (E2E)

**Scenarios:**

1. User login → create project → write code → run → see output
2. User share project → other user join → collaborative editing
3. User deploy to Vercel → verify URL live

### 10.3 Load Testing

**Tool:** k6

**Test:**

- 100 concurrent users connecting to collaboration WS
- 1000 req/s to `/api/execute`
- Measure: p95 latency, error rate

---

## 11. Limitări Cunoscute

1. **SQLite nu e distribuit:** Proiectele locale nu se sincronizează între instanțe
   - **Workaround:** MongoDB sync (planned)
2. **Docker overhead:** Execuția e lentă (2-5s startup)
   - **Workaround:** Container pooling (planned)
3. **AI rate limits:** DeepSeek free tier 50 req/h
   - **Workaround:** User API keys (planned)
4. **No mobile UI:** Layout-ul nu e responsive
   - **Workaround:** Planned responsive redesign
5. **Terminal multiplexing:** Toți userii văd același terminal
   - **Workaround:** Per-user PTY sessions (planned)

---

## 12. Roadmap Viitor

### Q2 2026 (Post-iTEC)

- [ ] PostgreSQL migration pentru scalability
- [ ] Redis caching pentru Yjs state
- [ ] Mobile-responsive UI
- [ ] Dark mode (user preference)
- [ ] Multi-language UI (i18n)

### Q3 2026

- [ ] VS Code extension (connect to VibeCodium workspace)
- [ ] Live cursors în Monaco (Yjs Awareness++)
- [ ] Voice chat între collaboratori (WebRTC)
- [ ] AI code review automat la snapshot
- [ ] Marketplace pentru templates

### Q4 2026

- [ ] Self-hosted deployment option (Docker Compose)
- [ ] Enterprise features (SSO, audit logs)
- [ ] GPU sandbox pentru ML workloads
- [ ] GitHub Copilot integration
- [ ] Live streaming coding sessions (OBS integration)

---

## 13. Concluzii

VibeCodium este o platformă all-in-one pentru învățare, colaborare și deployment de cod, construită cu tehnologii moderne (Bun, Hono, React 19, Yjs, Docker). Arhitectura monorepo, separarea SQLite/MongoDB și sandbox-ul Docker oferă un echilibru între simplitate și scalabilitate.

**Puncte forte:**
✅ Real-time collaboration fără lag (Yjs CRDT)
✅ AI agent integrat cu tool calling
✅ Execuție multi-limbaj sandboxată
✅ Deploy automat pe Vercel
✅ Terminal interactiv multiplexat
✅ Community features pentru învățare socială

**Inovație:**

- Combinarea CRDT + AI + Docker într-o singură platformă
- Timeline cu AI diff analysis (unique feature)
- CoderMatch algorithm pentru networking

**Target iTEC 2026:**
Acest proiect demonstrează cunoștințe avansate de:

- Full-stack development (React 19, Hono, Bun)
- Real-time systems (WebSocket, SSE, CRDT)
- DevOps (Docker, CI/CD, monorepo)
- AI integration (streaming, tool calling)
- Cloud deployment (Vercel, MongoDB Atlas, Railway)

---

**Echipă:** [Numele Membrilor]
**Contact:** [EMAIL_ADDRESS]
**Repo:** https://github.com/paulhondola/vibecodium
**Demo:** https://vibecodium.vercel.app
**Prezentare:** [Link slides]

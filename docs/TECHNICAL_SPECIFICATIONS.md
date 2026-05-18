# Technical Specifications: VibeCodium

**Version:** 0.5.1
**Target:** iTEC 2026 Web Development Track
**Architecture:** Monorepo (Turborepo + Bun Workspaces)

---

## 1. System Overview

VibeCodium is a full-stack, cloud-native IDE designed for real-time collaboration and AI-assisted development. It prioritizes low latency, security isolation, and deep AI integration.

### High-Level Architecture

- **Frontend:** React 19 SPA served via Vite.
- **Backend:** Hono API running on Bun 1.2.
- **Storage:** Supabase (PostgreSQL, Vault, Auth).
- **Execution:** Docker-based multi-language sandbox.
- **Collaboration:** Yjs CRDT with WebSocket signaling.

---

## 2. Frontend Specifications (`/client`)

### Core Stack

- **Framework:** React 19 (Concurrent Mode enabled).
- **Router:** TanStack Router (Type-safe file-based routing).
- **State Management:** React Context + TanStack Query.
- **Editor Engine:** Monaco Editor (VS Code core).
- **Terminal:** xterm.js with PTY support.
- **Styling:** Vanilla CSS + Framer Motion for animations.

### Key Features

- **Y-Monaco Integration:** Real-time multi-user cursor and text synchronization.
- **SSE Streaming:** Real-time AI token streaming for responsive suggestions.
- **Diff Overlay:** Custom Monaco implementation for accepting/rejecting AI suggested changes.
- **Live Terminal:** WebSocket-to-PTY bridge for shell interaction.

---

## 3. Backend Specifications (`/server`)

### Core Stack

- **Runtime:** Bun 1.2 (using native `Bun.serve` for HTTP/WS).
- **Framework:** Hono 4 (Middleware-centric architecture).
- **Database Wrapper:** Drizzle ORM (Type-safe SQL).
- **Auth:** Supabase JWT (RS256) verified via JWKS.

### Services

- **Agent Loop:** SSE-based tool-use engine (supports `read_file`, `write_file`, `execute_command`).
- **Sandbox Orchestrator:** Uses `dockerode` to manage ephemeral containers.
- **Vault Service:** Interacts with `supabase_vault` for AES-256-GCM secret storage.
- **Collaboration Server:** Y-Websocket provider for CRDT state persistence.

---

## 4. Execution Sandbox (`/scripts/setup_docker.sh`)

Every code execution request triggers a security-hardened container lifecycle.

| Image Name          | Base               | Hard Limits                      |
| :------------------ | :----------------- | :------------------------------- |
| `vibecodium-python` | `python:3.11-slim` | 2GB RAM, No Network, 3s Timeout  |
| `vibecodium-node`   | `node:20-slim`     | 2GB RAM, No Network, 3s Timeout  |
| `vibecodium-rust`   | `rust:1.75-slim`   | 2GB RAM, No Network, 10s Timeout |
| `vibecodium-cpp`    | `gcc:latest`       | 2GB RAM, No Network, 5s Timeout  |
| `vibecodium-go`     | `golang:1.21-slim` | 2GB RAM, No Network, 5s Timeout  |
| `vibecodium-bun`    | `oven/bun:latest`  | 2GB RAM, No Network, 3s Timeout  |

### Security Protocol

1.  **Static Scan:** Regex-based vulnerability detection (`rm -rf`, `fork()`, etc.).
2.  **Isolation:** Containers are created with `--network none` and `--memory 2g`.
3.  **Clean-up:** Containers are forcefully removed immediately after execution or timeout.

---

## 5. Data Schema (Supabase)

### Primary Tables

- `projects`: Metadata, visibility, and ownership.
- `files`: Versioned file contents linked to projects.
- `timeline_events`: History of edits (used for Timeline AI).
- `checkpoints`: Logical markers in project history (every 50 edits).
- `user_tokens`: Encrypted references to external secrets (GitHub, Vercel).

### Security Model

- **RLS (Row Level Security):** Ensures users can only access their own projects.
- **Vault:** External API keys are never stored in the application database; they reside in the encrypted Vault extension.

---

## 6. AI Agent Implementation

The AI agent is designed to be "OpenAI-compatible," allowing it to point to DeepSeek, LM Studio, or OpenAI.

- **Interaction Pattern:** Tool-calling loop.
- **Toolbox:**
  - `read_file(path)`: Returns contents from Supabase.
  - `write_file(path, content)`: Stages a diff for user approval.
  - `execute_command(cmd)`: Runs a command in the Docker sandbox and returns output.
- **Feedback Loop:** The agent continues to call tools until it reaches a "stop" signal or finishes the task.

---

## 7. Deployment Pipeline

- **Frontend:** Deployed to Vercel (Edge Functions + CDN).
- **Backend:** Designed for Cloudflare Tunneling to allow local-to-cloud secure communication.
- **One-Click Deploy:** Integrated Vercel API client that encodes project files into Base64 and triggers a Vercel deployment from the server.

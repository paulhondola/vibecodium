# 🦫 VibeCodium (bhvr) — Project Context

VibeCodium is a high-performance, real-time collaborative code editor and execution sandbox built on a modern TypeScript stack. It is designed for developers who need a seamless, type-safe development environment with integrated AI capabilities and safe code execution.

## 🚀 Project Overview

- **Purpose:** Real-time collaborative IDE with isolated code execution sandboxes.
- **Architecture:** Monorepo (Turbo) with three main packages:
    - `client/`: React + Vite frontend, using TanStack Router for navigation and Monaco Editor for coding.
    - `server/`: Hono (running on Bun) backend, handling WebSockets, Docker orchestration, and API logic.
    - `shared/`: Common TypeScript types and interfaces used by both client and server.
- **Core Technologies:**
    - **Runtime:** [Bun](https://bun.sh) (Fast JS runtime, package manager, and test runner).
    - **Backend:** [Hono](https://hono.dev) (Lightweight, fast web framework).
    - **Frontend:** React, Vite, Tailwind CSS, TanStack Router.
    - **Real-time:** WebSockets for multi-cursor collaboration and terminal sync.
    - **Sandboxing:** Docker containers for isolated execution of Python, Node, C++, and Rust.
    - **Database:** SQLite with [Drizzle ORM](https://orm.drizzle.team/).
    - **Auth:** Auth0 for secure user management and social logins.

## 🛠️ Building and Running

### Prerequisites
- **Bun:** Must be installed (`curl -fsSL https://bun.sh/install | bash`).
- **Docker:** Must be running to build and execute sandboxes.

### Key Commands
- `bun install`: Installs all dependencies and automatically builds the shared package and Docker images.
- `bun run dev`: Starts the entire monorepo in development mode (Turbo).
    - `bun run dev:client`: Dev mode for frontend only.
    - `bun run dev:server`: Dev mode for backend only.
- `bun run build`: Builds all packages for production.
- `bun run setup:docker`: Manually rebuild the execution sandbox Docker images.
- `bun run format`: Formats the codebase using Biome.
- `bun run lint`: Lints the codebase using Biome.

## 📐 Development Conventions

- **Type Safety:** Always prefer shared types from `shared/src/types` to ensure end-to-end safety.
- **Bun APIs:** Use Bun-native APIs where possible (e.g., `Bun.serve`, `Bun.spawn`, `Bun.file`) instead of Node.js polyfills.
- **Surgical Edits:** When modifying the frontend, prioritize React patterns and Monaco Editor conventions.
- **Real-time Protocol:** Collaborative updates follow the protocol defined in `shared/src/types`.
- **Database Migrations:** Managed via Drizzle. Schema is located in `server/src/db/schema.ts`.
- **Styling:** Use Tailwind CSS (configured in `client/tailwind.config.js`).

## 📁 Key Directories
- `client/src/components/`: Core UI components (Editor, Terminal, Activity Feed, etc.).
- `server/src/routes/`: API endpoints for projects, sessions, git integration, and AI agents.
- `server/docker/`: Dockerfiles for the different execution runtimes.
- `shared/src/types/`: The "source of truth" for data structures and WebSocket messages.

## 🔒 Security & Sandboxing
- Code execution is strictly isolated within Docker containers.
- Security scans (Semgrep/Trivy) are integrated into the execution pipeline to detect vulnerabilities before code runs.
- Auth0 handles identity; GitHub/Vercel tokens are stored securely in the database.

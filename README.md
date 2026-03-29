# 🚀 iTECify — The AI-Native Collaborative Forge

> **Vision**: We are at an industry inflection point. AI is no longer a separate tab or a passive assistant; it is a real-time partner. iTECify solves the "absolute nightmare" of collaborative debugging by visually delimiting human intent from AI intelligence through an isolated, high-performance universal sandbox.

---

## 🏗️ The Universal Sandbox (Technical Stack)

iTECify is built on the **BHVR Stack** (Bun, Hono, Vite, React), engineered for sub-millisecond latency and total environment isolation.

| Layer | Technology | Implementation Detail |
| :--- | :--- | :--- |
| **Runtime** | **Bun** | High-performance JS runtime running on **Azure VM**. |
| **Backend** | **Hono** | Ultrafast web framework for API routing and WebSocket orchestration. |
| **Sandboxing** | **Dockerode** | Intelligent isolation with "on-the-fly" image detection for Node.js, Python, Rust, C++, and Go. |
| **Frontend** | **React + Monaco** | The VS Code core engine paired with **Xterm.js** for real-time collaborative terminal output. |
| **Synchronization**| **WebSockets** | Custom multi-presence algorithms for real-time cursor tracking and file-focus synchronization. |
| **Persistence** | **Mongo Atlas + SQLite** | MongoDB Atlas for global user profiles/tokens; SQLite for low-latency local session state. |
| **Deployment** | **Vercel & Railway** | Zero-disruption "Ship to Cloud" via REST/GraphQL API integrations. |

---

## 🌟 Core Features

### 1. Multi-Presence Collaboration
Forget "screen sharing." iTECify provides a fluid, Figma-like experience where every participant—including the **AI Agent**—possesses a unique cursor and presence. You see what Ana is typing, where Radu is looking, and what the AI is proposing, all in a unified workspace.

### 2. The Collaborative Terminal
A shared integrated terminal where `stdout` and `stderr` are broadcasted via WebSockets to every client. If a build fails, everyone sees the error exactly as it happens. Powered by **Docker**, ensuring that "it works on my machine" is a problem of the past.

### 3. Block-Style AI Integration
AI suggestions aren't just text—they are **Notion-style blocks**.
- **Visual Delimitation**: AI-generated code is clearly marked, preventing accidental merges of unverified logic.
- **Atomic Actions**: Accept or Reject AI suggestions with a single click. The system handles the diffing and synchronization across all connected peers instantly.

### 4. Smart Resource Limits
To prevent system-wide degradation from infinite loops or malicious scripts, our Docker engine enforces strict **CPU and Memory caps** (512MB RAM / 0.5 CPU shares). If code exceeds these limits, the sandbox is gracefully terminated, and the room is notified.

### 5. Pre-Deploy Security Scanning
Security is not an afterthought. Before any container starts or any code is shipped to Vercel/Railway:
- **Live Vulnerability Scan**: The system scans for high-severity patterns (e.g., hardcoded secrets, dangerous `eval` calls, or insecure shell executions).
- **Policy Enforcement**: Deployment is automatically blocked if critical vulnerabilities are detected.

---

## 🔐 Architecture & Security Data Flow

1.  **Input**: User edits code in the Monaco Editor.
2.  **Sync**: Changes are broadcasted via WebSockets to all peers and persisted in the server-side SQLite mirror.
3.  **Sandbox Request**: User triggers "Execute." 
4.  **Scan**: The Security Scanner audits the code buffer for malicious patterns.
5.  **Provision**: Dockerode pulls the required language image and mounts the project files as a read-only volume (or restricted RW).
6.  **Execute**: Code runs within the resource-constrained container.
7.  **Output**: Real-time logs are piped from Docker back through WebSockets to the shared Xterm.js UI.

---

## 🎁 Easter Eggs & Bonus Points

iTECify isn't just functional; it's alive. We've implemented several "Vibe" features:
- **🔥 Code Roast**: Submit your code to a savage AI senior engineer who will tell you exactly why your variable naming is a disaster.
- **📺 Vibe Reels**: A non-distracting sidebar of tech-memes and coding shorts to keep the morale high during long debugging sessions.
- **✨ Success Confetti**: A discretely choreographed celebration when your project successfully deploys to the cloud.
- **⌨️ Hacker Mode**: Toggle a Matrix-style rain overlay for when you're "in the zone."

---

## 🚀 Quick Start

### Backend
```bash
cd server
bun install
bun run dev
```

### Frontend
```bash
cd client
bun install
bun run dev
```

**Required Environment Variables**:
- `AUTH0_DOMAIN`: Your Auth0 tenant.
- `MONGO_URI`: MongoDB Atlas connection string.
- `RAILWAY_TOKEN` / `VERCEL_TOKEN`: For cloud deployments.

---

iTECify is more than an editor. It is a **Collaborative Forge** designed for the next generation of engineers who treat AI as a peer, not a tool. 

**Developed for iTEC 2026.**

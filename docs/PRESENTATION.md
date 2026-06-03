# VibeCodium — Presentation


> **"The Future of Collaborative Coding"**
> Build at the speed of thought — with agentic AI integration, real-time multi-user editing, sandboxed code execution, and a social developer community. All in the browser.


---

## Introduction 

### What is VibeCodium?

VibeCodium is a **full-stack, cloud-native IDE** — a collaborative code editor that runs entirely in the browser. It combines the power of a professional code editor, an autonomous AI coding agent, real-time multi-user collaboration, and a developer social community into a single, unified platform.

> [!IMPORTANT]
> VibeCodium is **not** just another code editor. It belongs to the 4th generation of development environments — the **AI-Native / Agentic IDE** era, where code is negotiated between the developer and an intelligent agent that reads, writes, and executes in a continuous tool loop.

### The Problem We Solve

| Problem | Answer |
|---|---|
| Solo IDEs are isolated — no real-time collaboration | Conflict-free multi-user editing |
| AI assistants are opaque black boxes | Agent shows its work: Accept/Reject diffs inline |
| Arbitrary code execution is dangerous | Docker sandbox: network off, 2GB RAM |
| The lack of community in the professional coding | CoderMatch, Help Posts, VibeMatch for developers |

### Competitive Positioning

```
         Social/Community
               ▲
               │  VibeCodium ★
               │
Solo ──────────┼────────────── Collaborative
               │
               │Cursor or Zed
               ▼
         Professional
```

VibeCodium combines **agentic AI capabilities** + **social collaboration** — a space that lacks competition.

---

---

## The Landing Page

The landing page at is designed to **wow from the first second**. It features:

- **Cinematic hero section** with a warp-speed star animation background, floating data stream effects, and a 3D-tilted terminal preview showing a live "AI Sentient Optimization" block with `Accept Merge` / `Refactor` buttons.
- **Bento grid feature layout** — large cards for the most impressive features, cascading into a secondary 3-column grid.
- A **VS Code-style status bar footer** (always visible) with "VibeCodium v4.0.2 Stable" branding.

### Landing Page Sections

1. **Hero** — Main headline, CTA buttons (`Initialize Workspace` / `Import Repository`), and the animated terminal preview mockup
2. **Feature Bento Grid** — Live Collaboration (large), One-Click Deploy (small), AI Agent full-width card
3. **Secondary Features Grid** 

If the user is **already authenticated**, the hero button becomes `Dashboard` and the nav profile button shows their GitHub username.

### Navigation Bar
Fixed glassmorphism top bar with:
- **VibeCodium** logo (animated terminal icon)
- Community link → `/community`
- Profile/Login button → `/profile` or Auth0 login redirect

---

## The Dashboard

The dashboard at `/dashboard` is the **Command Center** — the hub between your GitHub repositories and your VibeCodium workspaces.

```
┌─────────────────────────────────────────────────────────┐
│  DashboardHeader (user info, nav)                       │
├──────────┬──────────────────────────────────────────────┤
│ Sidebar  │   Your Repositories (headline + stats)       │
│          │                                              │
│ • Files  │   [🔍 Search repos bar]                      │
│ • Recent │                                              │
│ • Deploy │   ─── Recent Workspaces (3 cards + Import) ─ │
│ • Create │                                              │
│ • Match  │   ─── Deployed Apps ───────────────────────  │
│          │                                              │
│          │   ─── GitHub Repositories (full list) ─────  │
│          │                                              │
│          │   ─── All Workspaces (saved projects) ─────  │
└──────────┴──────────────────────────────────────────────┘
```

### Dashboard Sections

**Stats Header** — Total Stars ★ across all repos, total Repository count — displayed in glassmorphism stat cards.

**Repository Search** — Live fuzzy search across repo names and descriptions, with inline results and a Clear button.

**Recent Workspaces** — Top 3 most-recently-created projects, displayed as large hover-glow cards. An `Import Project` card (dashed border, animated `+` icon) triggers the Import Modal.

**Deployed Apps** — Shows all apps previously shipped to Vercel, with a 🟢 Live badge and `Visit App` link.

**GitHub Repositories** — Complete list of all user repos fetched from the GitHub API, showing language badge (color-coded dot), star count, fork count, and last-update time. Each row has an `Import` button that clones the repo into a VibeCodium workspace.

**All Workspaces** — A chronological flat list of every saved workspace (SQLite). Click any row to open that project directly in the editor.

### DashboardSidebar
The left sidebar contains navigation links for: scrolling to recent workspaces, scrolling to repos, opening CoderMatch, creating a new repo. A badge shows the count of unread VibeMatch messages (polled every 30 seconds).

---

## The Code Editor (Workspace)

### Overview

The main IDE workspace at `/?w=<projectId>` is a **professional-grade code editor** running entirely in the browser, with real-time collaboration, a full PTY terminal, and an AI agent sidebar.

### 3-Column Layout
Left column: Activity Bar , Panel, Explorer, Search, Git, Fun, Help, Spotify, YouTube

Middle column: Editor, Terminal

Right column: The AI Agent

All panels are **resizable** via drag handles (`react-resizable-panels`).

### Monaco Editor Features
- **Syntax highlighting** for all major languages
- **Multi-tab** support (open files in tabs, close with ×)
- **Tab context menu** — Close, Close Others, Close All
- **Remote cursor rendering** — colored named cursors from other users in real time
- **Pending Edit Blocks (AI Diffs)** — when the AI proposes a change, it highlights the diff in the editor with inline `✓ Accept` / `✗ Reject` buttons
- **Power Mode** (Easter egg) — keystroke sparks when typing
- **Embedded Games** — Flappy Bird / Subway Surfer play in a Picture-in-Picture window inside the editor

### WorkspaceTopBar
The top bar shows: project name, branch name, collaborator avatars (colored dots), connection status, `Save to GitHub`, `Deploy to Vercel`, `Share Link`, `Whiteboard` toggle buttons.

---

## Ship to Cloud (Vercel Deployment)

### One-Click Deploy

VibeCodium integrates the **Vercel API** directly into the editor. With a single click on `Deploy`, the entire project is packaged and shipped to production.

### Deployment Flow

```
[Deploy Button] 
    │
    ▼
Check for Vercel token
    │ missing? → Token Prompt Modal → user goes to Profile
    │ present? ↓
    ▼
POST /api/deploy/:projectId
    │
    ▼
Server reads all project files from SQLite
    │
    ▼
Encodes each file as Base64
    │
    ▼
Calls Vercel API → creates deployment
    │
    ▼
Streams build logs → Xterm.js Terminal (real-time)
    │
    ▼
Deploy Success Modal 🎉 + Confetti
    │
    ▼
Live URL displayed → saved to Supabase
```

### Features
- **Real-time terminal streaming** — deployment logs appear in the Xterm terminal as they come in
- **Deploy Success Modal** — shows the live URL with a `Visit App` button and `Copy URL` option
- **Deployed Apps history** — all past deployments appear on the Dashboard's "Deployed Apps" section
- **Token management** — GitHub and Vercel tokens are stored encrypted in Supabase, never in plaintext
- **Confetti celebration** on successful deploy

### GitHub Push (Save)
The `Save to GitHub` button in the top bar calls `POST /api/projects/:id/push`, which commits all current file contents back to the linked GitHub repository using the user's stored GitHub token.

> [!TIP]
> Both GitHub token and Vercel token are managed in the **Profile** page under **Integrations**, stored securely.
---

## Real-Time Collaboration

### Architecture

VibeCodium's collaboration layer uses **Yjs CRDTs** for conflict-free concurrent editing, transmitted over **WebSockets** via the Bun server.


![alt text](<uml/photos/VibeCodium - Class Diagram.png>)
```
Client A                  Bun Server (Hono)               Client B
────────                  ─────────────────               ────────
User types
  └─ Y.Doc transact
       └─ doc.on("update")
            └─ WS send {type:"yjs_update"}
                              │
                     applyUpdate → roomYDocs[proj][file]
                     update roomFileStates[proj][file]
                     ws.publish(projectId, {type:"yjs_update"})
                                                     │
                                         applyUpdate to local Y.Doc
                                         Monaco model.setValue(merged)
```

### Collaboration Features
- **Colored named cursors** — each collaborator gets a unique color; their cursor and username label appear in the editor in real time
- **Conflict-free merging** — Yjs CRDT guarantees zero conflicts regardless of concurrent edits
- **Room state sync** — when a new user joins, they receive the full current room state immediately
- **User presence list** — the top bar shows avatar dots for every active collaborator
- **Host designation** — the first user to open a project is the "host"; the backend tracks host assignment
- **Agent-accepted sync** — when one user accepts an AI suggestion, the change is broadcast to all collaborators
- **Session sharing** — the `Share Link` button generates a shareable URL (`/?w=projectId`) valid for anyone with the link

![alt text](<uml/photos/VibeCodium - Sequence (Real-Time Collaboration).png>)

### Shared Terminal
The Xterm.js terminal is backed by a **real PTY process** (`node-pty`) over WebSocket:
- Every keystroke is sent to the server's PTY
- All output is broadcast to every user in the session
- **Everyone sees the same terminal output simultaneously** — true pair-programming terminal
- Run `npm install`, `python main.py`, `bun run build` — all collaborators see it live
---

## AI Agent (VibeChat)

**VibeChat** is the AI agent sidebar — a token-streaming, tool-using autonomous coding assistant that lives in the right panel of every workspace.

### How the Agent Works

```
User sends message
    │
    ▼
POST /api/agent/stream (SSE)
    │
    ▼
LLM receives: system prompt + file context + user message
    │
    ▼
LLM streams tokens → rendered in chat as they arrive
    │
    ├─ Tool call detected? → execute tool:
    │      read_file(path)       → returns file content from SQLite
    │      write_file(path, ...) → stages diff for user approval
    │      execute_command(cmd)  → runs in Docker sandbox, returns output
    │
    └─ Loop back until LLM emits stop signal
```
---

### 🛠️ Technology Stack

```
┌──────────────────────────────────────────────────────────────┐
│                     FRONTEND (client/)                       │
│  React 19 · Vite · TanStack Router · TypeScript             │
│  Monaco Editor · Xterm.js · Yjs (y-monaco) · Framer Motion  │
│  Vanilla CSS · Lucide Icons · react-resizable-panels        │
└──────────────────────────────────────────────────────────────┘
                              │
                      WebSocket / SSE / REST
                              │
┌──────────────────────────────────────────────────────────────┐
│                     BACKEND (server/)                        │
│  Bun 1.2 runtime · Hono 4 framework                        │
│  Supabase (cloud DB)                        │
│  Auth0 (JWKS JWT validation)                                │
│  node-pty (PTY terminal process)                            │
└──────────────────────────────────────────────────────────────┘
                              │
                    Docker / External APIs
                              │
┌──────────────┬──────────────┬──────────────┬────────────────┐
│   Docker     │   DeepSeek   │   Vercel     │   GitHub API   │
│   Sandbox    │   / OpenAI   │   Deploy     │   (repos)      │
│   6 images   │   LLM API    │   API        │                │
│  Python      │              │              │                │
│  Node        │  OpenRouter  │  Supabase    │  YouTube API   │
│  Rust        │  Groq        │  Atlas       │  (Reels)       │
│  Go          │  Custom/     │  (cloud)     │                │
│  C++         │  Local       │              │                │
│  Bun         │              │              │                │
└──────────────┴──────────────┴──────────────┴────────────────┘
```

### Monorepo Structure

```
vibecodium/
├── client/        React 19 + Vite SPA
├── server/        Hono API (Bun runtime)
├── shared/        Shared TypeScript types
├── turbo.json     Turborepo config
└── package.json   Bun workspaces root
```
## VibeMatch, Community & Profile

### VibeMatch (CoderMatch)

**VibeMatch** is a Tinder-style developer matchmaking feature that pairs developers together for collaborative coding sessions.

#### How It Works
1. **Set up your profile** — bio, primary language, location (in the Profile page, under "Public Profile for Vibe Match")
2. **Browse & swipe** — the CoderMatch modal shows other developers (profile picture, bio, language, location)
3. **Match!** — when two users both swipe right on each other, a match is created
4. **Chat** — matched users can message each other directly in the app
5. **Unread badge** — the Dashboard sidebar shows a live unread message count, polled every 30 seconds

### Community Page (`/community`)

The community page has two sections:

**Help Posts** — Developers can post repositories for community code review. Other users can browse, reply, and offer help. Posts link directly to GitHub repos.

**CoderMatch Hub** — Full VibeMatch interface for browsing and matching with developers.

### Vibe Reels (YouTube Sidebar)

A TikTok-style **short-form video feed** of coding content, accessible from the YouTube icon in the editor's activity bar. Videos are cached via the YouTube Data API v3.

### Profile Page (`/profile`)

The profile page is a full settings hub:

#### Profile Card (Left Column)
- Auth0 avatar image (with glowing online indicator)
- Full name + GitHub username + email
- `Verified Dev` badge
- `Edit Profile` (scrolls to form) and `Disconnect` (logout) buttons

#### GitHub Stats
Fetched live from GitHub API:
- **Repositories** count
- **Commits** count (total across all repos)

#### Public Profile (for VibeMatch)
- **Bio** (up to 200 characters)
- **Primary Language** (dropdown: TypeScript, Python, Go, Rust, C++, etc.)
- **Location** (text field: City, Country)
- `Save Profile` button

#### Integrations
- **GitHub Token** — for pushing to repos and creating repos from the IDE
- **Vercel Token** — for one-click deployment
- **AI Model Provider** — choose from OpenRouter, OpenAI, Groq, DeepSeek, or Custom
  - Set the **Provider**, **Model** (e.g. `anthropic/claude-opus-4`), **API Key**, and **Base URL**

---
## Easter Eggs, Fun Features & Technology Stack

### 🥚 Easter Eggs & Fun Features

VibeCodium is packed with hidden and not-so-hidden fun features, accessible from the **Fun panel** (⟨✨⟩ icon in the activity bar).

#### ⚡ Power Mode
Toggle ON to enable **keystroke sparks** — every key press generates animated particle effects bursting from the cursor. Great for showing off during a demo.

#### 🖥️ Hacker Mode (Matrix Rain)
Toggle ON to overlay the entire editor with the classic **Matrix digital rain** effect — falling green katakana characters. Uses a canvas overlay that does not interfere with editing.

#### 🐦 Flappy Bird (Picture-in-Picture)
Launch a **fully playable Flappy Bird** game in a floating PIP window that stays on top of the editor. Keep coding while you play.

#### 🏃 Subway Surfer (Picture-in-Picture)
Launch a **3D Subway Surfer** game in a PIP window. The classic "coding with brainrot content" experience.

#### 🔥 Roast My Code
With any file open, click `Roast My Code` to send the current file to the AI for a **brutally honest (and funny) code review**. The AI generates roast-style commentary in a modal.

#### 😄 Emoji Reactions
Users in a collaboration session can send **floating emoji reactions** that appear on everyone's screen simultaneously (broadcast via WebSocket `emoji_reaction` type).

#### 🐍 Rubber Duck (RubberDuck.tsx)
A rubber duck debugging companion component.

#### 🔢 Quick Open (`Ctrl+P`)
VS Code-style command palette — type to fuzzy-find any file by name across the entire project.

#### 🧘 Zen Mode (`Ctrl+K`)
One shortcut to hide the sidebar, terminal, and chat — leaving only the pure editor in full focus mode.

#### 🎵 Spotify Integration
A Spotify player embedded directly in the editor sidebar. Code and vibe simultaneously.

#### 📺 Vibe Reels
TikTok-style coding short videos inside the IDE — because why leave to watch YouTube?

# Graph Report - .  (2026-04-12)

## Corpus Check
- 104 files · ~217,821 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 424 nodes · 513 edges · 32 communities detected
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 41 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `VibeCodium Technical Specifications (UML)` - 17 edges
2. `Actor: Utilizator Autentificat (Authenticated User)` - 12 edges
3. `Backend Hono Server` - 11 edges
4. `Storage Layer (Bun.sqlite + Drizzle ORM)` - 9 edges
5. `Workspace Component` - 8 edges
6. `VibeCodium Product Roadmap` - 8 edges
7. `System Architecture` - 7 edges
8. `Project State: Editing` - 7 edges
9. `Class: Project (DB Model)` - 7 edges
10. `Component: REST API Routes (Server)` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Collaborative Whiteboard (Excalidraw)` --semantically_similar_to--> `tldraw Whiteboard`  [INFERRED] [semantically similar]
  docs/ROADMAP.md → README.md
- `Deployment Pipeline Integration` --semantically_similar_to--> `One-Click Vercel Deployment Feature`  [INFERRED] [semantically similar]
  docs/ROADMAP.md → README.md
- `Class: DeployRoute (Backend)` --implements--> `Sequence Participant: Deploy Route (Vercel)`  [INFERRED]
  docs/uml/diagrams/code/class-diagram.puml → docs/uml/diagrams/photos/VibeCodium - Sequence (Vercel Deploy).png
- `Security Scan Execute Integration` --references--> `Execution Router`  [INFERRED]
  docs/SECURITY_SCAN_DEMO.md → README.md
- `LLM-Enhanced Security Scanning (scanWithLLM)` --references--> `DeepSeek / LM Studio LLM`  [INFERRED]
  docs/SECURITY_SCAN_DEMO.md → README.md

## Hyperedges (group relationships)
- **Real-Time Collaboration Stack** — readme_yjs_crdt, readme_ws_collab, readme_monaco_editor [EXTRACTED 0.95]
- **Sandboxed Execution Pipeline** — readme_security_scanner, readme_docker_sandbox, readme_execution_router [EXTRACTED 0.95]
- **AI Agent Tool Loop** — readme_ai_agent_feature, readme_deepseek_llm, readme_sqlite_local [EXTRACTED 0.90]
- **AI Agent Loop Flow: VibeChat -> AgentRoute -> DeepSeek -> ToolExecutor -> FileSystem** — seq_ai_vibechat, seq_ai_agentroute, seq_ai_deepseek_api, seq_ai_tool_executor, seq_ai_file_system [EXTRACTED 1.00]
- **Vercel Deploy Flow: Client -> DeployRoute -> GitHubAPI -> VercelAPI -> MongoDB** — seq_vercel_client, seq_vercel_deploy_route, seq_vercel_github_api, seq_vercel_vercel_api, comp_mongodb [EXTRACTED 1.00]
- **Real-Time Collaboration Flow: Browser Clients <-> WebSocket Server <-> Yjs Y.Doc <-> SQLite** — seq_collab_user1_browser, seq_collab_user2_browser, seq_collab_websocket_server, seq_collab_yjs_ydoc, seq_collab_sqlite_db [EXTRACTED 1.00]
- **VibeCodium Architecture Layers** — diag_stack_ui_layer, diag_stack_api_layer, diag_stack_agent_layer, diag_stack_execution_layer, diag_stack_storage_layer, diag_stack_llm_provider [EXTRACTED 1.00]
- **VibeCodium Database Schema Tables** — diag_schema_projects_table, diag_schema_files_table, diag_schema_messages_table, diag_schema_snapshots_table [EXTRACTED 1.00]
- **VibeCodium Agent Tools** — diag_backend_tool_read_file, diag_backend_tool_write_file, diag_backend_tool_exec_command [EXTRACTED 1.00]
- **VibeCodium UI Panels** — diag_ui_layout_file_explorer, diag_ui_layout_action_history, diag_ui_layout_monaco_editor, diag_ui_layout_output_panel, diag_ui_layout_vibe_chat [EXTRACTED 1.00]
- **VibeCodium Brand Assets (atom + brackets motif)** — vibecodium_square_logo_svg, vibecodium_wide_logo_png, vibecodium_square_logo_png, client_public_vibecodium_icon_svg, client_assets_vibecodium_icon_svg [EXTRACTED 1.00]
- **VibeCodium Execution Engines** — diag_execution_bun_spawn, diag_execution_piston_api, diag_backend_bun_spawn, diag_backend_piston_api [INFERRED 0.90]
- **VibeCodium Agent Loop Steps** — diag_agent_user_message, diag_agent_build_context, diag_agent_llm_call, diag_agent_tool_decision, diag_agent_execute_tools, diag_agent_append_results, diag_agent_persist_close [EXTRACTED 1.00]

## Communities

### Community 0 - "Frontend UI Components"
Cohesion: 0.04
Nodes (2): handleSend(), spawnEmoji()

### Community 1 - "Backend & AI Infrastructure"
Cohesion: 0.04
Nodes (58): Agent API (SSE), AI Agent Feature, Auth0, Auth Middleware (Auth0 JWKS), Backend Hono Server, Bun Runtime, Cloudflare Tunnel, DeepSeek / LM Studio LLM (+50 more)

### Community 2 - "Server Routes & Middleware"
Cohesion: 0.07
Nodes (0): 

### Community 3 - "Client Build & Tooling"
Cohesion: 0.06
Nodes (33): ESLint Configuration, Client Vite + React + TypeScript Template, Vite Build Tool, Client React SPA, Real-Time Collaboration Feature, EditorArea Component, FileExplorer Component, Monaco Editor (+25 more)

### Community 4 - "UML Use Case & Components"
Cohesion: 0.08
Nodes (33): Actor: Utilizator Anonim (Anonymous User), Actor: Utilizator Autentificat (Authenticated User), Actor: Colaborator (Collaborator), Component: Agent Tools (Server), External Service: DeepSeek LLM API, External Service: Docker Engine, Component: Execution Engines (Server), Component: SSE Client (Client) (+25 more)

### Community 5 - "External Services & Databases"
Cohesion: 0.07
Nodes (30): External Service: Auth0, Component: Auth Middleware (Server), External Service: GitHub API, Component: Monaco Editor (Client), Database: MongoDB Cloud Data, Component: React UI Components (Client), Component: REST API Routes (Server), Database: SQLite Local Data (+22 more)

### Community 6 - "Client Routes & Community"
Cohesion: 0.08
Nodes (0): 

### Community 7 - "Class Diagram Architecture"
Cohesion: 0.08
Nodes (26): Class: AgentRoute (Backend), Class: CollaborationWS (Backend), Class: Dashboard (Frontend), Class: DeployRoute (Backend), Class: EditorArea (Frontend), Class: ExecutionRoute (Backend), Class: FileExplorer (Frontend), Class: HonoServer (Backend) (+18 more)

### Community 8 - "AI Agent Loop & Chat"
Cohesion: 0.11
Nodes (24): Beaver SVG Icon (Noto Emoji by Google) — used as mascot/avatar, Append Tool Results (add to messages array), Build Context (file tree paths + open file content), Execute Tools (read_file / write_file / exec_command), LLM Call (streaming, OpenRouter Devstral 2 free), Persist + Close (save to DB), SSE Client (Vibe Chat UI), Tool Call Decision (tool calls in response?) (+16 more)

### Community 9 - "Database Models"
Cohesion: 0.16
Nodes (19): Class: File (DB Model), Class: HelpPost (DB Model), Class: Project (DB Model), Class: Session (DB Model), Class: Snapshot (DB Model), Class: TimelineEvent (DB Model), Class: User (DB Model), Class: ProjectsRoute (Backend) (+11 more)

### Community 10 - "Code Execution Engine"
Cohesion: 0.18
Nodes (12): Vite Logo SVG (client/public) — official Vite build tool logo, Agent Tool: exec_command, Bun.spawn Engine (write to /tmp/uuid/, run, capture stdout), Piston API Engine (POST emkc.org/api/v2/piston), POST /execute (fetch files from DB, build file map), Execution Router (JS/TS → Bun.spawn | other → Piston), Run Button (user triggered), Agent Layer (LLM Loop) (+4 more)

### Community 11 - "Architecture Overview"
Cohesion: 0.18
Nodes (12): Agent Loop (build context → LLM → handle tools), Bun.spawn (JS/TS only), Bun.sqlite (Drizzle ORM), CRUD Routes (projects + files), Execution Router (language check → pick engine), Piston API (Python, Rust, Go…), POST /agent (SSE stream), POST /execute (stateless run) (+4 more)

### Community 12 - "User Activity Flow"
Cohesion: 0.2
Nodes (10): Activity Step: AI Chat via VibeChat, Activity Step: Auth0 Login, Activity Step: Create New Project, Activity Step: Dashboard, Activity Step: Execute in Docker, Activity Step: Import from GitHub, Activity Step: Open in Editor (Monaco), Activity Step: Create Snapshot (+2 more)

### Community 13 - "Timeline Component"
Cohesion: 0.67
Nodes (2): formatDate(), formatTime()

### Community 14 - "Reels Component"
Cohesion: 0.5
Nodes (0): 

### Community 15 - "UI Utilities"
Cohesion: 0.5
Nodes (0): 

### Community 16 - "Brand Assets"
Cohesion: 0.67
Nodes (4): VibeCodium App Icon (client/src/assets) — atom + brackets SVG, VibeCodium App Icon (client/public) — atom + brackets SVG, VibeCodium Square Logo (PNG) — rounded square app icon, VibeCodium Square Logo (SVG) — dark purple bg, code brackets + atom icon

### Community 17 - "Productivity Widget"
Cohesion: 1.0
Nodes (0): 

### Community 18 - "C++ Docker Container"
Cohesion: 1.0
Nodes (0): 

### Community 19 - "Vite Config"
Cohesion: 1.0
Nodes (0): 

### Community 20 - "TypeScript Env Types"
Cohesion: 1.0
Nodes (0): 

### Community 21 - "Client Router"
Cohesion: 1.0
Nodes (1): TanStack Router

### Community 22 - "Session Sharing"
Cohesion: 1.0
Nodes (1): Session Sharing Feature

### Community 23 - "Community Features"
Cohesion: 1.0
Nodes (1): Community and Discovery Features

### Community 24 - "Animation Library"
Cohesion: 1.0
Nodes (1): Framer Motion

### Community 25 - "Code Quality Tools"
Cohesion: 1.0
Nodes (1): Biome Linter

### Community 26 - "Shared Type Definitions"
Cohesion: 1.0
Nodes (1): Shared TypeScript Types

### Community 27 - "Docker Setup"
Cohesion: 1.0
Nodes (1): Docker Setup Script

### Community 28 - "Resource Management"
Cohesion: 1.0
Nodes (1): Resource Limits and Smart Quotas

### Community 29 - "Plugin System"
Cohesion: 1.0
Nodes (1): Plugin Marketplace

### Community 30 - "Git Integration UI"
Cohesion: 1.0
Nodes (1): Integrated Git Workflow UI

### Community 31 - "Wide Logo Brand Asset"
Cohesion: 1.0
Nodes (1): VibeCodium Wide Logo (PNG) — dark purple wide banner, brackets + atom

## Knowledge Gaps
- **97 isolated node(s):** `TanStack Router`, `Cloudflare Tunnel`, `Sessions Share Tokens`, `Timeline Checkpoints`, `AI Agent Feature` (+92 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Productivity Widget`** (2 nodes): `PomodoroTimer.tsx`, `PomodoroTimer()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `C++ Docker Container`** (1 nodes): `Dockerfile.cpp`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Vite Config`** (1 nodes): `vite.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `TypeScript Env Types`** (1 nodes): `vite-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Client Router`** (1 nodes): `TanStack Router`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Session Sharing`** (1 nodes): `Session Sharing Feature`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community Features`** (1 nodes): `Community and Discovery Features`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Animation Library`** (1 nodes): `Framer Motion`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Code Quality Tools`** (1 nodes): `Biome Linter`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Shared Type Definitions`** (1 nodes): `Shared TypeScript Types`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Docker Setup`** (1 nodes): `Docker Setup Script`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Resource Management`** (1 nodes): `Resource Limits and Smart Quotas`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Plugin System`** (1 nodes): `Plugin Marketplace`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Git Integration UI`** (1 nodes): `Integrated Git Workflow UI`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Wide Logo Brand Asset`** (1 nodes): `VibeCodium Wide Logo (PNG) — dark purple wide banner, brackets + atom`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Class: HonoServer (Backend)` connect `Class Diagram Architecture` to `Database Models`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `Sequence Participant: Deploy Route (Vercel)` connect `External Services & Databases` to `Class Diagram Architecture`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `VibeCodium Technical Specifications (UML)` (e.g. with `VibeCodium Platform` and `PlantUML Diagram Generation Instructions`) actually correct?**
  _`VibeCodium Technical Specifications (UML)` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `Storage Layer (Bun.sqlite + Drizzle ORM)` (e.g. with `DB Schema: projects table (id, name, entry_point, language, created_at)` and `DB Schema: files table (id, project_id FK, path IX, content, updated_at)`) actually correct?**
  _`Storage Layer (Bun.sqlite + Drizzle ORM)` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `TanStack Router`, `Cloudflare Tunnel`, `Sessions Share Tokens` to the rest of the system?**
  _97 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Frontend UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `Backend & AI Infrastructure` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
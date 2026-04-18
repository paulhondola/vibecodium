# VibeCodium - Architecture & Diagrams Explained

**VibeCodium** is a collaborative real-time code editor and isolated execution sandbox designed to streamline development. 

**Tech Stack:**
- **Frontend**: React 19, Vite, Monaco Editor, Xterm.js
- **Backend**: Hono
- **Real-Time Collaboration**: Yjs (CRDT) over WebSockets
- **Databases**: Supabase (Cloud Storage)
- **Code Execution**: Docker Sandboxes
- **Deployment**: Vercel

## 1. The Class Diagram

<img src="photos/VibeCodium - Class Diagram.png" alt="Class Diagram" style="max-width: 100%;" />

The Class Diagram is essentially the blueprint of our entire codebase. It breaks the system down into three main pieces:

- **Frontend (React)**: Everything revolves around the `Dashboard`, which acts as the orchestrator for the `EditorArea` (where the magic happens with Monaco), the `TerminalArea` (hooked up to Xterm.js for that sweet interactive PTY terminal), and our AI assistant inside `VibeChat`.
- **Backend (Hono)**: This is our lightweight, ultra-fast API. Aside from handling the standard REST routes (like managing projects or executing code sandbox environments), it spins up our WebSocket handlers for real-time multiplayer editing (`CollaborationWS`) and terminal streaming (`TerminalWS`).
- **Database Models**: This section highlights the core entities that store everything from the `User` and `Project` details down to timeline `Snapshots` and `HelpPost` interactions.
---


## 2. The Use Case Diagram

<img src="photos/VibeCodium - Use Case Diagram.png" alt="Use Case Diagram" style="max-width: 80%;" />

**Anonymous Users**: They only view the initial landing experience to authenticate via Auth0.

**Authenticated Users**: This is where all the action happens. Once logged in, you can create projects, spin up code in the Docker sandboxes, deploy instantly to Vercel, chat with the integrated AI, or browse community features like CoderMatch and "Roast My Code." 

**Collaborators**: They can enter a project via a shared token link. They get dropped right into the action, gaining access to the shared collaborative editor and the interactive terminal.

---

## 3. The State Diagram (Collaboration Session)

<img src="photos/VibeCodium - State Diagram (Collaboration Session).png" alt="State Diagram" style="max-width: 50%;" />

This diagram gets into the real-time collaboration. It shows exactly what happens under the hood when multiple people are typing code simultaneously.

Here is the lifecycle of a multiplayer session:
- It starts off `Idle` until the first person connects, flipping the state to `SingleUser`.
- Whenever someone new joins the party, the system briefly enters a `Syncing` state. During this tiny window, the client syncs up with the existing `Y.Doc` state stored on the server.
- Once multiple people are active (`MultiUser`), we rely on CRDT (Conflict-free Replicated Data Type) magic. If two people aggressively edit the exact same lines at the same time, the system seamlessly triggers a CRDT merge. No locked files, no annoying conflict pop-ups.
- Eventually, if everyone leaves and the session reaches its max inactivity limit, it transitions safely to an `Expired` state.

---

## 4. Component Diagram

<img src="photos/VibeCodium - Component Diagram.png" alt="Component Diagram" style="max-width: 60%;" />

---

## 5. Sequence Diagram: AI Agent Loop

<img src="photos/VibeCodium - Sequence (AI Agent Loop).png" alt="Sequence (AI Agent Loop)" style="max-width: 60%;" />

---

## 6. Sequence Diagram: Docker Execution

<img src="photos/VibeCodium - Sequence (Docker Execution).png" alt="Sequence (Docker Execution)" style="max-width:60%;" />

---

## 7. Sequence Diagram: Real-Time Collaboration

<img src="photos/VibeCodium - Sequence (Real-Time Collaboration).png" alt="Sequence (Real-Time Collaboration)" style="max-width: 55%;" />

---

## 8. Sequence Diagram: Vercel Deploy

<img src="photos/VibeCodium - Sequence (Vercel Deploy).png" alt="Sequence (Vercel Deploy)" style="max-width: 50%;" />

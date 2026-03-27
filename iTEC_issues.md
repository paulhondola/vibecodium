# iTECify: Code Collaboration & Sandboxing
**Vision**: A Figma-like real-time collaborative code editor with Notion-style AI blocks and robust, on-the-fly execution sandboxing.

---

## 🛠️ Roles & Issue Breakdown

### 🐳 Sandboxing & Execution (Using Piston API)
> **Goal:** Securely execute code without manually managing Docker containers by leveraging the Piston API.

**Issue 1: Setup Piston API Integration (Proof of Concept)**
* **Labels:** `role: devops`, `priority: high`, `diff: medium`, `type: core-feature`
* **Description:** Integrate the Piston API to execute multi-language code snippets. Create a simple service that takes a code string (Python/Node), sends an HTTP request to a Piston API instance, and returns the execution output/error.
* **Acceptance Criteria:** Exported function `runCode(lang, code)` that correctly returns the output of the executed code.

**Issue 2: Output Handling & WebSocket Relay**
* **Labels:** `role: devops`, `priority: high`, `diff: medium`, `type: core-feature`
* **Description:** Modify the execution engine to format the Piston API response (compile output, stdout, stderr) and relay it effectively to the frontend via WebSockets in real-time.
* **Acceptance Criteria:** A user clicking "Run" sees the Piston execution payload mirrored directly into their UI console.

**Issue 3: Smart Resource Limits (Piston Config)**
* **Labels:** `role: devops`, `priority: medium`, `diff: easy`, `type: side-quest`
* **Description:** Enforce strict limitations in the Piston API execution payloads. Include strict `run_timeout` and `compile_timeout` (e.g., max 3-5 seconds) to prevent `while(true)` loops from blocking the execution queue.

**Issue 4: Pre-Execution Security & Vulnerability Scanning**
* **Labels:** `role: devops`, `priority: medium`, `diff: hard`, `type: core-feature`
* **Description:** Add a static analysis scanner before the code is sent to Piston. Use regex filters or lightweight tools to block malicious intent (e.g., blocking `import os` or `open()` in Python).

---

### 🧑‍💻 Frontend & Collaboration
> **Goal:** Building the multi-cursor real-time Yjs editor.

**Issue 5: Setup Collaborative Editor Interface (CRDT)**
* **Labels:** `role: frontend`, `priority: high`, `diff: hard`, `type: core-feature`
* **Description:** Integrate CodeMirror 6 or Monaco Editor into the React app. Hook it up to a Yjs (CRDT) document and establish a WebSocket provider to see multiple cursors.
* **Acceptance Criteria:** Sockets connect and multiple users cursors sync seamlessly without merge conflicts.

**Issue 6: AI Generated Code as Block Elements (Notion-style)**
* **Labels:** `role: frontend`, `priority: high`, `diff: hard`, `type: core-feature`
* **Description:** Create custom React widgets inside the editor. AI suggestions shouldn't just be raw text; they should appear as visually distinct interactable blocks (Accept / Reject options).

**Issue 7: Time-Travel Debugging (History Timeline)**
* **Labels:** `role: frontend`, `priority: low`, `diff: hard`, `type: side-quest`
* **Description:** Utilize the native Undo Manager in Yjs to create a timeline slider. Scrubbing the slider left/right visually rewinds or fast-forwards the code history on the screen.

---

### ⚙️ Backend Orchestrator & AI
> **Goal:** WebSocket routing, state management, and LLM integrations.

**Issue 8: WebSocket Real-Time Infrastructure**
* **Labels:** `role: backend`, `priority: high`, `diff: medium`, `type: core-feature`
* **Description:** Setup the main backend (Express/Hono) with a Websocket server (WS or Socket.io). Create isolated "rooms" for different projects so CRDT broadcasts don't leak between sessions.

**Issue 9: AI Agent API Integration & Routing**
* **Labels:** `role: backend`, `priority: high`, `diff: medium`, `type: core-feature`
* **Description:** Create an endpoint for AI suggestions. The backend will call the LLM (OpenAI API/Local model) with appropriate system prompts and return the streamed/fragmented code back to the session.

**Issue 10: Shared Terminal Relay Architecture**
* **Labels:** `role: backend`, `priority: medium`, `diff: hard`, `type: side-quest`
* **Description:** Create a bidirectional pipeline for the "Shared Terminal". Relay keystrokes from any user to the execution service, and broadcast the output to everyone simultaneously.

---

### 🎨 Full-Stack & UI Integrator 
> **Goal:** Tying the components together, dashboards, and user experience.

**Issue 11: Main App Layout, Project Dashboard & Routing**
* **Labels:** `role: fullstack`, `priority: high`, `diff: easy`, `type: core-feature`
* **Description:** Create the skeleton of the React application (Navbar, Dashboard, Editor View). Build the "Create New Session" flow.

**Issue 12: Integrated Shared Terminal UI (Xterm.js)**
* **Labels:** `role: fullstack`, `priority: medium`, `diff: medium`, `type: side-quest`
* **Description:** Add the `xterm.js` library to the frontend in a resizable bottom panel. Connect it directly to the STDIN/STDOUT WebSocket events provided by the backend.

**Issue 13: Easter-eggs & Auditory Experience**
* **Labels:** `role: fullstack`, `priority: low`, `diff: easy`, `type: easter-egg`
* **Description:** Implement the Konami Code on the keyboard to trigger a special retro editor theme. Add fun alert sounds if a user's code hits the Piston Timeout limit or triggers a security vulnerability block.

# 🚀 VibeCodium / iTECify — Product Roadmap & Innovation Plan

> **Status:** iTEC 2026 Web Development Track
> **Team:** Brigada Inginerilor Amărâți (Brigade of Miserable Engineers)
> **Last Updated:** 2026-03-28

---

## 📊 Current State Assessment

### ✅ **Implemented Features**

| Feature | Status | Notes |
|---------|--------|-------|
| Real-time WebSocket Collaboration | ✅ Complete | Multi-cursor, code sync, user presence |
| Monaco Editor Integration | ✅ Complete | Syntax highlighting, multi-tab support |
| AI Agent Chat (SSE Streaming) | ✅ Complete | Token-by-token streaming with DeepSeek/LM Studio |
| Pending Edit Blocks | ✅ Complete | Accept/Reject workflow for AI suggestions |
| Docker Code Execution | ⚠️ Partial | Basic execution, needs per-project isolation |
| Xterm.js Terminal | ✅ Complete | Shared terminal with WebSocket |
| File Explorer | ✅ Complete | Flat file list with path-based indentation |
| Activity Feed | ✅ Complete | Live action history |
| Snapshot System | ✅ Complete | SQLite-based time-travel foundation |
| Auth0 Authentication | ✅ Complete | Secure user management |
| GitHub Integration | ✅ Complete | Import/push repositories |
| Reels Feature | ✅ Complete | TikTok-style coding showcase |

---

## 🔴 Critical Missing Features (iTEC Requirements)

### 1. **Per-Project Docker Sandboxing** 🐳
**Priority:** P0 (Must-Have for Demo)
**Estimated:** 6-8 hours

**Current Problem:**
- All executions share the same Docker container
- No isolation between projects
- Security risk: malicious code could affect other sessions

**Solution:**
```typescript
// server/src/execution/sandbox.ts
interface ProjectSandbox {
  projectId: string;
  containerId: string;
  image: string;
  createdAt: number;
  lastUsed: number;
}

class SandboxManager {
  private sandboxes = new Map<string, ProjectSandbox>();

  async createSandbox(projectId: string, language: string) {
    // 1. Build custom image on-the-fly based on project deps
    // 2. Set resource limits (memory, CPU, network)
    // 3. Scan for vulnerabilities before start
    // 4. Store sandbox metadata
  }

  async executeBinary(projectId: string, code: string) {
    // Route to project-specific container
    // Stream stdout/stderr via WebSocket
  }

  async destroySandbox(projectId: string) {
    // Cleanup when project closes
  }
}
```

**Acceptance Criteria:**
- [ ] Each project gets its own Docker container
- [ ] Container is created on first execution
- [ ] Container persists for session duration (with timeout cleanup)
- [ ] Resource limits: 512MB RAM, 0.5 CPU cores, no network access
- [ ] Container logs visible in terminal

---

### 2. **Live Vulnerability Scanning** 🛡️
**Priority:** P0 (Impressive Demo Feature)
**Estimated:** 4-6 hours

**Integration Points:**
- Scan before Docker container starts
- Show results in Activity Feed
- Block execution if critical vulnerabilities detected

**Recommended Tools:**
- [Trivy](https://github.com/aquasecurity/trivy) for container scanning
- [Semgrep](https://semgrep.dev) for code-level SAST
- [npm audit](https://docs.npmjs.com/cli/v10/commands/npm-audit) for JS dependencies

**UI Flow:**
```
[Execute Button] → [Scanning...] → [Results Modal] → [Proceed/Cancel]
```

**Implementation:**
```typescript
// server/src/security/scanner.ts
interface ScanResult {
  severity: 'low' | 'medium' | 'high' | 'critical';
  vulnerabilities: Vulnerability[];
  safe: boolean;
}

async function scanProject(projectId: string): Promise<ScanResult> {
  // 1. Export project files to temp dir
  // 2. Run Semgrep on source code
  // 3. Run Trivy on generated Dockerfile
  // 4. Aggregate results
  // 5. Return verdict
}
```

---

### 3. **Time-Travel Debugging UI** ⏰
**Priority:** P1 (Side-Quest Bonus)
**Estimated:** 8-10 hours

**Current State:**
Snapshots are saved to DB but no UI to replay them.

**Vision:**
- Horizontal timeline scrubber at bottom of editor
- Slider shows all file changes over time
- Click any point → see diff + ability to restore
- Visual "heatmap" showing areas of high activity

**Mockup:**
```
┌────────────────────────────────────────────────────────────┐
│  Editor Content                                            │
│                                                            │
└────────────────────────────────────────────────────────────┘
┌─ Time Travel ──────────────────────────────────────────────┐
│  [◀] ━━━━●━━━━━━━━━━●━━━━●━━━━━━━━━●━━━━━━━━━━━━━━━━━ [▶]  │
│       12:01   12:15    12:30       13:00                   │
│  📝 Added auth   🔧 Fixed bug   ✨ New feature             │
└────────────────────────────────────────────────────────────┘
```

**Technical:**
- Query `snapshots` table by timestamp
- Show diff between consecutive snapshots
- Use Monaco's `diffEditor` API
- Restore = create new snapshot + broadcast via WS

---

### 4. **Resource Limits & Smart Quotas** 📊
**Priority:** P1 (Side-Quest Bonus)
**Estimated:** 3-4 hours

**Features:**
- Per-container CPU/Memory limits (already partially implemented in `server/src/index.ts:117`)
- Execution timeout (3s currently, should be configurable)
- Network throttling
- Disk I/O limits

**Enhancements Needed:**
```typescript
// server/src/config/limits.ts
export const RESOURCE_LIMITS = {
  memory: {
    free: 256 * 1024 * 1024,      // 256MB
    premium: 512 * 1024 * 1024,    // 512MB
  },
  cpu: {
    free: 0.5,                      // 50% of one core
    premium: 1.0,                   // Full core
  },
  execution_timeout: {
    free: 3000,                     // 3s
    premium: 10000,                 // 10s
  },
  network: {
    free: 'none',                   // No network
    premium: 'limited',             // Limited network
  }
};
```

**UI Indicator:**
```
Terminal Footer:
[⚡ CPU: 12% | 💾 RAM: 45/256MB | ⏱️ Time: 1.2s / 3s]
```

---

## 🚀 Innovation Ideas (Beyond iTEC Requirements)

### 5. **Multi-Agent Collaboration Mode** 🤖🤖
**Priority:** P2 (Wow Factor)
**Estimated:** 12-16 hours

**Concept:**
Multiple AI agents work simultaneously on different parts of the codebase.

**Agents:**
1. **CodeArchitect** — Plans overall structure, suggests file organization
2. **BugHunter** — Continuously scans for bugs, proposes fixes
3. **StyleGuard** — Enforces code style, auto-formats
4. **SecurityBot** — Real-time security analysis
5. **DocWriter** — Auto-generates inline documentation

**UI Design:**
```
┌─ Active Agents ─────────────────────────┐
│ 🏗️ CodeArchitect  [IDLE]                │
│ 🐛 BugHunter      [ANALYZING server.ts] │
│ 🎨 StyleGuard     [IDLE]                 │
│ 🛡️ SecurityBot    [WATCHING]            │
│ 📝 DocWriter      [DOCUMENTING]         │
└──────────────────────────────────────────┘
```

Each agent:
- Has its own color/cursor in the editor
- Can propose changes independently
- User accepts/rejects per agent
- Agents can "talk" to each other via context sharing

**Implementation:**
```typescript
interface Agent {
  id: string;
  name: string;
  role: 'architect' | 'bugfixer' | 'styler' | 'security' | 'docs';
  color: string;
  active: boolean;
  currentTask?: string;
}

class AgentOrchestrator {
  private agents: Agent[] = [];

  async distributeTask(userMessage: string) {
    // Parse user intent
    // Assign subtasks to relevant agents
    // Coordinate responses
  }

  async resolveConflict(agent1: Agent, agent2: Agent) {
    // If two agents edit same lines, ask user to choose
  }
}
```

---

### 6. **AI-Powered Debugging Assistant** 🔍
**Priority:** P2
**Estimated:** 6-8 hours

**Features:**
- Automatically detects runtime errors from terminal output
- Parses stack traces
- Suggests fixes inline
- Can apply fixes with one click

**Example Flow:**
```
Terminal Output:
> TypeError: Cannot read property 'map' of undefined
>   at server.ts:42:15

[AI DEBUGGER POPUP]
┌─────────────────────────────────────────────────────┐
│ 🔍 Error Detected: TypeError at line 42            │
│                                                     │
│ Suggested Fix:                                      │
│   Add null check before mapping:                   │
│   const result = data?.map(...) ?? []              │
│                                                     │
│ [Apply Fix] [Explain More] [Dismiss]               │
└─────────────────────────────────────────────────────┘
```

---

### 7. **Collaborative Whiteboard Mode** 🎨
**Priority:** P3 (Nice-to-Have)
**Estimated:** 10-12 hours

**Concept:**
Side panel with a canvas where team members can sketch architecture diagrams, flowcharts, or explain concepts visually while coding.

**Tech Stack:**
- [Excalidraw](https://github.com/excalidraw/excalidraw) (open source, React-based)
- Real-time sync via same WebSocket infrastructure
- Export as PNG/SVG

**Use Cases:**
- Planning architecture before coding
- Explaining complex algorithms
- Pair programming with visual aids

---

### 8. **Voice Commands for Coding** 🎤
**Priority:** P3 (Experimental)
**Estimated:** 8-10 hours

**Features:**
- Press-to-talk button in editor
- Natural language → code generation
- "Create a function that validates email" → AI generates + proposes

**Libraries:**
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) for voice input
- Send transcription to LLM with file context

---

### 9. **Plugin Marketplace** 🛍️
**Priority:** P3 (Long-term)
**Estimated:** 20+ hours

**Vision:**
Users can install community-built plugins that extend the IDE.

**Example Plugins:**
- **Prettier Auto-Format** — Format on save
- **Copilot Pro** — GitHub Copilot integration
- **Vim Mode** — Vim keybindings for Monaco
- **Dark Mode++** — More theme options
- **AI Commit Messages** — Auto-generate commit messages
- **Code Coverage** — Show test coverage inline
- **Linter Integration** — ESLint/TSLint inline errors

**Architecture:**
```typescript
// shared/src/types/plugin.ts
interface Plugin {
  id: string;
  name: string;
  version: string;
  author: string;
  hooks: {
    onFileSave?: (file: ProjectFile) => Promise<void>;
    onEditorMount?: (editor: IStandaloneCodeEditor) => void;
    onCommandExecute?: (cmd: string) => Promise<string>;
  };
}
```

---

### 10. **Integrated Git Workflow** 🌳
**Priority:** P2
**Estimated:** 8-10 hours

**Current:**
GitHub integration exists but no UI for branches, commits, PR creation.

**Enhancements:**
- Visual branch selector in top bar
- Commit history in Activity Feed
- Create PR directly from IDE
- Inline merge conflict resolution

**UI Mockup:**
```
Top Bar:
[main ▼] [🔀 3 branches] [⬆️ Push] [⬇️ Pull]

Activity Feed:
📝 Committed: "Fix auth bug" (2m ago)
🔀 Merged PR #42 (10m ago)
🌿 Created branch: feature/new-ui (1h ago)
```

---

### 11. **AI Code Review Bot** 👁️
**Priority:** P2
**Estimated:** 6-8 hours

**Features:**
- Automatically reviews every file change
- Suggests improvements (performance, security, readability)
- Shows suggestions as comments in editor gutter

**Example:**
```typescript
// User writes:
function fetchData(url) {
  return fetch(url).then(r => r.json())
}

// AI Review Bot suggests:
// 💡 Consider adding error handling
// 💡 Add TypeScript types for better safety
// 💡 Use async/await for cleaner syntax
```

---

### 12. **AI-Generated Test Cases** 🧪
**Priority:** P2
**Estimated:** 6-8 hours

**Concept:**
Right-click a function → "Generate Tests" → AI creates unit tests in adjacent file.

**Example:**
```typescript
// Original function:
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// AI generates:
// validateEmail.test.ts
import { validateEmail } from './utils';

describe('validateEmail', () => {
  it('should accept valid email', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });

  it('should reject invalid email', () => {
    expect(validateEmail('invalid')).toBe(false);
  });

  it('should reject email without domain', () => {
    expect(validateEmail('user@')).toBe(false);
  });
});
```

---

### 13. **Performance Profiler** 📈
**Priority:** P3
**Estimated:** 10-12 hours

**Features:**
- Measure execution time per function
- Show flame graph of hot paths
- Suggest optimizations

**Integration:**
- Hook into Bun's built-in profiler
- Display results in side panel
- Highlight slow functions in editor

---

### 14. **Semantic Code Search** 🔎
**Priority:** P2
**Estimated:** 6-8 hours

**Concept:**
Search by *meaning*, not just text.

**Example:**
```
User searches: "function that handles user authentication"
→ Finds: authenticateUser(), loginHandler(), verifyToken()
```

**Tech:**
- Embed all code blocks using a code embedding model (e.g. CodeBERT)
- Store embeddings in vector DB (e.g. ChromaDB, Pinecone)
- Semantic search at query time

---

### 15. **Real-Time Linting & Formatting** ✨
**Priority:** P1
**Estimated:** 4-6 hours

**Features:**
- ESLint/TSLint integration
- Show errors/warnings inline
- Auto-fix on save
- Prettier formatting

**Monaco Integration:**
```typescript
// client/src/components/EditorArea.tsx
monaco.languages.registerCodeActionProvider('typescript', {
  provideCodeActions: (model, range, context) => {
    // Return quick fixes for linting errors
  }
});
```

---

### 16. **Deployment Pipeline Integration** 🚀
**Priority:** P2
**Estimated:** 8-10 hours

**Features:**
- One-click deploy to Vercel, Netlify, Cloudflare
- Show deployment status in UI
- Automatic previews for branches

**UI:**
```
Top Bar:
[🚀 Deploy to Production] [⚙️ Configure]

Deployment History:
✅ Deployed to production (5m ago)
🔄 Building preview for branch: feature/x (2m ago)
❌ Deploy failed: build error (10m ago)
```

---

### 17. **AI Pair Programming Mode** 🧑‍💻🤖
**Priority:** P2
**Estimated:** 10-12 hours

**Concept:**
AI actively follows what you're typing and suggests next lines in real-time (like Copilot but integrated into the chat).

**Features:**
- Ghost text suggestions
- Context-aware completions
- Learn from your coding style over time

---

### 18. **Code Snippet Library** 📚
**Priority:** P3
**Estimated:** 6-8 hours

**Features:**
- Save frequently used code snippets
- Tag, search, organize
- Share with team
- AI-generated snippet suggestions

---

### 19. **Integrated Documentation Browser** 📖
**Priority:** P3
**Estimated:** 6-8 hours

**Features:**
- Hover over function → show docs
- Search MDN, Stack Overflow, GitHub
- AI-powered Q&A about libraries

---

### 20. **Live Collaboration Analytics** 📊
**Priority:** P3
**Estimated:** 4-6 hours

**Features:**
- Who wrote what (blame view)
- Lines of code per contributor
- Activity heatmap
- Contribution graphs

---

## 🎉 Easter Eggs (5-15 Creative Ideas)

### Easter Egg 1: **Konami Code → Retro Mode** 🕹️
**Trigger:** ↑ ↑ ↓ ↓ ← → ← → B A Enter
**Effect:** Entire IDE transforms into 8-bit retro theme with pixelated fonts, CRT scanlines, and chiptune background music.

**Implementation:**
```typescript
// client/src/hooks/useKonamiCode.ts
const KONAMI_CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a', 'Enter'];

function useKonamiCode(callback: () => void) {
  // Track keypresses, trigger callback on match
}
```

---

### Easter Egg 2: **"Amarati" Mode (Misery Mode)** 😭
**Trigger:** Type `/amarati` in chat
**Effect:**
- Everything slows down by 50%
- Random "errors" appear that aren't real
- AI agent responses become pessimistic ("This will never work...")
- Terminal shows fake "out of memory" warnings
- A sad violin plays in the background

**Disable:** Type `/optimist`

---

### Easter Egg 3: **Disco Mode** 🪩
**Trigger:** Click the logo 10 times rapidly
**Effect:**
- Editor background cycles through rainbow colors
- Cursor leaves a trail of sparkles
- Typing makes sound effects
- Random confetti explosions

**Implementation:**
```typescript
// client/src/components/Workspace.tsx
const [clicks, setClicks] = useState(0);

useEffect(() => {
  if (clicks >= 10) {
    // Enable disco mode
    document.body.classList.add('disco-mode');
  }
}, [clicks]);
```

---

### Easter Egg 4: **AI Agent Personality Switch** 🎭
**Trigger:** Type `/vibe pirate` in chat
**Effect:** AI responds like a pirate ("Arrr, matey! Let me refactor this code for ye!")

**Other Personalities:**
- `/vibe shakespeare` → Shakespearean English
- `/vibe yoda` → Yoda speech patterns
- `/vibe gen-z` → Brainrot slang ("No cap, this code bussin fr fr")
- `/vibe corporate` → Business jargon ("Let's circle back on this function's synergy")

---

### Easter Egg 5: **"Code Faster" Button** ⚡
**Trigger:** Hidden button appears after 30 minutes of coding
**Effect:**
- Enables "hyperspeed mode"
- Animations speed up 3x
- AI responds instantly
- Fake "turbo boost" sound effect
- Actually does nothing but placebo effect is real

---

### Easter Egg 6: **The Matrix Mode** 💚
**Trigger:** Type `matrix` three times in terminal
**Effect:**
- Green monospace font
- Falling characters in background
- Terminal shows "Wake up, Neo..." before every command
- Exit by typing `red pill` or `blue pill`

---

### Easter Egg 7: **Random Compliments** 💝
**Trigger:** Random (1% chance on every file save)
**Effect:** Toast notification appears:
- "Wow, that was elegant!"
- "You're crushing it today! 🔥"
- "This code sparks joy ✨"
- "Legend status achieved!"

---

### Easter Egg 8: **Rubber Duck Debugging** 🦆
**Trigger:** Drag-drop a file onto the duck icon (hidden in corner)
**Effect:**
- Duck appears in corner
- Ask it questions → it "quacks" back with generic advice
- "Have you tried turning it off and on again?"
- "Did you check the semicolon?"

---

### Easter Egg 9: **Coffee Break Reminder** ☕
**Trigger:** After 2 hours of continuous coding
**Effect:**
- Screen dims slightly
- Message: "Time for a coffee break, Ingineri Amărâți need rest too!"
- 5-minute countdown
- If you keep coding, messages get more desperate
- "PLEASE. STEP. AWAY. FROM. THE. KEYBOARD."

---

### Easter Egg 10: **Brainrot Autocomplete** 🧠
**Trigger:** Type `brainrot` in chat
**Effect:** All variable suggestions become brainrot terms:
- `data` → `bussinData`
- `error` → `oofError`
- `user` → `sigmaUser`
- `function` → `slayFunction`
- `success` → `noCapSuccess`

Disable with `/serious`

---

### Easter Egg 11: **Midnight Theme** 🌙
**Trigger:** Coding between 12 AM - 3 AM
**Effect:**
- Ultra-dark theme auto-enables
- Low-contrast to reduce eye strain
- Subtle stars twinkle in background
- Gentle reminder: "Are you sure you should be up this late?"

---

### Easter Egg 12: **Code Poetry Generator** 📜
**Trigger:** Right-click any function → "Generate Poem"
**Effect:** AI writes a poem about your code:
```
A function so pure and bright,
It validates emails with might.
With regex it checks each char,
A guardian from near and far.
```

---

### Easter Egg 13: **AI Roast Mode** 🔥
**Trigger:** Type `/roast` in chat
**Effect:** AI critiques your code harshly (but constructively):
- "Are you seriously using var in 2026?"
- "This function has more parameters than a math textbook"
- "I've seen cleaner code in a minifier's output"

---

### Easter Egg 14: **Achievement System** 🏆
**Trigger:** Automatic on milestone
**Effect:** Unlock achievements:
- 🐛 "Bug Squasher" — Fixed 10 bugs
- 🚀 "Speedrunner" — Completed project in <1 hour
- 🤝 "Team Player" — Collaborated with 5+ people
- 😭 "Suffering Engineer" — Coded for 6+ hours straight
- ☕ "Caffeine Dependent" — Late night coding (12AM+)

---

### Easter Egg 15: **Hidden Dev Tools** 🛠️
**Trigger:** Press `Ctrl+Shift+D` three times
**Effect:** Secret dev panel opens:
- Force trigger any Easter egg
- Modify AI personality
- Speed up/slow down animations
- Enable "god mode" (no errors)
- Show hidden stats (keystrokes, time coded, coffee breaks taken)

---

## 🔌 Suggested Plugin Ideas

### Plugin 1: **Vim Mode** ⌨️
Full Vim keybindings for Monaco editor.

### Plugin 2: **Code Metrics Dashboard** 📊
Real-time metrics: cyclomatic complexity, lines of code, technical debt.

### Plugin 3: **Pomodoro Timer** 🍅
Built-in timer with coding session tracking.

### Plugin 4: **Music Player** 🎵
Spotify integration, lo-fi beats for coding.

### Plugin 5: **Focus Mode** 🧘
Hides all panels except editor, zen coding experience.

### Plugin 6: **GitHub Copilot Integration** 🤖
Direct Copilot API integration.

### Plugin 7: **Code Screenshots** 📸
Generate beautiful code screenshots (like Carbon.now.sh).

### Plugin 8: **Live Share** 🔗
Generate shareable live-coding links (read-only for viewers).

### Plugin 9: **Daily Coding Stats** 📈
Track productivity, lines written, time spent per project.

### Plugin 10: **AI Art Generator** 🎨
Generate images from code comments (for fun).

---

## 📅 Suggested Implementation Timeline

### **Week 1: Critical iTEC Features**
- ✅ Per-Project Docker Sandboxing (Day 1-2)
- ✅ Live Vulnerability Scanning (Day 3-4)
- ✅ Resource Limits UI (Day 5)

### **Week 2: Side Quests + Polish**
- ✅ Time-Travel Debugging UI (Day 1-3)
- ✅ Multi-Agent Mode (Day 4-7)

### **Week 3: Innovation & Easter Eggs**
- ✅ AI Debugging Assistant (Day 1-2)
- ✅ Implement Easter Eggs 1-8 (Day 3-5)
- ✅ Plugin System Foundation (Day 6-7)

### **Week 4: Final Polish**
- ✅ Bug fixes
- ✅ Performance optimization
- ✅ Demo preparation
- ✅ Documentation

---

## 🎯 Success Metrics

**Demo Day Goals:**
- [ ] Execute code in isolated Docker containers
- [ ] Show live vulnerability scan
- [ ] Demonstrate multi-cursor collaboration
- [ ] Accept/reject AI suggestions smoothly
- [ ] Time-travel through code history
- [ ] Trigger at least 3 Easter eggs during demo
- [ ] Show terminal collaboration
- [ ] Deploy to Cloudflare/Vercel live

**Bonus Points:**
- [ ] Multi-agent collaboration demo
- [ ] Voice command demo
- [ ] AI code review in action
- [ ] Plugin marketplace preview

---

## 🧑‍💼 Manager's Notes

**Team Strengths:**
- Strong full-stack foundation (Bun + Hono + React)
- Real-time collab already working
- AI integration is solid

**Areas to Improve:**
- Security features (vulnerability scanning is critical)
- Docker isolation (current single-container setup is risky)
- UI polish (Easter eggs will help here)

**Competitive Advantage:**
- Reels feature (unique for coding platforms)
- Multi-agent concept (no one else has this)
- Brainrot Easter eggs (memorable for judges)

---

## 🚨 Risk Mitigation

**Risk 1:** Docker sandboxing too complex
**Mitigation:** Use pre-built images, don't build on-the-fly initially

**Risk 2:** Vulnerability scanning slows demo
**Mitigation:** Cache scan results, use async scanning

**Risk 3:** Easter eggs break production
**Mitigation:** Feature flag all Easter eggs, disable in production

---

## 📝 Final Thoughts

This platform has serious potential beyond iTEC. The combination of real-time collab, AI agents, and sandboxed execution is a unique value proposition. Focus on:

1. **Security** — iTEC will care about this
2. **Collaboration** — Make it feel magical
3. **Fun** — Easter eggs will make you memorable

Good luck, Brigada Inginerilor Amărâți! You got this. 💪

---

**Document Version:** 1.0
**Authors:** Claude Code + The Miserable Engineers
**License:** MIT

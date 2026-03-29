# iTECify — 6-Minute Pitch Strategy

---

## 0:00–0:30 — Hook (use their own words)

> "The problem statement opens with a scene: 3am, Ana writes Python, Radu tweaks React, an AI generates backend routes — all in the same file, no Git conflicts. You wrote that scenario. We built it."

Open the app live. Don't show slides. The interface is the pitch.

---

## 0:30–1:00 — Frame the gap

One sentence per problem they named in the PDF:

- Copilot = autocomplete on steroids. Not a real collaborator.
- You can't tell human code from AI hallucination — debugging is a nightmare.
- Sandboxing platforms fail at complex backends.
- Deployment breaks your flow entirely.

> "We solved all four."

---

## 1:00–2:30 — Demo Block 1: Collaboration (their #1 requirement)

**Show:** Two browser windows side by side (same session).

1. Type in one window → Yjs CRDT syncs cursor position and edits to the other in real time. Call out: *"No Git push, no conflict."*
2. Open VibeChat, send a prompt to the AI agent. Watch it stream token by token.
3. When the agent calls `write_file`, the Monaco editor shows the **accept/reject block** — green diff inline, two buttons. Click Accept.
4. Point out: *"Human code looks normal. AI code is a Notion block. One click to accept or reject. You asked for exactly this."*

**Covers:** Multi-cursor, CRDT sync, AI block-editor, accept/reject.

---

## 2:30–3:30 — Demo Block 2: Sandboxing + Security (their #2 requirement)

**Show:** Pick a Python or Rust file. Click Run.

1. The terminal shows live stdout/stderr as the Docker container executes. Say: *"Isolated Docker container, spun up on the fly, for any language."*
2. Open the **Security Scan** — trigger it on a file with a hardcoded secret or SQL injection pattern. Show the vulnerabilities flagged before execution.
3. Optional: mention CPU/memory limits enforced on the container.

**Covers:** Docker sandboxing, live output, pre-execution vulnerability scan, resource limits.

---

## 3:30–4:15 — Demo Block 3: Shared Terminal (Side-quest #1)

**Show:** Open a terminal in both windows.

1. Type a command in one window — both see the output simultaneously.
2. Say: *"Not just the editor. The terminal is collaborative too."*

Quick beat — 45 seconds max. It's a side-quest, treat it like one.

---

## 4:15–5:00 — Demo Block 4: Time-Travel Debugging (Side-quest #2)

**Show:** The timeline bar at the bottom of the workspace.

1. Click back through 3-4 checkpoints. Show the diff preview for each.
2. Restore a previous state. Say: *"Every AI action creates a checkpoint. Rewind the session like a replay."*

This maps directly to what they called "Time-Travel Debugging." Use that exact phrase.

---

## 5:00–5:30 — Easter Eggs (rapid fire, keep it fun)

Go fast, keep energy high:

1. **Rubber Duck** — *"Stuck? Talk to the duck."*
2. **Matrix Rain** — trigger it. *"Because why not."*
3. **Pomodoro Timer** — *"We care about burnout."*
4. **Subway Surfer 3D / Spotify** — *"3am hackathon energy, built in."*
5. **CoderMatch** — *"Tinder for finding a pair programmer."*
6. **Code Roast** — *"Ask the AI to roast your code. It will."*

One liner per egg, show don't explain.

---

## 5:30–6:00 — Close

> "You asked for Figma, but for code. Multi-human, multi-AI, one window, no conflicts, runs anything, scans for vulnerabilities before it executes, and deploys when you're ready. That's iTECify."

If there's a deploy feature ready — deploy something live right now as the final beat. Nothing closes a demo like shipping in front of the judges.

---

## Timing Summary

| Segment | Time | Criteria covered |
|---|---|---|
| Hook | 0:30 | Engagement |
| Problem framing | 0:30 | Context |
| Collaboration demo | 1:30 | Required: CRDT, AI blocks |
| Sandboxing + Security | 1:00 | Required: Docker, scan |
| Shared Terminal | 0:45 | Side-quest |
| Timeline / Time-travel | 0:45 | Side-quest |
| Easter eggs | 0:30 | Bonus |
| Close | 0:30 | Impact |

---

**One rule:** never leave the app. Every transition should be a click inside the UI, not a slide. The interface is dense and impressive — let it do the talking.

# VibeCodium Design System

```yaml
version: 1.0
name: vibecodium-design
description: >
  A dark-first AI coding platform whose UI reads like a developer IDE — not a marketing site.
  Near-void canvas (#09090b) with a four-step surface lift ladder. Single chromatic accent is
  Purple (#A855F7), used only on primary CTAs, focus rings, active states, and the wordmark.
  Emerald (#10B981) is the semantic-success / AI-done color only. Blue (#3B82F6) is information only.
  Layout follows Cursor's editorial rhythm — generous spacing, hairline-only depth, negative
  letter-spacing on display text. No glass blur on structural chrome; glass only on floating overlays.
  JetBrains Mono on every code surface. Inter for UI chrome.

colors:
  # Brand & Accent — used scarcely
  primary: "#A855F7"           # Purple — CTAs, focus rings, active tabs, brand mark
  primary-hover: "#9333EA"     # Press/hover state
  primary-dim: "#A855F71A"     # 10% purple — subtle active backgrounds
  primary-border: "#A855F740"  # 25% purple — active border

  # Semantic — never decorative
  semantic-success: "#10B981"  # AI done, deploy OK, tests pass
  semantic-info: "#3B82F6"     # Information, links
  semantic-warning: "#F59E0B"  # Warnings
  semantic-error: "#EF4444"    # Errors, destructive

  # Surface ladder — four steps up from void canvas
  canvas: "#09090b"            # Page floor, sidebar, panel backgrounds
  surface-1: "#111113"         # Slightly lifted panels
  surface-2: "#18181b"         # Cards, editor tab bar
  surface-3: "#1e1e24"         # Hover states, selected rows
  surface-4: "#27272a"         # Tooltips, dropdowns

  # Hairlines
  hairline: "#27272a"          # 1px standard divider
  hairline-soft: "#1e1e24"     # Subtle divider within surface
  hairline-strong: "#3f3f46"   # Panel separator, strong border

  # Text
  ink: "#fafafa"               # Primary text — near-white
  body: "#a1a1aa"              # Default running text
  muted: "#71717a"             # Placeholders, meta, secondary labels
  muted-soft: "#52525b"        # Disabled text

  # Timeline (AI agent action stages — in-product timeline only, never decorative)
  timeline-thinking: "#c084fc" # Soft purple — Thinking
  timeline-reading: "#60a5fa"  # Pastel blue — Reading / File scan
  timeline-editing: "#34d399"  # Mint green — Editing / Writing
  timeline-running: "#fbbf24"  # Amber — Running / Executing
  timeline-done: "#a3e635"     # Lime — Done / Success

  # Special
  on-primary: "#ffffff"

typography:
  display-xl:
    fontFamily: "'Inter', system-ui, sans-serif"
    fontSize: 48px
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: -1.44px
  display-lg:
    fontFamily: "'Inter', system-ui, sans-serif"
    fontSize: 32px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -0.96px
  display-md:
    fontFamily: "'Inter', system-ui, sans-serif"
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.48px
  display-sm:
    fontFamily: "'Inter', system-ui, sans-serif"
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: -0.18px
  title:
    fontFamily: "'Inter', system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0
  body-md:
    fontFamily: "'Inter', system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  body-sm:
    fontFamily: "'Inter', system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  caption:
    fontFamily: "'Inter', system-ui, sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0
  caption-uppercase:
    fontFamily: "'Inter', system-ui, sans-serif"
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0.66px
    textTransform: uppercase
  code:
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0
  code-sm:
    fontFamily: "'JetBrains Mono', monospace"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  button:
    fontFamily: "'Inter', system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.0
    letterSpacing: 0

rounded:
  none: 0px
  xs: 3px
  sm: 5px
  md: 7px
  lg: 10px
  xl: 14px
  pill: 9999px

spacing:
  xxs: 2px
  xs: 4px
  sm: 8px
  base: 12px
  md: 16px
  lg: 20px
  xl: 24px
  xxl: 32px
  section: 48px

components:
  # ── Top-level shell ────────────────────────────────────────────────────────
  app-shell:
    description: >
      Full-viewport IDE shell. Three-column: left sidebar (file explorer + nav, 240px),
      center editor pane (flex 1), right agent panel (340px, collapsible).
      No outer padding. All dividers are 1px hairlines.
    backgroundColor: "{colors.canvas}"

  # ── Navigation ─────────────────────────────────────────────────────────────
  top-nav:
    description: >
      Global header. Height 48px. Left: wordmark + breadcrumb. Right: user avatar + icon actions.
      No shadow — 1px bottom hairline only.
    backgroundColor: "{colors.surface-1}"
    borderBottom: "1px solid {colors.hairline}"
    height: 48px

  sidebar:
    description: >
      Left panel. Width 240px, full height. Project tree + global nav icons.
      No shadow. Right 1px hairline separator.
    backgroundColor: "{colors.canvas}"
    borderRight: "1px solid {colors.hairline}"
    width: 240px

  sidebar-item:
    description: File tree row or nav item.
    textColor: "{colors.body}"
    typography: "{typography.body-sm}"
    padding: 4px 12px
    rounded: "{rounded.sm}"
  sidebar-item-active:
    backgroundColor: "{colors.primary-dim}"
    textColor: "{colors.ink}"
    borderLeft: "2px solid {colors.primary}"

  # ── Editor ─────────────────────────────────────────────────────────────────
  editor-tab-bar:
    description: >
      Tab strip above Monaco. Height 36px. Tabs are compact — filename only with
      dot indicator for unsaved. Active tab bottom border in primary color.
    backgroundColor: "{colors.surface-2}"
    borderBottom: "1px solid {colors.hairline}"
    height: 36px

  editor-tab:
    typography: "{typography.body-sm}"
    textColor: "{colors.muted}"
    padding: 0 12px
    height: 36px
  editor-tab-active:
    textColor: "{colors.ink}"
    borderBottom: "2px solid {colors.primary}"
    backgroundColor: "{colors.canvas}"

  editor-pane:
    description: Monaco editor surface.
    backgroundColor: "{colors.canvas}"
    typography: "{typography.code}"

  status-bar:
    description: >
      Bottom strip. Height 24px. Shows: branch name, cursor position, language, AI status.
      Compact caption-uppercase labels.
    backgroundColor: "{colors.surface-2}"
    borderTop: "1px solid {colors.hairline}"
    height: 24px
    typography: "{typography.caption-uppercase}"
    textColor: "{colors.muted}"

  # ── Agent / AI Panel ───────────────────────────────────────────────────────
  agent-panel:
    description: >
      Right collapsible panel. Width 340px. Houses AI chat + timeline.
      Left 1px hairline separator. No shadow.
    backgroundColor: "{colors.surface-1}"
    borderLeft: "1px solid {colors.hairline}"
    width: 340px

  agent-message-user:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
    padding: 10px 14px

  agent-message-ai:
    backgroundColor: "transparent"
    textColor: "{colors.body}"
    typography: "{typography.body-sm}"
    padding: 10px 14px

  agent-input:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: 10px 14px
    border: "1px solid {colors.hairline}"
    focus-border: "1px solid {colors.primary-border}"

  # ── Timeline (AI action stages) ────────────────────────────────────────────
  timeline-pill-thinking:
    backgroundColor: "{colors.timeline-thinking}"
    textColor: "{colors.canvas}"
    typography: "{typography.caption-uppercase}"
    rounded: "{rounded.pill}"
    padding: 3px 8px
  timeline-pill-reading:
    backgroundColor: "{colors.timeline-reading}"
    textColor: "{colors.canvas}"
    typography: "{typography.caption-uppercase}"
    rounded: "{rounded.pill}"
    padding: 3px 8px
  timeline-pill-editing:
    backgroundColor: "{colors.timeline-editing}"
    textColor: "{colors.canvas}"
    typography: "{typography.caption-uppercase}"
    rounded: "{rounded.pill}"
    padding: 3px 8px
  timeline-pill-running:
    backgroundColor: "{colors.timeline-running}"
    textColor: "{colors.canvas}"
    typography: "{typography.caption-uppercase}"
    rounded: "{rounded.pill}"
    padding: 3px 8px
  timeline-pill-done:
    backgroundColor: "{colors.timeline-done}"
    textColor: "{colors.canvas}"
    typography: "{typography.caption-uppercase}"
    rounded: "{rounded.pill}"
    padding: 3px 8px

  # ── Dashboard ──────────────────────────────────────────────────────────────
  dashboard-header:
    description: >
      Top of dashboard view. Display headline + subtitle + primary CTA row.
      48px bottom padding. No decorative backgrounds.
    typography: "{typography.display-lg}"
    textColor: "{colors.ink}"

  project-card:
    description: >
      Project/repo card. No backdrop blur. 1px hairline border only.
      Hover: border elevates to hairline-strong. No transform or glow.
    backgroundColor: "{colors.surface-1}"
    borderColor: "{colors.hairline}"
    border: "1px solid"
    rounded: "{rounded.lg}"
    padding: 16px
    typography: "{typography.title}"
  project-card-hover:
    borderColor: "{colors.hairline-strong}"
    backgroundColor: "{colors.surface-2}"

  section-label:
    typography: "{typography.caption-uppercase}"
    textColor: "{colors.muted}"
    marginBottom: 12px

  # ── Buttons ────────────────────────────────────────────────────────────────
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 8px 16px
    height: 36px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"

  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.body}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 7px 15px
    height: 36px
    border: "1px solid {colors.hairline-strong}"
  button-secondary-hover:
    borderColor: "{colors.muted}"
    textColor: "{colors.ink}"

  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 6px 10px
  button-ghost-hover:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.body}"

  button-icon:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.sm}"
    size: 28px
  button-icon-hover:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.ink}"

  # ── Misc ───────────────────────────────────────────────────────────────────
  badge:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.body}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 2px 8px
  badge-primary:
    backgroundColor: "{colors.primary-dim}"
    textColor: "{colors.primary}"

  tooltip:
    backgroundColor: "{colors.surface-4}"
    textColor: "{colors.ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: 5px 10px
    border: "1px solid {colors.hairline-strong}"

  modal-overlay:
    description: >
      Full-screen overlay. Semi-transparent canvas — no full opacity.
      Modal card uses surface-2 with hairline border. NO backdrop-blur on the card itself.
    backgroundColor: "rgba(9, 9, 11, 0.85)"
  modal-card:
    backgroundColor: "{colors.surface-2}"
    border: "1px solid {colors.hairline-strong}"
    rounded: "{rounded.xl}"
    padding: 24px

  code-block:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.body}"
    typography: "{typography.code}"
    rounded: "{rounded.md}"
    padding: 16px
    border: "1px solid {colors.hairline}"
```

---

## Philosophy

VibeCodium's UI is an **IDE-first, not a marketing site**. Every layout decision should feel like a professional coding tool, not a landing page.

### Core rules

1. **Purple is scarce.** `{colors.primary}` only on primary CTAs, the active tab underline, focus rings, and the wordmark. Never as a decorative background or glow.
2. **No blur on structural chrome.** `backdrop-filter: blur` is reserved for floating overlays only (modals, command palette). The sidebar, editor, panels — all solid surfaces.
3. **Hairline-only depth.** Cards use 1px `{colors.hairline}` borders. Surface steps (`canvas → surface-1 → surface-2`) create hierarchy without shadows or glows.
4. **Timeline pills are scoped.** The five pastel timeline pills (thinking / reading / editing / running / done) appear only inside the agent timeline. They are not generic status badges.
5. **JetBrains Mono on every code surface.** Editor, inline code, file names in tabs, path breadcrumbs.
6. **Negative letter-spacing on display text.** Large headings (-1.4px+) read professional and sharp.
7. **48px section rhythm** (slightly tighter than Cursor's 80px — we're inside an app, not a marketing page).

### Do
- Use `{colors.surface-1/2/3}` to create lift. No shadows.
- Keep hover states subtle — a hairline color change or background step-up is enough.
- Use `{typography.caption-uppercase}` for section labels, tab labels, status bar text.
- Lean on spacing tokens. Internal card padding is 16px. Panel padding is 12px.

### Don't
- Don't add `box-shadow` glow effects to any card or panel.
- Don't use the purple accent decoratively (backgrounds, borders on non-interactive elements).
- Don't animate anything that isn't user-triggered (no breathing glows, no floating cards).
- Don't use `glass-card` on structural chrome. Glass only on command palette / modal overlay.
- Don't add backdrop-blur to the sidebar or agent panel.

---

## Layout: Editor Window

```
┌──────────────────────────────────────────────────────────────────────────┐
│ top-nav (48px)                                                           │
├────────────────┬─────────────────────────────────────┬───────────────────┤
│                │ editor-tab-bar (36px)               │                   │
│  sidebar       ├─────────────────────────────────────┤  agent-panel      │
│  (240px)       │                                     │  (340px)          │
│                │  editor-pane (Monaco)               │                   │
│  file tree     │                                     │  chat + timeline  │
│  nav icons     │                                     │                   │
│                ├─────────────────────────────────────┤                   │
│                │ status-bar (24px)                   │                   │
└────────────────┴─────────────────────────────────────┴───────────────────┘
```

## Layout: Dashboard Window

```
┌──────────────────────────────────────────────────────────────────────────┐
│ top-nav (48px)                                                           │
├────────────────────────────────────────────────────────────────────────  │
│  dashboard-header                                                        │
│  ↳ display-lg headline + subtitle + button-primary CTA row              │
│                                                                          │
│  section-label: "YOUR PROJECTS"                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
│  │project-  │ │project-  │ │project-  │ │ + New    │                   │
│  │card      │ │card      │ │card      │ │ project  │                   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                   │
│                                                                          │
│  section-label: "DEPLOYED APPS"                                         │
│  [ deployed app list ]                                                   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Agent Prompt Guide

When using this design system with an AI coding agent, use these ready prompts:

**Quick color reference:**
- Background: `bg-[#09090b]`
- Cards: `bg-[#111113]` or `bg-[#18181b]`
- Hover: `bg-[#1e1e24]`
- Border: `border-[#27272a]`
- Strong border: `border-[#3f3f46]`
- Primary: `bg-purple-500` / `text-purple-400` / `border-purple-500/40`
- Body text: `text-zinc-400`
- Heading text: `text-zinc-50`
- Muted text: `text-zinc-500`
- Success: `text-emerald-400`
- JetBrains Mono: `font-mono`

**Prompts:**
- "Use hairline borders only — no shadows, no glow effects on cards"
- "Purple accent only on primary CTAs, active states, and focus rings"
- "Apply negative letter-spacing (-0.04em) to all display headings"
- "Surface lift via background steps: canvas → surface-1 → surface-2, no elevation shadows"
- "Timeline pills (thinking/reading/editing/running/done) only inside the agent timeline bar"
- "No backdrop-blur on sidebar, panels, or cards — only on modal overlays"

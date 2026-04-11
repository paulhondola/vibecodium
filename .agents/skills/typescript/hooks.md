---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
---
# TypeScript/JavaScript Hooks

> This file extends [common/hooks.md](../common/hooks.md) with TypeScript/JavaScript specific content.
> **Project note**: This project uses **Bun** and **Biome**. Use `bun run` commands — not `pnpm`, `tsc` directly, or `prettier`.

## PostToolUse Hooks

Configure in `~/.claude/settings.json` (or equivalent for your agent):

- **Format**: `bun run format` — Biome formats all TS/JS files after edit
- **Lint**: `bun run lint` — Biome lint after edit
- **Type check**: `bun run type-check` — full monorepo type check after editing `.ts`/`.tsx` files
- **console.log warning**: Warn about `console.log` in edited files

## Stop Hooks

- **console.log audit**: Check all modified files for `console.log` before session ends
- **Build verification**: `bun run build` — ensure nothing is broken at session end

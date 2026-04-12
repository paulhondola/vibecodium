> This file extends [common/hooks.md](../common/hooks.md) with web-specific hook recommendations.
> **Project note**: This project uses **Bun** and **Biome**. Use `bun run` commands below — not `pnpm`, `eslint`, or `prettier`.

# Web Hooks

## Recommended PostToolUse Hooks

Prefer project-local tooling. Do not wire hooks to remote one-off package execution.

### Format on Save

Use the project's Biome formatter after edits:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "command": "bun run format",
        "description": "Format edited files with Biome"
      }
    ]
  }
}
```

### Lint Check

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "command": "bun run lint",
        "description": "Run Biome lint on edited files"
      }
    ]
  }
}
```

### Type Check

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "command": "bun run type-check",
        "description": "TypeScript check after edits"
      }
    ]
  }
}
```

## PreToolUse Hooks

### Guard File Size

Block oversized writes from tool input content, not from a file that may not exist yet:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write",
        "command": "node -e \"let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const i=JSON.parse(d);const c=i.tool_input?.content||'';const lines=c.split('\\n').length;if(lines>800){console.error('[Hook] BLOCKED: File exceeds 800 lines ('+lines+' lines)');console.error('[Hook] Split into smaller modules');process.exit(2)}console.log(d)})\"",
        "description": "Block writes that exceed 800 lines"
      }
    ]
  }
}
```

## Stop Hooks

### Final Build Verification

```json
{
  "hooks": {
    "Stop": [
      {
        "command": "bun run build",
        "description": "Verify the production build at session end"
      }
    ]
  }
}
```

## Ordering

Recommended order:
1. format (`bun run format`)
2. lint (`bun run lint`)
3. type check (`bun run type-check`)
4. build verification (`bun run build`)

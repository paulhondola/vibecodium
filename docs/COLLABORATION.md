# Real-Time Collaboration — Architecture & Troubleshooting

## Overview

VibeCodium's collaboration layer uses WebSockets for transport and **Yjs CRDTs** for conflict-free merge of concurrent edits. Every client in a project room sends minimal Yjs deltas; the server merges them into a per-file Y.Doc and broadcasts to other clients. File content is also cached server-side in RAM and flushed to Supabase when the last client leaves.

---

## Architecture

```
Client A                  Server (Bun + Hono)              Client B
───────                   ──────────────────               ────────
user types
  └─ onDidChangeContent
       └─ Y.Doc transact ("local")
            └─ doc.on("update") observer
                 └─ WS send {type:"yjs_update", update:base64}
                                   │
                            applyUpdate to roomYDocs[proj][file]
                            update roomFileStates[proj][file] = merged text
                            ws.publish(projectId, {type:"yjs_update", ...})
                                                          │
                                              applyUpdate to local Y.Doc ("remote")
                                              model.setValue(merged)
```

### Server-side state

| Map | Key | Value | Lifetime |
|-----|-----|-------|----------|
| `roomFileStates` | `projectId → filePath` | file content string | cleared when last client leaves, flushed to Supabase |
| `roomYDocs` | `projectId → filePath` | `Y.Doc` | cleared when last client leaves |
| `activeClientSockets` | `clientId` | WebSocket | cleared on close |
| `clientLastPong` | `clientId` | timestamp | cleared on close |

### Client-side state (`EditorArea.tsx`)

| Ref | Purpose |
|-----|---------|
| `ydocsRef` | `Map<filePath, Y.Doc>` — one doc per open file |
| `isRemoteUpdate` | `boolean` — blocks `onDidChangeContent` → Y.Doc during programmatic model updates |
| `sendRef` | stable ref to `send()` from `SocketProvider` |

---

## WebSocket Message Types

### Client → Server

| Type | Fields | Description |
|------|--------|-------------|
| `yjs_update` | `filePath`, `update` (base64) | Yjs delta from a local edit |
| `sync_request` | — | Sent on reconnect; asks server for full state |
| `code_change` | `filePath`, `content` | Legacy full-content update (fallback when Y.Doc not active) |
| `agent_accepted` | `filePath`, `content`, `updateId` | Agent diff acceptance; server broadcasts to room |
| `cursor_move` | `filePath`, `position` | Cursor position for remote cursors |
| `file_focus` | `filePath` | Notifies room of active file |
| `pong` | — | Heartbeat response |

### Server → Client

| Type | Fields | Description |
|------|--------|-------------|
| `connected` | `color`, `users`, `isHost` | Sent on initial connection |
| `room_state` | `files: Record<path, content>` | Full file content map sent to reconnecting clients |
| `yjs_update` | `filePath`, `update` (base64), `clientId` | Delta relayed to all other clients in room |
| `yjs_sync` | `filePath`, `update` (base64) | Full Y.Doc state sent in response to `sync_request` |
| `code_update` | `filePath`, `content`, `clientId` | Legacy full-content update from `code_change` |
| `agent_accepted` | `filePath`, `content`, `appliedBy` | Another client accepted an agent diff |
| `cursor_update` | `filePath`, `clientId`, `position`, `color`, `userName` | Remote cursor position |
| `ping` | — | Heartbeat; client must respond with `pong` |
| `user_joined` / `user_left` | `user` / `clientId` | Room membership changes |

---

## Reconnection Flow

1. Client loses connection → `socket.onclose` fires
2. `SocketProvider` schedules reconnect with exponential backoff: `[1s, 2s, 4s, 8s, 16s, 30s]` ±20% jitter
3. On `socket.onopen`:
   - Pending message queue (cap 50) is flushed in FIFO order
   - `sync_request` is sent
4. Server responds with:
   - `room_state` — full content map for all cached files
   - `yjs_sync` — full Y.Doc state vector for each file
5. Client re-initialises any open Y.Docs from `yjs_sync`; Monaco is updated from `room_state`

---

## Yjs Origins

The Y.Doc `origin` field controls whether the `update` observer fires a `yjs_update` to the server:

| Origin | Sent to server? | Used for |
|--------|----------------|----------|
| `"local"` | **Yes** | Normal user keystrokes |
| `"remote"` | No | Applying deltas received from server |
| `"init"` | No | Initial Y.Doc population on file open |
| `"agent_accepted"` | No | Re-syncing Y.Doc after an agent diff accept (server already knows) |

---

## Agent Diff Acceptance Flow

When a client accepts an agent suggestion:

1. `handleAccept` in `EditorArea` calls `model.setValue(newContent)` with `isRemoteUpdate = true`
2. Y.Doc is re-synced with `"agent_accepted"` origin (no `yjs_update` sent — server learns via `agent_accepted` message)
3. `agent_accepted` WS message is sent to server → broadcast to room
4. Other clients receive `agent_accepted` in `Workspace.tsx` → `setRemoteCodeUpdate({..., clientId: "__agent_accepted__"})`
5. `EditorArea` guard passes `"__agent_accepted__"` through, re-syncs their Y.Doc with the new content

---

## Time-Travel Restore Flow

1. User scrubs timeline → `model.setValue(snappedContent)` with `isRemoteUpdate = true`
2. User clicks **Restore** → `handleRestoreEvent` fires
3. Y.Doc is updated with `"local"` origin → observer fires → `yjs_update` broadcast to all peers
4. Other clients apply the delta to their Y.Docs; Monaco updates
5. Falls back to `code_change` if Y.Doc not active for that file

---

## Heartbeat

Server pings all clients every **25 seconds**. Any client that hasn't sent a `pong` within **55 seconds** (2 missed pings) is terminated. This prevents ghost connections from blocking room cleanup.

Log line when a zombie is terminated:
```
[WS Heartbeat] Terminating zombie client: <clientId>
```

---

## Diagnosing Sync Failures

### Symptoms and causes

**Symptom: Client joins but sees stale content**

Check server logs for:
```
[WS] Sent room_state (N file(s)) to reconnecting client <id>
```
If absent, the room cache was empty — the client connected after the last client left and the cache was cleared. Content comes from Supabase on the next file load.

---

**Symptom: Edits from one client not appearing on another**

1. Open browser DevTools → Network → WS tab. Confirm `yjs_update` messages are flowing.
2. If messages flow but editor doesn't update: check for `[YJS Remote]` console logs. If absent, the receiving client has no Y.Doc for that file (file not open). Content will sync via `room_state` on next reconnect.
3. If no messages flow: check that `SocketProvider` is connected (`isConnected` state in Workspace).

---

**Symptom: Garbled/corrupted content after rapid edits**

Likely cause: Y.Doc state diverged. Force a sync:
1. Close and reopen the file tab — triggers `sync_request` on reconnect
2. Or refresh the page — full reconnect with `room_state`

---

**Symptom: Agent acceptance not visible to other clients**

Verify `agent_accepted` message is broadcast:
```
Server log: [WS] agent_accepted for <filePath> by <clientId>
```
On the receiving client, check that `remoteCodeUpdate.clientId` is `"__agent_accepted__"` (not `"agent"` or `undefined`). If it's not, the guard in `EditorArea.tsx` will silently drop the update.

---

**Symptom: Content lost on server restart**

Expected — `roomFileStates` is in-memory only. Content is flushed to Supabase when the **last** client leaves cleanly. If the server crashes with clients connected, the last in-memory state is lost. Workaround: explicitly close all file tabs before restarting the server.

---

## Known Limitations

- **Server restart loses in-flight edits**: There is no WAL or write-ahead log. Periodic auto-save (e.g., every 30s flush to Supabase regardless of client count) is not yet implemented.
- **Y.Doc size grows unboundedly**: Yjs stores full operation history. For very large files or long sessions, the Y.Doc binary snapshot can become large. No compaction (garbage collection) is currently applied.
- **Single server, no horizontal scaling**: `roomFileStates` and `roomYDocs` are in-process Maps. Multiple server instances would not share state.

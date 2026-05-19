import { describe, test, expect, beforeEach } from "bun:test";

// ── Room file state management ────────────────────────────────────────────────

describe("roomFileStates cache", () => {
    let roomFileStates: Map<string, Map<string, string>>;

    beforeEach(() => {
        roomFileStates = new Map();
    });

    function upsertFile(projectId: string, filePath: string, content: string) {
        if (!roomFileStates.has(projectId)) roomFileStates.set(projectId, new Map());
        roomFileStates.get(projectId)!.set(filePath, content);
    }

    test("stores and retrieves file content per room", () => {
        upsertFile("proj-1", "src/index.ts", "console.log('hello')");
        const room = roomFileStates.get("proj-1");
        expect(room?.get("src/index.ts")).toBe("console.log('hello')");
    });

    test("overwrites with newer content", () => {
        upsertFile("proj-1", "src/index.ts", "v1");
        upsertFile("proj-1", "src/index.ts", "v2");
        expect(roomFileStates.get("proj-1")?.get("src/index.ts")).toBe("v2");
    });

    test("isolates rooms", () => {
        upsertFile("proj-1", "app.ts", "project one");
        upsertFile("proj-2", "app.ts", "project two");
        expect(roomFileStates.get("proj-1")?.get("app.ts")).toBe("project one");
        expect(roomFileStates.get("proj-2")?.get("app.ts")).toBe("project two");
    });

    test("clears room on last client leaving", () => {
        upsertFile("proj-1", "app.ts", "some content");
        roomFileStates.delete("proj-1");
        expect(roomFileStates.has("proj-1")).toBe(false);
    });

    test("serialises to plain object for JSON transport", () => {
        upsertFile("proj-1", "a.ts", "aaa");
        upsertFile("proj-1", "b.ts", "bbb");
        const room = roomFileStates.get("proj-1")!;
        const payload = Object.fromEntries(room);
        expect(payload).toEqual({ "a.ts": "aaa", "b.ts": "bbb" });
        const json = JSON.stringify({ type: "room_state", files: payload });
        const parsed = JSON.parse(json);
        expect(parsed.files["a.ts"]).toBe("aaa");
    });
});

// ── Heartbeat / pong tracking ─────────────────────────────────────────────────

describe("zombie detection", () => {
    const ZOMBIE_TIMEOUT_MS = 55_000;

    test("client is live when pong is recent", () => {
        const now = Date.now();
        const lastPong = now - 10_000;
        expect(now - lastPong > ZOMBIE_TIMEOUT_MS).toBe(false);
    });

    test("client is zombie when pong is stale", () => {
        const now = Date.now();
        const lastPong = now - 60_000;
        expect(now - lastPong > ZOMBIE_TIMEOUT_MS).toBe(true);
    });
});

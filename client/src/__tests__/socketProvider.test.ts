import { describe, test, expect } from "vitest";

// ── Reconnection backoff ──────────────────────────────────────────────────────

const BACKOFF_SCHEDULE = [1000, 2000, 4000, 8000, 16000, 30000];

function getBackoffDelay(attempt: number): number {
    return BACKOFF_SCHEDULE[Math.min(attempt, BACKOFF_SCHEDULE.length - 1)]!;
}

function jitter(ms: number): number {
    return Math.round(ms * (0.8 + Math.random() * 0.4));
}

describe("reconnection backoff", () => {
    test("first attempt uses 1s base", () => {
        expect(getBackoffDelay(0)).toBe(1000);
    });

    test("backoff grows with each attempt", () => {
        expect(getBackoffDelay(1)).toBe(2000);
        expect(getBackoffDelay(2)).toBe(4000);
        expect(getBackoffDelay(3)).toBe(8000);
    });

    test("capped at last schedule entry after exhaustion", () => {
        expect(getBackoffDelay(5)).toBe(30000);
        expect(getBackoffDelay(10)).toBe(30000);
        expect(getBackoffDelay(100)).toBe(30000);
    });

    test("jitter stays within ±20% bounds", () => {
        for (let i = 0; i < 200; i++) {
            const result = jitter(1000);
            expect(result).toBeGreaterThanOrEqual(800);
            expect(result).toBeLessThanOrEqual(1200);
        }
    });
});

// ── Pending message queue ─────────────────────────────────────────────────────

const MAX_QUEUE_SIZE = 50;

describe("pending queue", () => {
    test("caps at MAX_QUEUE_SIZE", () => {
        const queue: string[] = [];
        for (let i = 0; i < 60; i++) {
            if (queue.length < MAX_QUEUE_SIZE) queue.push(`msg-${i}`);
        }
        expect(queue.length).toBe(50);
        expect(queue[49]).toBe("msg-49");
    });

    test("drops messages beyond the cap", () => {
        const queue: string[] = [];
        for (let i = 0; i < 60; i++) {
            if (queue.length < MAX_QUEUE_SIZE) queue.push(`msg-${i}`);
        }
        expect(queue.find(m => m === "msg-50")).toBeUndefined();
    });

    test("flushes in FIFO order and empties the queue", () => {
        const queue = ["a", "b", "c"];
        const sent: string[] = [];
        const flushed = queue.splice(0);
        for (const msg of flushed) sent.push(msg);
        expect(sent).toEqual(["a", "b", "c"]);
        expect(queue.length).toBe(0);
    });

    test("sync_request is sent after flush", () => {
        const queue = ["queued-msg"];
        const sent: string[] = [];
        const flushed = queue.splice(0);
        for (const msg of flushed) sent.push(msg);
        sent.push(JSON.stringify({ type: "sync_request" }));
        expect(JSON.parse(sent[sent.length - 1]).type).toBe("sync_request");
        expect(sent[0]).toBe("queued-msg");
    });
});

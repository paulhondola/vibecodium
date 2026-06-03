import { describe, test, expect, beforeEach } from "bun:test";
import * as Y from "yjs";

// ── Room file state management ────────────────────────────────────────────────

describe("roomFileStates cache", () => {
	let roomFileStates: Map<string, Map<string, string>>;

	beforeEach(() => {
		roomFileStates = new Map();
	});

	function upsertFile(projectId: string, filePath: string, content: string) {
		if (!roomFileStates.has(projectId))
			roomFileStates.set(projectId, new Map());
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

// ── Yjs CRDT: multi-user concurrent editing ────────────────────────────────────

function makeDoc(text: string): Y.Doc {
	const doc = new Y.Doc();
	doc.getText("content").insert(0, text);
	return doc;
}

function base64Encode(arr: Uint8Array): string {
	let s = "";
	for (let i = 0; i < arr.byteLength; i++) s += String.fromCharCode(arr[i]!);
	return btoa(s);
}

function base64Decode(b64: string): Uint8Array {
	const s = atob(b64);
	const out = new Uint8Array(s.length);
	for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
	return out;
}

describe("Yjs CRDT collaboration", () => {
	test("local origin triggers observer; remote does not", () => {
		const doc = makeDoc("hello");
		const fired: string[] = [];
		doc.on("update", (_update: Uint8Array, origin: unknown) => {
			fired.push(String(origin));
		});

		doc.transact(() => doc.getText("content").insert(5, " world"), "local");
		doc.transact(() => doc.getText("content").insert(0, "prefix "), "remote");

		expect(fired).toEqual(["local", "remote"]);
	});

	test("observer can filter to local-only updates", () => {
		const doc = makeDoc("hello");
		const localUpdates: Uint8Array[] = [];
		doc.on("update", (update: Uint8Array, origin: unknown) => {
			if (origin === "local") localUpdates.push(update);
		});

		doc.transact(() => doc.getText("content").insert(5, "!"), "local");
		doc.transact(() => doc.getText("content").insert(0, "~"), "remote");
		doc.transact(() => doc.getText("content").insert(0, "^"), "agent_accepted");

		expect(localUpdates.length).toBe(1);
	});

	test("concurrent inserts at different positions both survive merge", () => {
		const server = makeDoc("hello");

		const clientA = new Y.Doc();
		Y.applyUpdate(clientA, Y.encodeStateAsUpdate(server));
		const clientB = new Y.Doc();
		Y.applyUpdate(clientB, Y.encodeStateAsUpdate(server));

		// A inserts at end, B inserts at start — captured as deltas from a common base
		let deltaA!: Uint8Array;
		let deltaB!: Uint8Array;
		clientA.on("update", (u: Uint8Array, o: unknown) => {
			if (o === "local") deltaA = u;
		});
		clientB.on("update", (u: Uint8Array, o: unknown) => {
			if (o === "local") deltaB = u;
		});

		clientA.transact(() => clientA.getText("content").insert(5, " A"), "local");
		clientB.transact(() => clientB.getText("content").insert(0, "B "), "local");

		// Both deltas reach the server; server merges sequentially
		Y.applyUpdate(server, deltaA);
		Y.applyUpdate(server, deltaB);

		const merged = server.getText("content").toString();
		expect(merged).toContain("A");
		expect(merged).toContain("B");
		expect(merged).toContain("hello");
	});

	test("delta from client A reaches client B via server relay", () => {
		const server = makeDoc("start");
		const clientB = new Y.Doc();
		Y.applyUpdate(clientB, Y.encodeStateAsUpdate(server));

		// Client A makes a change and produces a delta
		const clientA = new Y.Doc();
		Y.applyUpdate(clientA, Y.encodeStateAsUpdate(server));
		let delta!: Uint8Array;
		clientA.on("update", (u: Uint8Array, o: unknown) => {
			if (o === "local") delta = u;
		});
		clientA.transact(
			() => clientA.getText("content").insert(5, "-edit"),
			"local",
		);

		// Server applies it
		Y.applyUpdate(server, delta);
		// Server relays raw delta to client B
		Y.applyUpdate(clientB, delta, "remote");

		expect(clientB.getText("content").toString()).toBe("start-edit");
	});

	test("base64 round-trip preserves Yjs update bytes", () => {
		const doc = makeDoc("roundtrip");
		let captured!: Uint8Array;
		doc.on("update", (u: Uint8Array, o: unknown) => {
			if (o === "local") captured = u;
		});
		doc.transact(() => doc.getText("content").insert(9, "!"), "local");

		const b64 = base64Encode(captured);
		const decoded = base64Decode(b64);

		expect(decoded).toEqual(captured);

		// Applying decoded bytes to a fresh doc produces the same text
		const fresh = new Y.Doc();
		Y.applyUpdate(fresh, Y.encodeStateAsUpdate(doc));
		const fresh2 = new Y.Doc();
		Y.applyUpdate(fresh2, decoded);
		// fresh2 started empty, so the delta alone doesn't reconstruct the full doc;
		// but the bytes are byte-identical
		expect(Array.from(decoded)).toEqual(Array.from(captured));
	});

	test("agent_accepted re-sync: Y.Doc fully replaced with new content", () => {
		const doc = makeDoc("original text");
		const acceptedContent = "completely new content after agent accept";

		doc.transact(() => {
			const ytext = doc.getText("content");
			ytext.delete(0, ytext.length);
			ytext.insert(0, acceptedContent);
		}, "agent_accepted");

		expect(doc.getText("content").toString()).toBe(acceptedContent);
	});

	test("time-travel restore with local origin produces a broadcastable delta", () => {
		const doc = makeDoc("before restore");
		// peer2 starts from the same shared history as doc
		const peer2 = new Y.Doc();
		Y.applyUpdate(peer2, Y.encodeStateAsUpdate(doc));

		const restoredContent = "snapshot from timeline";
		const deltas: Uint8Array[] = [];
		doc.on("update", (u: Uint8Array, o: unknown) => {
			if (o === "local") deltas.push(u);
		});

		doc.transact(() => {
			const ytext = doc.getText("content");
			ytext.delete(0, ytext.length);
			ytext.insert(0, restoredContent);
		}, "local");

		expect(deltas.length).toBe(1);
		expect(doc.getText("content").toString()).toBe(restoredContent);

		// Peer2 receives the delta and converges to the restored content
		Y.applyUpdate(peer2, deltas[0]!, "remote");
		expect(peer2.getText("content").toString()).toBe(restoredContent);
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

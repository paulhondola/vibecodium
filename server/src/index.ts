import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serveStatic } from "hono/bun";

import gitRoutes from "./routes/git";
import projectsRoutes from "./routes/projects";
import sessionsRoutes from "./routes/sessions";
import reelsRoutes from "./routes/reels";
import agentRoutes from "./routes/agent";
import githubRoutes from "./routes/github";
import usersRouter from "./routes/users";
import matchRouter from "./routes/match";
import deployRoutes from "./routes/deploy";
import helpRoutes from "./routes/help";
import llmRoutes from "./routes/llm";
import timelineRoutes from "./routes/timeline";
import executeRoutes from "./routes/execute";
import { supabase } from "./db/supabase";
import { addMatchClient, removeMatchClient } from "./ws/matchMessaging";

// WebSocket handlers
import type { WSData } from "./ws/terminal";
import { handleTerminalOpen, handleTerminalMessage, handleTerminalClose } from "./ws/terminal";
import { handleCollabOpen, handleCollabMessage, handleCollabClose } from "./ws/collaboration";

// Re-export for deploy.ts
export { broadcastToTerminal } from "./ws/terminal";

export const app = new Hono()
	.onError((err, c) => {
		console.error("Unhandled error:", err);
		return c.json({ success: false, error: "Internal server error" }, 500);
	})
	.use(logger())
	.use(cors({
		origin: "*",
		allowHeaders: ["*"],
		allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
		credentials: false,
	}))
	.route("/api/git", gitRoutes)
	.route("/api/projects", projectsRoutes)
	.route("/api/sessions", sessionsRoutes)
	.route("/api/reels", reelsRoutes)
	.route("/api/agent", agentRoutes)
	.route("/api/github", githubRoutes)
	.route("/api/users", usersRouter)
	.route("/api/match", matchRouter)
	.route("/api/deploy", deployRoutes)
	.route("/api/help", helpRoutes)
	.route("/api/timeline", timelineRoutes)
	.route("/api", llmRoutes)
	.route("/execute", executeRoutes)
	// Serve static assets from the client dist folder
	.use("/assets/*", serveStatic({ root: "../client/dist" }))
	.use("/favicon.ico", serveStatic({ path: "../client/dist/favicon.ico" }))
	.use("/vibecodium_icon.svg", serveStatic({ path: "../client/dist/vibecodium_icon.svg" }))
	.use("/vite.svg", serveStatic({ path: "../client/dist/vite.svg" }))
	.use("/subway-surfer.html", serveStatic({ path: "../client/dist/subway-surfer.html" }))
	.use("/flappy-bird/*", serveStatic({ root: "../client/dist" }))
	.get("/hello", async (c) => c.json({ message: "Hello BHVR!", success: true }, 200))
	.get("*", serveStatic({ path: "../client/dist/index.html" }));

// ──────────────────────────────────────────
// Bun.serve Engine
// ──────────────────────────────────────────

export default {
	port: process.env.PORT || 3000,

	async fetch(req: Request, server: import("bun").Server<WSData>) {
		const url = new URL(req.url);

		// Match chat WebSocket — /ws/match?matchId=&userId=
		if (url.pathname === "/ws/match") {
			const matchId = url.searchParams.get("matchId") || "";
			const userId = url.searchParams.get("userId") || "anon";
			if (!matchId) return new Response("matchId required", { status: 400 });
			if (server.upgrade(req, {
				data: { type: "match", projectId: matchId, clientId: userId, userName: "", isHost: false, color: "" }
			})) return;
			return new Response("Upgrade failed", { status: 500 });
		}

		// Terminals — Docker-backed collaborative sandbox
		if (url.pathname === "/ws/terminal") {
			const roomId = url.searchParams.get("roomId") || "default";
			if (server.upgrade(req, {
				data: { type: "terminal", projectId: roomId, clientId: crypto.randomUUID(), userName: "terminal", color: "", isHost: false }
			})) return;
			return new Response("Upgrade failed", { status: 500 });
		}

		// Collaboration
		if (url.pathname.startsWith("/ws/collab/")) {
			const projectId = url.pathname.split("/").pop();
			if (!projectId) return new Response("Bad Request", { status: 400 });

			const { data: proj } = await supabase
				.from("projects")
				.select("id")
				.eq("id", projectId)
				.maybeSingle();
			if (!proj) return new Response("Project not found", { status: 404 });

			const clientId = url.searchParams.get("userId") || "anon";
			const userName = url.searchParams.get("userName") || "Anonymous";

			if (server.upgrade(req, {
				data: { type: "collab", projectId, clientId, userName, isHost: false, color: "" }
			})) {
				return;
			}
			return new Response("Upgrade failed", { status: 500 });
		}

		// Standard Hono API
		return app.fetch(req, server);
	},

	websocket: {
		open(ws: import("bun").ServerWebSocket<WSData>) {
			if (ws.data.type === "match") {
				addMatchClient(ws.data.projectId, ws);
				return;
			}
			if (ws.data.type === "terminal") {
				handleTerminalOpen(ws);
			} else {
				handleCollabOpen(ws);
			}
		},

		message(ws: import("bun").ServerWebSocket<WSData>, message: string) {
			if (ws.data.type === "terminal") {
				handleTerminalMessage(ws, message);
			} else {
				handleCollabMessage(ws, message);
			}
		},

		close(ws: import("bun").ServerWebSocket<WSData>) {
			if (ws.data.type === "match") {
				removeMatchClient(ws.data.projectId, ws);
				return;
			}
			if (ws.data.type === "terminal") {
				handleTerminalClose(ws);
			} else {
				handleCollabClose(ws);
			}
		}
	}
};

import { Hono } from "hono";
import { authMiddleware } from "../middleware/authMiddleware";

const projectsRoutes = new Hono();

projectsRoutes.use("/*", authMiddleware);

projectsRoutes.post("/import", async (c) => {
	try {
		const payload = await c.req.json();
		const repoUrl = payload.repoUrl as string;
		
		if (!repoUrl) {
			return c.json({ error: "Missing repoUrl parameter" }, 400);
		}

        // Basic GitHub URL validation
        if (!repoUrl.startsWith("https://github.com/")) {
            return c.json({ error: "Only GitHub URLs are supported." }, 400);
        }

		// Generate a random project ID for the tmp folder
		const projectId = crypto.randomUUID();
		const targetDir = `/tmp/vibecodium/${projectId}`;

		console.log(`Cloning ${repoUrl} to ${targetDir}...`);
        
        // Ensure the directory exists synchronously before spawning git
        const fs = require("node:fs");
        fs.mkdirSync("/tmp/vibecodium", { recursive: true });

		// Using Bun.spawn to clone the repo
		const proc = Bun.spawn(["git", "clone", repoUrl, targetDir], {
            stdout: "pipe",
            stderr: "pipe"
        });

        // Wait for it to finish
		const exitCode = await proc.exited;

        if (exitCode !== 0) {
            const errorText = await new Response(proc.stderr).text();
            return c.json({ error: `Failed to clone repository: ${errorText}` }, 500);
        }

		return c.json({
			success: true,
			message: "Repository imported successfully",
			projectId: projectId,
            path: targetDir,
		}, 200);

	} catch (error: any) {
		return c.json({ error: `Internal Server Error: ${error.message}` }, 500);
	}
});

export default projectsRoutes;

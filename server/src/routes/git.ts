import { Hono } from "hono";
import { authMiddleware } from "../middleware/authMiddleware";

const gitRoutes = new Hono();

// Securing the route
gitRoutes.use("*", authMiddleware);

gitRoutes.post("/", async (c) => {
	try {
        const payload = await c.req.json();
        const command = payload.command as string;
        const projectId = payload.projectId as string;
        
        if (!command || !projectId) {
            return c.json({ error: "Missing command or projectId" }, 400);
        }

        // Basic bash injection prevention (allow only git)
        if (!command.startsWith("git ")) {
            return c.json({ error: "Only git commands are allowed." }, 403);
        }

        const projectDir = `/tmp/vibecodium/${projectId}`;
        
        try {
            // Using Bun.spawn to execute the git command synchronously
            const args = command.split(" ");
            
            const proc = Bun.spawn(args, {
                cwd: projectDir,
                stdout: "pipe",
                stderr: "pipe",
            });

            const rawOutput = await new Response(proc.stdout).text();
            const rawError = await new Response(proc.stderr).text();

            return c.json({
                success: proc.exitCode === 0,
                output: rawOutput.trim() || rawError.trim(), // return stderr if stdout is empty
                exitCode: proc.exitCode
            });
            
        } catch (execError: any) {
            return c.json({ error: execError.message }, 500);
        }

	} catch (error: any) {
		return c.json({ error: error.message }, 500);
	}
});

export default gitRoutes;

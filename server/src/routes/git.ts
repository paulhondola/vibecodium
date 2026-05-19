import { Hono } from "hono";
import { authMiddleware } from "../middleware/authMiddleware";
import { ensureGitRepo } from "../utils/sync";
import { supabase } from "../db/supabase";
import { getUserTokens } from "../utils/tokens";

const gitRoutes = new Hono();

gitRoutes.use("*", authMiddleware);

gitRoutes.post("/", async (c) => {
	try {
        const payload = await c.req.json();
        const command = payload.command as string;
        const projectId = payload.projectId as string;

        if (!command || !projectId) {
            return c.json({ error: "Missing command or projectId" }, 400);
        }

        if (!command.startsWith("git ")) {
            return c.json({ error: "Only git commands are allowed." }, 403);
        }

        const user = (c.get as any)("user");
        const userId = user?.sub;

        const [{ data: project }, tokens] = await Promise.all([
            supabase.from("projects").select("repo_url").eq("id", projectId).maybeSingle(),
            getUserTokens(userId),
        ]);

        const githubToken = tokens.githubToken || process.env.GITHUB_TOKEN_REPO || process.env.GITHUB_TOKEN;
        const repoUrl = project?.repo_url || "";

        const projectDir = await ensureGitRepo(projectId, repoUrl, githubToken);

        // Ensure git identity is set
        const configCheck = Bun.spawn(["git", "config", "user.email"], { cwd: projectDir, stdout: "pipe" });
        const configEmail = (await new Response(configCheck.stdout).text()).trim();
        await configCheck.exited;
        if (!configEmail) {
            const cu = Bun.spawn(["git", "config", "user.name", "VibeCodium"], { cwd: projectDir });
            await cu.exited;
            const ce = Bun.spawn(["git", "config", "user.email", "live@vibecodium.cloud"], { cwd: projectDir });
            await ce.exited;
        }

        const args = command.split(" ");
        const proc = Bun.spawn(args, {
            cwd: projectDir,
            stdout: "pipe",
            stderr: "pipe",
        });

        const [rawOutput, rawError, exitCode] = await Promise.all([
            new Response(proc.stdout).text(),
            new Response(proc.stderr).text(),
            proc.exited,
        ]);

        return c.json({
            success: exitCode === 0,
            output: rawOutput.trim() || rawError.trim(),
            exitCode,
        });

	} catch (error: any) {
		return c.json({ error: error.message }, 500);
	}
});

export default gitRoutes;

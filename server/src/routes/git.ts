import { Hono } from "hono";
import * as path from "node:path";
import * as fs from "node:fs";
import { authMiddleware } from "../middleware/authMiddleware";
import { ensureGitRepo, syncProjectFilesToDisk } from "../utils/sync";
import { supabase } from "../db/supabase";
import { getUserTokens } from "../utils/tokens";

const gitRoutes = new Hono();

gitRoutes.use("*", authMiddleware);

gitRoutes.post("/", async (c) => {
    try {
        const payload = await c.req.json();
        const projectId = payload.projectId as string;
        if (!projectId) return c.json({ error: "Missing projectId" }, 400);

        // Accept either { args: string[] } (new) or { command: string } (legacy)
        let args: string[];
        if (Array.isArray(payload.args)) {
            args = payload.args;
        } else if (typeof payload.command === "string") {
            args = shellSplit(payload.command);
        } else {
            return c.json({ error: "Missing command or args" }, 400);
        }

        if (args[0] !== "git") {
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
        const targetDir = `/tmp/vibecodium/${projectId}`;
        const gitDir = path.join(targetDir, ".git");

        // Only do a full ensureGitRepo (clone + sync) when .git is missing.
        // For status, sync files so the latest Supabase edits show up on disk.
        // For all other commands (diff, add, restore, reset, checkout, branch),
        // skip syncing — the client runs status first so files are already current.
        const subCommand = args[1] ?? "";
        const needsSync = !fs.existsSync(gitDir) || subCommand === "status";

        let projectDir: string;
        if (!fs.existsSync(gitDir)) {
            // No .git — full clone + force sync
            projectDir = await ensureGitRepo(projectId, repoUrl, githubToken);
        } else if (needsSync) {
            // .git exists, sync files for status
            projectDir = await syncProjectFilesToDisk(projectId);
        } else {
            // All other commands — don't touch files on disk
            projectDir = targetDir;
        }

        // Ensure git identity
        const emailCheck = Bun.spawn(["git", "config", "user.email"], { cwd: projectDir, stdout: "pipe" });
        const email = (await new Response(emailCheck.stdout).text()).trim();
        await emailCheck.exited;
        if (!email) {
            const pu = Bun.spawn(["git", "config", "user.name", "VibeCodium"], { cwd: projectDir });
            await pu.exited;
            const pe = Bun.spawn(["git", "config", "user.email", "live@vibecodium.cloud"], { cwd: projectDir });
            await pe.exited;
        }

        const proc = Bun.spawn(args, { cwd: projectDir, stdout: "pipe", stderr: "pipe" });
        const [rawOut, rawErr, exitCode] = await Promise.all([
            new Response(proc.stdout).text(),
            new Response(proc.stderr).text(),
            proc.exited,
        ]);

        return c.json({
            success: exitCode === 0,
            output: rawOut.trimEnd() || rawErr.trimEnd(),
            exitCode,
        });

    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

// Very small shell-like tokenizer: handles double-quoted strings.
function shellSplit(cmd: string): string[] {
    const tokens: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < cmd.length; i++) {
        const ch = cmd[i];
        if (inQuote) {
            if (ch === '"') inQuote = false;
            else cur += ch;
        } else if (ch === '"') {
            inQuote = true;
        } else if (ch === " ") {
            if (cur) { tokens.push(cur); cur = ""; }
        } else {
            cur += ch;
        }
    }
    if (cur) tokens.push(cur);
    return tokens;
}

export default gitRoutes;

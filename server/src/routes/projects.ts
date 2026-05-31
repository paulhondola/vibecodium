import { Hono } from "hono";
import { authMiddleware } from "../middleware/authMiddleware";
import { supabase } from "../db/supabase";
import { syncProjectFilesToDisk, ensureGitRepo } from "../utils/sync";
import { getUserTokens } from "../utils/tokens";
import * as fs from "node:fs";
import * as path from "node:path";

const projectsRoutes = new Hono();

// All project routes require auth except OPTIONS
projectsRoutes.use("/*", async (c, next) => {
    if (c.req.method === "OPTIONS") return next();
    return authMiddleware(c, next);
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAllFilesRecursive(dir: string, baseDir: string): { path: string; content: string }[] {
    const results: { path: string; content: string }[] = [];
    for (const item of fs.readdirSync(dir)) {
        if (item === ".git" || item === "node_modules") continue;
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            results.push(...getAllFilesRecursive(fullPath, baseDir));
        } else {
            if (stat.size > 2 * 1024 * 1024) continue;
            try {
                const content = fs.readFileSync(fullPath, "utf-8");
                if (content.includes("\x00")) continue;
                results.push({ path: path.relative(baseDir, fullPath), content });
            } catch { /* skip unreadable */ }
        }
    }
    return results;
}

async function upsertFiles(projectId: string, allFiles: { path: string; content: string }[]) {
    const BATCH_SIZE = 100;
    for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
        const batch = allFiles.slice(i, i + BATCH_SIZE).map((f) => ({
            id: crypto.randomUUID(),
            project_id: projectId,
            path: f.path,
            content: f.content,
            updated_at: new Date().toISOString(),
        }));
        const { error } = await supabase
            .from("files")
            .upsert(batch, { onConflict: "project_id,path" });
        if (error) throw error;
    }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/projects — list all projects for the current user
projectsRoutes.get("/", async (c) => {
    try {
        const user = (c.get as any)("user");
        if (!user?.sub) return c.json({ error: "Unauthorized user" }, 401);

        const { data, error } = await supabase
            .from("projects")
            .select("id, project_name, repo_url, status, local_path, created_at, environment")
            .eq("user_id", user.sub)
            .order("created_at", { ascending: false });

        if (error) throw error;

        // Normalise to the shape the client expects (projectName, repoUrl)
        const projects = (data ?? []).map((p) => ({
            _id: p.id,
            projectName: p.project_name,
            repoUrl: p.repo_url,
            status: p.status,
            localPath: p.local_path,
            createdAt: p.created_at,
            environment: p.environment ?? 'auto',
        }));

        return c.json({ success: true, projects }, 200);
    } catch (err: any) {
        return c.json({ error: `Failed to fetch projects: ${err.message}` }, 500);
    }
});

// GET /api/projects/user/:userId — list projects for any user (public)
projectsRoutes.get("/user/:userId", async (c) => {
    try {
        const userId = c.req.param("userId");
        if (!userId) return c.json({ error: "Missing userId" }, 400);

        const { data, error } = await supabase
            .from("projects")
            .select("id, project_name, repo_url, status, created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

        if (error) throw error;
        return c.json({ success: true, projects: data ?? [] }, 200);
    } catch (err: any) {
        return c.json({ error: `Failed to fetch user projects: ${err.message}` }, 500);
    }
});

// POST /api/projects/import — clone a repo and index its files
projectsRoutes.post("/import", async (c) => {
    try {
        const payload = await c.req.json();
        const repoUrl = payload.repoUrl as string;
        const environment: string = payload.environment ?? 'auto';

        if (!repoUrl) return c.json({ error: "Missing repoUrl parameter" }, 400);
        if (!repoUrl.startsWith("https://github.com/"))
            return c.json({ error: "Only GitHub URLs are supported." }, 400);

        const user = (c.get as any)("user");
        const userId = user?.sub ?? "anonymous";

        // Build authenticated clone URL if user has a GitHub token (required for private repos)
        const tokens = await getUserTokens(userId);
        const githubToken = tokens.githubToken || process.env.GITHUB_TOKEN_REPO || process.env.GITHUB_TOKEN;
        const cloneUrl = githubToken && githubToken !== "undefined" && repoUrl.startsWith("https://github.com/")
            ? repoUrl.replace("https://github.com/", `https://${githubToken}@github.com/`)
            : repoUrl;

        // Check if already imported
        const { data: existing } = await supabase
            .from("projects")
            .select("id, project_name, repo_url, local_path")
            .eq("user_id", userId)
            .eq("repo_url", repoUrl)
            .maybeSingle();

        if (existing) {
            const projectId = existing.id;
            const targetDir = existing.local_path || `/tmp/vibecodium/${projectId}`;

            const { data: existingFiles } = await supabase
                .from("files")
                .select("id")
                .eq("project_id", projectId)
                .limit(1);

            if (!existingFiles?.length) {
                if (fs.existsSync(targetDir)) {
                    console.log(`Re-indexing existing project ${projectId} from disk...`);
                    const allFiles = getAllFilesRecursive(targetDir, targetDir);
                    await upsertFiles(projectId, allFiles);
                    return c.json({ success: true, message: "Repository re-indexed", projectId, name: existing.project_name, filesCount: allFiles.length }, 200);
                } else {
                    // Re-clone
                    console.log(`Re-cloning project ${projectId}...`);
                    await supabase.from("projects").update({ status: "cloning" }).eq("id", projectId);
                    fs.mkdirSync("/tmp/vibecodium", { recursive: true });
                    const cloneProc = Bun.spawn(["git", "clone", cloneUrl, targetDir], { stdout: "pipe", stderr: "pipe" });
                    if (await cloneProc.exited !== 0) {
                        const errText = await new Response(cloneProc.stderr).text();
                        await supabase.from("projects").update({ status: "error" }).eq("id", projectId);
                        return c.json({ error: `Re-clone failed: ${errText}` }, 500);
                    }
                    await supabase.from("projects").update({ status: "ready", local_path: targetDir }).eq("id", projectId);
                    const allFiles = getAllFilesRecursive(targetDir, targetDir);
                    await upsertFiles(projectId, allFiles);
                    return c.json({ success: true, message: "Repository re-cloned", projectId, name: existing.project_name, filesCount: allFiles.length }, 200);
                }
            }

            return c.json({ success: true, message: "Repository already imported", projectId, name: existing.project_name }, 200);
        }

        // New import — generate ID, clone, index
        const projectId = crypto.randomUUID();
        const targetDir = `/tmp/vibecodium/${projectId}`;
        const projectName = repoUrl.split("/").pop()?.replace(".git", "") || "Untitled";

        const { error: insertErr } = await supabase.from("projects").insert({
            id: projectId,
            user_id: userId,
            project_name: projectName,
            repo_url: repoUrl,
            status: "cloning",
            environment,
        });
        if (insertErr) throw insertErr;

        fs.mkdirSync("/tmp/vibecodium", { recursive: true });
        const proc = Bun.spawn(["git", "clone", cloneUrl, targetDir], { stdout: "pipe", stderr: "pipe" });
        const exitCode = await proc.exited;

        if (exitCode !== 0) {
            const errorText = await new Response(proc.stderr).text();
            await supabase.from("projects").update({ status: "error" }).eq("id", projectId);
            return c.json({ error: `Failed to clone repository: ${errorText}` }, 500);
        }

        await supabase.from("projects").update({ status: "ready", local_path: targetDir }).eq("id", projectId);

        const allFiles = getAllFilesRecursive(targetDir, targetDir);
        await upsertFiles(projectId, allFiles);

        return c.json({ success: true, message: "Repository imported and indexed", projectId, name: projectName, filesCount: allFiles.length }, 200);

    } catch (error: any) {
        return c.json({ error: `Internal Server Error: ${error.message}` }, 500);
    }
});

// GET /api/projects/:id/files
projectsRoutes.get("/:id/files", async (c) => {
    try {
        const projectId = c.req.param("id");
        if (!projectId) return c.json({ error: "Missing projectId" }, 400);

        const { data: project } = await supabase
            .from("projects")
            .select("project_name, repo_url, local_path, environment")
            .eq("id", projectId)
            .maybeSingle();

        const projectName = project?.project_name ||
            project?.repo_url?.split("/").pop()?.replace(".git", "") || "Untitled";

        let { data: projectFiles, error } = await supabase
            .from("files")
            .select("id, path, content")
            .eq("project_id", projectId);

        if (error) throw error;

        // Auto-recover: re-index from disk if SQLite cleared
        if (!projectFiles?.length && project) {
            const diskDir = project.local_path || `/tmp/vibecodium/${projectId}`;
            if (fs.existsSync(diskDir)) {
                console.log(`[files] Re-indexing ${projectId} from disk on read...`);
                const diskFiles = getAllFilesRecursive(diskDir, diskDir);
                await upsertFiles(projectId, diskFiles);
                const { data: fresh } = await supabase.from("files").select("id, path, content").eq("project_id", projectId);
                projectFiles = fresh ?? [];
            }
        }

        return c.json({ success: true, files: projectFiles ?? [], projectName, repoUrl: project?.repo_url ?? null, environment: project?.environment ?? 'auto' });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// GET /api/projects/:id/snapshots
projectsRoutes.get("/:id/snapshots", async (c) => {
    try {
        const projectId = c.req.param("id");
        const filePath = c.req.query("path");
        if (!projectId) return c.json({ error: "Missing projectId" }, 400);

        let query = supabase
            .from("snapshots")
            .select("id, path, content, timestamp")
            .eq("project_id", projectId)
            .order("timestamp", { ascending: false });

        if (filePath) query = query.eq("path", filePath);

        const { data, error } = await query;
        if (error) throw error;

        return c.json({ success: true, snapshots: data ?? [] });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /api/projects/:id/push — commit & push to GitHub
projectsRoutes.post("/:id/push", async (c) => {
    try {
        const projectId = c.req.param("id");
        if (!projectId) return c.json({ error: "Missing projectId" }, 400);

        const user = (c.get as any)("user");
        const userId = user?.sub;
        if (!userId) return c.json({ error: "Unauthorized" }, 401);

        const tokens = await getUserTokens(userId);
        const githubToken = tokens.githubToken || process.env.GITHUB_TOKEN_REPO || process.env.GITHUB_TOKEN;

        if (!githubToken || githubToken === "undefined") {
            return c.json({
                success: false,
                error: "GITHUB_TOKEN_REQUIRED",
                message: "You need to register your GitHub Token in your profile to commit and push changes.",
            }, 403);
        }

        const { data: project } = await supabase
            .from("projects")
            .select("repo_url, local_path")
            .eq("id", projectId)
            .maybeSingle();

        if (!project) return c.json({ error: "Project not found" }, 404);

        let commitMessage = "Auto-Save Sandbox Commit";
        let targetBranch = "main";
        try {
            const body = await c.req.json();
            if (body?.message?.trim()) commitMessage = body.message.trim();
            if (body?.branch?.trim()) targetBranch = body.branch.trim();
        } catch { /* no body is fine */ }

        const targetDir = await ensureGitRepo(projectId, project.repo_url, githubToken);

        const gitConfigUser = Bun.spawn(["git", "config", "user.name", "VibeCodium Live Collaboration"], { cwd: targetDir });
        await gitConfigUser.exited;
        const gitConfigEmail = Bun.spawn(["git", "config", "user.email", "live@vibecodium.cloud"], { cwd: targetDir });
        await gitConfigEmail.exited;

        // Checkout the target branch (try plain checkout first, fall back to -b for new branches)
        const checkoutProc = Bun.spawn(["git", "checkout", targetBranch], { cwd: targetDir, stdout: "pipe", stderr: "pipe" });
        if ((await checkoutProc.exited) !== 0) {
            const checkoutB = Bun.spawn(["git", "checkout", "-b", targetBranch], { cwd: targetDir, stdout: "pipe", stderr: "pipe" });
            await checkoutB.exited;
        }

        const gitAdd = Bun.spawn(["git", "add", "."], { cwd: targetDir });
        await gitAdd.exited;

        const gitCommit = Bun.spawn(["git", "commit", "-m", commitMessage], { cwd: targetDir });
        await gitCommit.exited;

        const repoUrl = project.repo_url;
        const authenticatedUrl = repoUrl.startsWith("https://github.com/")
            ? repoUrl.replace("https://github.com/", `https://${githubToken}@github.com/`)
            : repoUrl;

        const gitPush = Bun.spawn(["git", "push", authenticatedUrl, `HEAD:${targetBranch}`, "--force"], {
            cwd: targetDir, stdout: "pipe", stderr: "pipe",
        });
        const exitCode = await gitPush.exited;
        const stdout = await new Response(gitPush.stdout).text();
        const stderr = await new Response(gitPush.stderr).text();

        if (exitCode !== 0) return c.json({ error: "Failed to push to GitHub", details: stderr }, 500);
        return c.json({ success: true, message: "Successfully pushed to GitHub", output: stdout });

    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /api/projects/:id/branches — create a branch locally and push it to GitHub
projectsRoutes.post("/:id/branches", async (c) => {
    try {
        const projectId = c.req.param("id");
        if (!projectId) return c.json({ error: "Missing projectId" }, 400);

        const user = (c.get as any)("user");
        const userId = user?.sub;
        if (!userId) return c.json({ error: "Unauthorized" }, 401);

        const { name } = await c.req.json<{ name: string }>();
        const branchName = name?.trim();
        if (!branchName) return c.json({ error: "Missing branch name" }, 400);
        if (!/^[a-zA-Z0-9._\-\/]+$/.test(branchName))
            return c.json({ error: "Invalid branch name — use letters, numbers, -, _, /, ." }, 400);

        const tokens = await getUserTokens(userId);
        const githubToken = tokens.githubToken || process.env.GITHUB_TOKEN_REPO || process.env.GITHUB_TOKEN;
        if (!githubToken || githubToken === "undefined") {
            return c.json({
                success: false,
                error: "GITHUB_TOKEN_REQUIRED",
                message: "You need to register your GitHub Token in your profile to push branches.",
            }, 403);
        }

        const { data: project } = await supabase
            .from("projects")
            .select("repo_url")
            .eq("id", projectId)
            .maybeSingle();
        if (!project) return c.json({ error: "Project not found" }, 404);

        const targetDir = await ensureGitRepo(projectId, project.repo_url, githubToken);

        const configUser = Bun.spawn(["git", "config", "user.name", "VibeCodium Live Collaboration"], { cwd: targetDir });
        await configUser.exited;
        const configEmail = Bun.spawn(["git", "config", "user.email", "live@vibecodium.cloud"], { cwd: targetDir });
        await configEmail.exited;

        // Create branch locally
        const checkoutProc = Bun.spawn(["git", "checkout", "-b", branchName], {
            cwd: targetDir, stdout: "pipe", stderr: "pipe",
        });
        const [, checkoutErr, checkoutExit] = await Promise.all([
            new Response(checkoutProc.stdout).text(),
            new Response(checkoutProc.stderr).text(),
            checkoutProc.exited,
        ]);
        if (checkoutExit !== 0) {
            return c.json({ success: false, error: checkoutErr.trim() || "Failed to create branch" }, 400);
        }

        // Push the new branch to GitHub with auth token
        const authenticatedUrl = project.repo_url.startsWith("https://github.com/")
            ? project.repo_url.replace("https://github.com/", `https://${githubToken}@github.com/`)
            : project.repo_url;

        const pushProc = Bun.spawn(["git", "push", "-u", authenticatedUrl, branchName], {
            cwd: targetDir, stdout: "pipe", stderr: "pipe",
        });
        const [, pushErr, pushExit] = await Promise.all([
            new Response(pushProc.stdout).text(),
            new Response(pushProc.stderr).text(),
            pushProc.exited,
        ]);
        if (pushExit !== 0) {
            return c.json({ success: false, error: pushErr.trim() || "Failed to push branch to GitHub" }, 500);
        }

        return c.json({ success: true, branch: branchName });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// ── File Management ───────────────────────────────────────────────────────────

projectsRoutes.post("/:id/files/create", async (c) => {
    try {
        const projectId = c.req.param("id");
        const { path: filePath, content = "" } = await c.req.json<{ path: string; content?: string }>();
        if (!projectId || !filePath) return c.json({ error: "Missing projectId or path" }, 400);

        const user = (c.get as any)("user");
        const { data: project } = await supabase.from("projects").select("user_id").eq("id", projectId).maybeSingle();
        if (!project) return c.json({ error: "Project not found" }, 404);
        if (project.user_id !== user.sub) return c.json({ error: "Forbidden" }, 403);

        const { error } = await supabase.from("files").upsert(
            { id: crypto.randomUUID(), project_id: projectId, path: filePath, content, updated_at: new Date().toISOString() },
            { onConflict: "project_id,path" }
        );
        if (error) throw error;

        return c.json({ success: true, path: filePath });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

projectsRoutes.delete("/:id/files", async (c) => {
    try {
        const projectId = c.req.param("id");
        const { path: filePath } = await c.req.json<{ path: string }>();
        if (!projectId || !filePath) return c.json({ error: "Missing projectId or path" }, 400);

        const user = (c.get as any)("user");
        const { data: project } = await supabase.from("projects").select("user_id").eq("id", projectId).maybeSingle();
        if (!project) return c.json({ error: "Project not found" }, 404);
        if (project.user_id !== user.sub) return c.json({ error: "Forbidden" }, 403);

        const { data: allFiles } = await supabase.from("files").select("id, path").eq("project_id", projectId);
        const toDelete = (allFiles ?? []).filter((f) => f.path === filePath || f.path.startsWith(filePath + "/"));

        if (toDelete.length) {
            const { error } = await supabase.from("files").delete().in("id", toDelete.map((f) => f.id));
            if (error) throw error;
        }

        return c.json({ success: true, deleted: toDelete.length });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

projectsRoutes.patch("/:id/files/rename", async (c) => {
    try {
        const projectId = c.req.param("id");
        const { oldPath, newPath } = await c.req.json<{ oldPath: string; newPath: string }>();
        if (!projectId || !oldPath || !newPath) return c.json({ error: "Missing fields" }, 400);

        const user = (c.get as any)("user");
        const { data: project } = await supabase.from("projects").select("user_id").eq("id", projectId).maybeSingle();
        if (!project) return c.json({ error: "Project not found" }, 404);
        if (project.user_id !== user.sub) return c.json({ error: "Forbidden" }, 403);

        const { data: allFiles } = await supabase.from("files").select("*").eq("project_id", projectId);
        const toRename = (allFiles ?? []).filter((f) => f.path === oldPath || f.path.startsWith(oldPath + "/"));

        for (const f of toRename) {
            const renamedPath = newPath + f.path.slice(oldPath.length);
            await supabase.from("files").upsert(
                { id: crypto.randomUUID(), project_id: projectId, path: renamedPath, content: f.content, updated_at: new Date().toISOString() },
                { onConflict: "project_id,path" }
            );
            await supabase.from("files").delete().eq("id", f.id);
        }

        return c.json({ success: true, renamed: toRename.length });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// ── GitHub Integration ────────────────────────────────────────────────────────

projectsRoutes.post("/create-repo", async (c) => {
    try {
        const user = (c.get as any)("user");
        const userId = user?.sub;
        if (!userId) return c.json({ error: "Unauthorized" }, 401);

        const { name, description, isPrivate } = await c.req.json<{ name: string; description?: string; isPrivate?: boolean }>();
        if (!name) return c.json({ error: "Repository name is required" }, 400);

        const tokens = await getUserTokens(userId);
        const githubToken = tokens.githubToken || process.env.GITHUB_TOKEN_REPO || process.env.GITHUB_TOKEN;

        if (!githubToken || githubToken === "undefined") {
            return c.json({ success: false, error: "GITHUB_TOKEN_REQUIRED", message: "Register your GitHub Token in your profile to create repositories." }, 403);
        }

        // GitHub username is the nickname normalised from Supabase metadata
        const githubUsername = user.nickname;
        if (!githubUsername) return c.json({ error: "GitHub username not found in profile" }, 400);

        const response = await fetch("https://api.github.com/user/repos", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${githubToken}`,
                "Content-Type": "application/json",
                Accept: "application/vnd.github.v3+json",
                "User-Agent": "VibeCodium-App",
            },
            body: JSON.stringify({ name, description: description || undefined, private: isPrivate || false, auto_init: true }),
        });

        if (!response.ok) {
            const errorData = await response.json() as any;
            return c.json({ error: errorData.message || "Failed to create repository on GitHub" }, response.status as any);
        }

        const repoData = await response.json() as any;
        return c.json({
            success: true,
            repository: {
                id: repoData.id,
                name: repoData.name,
                full_name: repoData.full_name,
                html_url: repoData.html_url,
                description: repoData.description,
                private: repoData.private,
                created_at: repoData.created_at,
            },
        }, 201);

    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

projectsRoutes.get("/:id/commits", async (c) => {
    try {
        const projectId = c.req.param("id");
        if (!projectId) return c.json({ error: "Missing projectId" }, 400);

        const { data: project } = await supabase
            .from("projects")
            .select("repo_url")
            .eq("id", projectId)
            .maybeSingle();

        if (!project?.repo_url) return c.json({ error: "Project or repoUrl not found" }, 404);

        const urlStr = project.repo_url.replace(".git", "");
        const urlParams = urlStr.split("github.com/");
        if (urlParams.length < 2) return c.json({ error: "Invalid GitHub URL format" }, 400);

        const [owner, repo] = urlParams[1].split("/");
        if (!owner || !repo) return c.json({ error: "Could not extract owner/repo from URL" }, 400);

        const user = (c.get as any)("user");
        const tokens = await getUserTokens(user?.sub);
        const githubToken = tokens.githubToken || process.env.GITHUB_TOKEN;

        const headers: Record<string, string> = {
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "VibeCodium-App",
        };
        if (githubToken && githubToken !== "undefined") {
            headers["Authorization"] = `Bearer ${githubToken}`;
        }

        const ghResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits`, { headers });
        if (!ghResponse.ok) return c.json({ error: `GitHub API error: ${ghResponse.statusText}` }, 500);

        const commitsData = await ghResponse.json() as any[];
        const parsedCommits = commitsData.slice(0, 50).map((commitItem: any) => ({
            sha: commitItem.sha,
            message: commitItem.commit?.message?.split("\n")[0] || "No message",
            author: {
                name: commitItem.commit?.author?.name || "Unknown",
                avatar: commitItem.author?.avatar_url || null,
            },
            date: commitItem.commit?.author?.date || null,
        }));

        return c.json({ success: true, commits: parsedCommits }, 200);
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

// GET /api/projects/:id/commits/:sha — fetch changed files for a single commit
projectsRoutes.get("/:id/commits/:sha", async (c) => {
    try {
        const projectId = c.req.param("id");
        const sha = c.req.param("sha");
        if (!projectId || !sha) return c.json({ error: "Missing params" }, 400);

        const { data: project } = await supabase
            .from("projects")
            .select("repo_url")
            .eq("id", projectId)
            .maybeSingle();
        if (!project?.repo_url) return c.json({ error: "Project not found" }, 404);

        const urlStr = project.repo_url.replace(".git", "");
        const [owner, repo] = urlStr.split("github.com/")[1]?.split("/") ?? [];
        if (!owner || !repo) return c.json({ error: "Invalid repo URL" }, 400);

        const user = (c.get as any)("user");
        const tokens = await getUserTokens(user?.sub);
        const githubToken = tokens.githubToken || process.env.GITHUB_TOKEN;

        const headers: Record<string, string> = {
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "VibeCodium-App",
        };
        if (githubToken && githubToken !== "undefined") {
            headers["Authorization"] = `Bearer ${githubToken}`;
        }

        const ghRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${sha}`, { headers });
        if (!ghRes.ok) return c.json({ error: `GitHub API error: ${ghRes.statusText}` }, 500);

        const data = await ghRes.json() as any;
        return c.json({
            success: true,
            sha: data.sha,
            stats: data.stats ?? { additions: 0, deletions: 0, total: 0 },
            files: (data.files ?? []).map((f: any) => ({
                filename: f.filename,
                status: f.status,
                additions: f.additions,
                deletions: f.deletions,
            })),
        });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export default projectsRoutes;

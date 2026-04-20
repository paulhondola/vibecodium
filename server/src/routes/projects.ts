import { Hono } from "hono";
import { authMiddleware } from "../middleware/authMiddleware";
import { supabase } from "../db/supabase";
import { syncProjectFilesToDisk } from "../utils/sync";
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
    const now = Math.floor(Date.now() / 1000);
    for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
        const batch = allFiles.slice(i, i + BATCH_SIZE).map((f) => ({
            id: crypto.randomUUID(),
            project_id: projectId,
            path: f.path,
            content: f.content,
            updated_at: now,
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
            .select("id, project_name, repo_url, status, local_path, created_at")
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

        if (!repoUrl) return c.json({ error: "Missing repoUrl parameter" }, 400);
        if (!repoUrl.startsWith("https://github.com/"))
            return c.json({ error: "Only GitHub URLs are supported." }, 400);

        const user = (c.get as any)("user");
        const userId = user?.sub ?? "anonymous";

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
                    const cloneProc = Bun.spawn(["git", "clone", repoUrl, targetDir], { stdout: "pipe", stderr: "pipe" });
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
        });
        if (insertErr) throw insertErr;

        fs.mkdirSync("/tmp/vibecodium", { recursive: true });
        const proc = Bun.spawn(["git", "clone", repoUrl, targetDir], { stdout: "pipe", stderr: "pipe" });
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
            .select("project_name, repo_url, local_path")
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

        return c.json({ success: true, files: projectFiles ?? [], projectName, repoUrl: project?.repo_url ?? null });
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

        const targetDir = await syncProjectFilesToDisk(projectId);

        const gitConfigUser = Bun.spawn(["git", "config", "user.name", "VibeCodium Live Collaboration"], { cwd: targetDir });
        await gitConfigUser.exited;
        const gitConfigEmail = Bun.spawn(["git", "config", "user.email", "live@vibecodium.cloud"], { cwd: targetDir });
        await gitConfigEmail.exited;

        const gitAdd = Bun.spawn(["git", "add", "."], { cwd: targetDir });
        await gitAdd.exited;

        const gitCommit = Bun.spawn(["git", "commit", "-m", "Auto-Save Sandbox Commit"], { cwd: targetDir });
        await gitCommit.exited;

        const repoUrl = project.repo_url;
        const authenticatedUrl = repoUrl.startsWith("https://github.com/")
            ? repoUrl.replace("https://github.com/", `https://${githubToken}@github.com/`)
            : repoUrl;

        const gitPush = Bun.spawn(["git", "push", authenticatedUrl, "HEAD:main", "--force"], {
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

// ── File Management ───────────────────────────────────────────────────────────

projectsRoutes.post("/:id/files/create", async (c) => {
    try {
        const projectId = c.req.param("id");
        const { path: filePath, content = "" } = await c.req.json<{ path: string; content?: string }>();
        if (!projectId || !filePath) return c.json({ error: "Missing projectId or path" }, 400);

        const { error } = await supabase.from("files").upsert(
            { id: crypto.randomUUID(), project_id: projectId, path: filePath, content, updated_at: Math.floor(Date.now() / 1000) },
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

        const { data: allFiles } = await supabase.from("files").select("*").eq("project_id", projectId);
        const toRename = (allFiles ?? []).filter((f) => f.path === oldPath || f.path.startsWith(oldPath + "/"));

        for (const f of toRename) {
            const renamedPath = newPath + f.path.slice(oldPath.length);
            await supabase.from("files").upsert(
                { id: crypto.randomUUID(), project_id: projectId, path: renamedPath, content: f.content, updated_at: Math.floor(Date.now() / 1000) },
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

        const headers: Record<string, string> = {
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "VibeCodium-App",
        };
        if (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN !== "undefined") {
            headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
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

export default projectsRoutes;

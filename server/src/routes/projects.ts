import { Hono } from "hono";
import { authMiddleware } from "../middleware/authMiddleware";
import { db } from "../db";
import { projects, files, snapshots } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import * as fs from "node:fs";
import * as path from "node:path";
import mongoose from "mongoose";
import { connectMongo } from "../db/mongoose";
import { Project } from "../db/models/Project";
import { syncProjectFilesToDisk } from "../utils/sync";

const projectsRoutes = new Hono();

// Skip auth for OPTIONS preflight — the CORS middleware on the main app handles those
projectsRoutes.use("/*", async (c, next) => {
    if (c.req.method === "OPTIONS") return next();
    return authMiddleware(c, next);
});

function getAllFilesRecursive(dir: string, baseDir: string): { path: string; content: string }[] {
    const results: { path: string; content: string }[] = [];
    const items = fs.readdirSync(dir);

    for (const item of items) {
        if (item === ".git" || item === "node_modules") continue;

        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            results.push(...getAllFilesRecursive(fullPath, baseDir));
        } else {
            if (stat.size > 2 * 1024 * 1024) continue; // Skip files over 2MB
            try {
                let content = fs.readFileSync(fullPath, "utf-8");
                if (content.includes("\x00")) continue; // Skip binary files
                
                const relativePath = path.relative(baseDir, fullPath);
                results.push({ path: relativePath, content });
            } catch (e) {
                // skip unreadable files gracefully
            }
        }
    }

    return results;
}

projectsRoutes.get("/", async (c) => {
    try {
        await connectMongo();
        const user = (c.get as any)("user");
        if (!user || (!user.sub && !user.nickname)) {
            return c.json({ error: "Unauthorized user" }, 401);
        }

        const userId = user.sub || user.nickname;
        const userProjects = await Project.find({ userId }).sort({ createdAt: -1 });

        return c.json({ success: true, projects: userProjects }, 200);
    } catch (err: any) {
        return c.json({ error: `Failed to fetch projects: ${err.message}` }, 500);
    }
});

projectsRoutes.get("/user/:userId", async (c) => {
    try {
        await connectMongo();
        const userId = c.req.param("userId");
        if (!userId) return c.json({ error: "Missing userId" }, 400);

        const userProjects = await Project.find({ userId }).sort({ createdAt: -1 });
        return c.json({ success: true, projects: userProjects }, 200);
    } catch (err: any) {
        return c.json({ error: `Failed to fetch user projects: ${err.message}` }, 500);
    }
});

projectsRoutes.post("/import", async (c) => {
	try {
        await connectMongo();
		const payload = await c.req.json();
		const repoUrl = payload.repoUrl as string;
		
		if (!repoUrl) {
			return c.json({ error: "Missing repoUrl parameter" }, 400);
		}

        if (!repoUrl.startsWith("https://github.com/")) {
            return c.json({ error: "Only GitHub URLs are supported." }, 400);
        }

        const user = (c.get as any)("user");
        const userId = user ? (user.sub || user.nickname) : "anonymous";

        // Check if the user already imported this repository
        const existingProject = await Project.findOne({ userId, repoUrl });
        if (existingProject) {
            return c.json({
                success: true,
                message: "Repository already imported",
                projectId: existingProject._id.toString(),
                name: existingProject.projectName,
            }, 200);
        }

		const projectId = new mongoose.Types.ObjectId().toString();
		const targetDir = `/tmp/vibecodium/${projectId}`;
        const projectName = repoUrl.split("/").pop()?.replace(".git", "") || "Untitled";

		console.log(`Cloning ${repoUrl} to ${targetDir}...`);
        
        // 1. Save entry to MongoDB with status "cloning"
        await Project.create({
            _id: projectId,
            userId: userId,
            projectName: projectName,
            repoUrl: repoUrl,
            status: "cloning"
        });

        fs.mkdirSync("/tmp/vibecodium", { recursive: true });

		const proc = Bun.spawn(["git", "clone", repoUrl, targetDir], {
            stdout: "pipe",
            stderr: "pipe"
        });

		const exitCode = await proc.exited;

        if (exitCode !== 0) {
            const errorText = await new Response(proc.stderr).text();
            await Project.findByIdAndUpdate(projectId, { status: "error" });
            return c.json({ error: `Failed to clone repository: ${errorText}` }, 500);
        }

        // 2. Clone finished successfully. Update status to "ready" and localPath
        await Project.findByIdAndUpdate(projectId, { status: "ready", localPath: targetDir });

        const allFiles = getAllFilesRecursive(targetDir, targetDir);

        // Maximum chunk sizes roughly to 100 on sqlite batching
        const BATCH_SIZE = 100;
        for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
            const batch = allFiles.slice(i, i + BATCH_SIZE);
            const filesToInsert = batch.map((f) => ({
                id: crypto.randomUUID(),
                projectId: projectId,
                path: f.path,
                content: f.content,
                updatedAt: Math.floor(Date.now() / 1000)
            }));
            await db.insert(files).values(filesToInsert);
        }

		return c.json({
			success: true,
			message: "Repository imported and indexed successfully",
			projectId: projectId,
            name: projectName,
            filesCount: allFiles.length
		}, 200);

	} catch (error: any) {
		return c.json({ error: `Internal Server Error: ${error.message}` }, 500);
	}
});

projectsRoutes.get("/:id/files", async (c) => {
    try {
        const projectId = c.req.param("id");
        if (!projectId) return c.json({ error: "Missing projectId" }, 400);
        
        const projectFiles = await db.select({
            id: files.id,
            path: files.path,
            content: files.content
        })
        .from(files)
        .where(eq(files.projectId, projectId));

        // Fetch project name from MongoDB
        await connectMongo();
        const project = await Project.findById(projectId).select("projectName repoUrl");
        const projectName = project?.projectName 
            || project?.repoUrl?.split("/").pop()?.replace(".git", "")
            || "Untitled";

        return c.json({ success: true, files: projectFiles, projectName });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

projectsRoutes.get("/:id/snapshots", async (c) => {
    try {
        const projectId = c.req.param("id");
        const filePath = c.req.query("path");
        if (!projectId) return c.json({ error: "Missing projectId" }, 400);
        
        const query = db.select({
            id: snapshots.id,
            path: snapshots.path,
            content: snapshots.content,
            timestamp: snapshots.timestamp
        }).from(snapshots);

        let projectSnapshots;
        if (filePath) {
            projectSnapshots = await query
                .where(and(eq(snapshots.projectId, projectId), eq(snapshots.path, filePath)))
                .orderBy(desc(snapshots.timestamp));
        } else {
            projectSnapshots = await query
                .where(eq(snapshots.projectId, projectId))
                .orderBy(desc(snapshots.timestamp));
        }

        return c.json({ success: true, snapshots: projectSnapshots });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

projectsRoutes.post("/:id/push", async (c) => {
    try {
        const projectId = c.req.param("id");
        if (!projectId) return c.json({ error: "Missing projectId" }, 400);

        // Fetch project from MongoDB to get repoUrl (if needed)
        await connectMongo();
        const project = await Project.findById(projectId);
        if (!project) return c.json({ error: "Project not found" }, 404);

        // 1. Sync all files to disk
        const targetDir = await syncProjectFilesToDisk(projectId);

        // 2. Execute git commands
        const gitConfigUser = Bun.spawn(["git", "config", "user.name", "iTECify Live Collaboration"], { cwd: targetDir });
        await gitConfigUser.exited;
        const gitConfigEmail = Bun.spawn(["git", "config", "user.email", "live@itecify.cloud"], { cwd: targetDir });
        await gitConfigEmail.exited;

        const gitAdd = Bun.spawn(["git", "add", "."], { cwd: targetDir });
        await gitAdd.exited;

        const gitCommit = Bun.spawn(["git", "commit", "-m", "Auto-Save Sandbox Commit"], { cwd: targetDir });
        await gitCommit.exited;

        const gitPush = Bun.spawn(["git", "push", "--force"], { cwd: targetDir, stdout: "pipe", stderr: "pipe" });
        const exitCode = await gitPush.exited;
        
        const stdout = await new Response(gitPush.stdout).text();
        const stderr = await new Response(gitPush.stderr).text();

        if (exitCode !== 0) {
            return c.json({ error: "Failed to push to GitHub", details: stderr }, 500);
        }

        return c.json({ success: true, message: "Successfully pushed to GitHub", output: stdout });

    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// ── File Management ──────────────────────────────────────────────────────────

// Create a file (or overwrite)
projectsRoutes.post("/:id/files/create", async (c) => {
    try {
        const projectId = c.req.param("id");
        const { path: filePath, content = "" } = await c.req.json<{ path: string; content?: string }>();
        if (!projectId || !filePath) return c.json({ error: "Missing projectId or path" }, 400);

        const existing = await db.select({ id: files.id })
            .from(files)
            .where(eq(files.projectId, projectId))
            .then(rows => rows.find(r => r.id)); // just check if project has files

        await db.insert(files).values({
            id: crypto.randomUUID(),
            projectId,
            path: filePath,
            content,
            updatedAt: Math.floor(Date.now() / 1000),
        }).onConflictDoUpdate({
            target: [files.projectId, files.path],
            set: { content, updatedAt: Math.floor(Date.now() / 1000) },
        });

        return c.json({ success: true, path: filePath });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// Delete a file or all files under a folder prefix
projectsRoutes.delete("/:id/files", async (c) => {
    try {
        const projectId = c.req.param("id");
        const { path: filePath } = await c.req.json<{ path: string }>();
        if (!projectId || !filePath) return c.json({ error: "Missing projectId or path" }, 400);

        // Delete exact match (file) AND any children (folder prefix)
        const allFiles = await db.select({ id: files.id, path: files.path })
            .from(files)
            .where(eq(files.projectId, projectId));

        const toDelete = allFiles.filter(f =>
            f.path === filePath || f.path.startsWith(filePath + "/")
        );

        for (const f of toDelete) {
            await db.delete(files).where(eq(files.id, f.id));
        }

        return c.json({ success: true, deleted: toDelete.length });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// Rename a file or folder (prefix rename)
projectsRoutes.patch("/:id/files/rename", async (c) => {
    try {
        const projectId = c.req.param("id");
        const { oldPath, newPath } = await c.req.json<{ oldPath: string; newPath: string }>();
        if (!projectId || !oldPath || !newPath) return c.json({ error: "Missing fields" }, 400);

        const allFiles = await db.select()
            .from(files)
            .where(eq(files.projectId, projectId));

        const toRename = allFiles.filter(f =>
            f.path === oldPath || f.path.startsWith(oldPath + "/")
        );

        for (const f of toRename) {
            const renamedPath = newPath + f.path.slice(oldPath.length);
            // Insert new, delete old (SQLite has no UPDATE on unique constraints easily)
            await db.insert(files).values({
                id: crypto.randomUUID(),
                projectId,
                path: renamedPath,
                content: f.content,
                updatedAt: Math.floor(Date.now() / 1000),
            }).onConflictDoUpdate({
                target: [files.projectId, files.path],
                set: { content: f.content, updatedAt: Math.floor(Date.now() / 1000) },
            });
            await db.delete(files).where(eq(files.id, f.id));
        }

        return c.json({ success: true, renamed: toRename.length });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// ── GitHub Integration ───────────────────────────────────────────────────────

// Create a new GitHub repository
projectsRoutes.post("/create-repo", async (c) => {
    try {
        const user = (c.get as any)("user");
        const userId = user ? (user.sub || user.nickname) : null;
        if (!userId) return c.json({ error: "Unauthorized" }, 401);

        const { name, description, isPrivate } = await c.req.json<{
            name: string;
            description?: string;
            isPrivate?: boolean;
        }>();

        if (!name) return c.json({ error: "Repository name is required" }, 400);

        // Get GitHub token from environment
        const githubToken = process.env.GITHUB_TOKEN_REPO;
        if (!githubToken || githubToken === "undefined") {
            return c.json({
                error: "GitHub integration not configured. Please set GITHUB_TOKEN_REPO in .env"
            }, 500);
        }

        // Get GitHub username from Auth0 user
        const githubUsername = user.nickname;
        if (!githubUsername) {
            return c.json({ error: "GitHub username not found in profile" }, 400);
        }

        // Create repository via GitHub API
        const response = await fetch("https://api.github.com/user/repos", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${githubToken}`,
                "Content-Type": "application/json",
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "VibeCodium-App"
            },
            body: JSON.stringify({
                name,
                description: description || undefined,
                private: isPrivate || false,
                auto_init: true
            })
        });

        if (!response.ok) {
            const errorData = await response.json() as any;
            return c.json({
                error: errorData.message || "Failed to create repository on GitHub"
            }, response.status as any);
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
                created_at: repoData.created_at
            }
        }, 201);

    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

projectsRoutes.get("/:id/commits", async (c) => {
    try {
        const projectId = c.req.param("id");
        if (!projectId) return c.json({ error: "Missing projectId" }, 400);

        await connectMongo();
        const project = await Project.findById(projectId).select("repoUrl");
        if (!project || !project.repoUrl) {
            return c.json({ error: "Project or repoUrl not found" }, 404);
        }

        const urlStr = project.repoUrl.replace(".git", "");
        const urlParams = urlStr.split("github.com/");
        if (urlParams.length < 2) {
            return c.json({ error: "Invalid GitHub URL format" }, 400);
        }
        
        const [owner, repo] = urlParams[1].split("/");
        if (!owner || !repo) {
            return c.json({ error: "Could not extract owner/repo from URL" }, 400);
        }

        const headers: Record<string, string> = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "iTECify-App"
        };
        
        if (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN !== "undefined") {
            headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
        }

        const ghResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits`, { headers });

        if (!ghResponse.ok) {
            return c.json({ error: `GitHub API error: ${ghResponse.statusText}` }, 500);
        }

        const commitsData = await ghResponse.json() as any[];

        const parsedCommits = commitsData.slice(0, 50).map((commitItem: any) => ({
            sha: commitItem.sha,
            message: commitItem.commit?.message?.split("\n")[0] || "No message",
            author: {
                name: commitItem.commit?.author?.name || "Unknown",
                avatar: commitItem.author?.avatar_url || null
            },
            date: commitItem.commit?.author?.date || null
        }));

        return c.json({ success: true, commits: parsedCommits }, 200);

    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

export default projectsRoutes;

import { Hono } from "hono";
import { authMiddleware } from "../middleware/authMiddleware";
import { db } from "../db";
import { projects, files } from "../db/schema";
import { eq } from "drizzle-orm";
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

export default projectsRoutes;

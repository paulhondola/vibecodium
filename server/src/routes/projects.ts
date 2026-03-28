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

		const projectId = new mongoose.Types.ObjectId().toString();
		const targetDir = `/tmp/vibecodium/${projectId}`;

		console.log(`Cloning ${repoUrl} to ${targetDir}...`);
        
        fs.mkdirSync("/tmp/vibecodium", { recursive: true });

		const proc = Bun.spawn(["git", "clone", repoUrl, targetDir], {
            stdout: "pipe",
            stderr: "pipe"
        });

		const exitCode = await proc.exited;

        if (exitCode !== 0) {
            const errorText = await new Response(proc.stderr).text();
            return c.json({ error: `Failed to clone repository: ${errorText}` }, 500);
        }

        const allFiles = getAllFilesRecursive(targetDir, targetDir);

        const projectName = repoUrl.split("/").pop()?.replace(".git", "") || "Untitled";
        
        await Project.create({
            _id: projectId,
            userId: userId,
            name: projectName,
            repoUrl: repoUrl
        });

        // Maximum chunk sizes roughly to 100 on sqlite batching
        const BATCH_SIZE = 100;
        for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
            const batch = allFiles.slice(i, i + BATCH_SIZE);
            const filesToInsert = batch.map((f) => ({
                id: crypto.randomUUID(),
                projectId: projectId,
                path: f.path,
                content: f.content
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

        return c.json({ success: true, files: projectFiles });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export default projectsRoutes;

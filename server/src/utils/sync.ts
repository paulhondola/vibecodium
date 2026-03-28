import * as fs from "node:fs";
import * as path from "node:path";
import { db } from "../db";
import { files } from "../db/schema";
import { eq } from "drizzle-orm";

export async function syncProjectFilesToDisk(projectId: string): Promise<string> {
    const targetDir = `/tmp/vibecodium/${projectId}`;

    // Ensure directory exists
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    // Fetch all files from the DB for this project
    const projectFiles = await db.select({
        path: files.path,
        content: files.content,
        updatedAt: files.updatedAt
    })
    .from(files)
    .where(eq(files.projectId, projectId));

    // For absolute sandboxing correctly, we could delete files from disk not present in the DB,
    // but for now, we'll overwrite / write all DB files to disk.
    for (const f of projectFiles) {
        if (!f.content) continue; // Skip empty/null content
        
        const fullPath = path.join(targetDir, f.path);
        const dir = path.dirname(fullPath);

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // We could compare the content or timestamp before writing,
        // but writing is fast and guarantees sync.
        fs.writeFileSync(fullPath, f.content, "utf-8");
    }

    return targetDir;
}

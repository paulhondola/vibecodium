import * as fs from "node:fs";
import * as path from "node:path";
import { supabase } from "../db/supabase";

export async function syncProjectFilesToDisk(projectId: string): Promise<string> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
    if (!isUuid) {
        throw new Error(`syncProjectFilesToDisk: invalid project id (not a UUID): "${projectId}"`);
    }

    const targetDir = `/tmp/vibecodium/${projectId}`;

    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    const { data: projectFiles, error } = await supabase
        .from("files")
        .select("path, content, updated_at")
        .eq("project_id", projectId);

    if (error) throw new Error(`syncProjectFilesToDisk: ${error.message}`);

    for (const f of projectFiles ?? []) {
        if (!f.content) continue;
        const fullPath = path.join(targetDir, f.path);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fullPath, f.content, "utf-8");
    }

    return targetDir;
}

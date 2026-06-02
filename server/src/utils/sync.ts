import * as fs from "node:fs";
import * as path from "node:path";
import { supabase } from "../db/supabase";

/**
 * Sync files from Supabase to disk.
 *
 * By default, uses timestamp-aware sync: only overwrites files whose
 * Supabase `updated_at` is newer than the file's mtime on disk.
 * This preserves Git index state (staged / unstaged) for files that
 * haven't changed since the last sync.
 *
 * Pass `force: true` to unconditionally overwrite every file
 * (used during initial clone / full re-sync).
 */
export async function syncProjectFilesToDisk(
	projectId: string,
	opts?: { force?: boolean }
): Promise<string> {
	const targetDir = `/tmp/vibecodium/${projectId}`;
	const force = opts?.force ?? false;

	if (!fs.existsSync(targetDir)) {
		fs.mkdirSync(targetDir, { recursive: true });
	}

	const { data: projectFiles, error } = await supabase
		.from("files")
		.select("path, content, updated_at")
		.eq("project_id", projectId);

	if (error) throw new Error(`syncProjectFilesToDisk: ${error.message}`);

	for (const f of projectFiles ?? []) {
		if (!f.content && f.content !== "") continue;
		const fullPath = path.join(targetDir, f.path);
		const dir = path.dirname(fullPath);
		if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

		if (!force && fs.existsSync(fullPath)) {
			// Compare content instead of timestamps to avoid clock drift issues
			// between the backend server mtime and Supabase updated_at.
			const diskContent = fs.readFileSync(fullPath, "utf-8");
			if (diskContent === f.content) continue;
		}

		fs.writeFileSync(fullPath, f.content ?? "", "utf-8");
	}

	return targetDir;
}

// Ensures targetDir has a valid .git repo. Re-clones from GitHub if missing,
// then re-applies the latest files from Supabase on top (they may be ahead of GitHub).
export async function ensureGitRepo(
	projectId: string,
	repoUrl: string,
	githubToken?: string
): Promise<string> {
	const targetDir = `/tmp/vibecodium/${projectId}`;
	const gitDir = path.join(targetDir, ".git");

	if (!fs.existsSync(gitDir)) {
		if (fs.existsSync(targetDir)) {
			fs.rmSync(targetDir, { recursive: true, force: true });
		}
		const cloneUrl =
			githubToken &&
			githubToken !== "undefined" &&
			repoUrl.startsWith("https://github.com/")
				? repoUrl.replace(
						"https://github.com/",
						`https://${githubToken}@github.com/`
					)
				: repoUrl;

		const cloneProc = Bun.spawn(["git", "clone", cloneUrl, targetDir], {
			stdout: "pipe",
			stderr: "pipe",
		});
		if ((await cloneProc.exited) !== 0) {
			// Fallback: bare init so subsequent git commands don't crash
			fs.mkdirSync(targetDir, { recursive: true });
			const initProc = Bun.spawn(["git", "init"], { cwd: targetDir });
			await initProc.exited;
			const remoteProc = Bun.spawn(
				["git", "remote", "add", "origin", repoUrl],
				{ cwd: targetDir }
			);
			await remoteProc.exited;
		}

		// First clone — force-write all files from Supabase
		return await syncProjectFilesToDisk(projectId, { force: true });
	}

	// Repo already exists — timestamp-aware sync (preserves staging state)
	return await syncProjectFilesToDisk(projectId);
}

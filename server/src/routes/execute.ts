import { Hono } from "hono";
import { Writable } from "stream";
import { docker } from "../utils/docker";
import { syncProjectFilesToDisk } from "../utils/sync";
import { authMiddleware } from "../middleware/authMiddleware";
import { supabase } from "../db/supabase";
import type { ExecuteRequest, ExecuteResponse } from "shared";

type Variables = { user: Record<string, any> };
const executeRoutes = new Hono<{ Variables: Variables }>();

executeRoutes.use("/*", authMiddleware);

function isSafeFilePath(file: string): boolean {
	return (
		/^[a-zA-Z0-9._\-/]+$/.test(file) &&
		!file.includes("..") &&
		!file.startsWith("/")
	);
}

const LANGUAGE_IMAGES: Record<string, string> = {
	python: "vibecodium-python:latest",
	node: "vibecodium-node:latest",
	"c++": "vibecodium-cpp:latest",
	rust: "vibecodium-rust:latest",
};

const EXEC_COMMANDS: Record<string, () => string[]> = {
	python: () => [
		"python",
		"-c",
		"import os\nexec(os.environ.get('USER_CODE', ''))",
	],
	node: () => ["node", "-e", "eval(process.env.USER_CODE)"],
	"c++": () => [
		"sh",
		"-c",
		"printenv USER_CODE > main.cpp && g++ main.cpp && ./a.out",
	],
	rust: () => [
		"sh",
		"-c",
		"printenv USER_CODE > main.rs && rustc main.rs && ./main",
	],
};

executeRoutes.post("/", async (c) => {
	try {
		const user = c.get("user");
		const body = await c.req.json<ExecuteRequest>();
		if (!body.language || !body.version || !body.code)
			return c.json<ExecuteResponse>(
				{
					success: false,
					stdout: "",
					stderr: "",
					error: "Missing language, version, or code.",
				},
				400,
			);

		const imageName = LANGUAGE_IMAGES[body.language];
		const getCmd = EXEC_COMMANDS[body.language];
		if (!imageName || !getCmd)
			return c.json<ExecuteResponse>(
				{
					success: false,
					stdout: "",
					stderr: "",
					error: `Unsupported language: ${body.language}`,
				},
				400,
			);

		let cmd = getCmd();
		let hostConfig: any = { Memory: 2048 * 1024 * 1024, NetworkMode: "none" };

		if (body.projectId && body.entryFile) {
			if (!isSafeFilePath(body.entryFile)) {
				return c.json<ExecuteResponse>(
					{
						success: false,
						stdout: "",
						stderr: "",
						error: "Invalid entry file path.",
					},
					400,
				);
			}

			const { data: project } = await supabase
				.from("projects")
				.select("user_id")
				.eq("id", body.projectId)
				.maybeSingle();

			if (!project || project.user_id !== user.sub) {
				return c.json<ExecuteResponse>(
					{
						success: false,
						stdout: "",
						stderr: "",
						error: "Project not found.",
					},
					404,
				);
			}

			const targetDir = await syncProjectFilesToDisk(body.projectId);
			hostConfig.Binds = [`${targetDir}:/app`];
			if (body.language === "node") cmd = ["node", `/app/${body.entryFile}`];
			if (body.language === "python")
				cmd = ["python", `/app/${body.entryFile}`];
			// Use positional argument to avoid shell injection
			if (body.language === "c++")
				cmd = [
					"sh",
					"-c",
					'cd /app && g++ "$1" && ./a.out',
					"--",
					body.entryFile,
				];
			if (body.language === "rust")
				cmd = [
					"sh",
					"-c",
					'cd /app && rustc "$1" && ./main',
					"--",
					body.entryFile,
				];
		}

		const container = await docker.createContainer({
			Image: imageName,
			Cmd: cmd,
			Env: [`USER_CODE=${body.code}`],
			HostConfig: hostConfig,
			Tty: false,
		});

		try {
			const stream = await container.attach({
				stream: true,
				stdout: true,
				stderr: true,
			});
			let stdoutData = "";
			let stderrData = "";
			container.modem.demuxStream(
				stream,
				new Writable({
					write(c, e, n) {
						stdoutData += c.toString();
						n();
					},
				}),
				new Writable({
					write(c, e, n) {
						stderrData += c.toString();
						n();
					},
				}),
			);
			await container.start();

			const waitPromise = container.wait();
			let timeoutTrigged = false;
			const timeoutPromise = new Promise<{ StatusCode: number }>((resolve) =>
				setTimeout(() => {
					timeoutTrigged = true;
					resolve({ StatusCode: 137 });
				}, 3000),
			);

			const waitResult = await Promise.race([waitPromise, timeoutPromise]);
			if (timeoutTrigged) {
				await container.kill().catch(() => {});
				return c.json<ExecuteResponse>({
					success: false,
					stdout: stdoutData,
					stderr: stderrData,
					error: "Execution Timeout: Killed.",
				});
			}
			return c.json<ExecuteResponse>({
				success: waitResult.StatusCode === 0,
				stdout: stdoutData,
				stderr: stderrData,
				compileOutput: "",
			});
		} finally {
			await container.remove({ force: true }).catch(() => {});
		}
	} catch (err: any) {
		console.error(err);
		if (err.statusCode === 404)
			return c.json<ExecuteResponse>(
				{
					success: false,
					stdout: "",
					stderr: "",
					error: "Docker image missing!",
				},
				500,
			);
		return c.json<ExecuteResponse>(
			{
				success: false,
				stdout: "",
				stderr: "",
				error: "Internal Error executing code.",
			},
			500,
		);
	}
});

export default executeRoutes;

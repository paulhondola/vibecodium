import { Hono } from "hono";
import { Writable } from "stream";
import { docker } from "../utils/docker";
import { syncProjectFilesToDisk } from "../utils/sync";
import type { ExecuteRequest, ExecuteResponse } from "shared";

const executeRoutes = new Hono();

const LANGUAGE_IMAGES: Record<string, string> = {
	python: "vibecodium-python:latest",
	node: "vibecodium-node:latest",
	"c++": "vibecodium-cpp:latest",
	rust: "vibecodium-rust:latest"
};

const EXEC_COMMANDS: Record<string, () => string[]> = {
	python: () => ["python", "-c", "import os\nexec(os.environ.get('USER_CODE', ''))"],
	node: () => ["node", "-e", "eval(process.env.USER_CODE)"],
	"c++": () => ["sh", "-c", "printenv USER_CODE > main.cpp && g++ main.cpp && ./a.out"],
	rust: () => ["sh", "-c", "printenv USER_CODE > main.rs && rustc main.rs && ./main"] 
};

executeRoutes.post("/", async (c) => {
    try {
        const body = await c.req.json<ExecuteRequest>();
        if (!body.language || !body.version || !body.code) return c.json<ExecuteResponse>({ success: false, stdout: "", stderr: "", error: "Missing language, version, or code." }, 400);

        const imageName = LANGUAGE_IMAGES[body.language];
        const getCmd = EXEC_COMMANDS[body.language];
        if (!imageName || !getCmd) return c.json<ExecuteResponse>({ success: false, stdout: "", stderr: "", error: `Unsupported language: ${body.language}` }, 400);

        let cmd = getCmd();
        let hostConfig: any = { Memory: 2048 * 1024 * 1024, NetworkMode: "none" };
        const reqBody = body as any;
        
        if (reqBody.projectId && reqBody.entryFile) {
            const targetDir = await syncProjectFilesToDisk(reqBody.projectId);
            hostConfig.Binds = [`${targetDir}:/app`];
            if (body.language === "node") cmd = ["node", `/app/${reqBody.entryFile}`];
            if (body.language === "python") cmd = ["python", `/app/${reqBody.entryFile}`];
            if (body.language === "c++") cmd = ["sh", "-c", `cd /app && g++ ${reqBody.entryFile} && ./a.out`];
            if (body.language === "rust") cmd = ["sh", "-c", `cd /app && rustc ${reqBody.entryFile} && ./main`];
        }

        const container = await docker.createContainer({
            Image: imageName, Cmd: cmd, Env: [`USER_CODE=${body.code}`],
            HostConfig: hostConfig, Tty: false
        });

        try {
            const stream = await container.attach({ stream: true, stdout: true, stderr: true });
            let stdoutData = ""; let stderrData = "";
            container.modem.demuxStream(stream, new Writable({ write(c, e, n) { stdoutData += c.toString(); n(); } }), new Writable({ write(c, e, n) { stderrData += c.toString(); n(); } }));
            await container.start();

            const waitPromise = container.wait();
            let timeoutTrigged = false;
            const timeoutPromise = new Promise<{ StatusCode: number }>((resolve) => setTimeout(() => { timeoutTrigged = true; resolve({ StatusCode: 137 }); }, 3000));
            
            const waitResult = await Promise.race([waitPromise, timeoutPromise]);
            if (timeoutTrigged) {
                await container.kill().catch(() => {});
                return c.json<ExecuteResponse>({ success: false, stdout: stdoutData, stderr: stderrData, error: "Execution Timeout: Killed." });
            }
            return c.json<ExecuteResponse>({ success: waitResult.StatusCode === 0, stdout: stdoutData, stderr: stderrData, compileOutput: "" });
        } finally {
            await container.remove({ force: true }).catch(() => {});
        }
    } catch (err: any) {
        console.error(err);
        if (err.statusCode === 404) return c.json<ExecuteResponse>({ success: false, stdout: "", stderr: "", error: "Docker image missing!" }, 500);
        return c.json<ExecuteResponse>({ success: false, stdout: "", stderr: "", error: "Internal Error executing code." }, 500);
    }
});

export default executeRoutes;

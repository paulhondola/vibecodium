import { Hono } from "hono";
import { db } from "../db";
import { files } from "../db/schema";
import { eq } from "drizzle-orm";
import { scanCode } from "../security/scanner";
import { rooms, broadcast } from "../ws/collaboration";
import { connectMongo } from "../db/mongoose";
import { Project } from "../db/models/Project";

const deployRoutes = new Hono();

const VERCEL_API = "https://api.vercel.com";

deployRoutes.post("/:projectId", async (c) => {
    const projectId = c.req.param("projectId");
    const token = process.env.VERCEL_TOKEN;

    if (!token) {
        return c.json({ error: "VERCEL_TOKEN is not configured in .env" }, 500);
    }

    const room = rooms.get(projectId);
    const sendLog = (message: string, type: "info" | "error" | "success" = "info") => {
        console.log(`[Deploy] ${message}`);
        if (room) {
            broadcast(room, {
                type: "terminal_output",
                data: `\r\n\x1b[36m[ShipToCloud]\x1b[0m ${type === "error" ? "\x1b[31m" : type === "success" ? "\x1b[32m" : ""}${message}\x1b[0m\r\n`
            });
        }
    };

    try {
        sendLog("🚀 Starting deployment to Vercel...");

        // 1. Collect files from DB
        sendLog("📦 Collecting project files...");
        const projectFiles = await db.select().from(files).where(eq(files.projectId, projectId));
        if (projectFiles.length === 0) throw new Error("No files found for this project.");

        await connectMongo();
        const projectRow = await Project.findById(projectId).select("projectName repoUrl");
        if (!projectRow) throw new Error("Project not found in database.");
        const projectName = projectRow.projectName
            || projectRow.repoUrl?.split("/").pop()?.replace(".git", "")
            || "itecify-app";

        // 2. Security scan
        sendLog("🛡️ Running pre-deploy security scan...");
        const scanResult = await scanCode(projectFiles.map(f => ({ path: f.path, content: f.content || "" })));
        if (!scanResult.safe) {
            const criticals = scanResult.vulnerabilities.filter(v => v.severity === "critical" || v.severity === "high");
            sendLog(`❌ Security scan failed: ${criticals.length} high/critical vulnerabilities found.`, "error");
            return c.json({ success: false, error: "Security scan failed", vulnerabilities: criticals }, 400);
        }
        sendLog("✅ Security scan passed.");

        // 3. Build Vercel file list — files are sent inline as base64 or utf8
        sendLog("📡 Preparing files for Vercel...");
        const vercelFiles = projectFiles.map(f => ({
            file: f.path,
            data: Buffer.from(f.content || "").toString("base64"),
            encoding: "base64",
        }));

        // 4. Verify token is valid
        const meRes = await fetch(`${VERCEL_API}/v2/user`, {
            headers: { "Authorization": `Bearer ${token}` },
        });
        const meData = await meRes.json() as any;
        if (!meRes.ok) {
            throw new Error(`Invalid VERCEL_TOKEN: ${meData?.error?.message ?? meRes.status}`);
        }
        sendLog(`✅ Authenticated as ${meData.user?.email ?? meData.user?.username}`);

        // 5. Deploy to Vercel via API
        sendLog("☁️ Deploying to Vercel...");
        const safeName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 52);

        const teamId = process.env.VERCEL_TEAM_ID;
        const params = new URLSearchParams({ skipAutoDetectionConfirmation: "1" });
        if (teamId) params.set("teamId", teamId);
        const deployUrl = `${VERCEL_API}/v13/deployments?${params}`;

        const deployRes = await fetch(deployUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: safeName,
                files: vercelFiles,
            }),
        });

        const deployData = await deployRes.json() as any;

        if (!deployRes.ok) {
            console.error("[Deploy] Vercel error response:", JSON.stringify(deployData, null, 2));
            const errMsg = deployData?.error?.message ?? JSON.stringify(deployData);
            throw new Error(`Vercel deployment failed (${deployRes.status}): ${errMsg}`);
        }

        const liveUrl = `https://${deployData.url}`;
        sendLog(`✨ Deployment successful! Live at: ${liveUrl}`, "success");

        return c.json({
            success: true,
            url: liveUrl,
            deploymentId: deployData.id,
            message: "Project deployed to Vercel!",
        });

    } catch (err: any) {
        sendLog(`❌ Deployment failed: ${err.message}`, "error");
        return c.json({ success: false, error: err.message }, 500);
    }
});

export default deployRoutes;

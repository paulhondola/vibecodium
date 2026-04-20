import { Hono } from "hono";
import { supabase } from "../db/supabase";
import { scanCode } from "../security/scanner";
import { rooms, broadcast } from "../ws/collaboration";
import { getUserTokens } from "../utils/tokens";
import { authMiddleware } from "../middleware/authMiddleware";

const deployRoutes = new Hono();

// Require authenticated Supabase session but skip OPTIONS preflight
deployRoutes.use("/*", async (c, next) => {
    if (c.req.method === "OPTIONS") return next();
    return authMiddleware(c, next);
});

const VERCEL_API = "https://api.vercel.com";

deployRoutes.post("/:projectId", async (c) => {
    const projectId = c.req.param("projectId");
    const user = (c.get as any)("user");
    const userId = user?.sub;

    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const tokens = await getUserTokens(userId);
    const token = tokens.vercelToken || process.env.VERCEL_TOKEN;

    if (!token) {
        return c.json({
            success: false,
            error: "VERCEL_TOKEN_REQUIRED",
            message: "You need to register your Vercel Token in your profile to deploy websites.",
        }, 403);
    }

    const room = rooms.get(projectId);
    const sendLog = (message: string, type: "info" | "error" | "success" = "info") => {
        console.log(`[Deploy] ${message}`);
        if (room) {
            broadcast(room, {
                type: "terminal_output",
                data: `\r\n\x1b[36m[ShipToCloud]\x1b[0m ${type === "error" ? "\x1b[31m" : type === "success" ? "\x1b[32m" : ""}${message}\x1b[0m\r\n`,
            });
        }
    };

    try {
        sendLog("🚀 Starting deployment to Vercel...");

        // 1. Collect files
        sendLog("📦 Collecting project files...");
        const { data: projectFiles, error: fErr } = await supabase
            .from("files")
            .select("path, content")
            .eq("project_id", projectId);
        if (fErr) throw fErr;
        if (!projectFiles?.length) throw new Error("No files found for this project.");

        const { data: projectRow, error: pErr } = await supabase
            .from("projects")
            .select("project_name, repo_url")
            .eq("id", projectId)
            .maybeSingle();
        if (pErr) throw pErr;
        if (!projectRow) throw new Error("Project not found in database.");

        const projectName =
            projectRow.project_name ||
            projectRow.repo_url?.split("/").pop()?.replace(".git", "") ||
            "vibecodium-app";

        // 2. Security scan
        sendLog("🛡️ Running pre-deploy security scan...");
        const scanResult = await scanCode(projectFiles.map((f) => ({ path: f.path, content: f.content || "" })));
        if (!scanResult.safe) {
            const criticals = scanResult.vulnerabilities.filter((v) => v.severity === "critical" || v.severity === "high");
            sendLog(`❌ Security scan failed: ${criticals.length} high/critical vulnerabilities found.`, "error");
            return c.json({ success: false, error: "Security scan failed", vulnerabilities: criticals }, 400);
        }
        sendLog("✅ Security scan passed.");

        // 3. Build Vercel file list
        sendLog("📡 Preparing files for Vercel...");
        const vercelFiles = projectFiles.map((f) => ({
            file: f.path,
            data: Buffer.from(f.content || "").toString("base64"),
            encoding: "base64",
        }));

        // 4. Verify Vercel token
        const meRes = await fetch(`${VERCEL_API}/v2/user`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const meData = await meRes.json() as any;
        if (!meRes.ok) throw new Error(`Invalid VERCEL_TOKEN: ${meData?.error?.message ?? meRes.status}`);
        sendLog(`✅ Authenticated as ${meData.user?.email ?? meData.user?.username}`);

        // 5. Deploy
        sendLog("☁️ Deploying to Vercel...");
        const safeName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 52);
        const teamId = process.env.VERCEL_TEAM_ID;
        const params = new URLSearchParams({ skipAutoDetectionConfirmation: "1" });
        if (teamId) params.set("teamId", teamId);

        const deployRes = await fetch(`${VERCEL_API}/v13/deployments?${params}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ name: safeName, files: vercelFiles }),
        });

        const deployData = await deployRes.json() as any;
        if (!deployRes.ok) {
            console.error("[Deploy] Vercel error response:", JSON.stringify(deployData, null, 2));
            const errMsg = deployData?.error?.message ?? JSON.stringify(deployData);
            throw new Error(`Vercel deployment failed (${deployRes.status}): ${errMsg}`);
        }

        const liveUrl = `https://${deployData.url}`;
        sendLog(`✨ Deployment successful! Live at: ${liveUrl}`, "success");

        // Persist deployment record
        await supabase.from("deployed_apps").insert({
            user_id: userId,
            title: projectName,
            project_repo: projectRow.repo_url || "",
            project_link: liveUrl,
        });

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

// GET /api/deployments — list all deployments for the authenticated user
deployRoutes.get("/", async (c) => {
    const user = (c.get as any)("user");
    const userId = user?.sub;
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const { data: apps, error } = await supabase
        .from("deployed_apps")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, apps: apps ?? [] });
});

export default deployRoutes;

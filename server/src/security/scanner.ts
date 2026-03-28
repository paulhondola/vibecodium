// Security Scanner for iTEC 2026 - Live Vulnerability Detection
// Blocks dangerous code before container execution

export interface VulnerabilityMatch {
	pattern: string;
	severity: "critical" | "high" | "medium" | "low";
	description: string;
	line?: number;
	code?: string;
	recommendation: string;
}

export interface ScanResult {
	safe: boolean;
	vulnerabilities: VulnerabilityMatch[];
	scannedFiles: number;
	scannedLines: number;
	scanDuration: number; // ms
}

// Comprehensive vulnerability patterns
const VULNERABILITY_PATTERNS: Array<{
	regex: RegExp;
	severity: "critical" | "high" | "medium" | "low";
	description: string;
	recommendation: string;
}> = [
	// === CRITICAL: System Destruction ===
	{
		regex: /rm\s+-rf\s+[/~]/,
		severity: "critical",
		description: "Recursive deletion of system directories",
		recommendation: "Remove dangerous rm -rf commands",
	},
	{
		regex: /mkfs\s/,
		severity: "critical",
		description: "Filesystem formatting command",
		recommendation: "Remove filesystem formatting operations",
	},
	{
		regex: /shred\s/,
		severity: "critical",
		description: "File shredding/destruction",
		recommendation: "Remove file destruction commands",
	},
	{
		regex: />\s*\/dev\/sd[a-z]/,
		severity: "critical",
		description: "Direct disk device write",
		recommendation: "Do not write directly to disk devices",
	},

	// === CRITICAL: Resource Exhaustion ===
	{
		regex: /:\(\)\s*\{\s*:\s*\|\s*:.*\}/,
		severity: "critical",
		description: "Fork bomb detected",
		recommendation: "Remove fork bomb pattern",
	},
	{
		regex: /while\s*\(\s*true\s*\)|while\s*\(\s*1\s*\)|for\s*\(\s*;\s*;\s*\)/,
		severity: "high",
		description: "Infinite loop without exit condition",
		recommendation: "Add proper loop termination conditions",
	},
	{
		regex: /dd\s+if=\/dev\/(zero|urandom|random)/,
		severity: "high",
		description: "Potential memory/disk exhaustion",
		recommendation: "Avoid reading from /dev/zero or /dev/urandom in loops",
	},

	// === HIGH: Command Injection ===
	{
		regex: /os\.system\s*\(/,
		severity: "high",
		description: "os.system() allows arbitrary command execution",
		recommendation: "Use subprocess.run() with shell=False instead",
	},
	{
		regex: /eval\s*\(/,
		severity: "high",
		description: "eval() executes arbitrary code",
		recommendation: "Avoid eval(), use safer alternatives like JSON.parse()",
	},
	{
		regex: /exec\s*\(/,
		severity: "high",
		description: "exec() executes arbitrary code",
		recommendation: "Avoid exec(), use explicit function calls",
	},
	{
		regex: /child_process\.(exec|spawn)\s*\(/,
		severity: "high",
		description: "Unvalidated shell command execution",
		recommendation: "Validate and sanitize all inputs before executing commands",
	},
	{
		regex: /subprocess\.(call|check_output|Popen)\s*\(.*shell\s*=\s*True/,
		severity: "high",
		description: "Shell command injection vulnerability",
		recommendation: "Set shell=False and pass command as array",
	},

	// === HIGH: Path Traversal ===
	{
		regex: /\.\.[\/\\]/,
		severity: "high",
		description: "Path traversal pattern detected",
		recommendation: "Sanitize file paths to prevent directory traversal",
	},
	{
		regex: /open\s*\(\s*[^)]*\+\s*[^)]*\)/,
		severity: "medium",
		description: "Dynamic file path construction",
		recommendation: "Validate user input before constructing file paths",
	},

	// === MEDIUM: SQL Injection ===
	{
		regex: /execute\s*\(\s*["`'].*%s.*["`']\s*%/,
		severity: "medium",
		description: "Potential SQL injection via string formatting",
		recommendation: "Use parameterized queries instead",
	},
	{
		regex: /query\s*\(\s*["`'].*\+.*["`']\s*\)/,
		severity: "medium",
		description: "SQL query string concatenation",
		recommendation: "Use prepared statements with placeholders",
	},

	// === MEDIUM: Hardcoded Secrets ===
	{
		regex: /password\s*=\s*["`'][^"`']+["`']/i,
		severity: "medium",
		description: "Hardcoded password detected",
		recommendation: "Use environment variables for credentials",
	},
	{
		regex: /api[_-]?key\s*=\s*["`'][^"`']+["`']/i,
		severity: "medium",
		description: "Hardcoded API key detected",
		recommendation: "Store API keys in environment variables",
	},
	{
		regex: /secret\s*=\s*["`'][^"`']+["`']/i,
		severity: "medium",
		description: "Hardcoded secret detected",
		recommendation: "Use secure secret management",
	},
	{
		regex: /(sk|pk)_live_[a-zA-Z0-9]{24,}/,
		severity: "high",
		description: "Stripe API key exposed",
		recommendation: "Remove API key and rotate immediately",
	},
	{
		regex: /ghp_[a-zA-Z0-9]{36}/,
		severity: "high",
		description: "GitHub personal access token exposed",
		recommendation: "Remove token and regenerate",
	},

	// === MEDIUM: Network Security ===
	{
		regex: /verify\s*=\s*False/,
		severity: "medium",
		description: "SSL certificate verification disabled",
		recommendation: "Enable SSL verification for production code",
	},
	{
		regex: /0\.0\.0\.0/,
		severity: "low",
		description: "Binding to all network interfaces",
		recommendation: "Bind to localhost (127.0.0.1) for development",
	},

	// === LOW: Deprecated/Unsafe Functions ===
	{
		regex: /pickle\.loads?\s*\(/,
		severity: "medium",
		description: "Pickle deserialization can execute arbitrary code",
		recommendation: "Use JSON for serialization instead",
	},
	{
		regex: /yaml\.load\s*\(/,
		severity: "medium",
		description: "Unsafe YAML loading",
		recommendation: "Use yaml.safe_load() instead",
	},
	{
		regex: /innerHTML\s*=/,
		severity: "medium",
		description: "Potential XSS vulnerability",
		recommendation: "Use textContent or DOM methods instead",
	},
	{
		regex: /dangerouslySetInnerHTML/,
		severity: "medium",
		description: "React XSS risk",
		recommendation: "Sanitize HTML before rendering",
	},
];

export async function scanCode(
	files: Array<{ path: string; content: string }>
): Promise<ScanResult> {
	const startTime = Date.now();
	const vulnerabilities: VulnerabilityMatch[] = [];
	let totalLines = 0;

	for (const file of files) {
		if (!file.content) continue;

		const lines = file.content.split("\n");
		totalLines += lines.length;

		// Scan each line against all patterns
		lines.forEach((line, lineIndex) => {
			for (const pattern of VULNERABILITY_PATTERNS) {
				const match = pattern.regex.exec(line);
				if (match) {
					vulnerabilities.push({
						pattern: pattern.regex.source,
						severity: pattern.severity,
						description: `${file.path}:${lineIndex + 1} - ${pattern.description}`,
						line: lineIndex + 1,
						code: line.trim(),
						recommendation: pattern.recommendation,
					});
				}
			}
		});
	}

	const scanDuration = Date.now() - startTime;

	// Sort by severity (critical first)
	const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
	vulnerabilities.sort(
		(a, b) => severityOrder[a.severity] - severityOrder[b.severity]
	);

	return {
		safe: vulnerabilities.filter((v) => v.severity === "critical" || v.severity === "high").length === 0,
		vulnerabilities,
		scannedFiles: files.length,
		scannedLines: totalLines,
		scanDuration,
	};
}

// LLM-based advanced scanning (optional fallback)
export async function scanWithLLM(
	code: string,
	llmBaseUrl: string,
	llmKey: string,
	llmModel: string
): Promise<{ safe: boolean; analysis: string }> {
	try {
		const response = await fetch(`${llmBaseUrl}/chat/completions`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${llmKey}`,
			},
			body: JSON.stringify({
				model: llmModel,
				messages: [
					{
						role: "system",
						content:
							"You are a security expert. Analyze code for vulnerabilities. Reply with JSON: {safe: boolean, issues: string[]}",
					},
					{
						role: "user",
						content: `Analyze this code for security issues:\n\n${code.slice(0, 2000)}`,
					},
				],
				temperature: 0.1,
				max_tokens: 500,
			}),
			signal: AbortSignal.timeout(10_000),
		});

		if (!response.ok) {
			throw new Error("LLM API failed");
		}

		const data = (await response.json()) as {
			choices: { message: { content: string } }[];
		};
		const analysis = data.choices[0]?.message?.content || "{}";

		try {
			const parsed = JSON.parse(analysis);
			return { safe: parsed.safe ?? true, analysis: analysis };
		} catch {
			return { safe: true, analysis: "Unable to parse LLM response" };
		}
	} catch (error) {
		console.error("LLM scanning failed:", error);
		return { safe: true, analysis: "LLM scan unavailable" };
	}
}

// Quick check for critical patterns only (fast)
export function hasCriticalVulnerability(content: string): boolean {
	return VULNERABILITY_PATTERNS.filter((p) => p.severity === "critical").some(
		(pattern) => pattern.regex.test(content)
	);
}

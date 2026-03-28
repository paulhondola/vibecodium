import { X, Shield, AlertTriangle, AlertCircle, Info, CheckCircle, Loader2 } from "lucide-react";
import { useState } from "react";

interface VulnerabilityMatch {
	pattern: string;
	severity: "critical" | "high" | "medium" | "low";
	description: string;
	line?: number;
	code?: string;
	recommendation: string;
}

interface ScanResult {
	safe: boolean;
	vulnerabilities: VulnerabilityMatch[];
	scannedFiles: number;
	scannedLines: number;
	scanDuration: number;
}

interface SecurityScanModalProps {
	onClose: () => void;
	projectId: string | null;
	token: string | null;
}

export default function SecurityScanModal({ onClose, projectId, token }: SecurityScanModalProps) {
	const [scanResult, setScanResult] = useState<ScanResult | null>(null);
	const [isScanning, setIsScanning] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const runScan = async () => {
		if (!projectId || !token) {
			setError("Project ID or token missing");
			return;
		}

		setIsScanning(true);
		setError(null);

		try {
			const res = await fetch("http://localhost:3000/api/scan", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ projectId }),
			});

			const data = await res.json();

			if (data.success) {
				setScanResult(data.scan);
			} else {
				setError(data.error || "Scan failed");
			}
		} catch (err: any) {
			setError(err.message || "Network error");
		} finally {
			setIsScanning(false);
		}
	};

	const getSeverityIcon = (severity: string) => {
		switch (severity) {
			case "critical":
				return <AlertCircle size={16} className="text-red-500" />;
			case "high":
				return <AlertTriangle size={16} className="text-orange-500" />;
			case "medium":
				return <AlertTriangle size={16} className="text-yellow-500" />;
			case "low":
				return <Info size={16} className="text-blue-500" />;
			default:
				return null;
		}
	};

	const getSeverityColor = (severity: string) => {
		switch (severity) {
			case "critical":
				return "bg-red-500/10 border-red-500/30 text-red-400";
			case "high":
				return "bg-orange-500/10 border-orange-500/30 text-orange-400";
			case "medium":
				return "bg-yellow-500/10 border-yellow-500/30 text-yellow-400";
			case "low":
				return "bg-blue-500/10 border-blue-500/30 text-blue-400";
			default:
				return "";
		}
	};

	const critical = scanResult?.vulnerabilities.filter((v) => v.severity === "critical").length || 0;
	const high = scanResult?.vulnerabilities.filter((v) => v.severity === "high").length || 0;
	const medium = scanResult?.vulnerabilities.filter((v) => v.severity === "medium").length || 0;
	const low = scanResult?.vulnerabilities.filter((v) => v.severity === "low").length || 0;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
			<div className="bg-[#09090b] border border-[#27272a] rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
				{/* Header */}
				<div className="flex items-center justify-between p-4 border-b border-[#27272a] bg-[#18181b]">
					<div className="flex items-center gap-2">
						<Shield size={20} className="text-cyan-400" />
						<h2 className="font-bold text-lg">Security Scan</h2>
					</div>
					<button
						onClick={onClose}
						className="hover:bg-[#27272a] p-1 rounded transition-colors"
					>
						<X size={20} />
					</button>
				</div>

				{/* Content */}
				<div className="flex-1 overflow-auto p-6">
					{!scanResult && !isScanning && !error && (
						<div className="flex flex-col items-center justify-center h-full gap-4 text-center">
							<Shield size={64} className="text-cyan-400 opacity-50" />
							<p className="text-gray-400">
								Run a comprehensive security scan to detect vulnerabilities in your project code.
							</p>
							<button
								onClick={runScan}
								className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded font-bold hover:scale-105 transition-transform"
							>
								Start Scan
							</button>
						</div>
					)}

					{isScanning && (
						<div className="flex flex-col items-center justify-center h-full gap-4">
							<Loader2 size={48} className="animate-spin text-cyan-400" />
							<p className="text-gray-400">Scanning project files...</p>
						</div>
					)}

					{error && (
						<div className="flex flex-col items-center justify-center h-full gap-4">
							<AlertCircle size={48} className="text-red-400" />
							<p className="text-red-400">{error}</p>
							<button
								onClick={runScan}
								className="px-4 py-2 bg-[#27272a] hover:bg-[#3f3f46] text-white rounded transition-colors"
							>
								Retry
							</button>
						</div>
					)}

					{scanResult && (
						<div className="flex flex-col gap-4">
							{/* Summary */}
							<div className="grid grid-cols-2 gap-4">
								<div className="bg-[#18181b] border border-[#27272a] rounded-lg p-4">
									<div className="flex items-center gap-2 mb-2">
										{scanResult.safe ? (
											<CheckCircle size={24} className="text-green-400" />
										) : (
											<AlertCircle size={24} className="text-red-400" />
										)}
										<h3 className="font-bold">
											{scanResult.safe ? "All Clear!" : "Vulnerabilities Found"}
										</h3>
									</div>
									<p className="text-sm text-gray-400">
										{scanResult.safe
											? "No critical or high-severity issues detected."
											: `${critical + high} critical/high issues require attention.`}
									</p>
								</div>

								<div className="bg-[#18181b] border border-[#27272a] rounded-lg p-4">
									<h3 className="font-bold mb-2">Scan Statistics</h3>
									<div className="text-sm space-y-1">
										<div className="flex justify-between">
											<span className="text-gray-400">Files scanned:</span>
											<span className="text-white">{scanResult.scannedFiles}</span>
										</div>
										<div className="flex justify-between">
											<span className="text-gray-400">Lines scanned:</span>
											<span className="text-white">{scanResult.scannedLines}</span>
										</div>
										<div className="flex justify-between">
											<span className="text-gray-400">Duration:</span>
											<span className="text-white">{scanResult.scanDuration}ms</span>
										</div>
									</div>
								</div>
							</div>

							{/* Severity Breakdown */}
							{scanResult.vulnerabilities.length > 0 && (
								<div className="grid grid-cols-4 gap-2">
									<div className="bg-red-500/10 border border-red-500/30 rounded p-3 text-center">
										<div className="text-2xl font-bold text-red-400">{critical}</div>
										<div className="text-xs text-red-300">Critical</div>
									</div>
									<div className="bg-orange-500/10 border border-orange-500/30 rounded p-3 text-center">
										<div className="text-2xl font-bold text-orange-400">{high}</div>
										<div className="text-xs text-orange-300">High</div>
									</div>
									<div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3 text-center">
										<div className="text-2xl font-bold text-yellow-400">{medium}</div>
										<div className="text-xs text-yellow-300">Medium</div>
									</div>
									<div className="bg-blue-500/10 border border-blue-500/30 rounded p-3 text-center">
										<div className="text-2xl font-bold text-blue-400">{low}</div>
										<div className="text-xs text-blue-300">Low</div>
									</div>
								</div>
							)}

							{/* Vulnerabilities List */}
							{scanResult.vulnerabilities.length > 0 && (
								<div className="space-y-3">
									<h3 className="font-bold">Detected Vulnerabilities:</h3>
									{scanResult.vulnerabilities.map((vuln, idx) => (
										<div
											key={idx}
											className={`border rounded-lg p-4 ${getSeverityColor(vuln.severity)}`}
										>
											<div className="flex items-start gap-3">
												{getSeverityIcon(vuln.severity)}
												<div className="flex-1">
													<div className="flex items-center gap-2 mb-1">
														<span className="font-bold text-sm uppercase">
															{vuln.severity}
														</span>
														{vuln.line && (
															<span className="text-xs opacity-75">Line {vuln.line}</span>
														)}
													</div>
													<p className="text-sm mb-2">{vuln.description}</p>
													{vuln.code && (
														<pre className="text-xs bg-black/30 p-2 rounded mb-2 overflow-x-auto">
															<code>{vuln.code}</code>
														</pre>
													)}
													<div className="text-xs opacity-90">
														<strong>Recommendation:</strong> {vuln.recommendation}
													</div>
												</div>
											</div>
										</div>
									))}
								</div>
							)}

							{/* Rescan Button */}
							<button
								onClick={runScan}
								disabled={isScanning}
								className="px-4 py-2 bg-[#27272a] hover:bg-[#3f3f46] text-white rounded transition-colors self-start"
							>
								Rescan Project
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

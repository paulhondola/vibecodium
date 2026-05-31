export type ApiResponse = {
  message: string;
  success: true;
};

// ── Environment / Dockerfile selector ─────────────────────────────────────────

export type EnvironmentKey =
  | "auto"
  | "python"
  | "node"
  | "bun"
  | "cpp"
  | "rust"
  | "go";

export interface Environment {
  key: EnvironmentKey;
  label: string;
  description: string;
  image: string;
  color: string;
  icon: string;
}

export const ENVIRONMENTS: Environment[] = [
  {
    key: "auto",
    label: "Auto-detect",
    description: "Detect from file extensions",
    image: "auto",
    color: "#6B7280",
    icon: "⚡",
  },
  {
    key: "python",
    label: "Python 3.10",
    description: "Python + uv package manager",
    image: "vibecodium-python:latest",
    color: "#3B82F6",
    icon: "🐍",
  },
  {
    key: "node",
    label: "Node.js",
    description: "JavaScript / TypeScript",
    image: "vibecodium-node:latest",
    color: "#F59E0B",
    icon: "⬡",
  },
  {
    key: "bun",
    label: "Bun 1.x",
    description: "Ultra-fast JS runtime",
    image: "vibecodium-bun:latest",
    color: "#EC4899",
    icon: "🥟",
  },
  {
    key: "cpp",
    label: "C++ GCC 12",
    description: "C/C++ with gcc + make",
    image: "vibecodium-cpp:latest",
    color: "#10B981",
    icon: "⚙",
  },
  {
    key: "rust",
    label: "Rust 1.68",
    description: "Rust with musl-dev",
    image: "vibecodium-rust:latest",
    color: "#EF4444",
    icon: "⬡",
  },
  {
    key: "go",
    label: "Go 1.21",
    description: "Go programming language",
    image: "vibecodium-go:latest",
    color: "#00ADD8",
    icon: "⬡",
  },
];

// ── WebSocket editor protocol ──────────────────────────────────────────────

export interface WsEditorUpdate {
  type: "update";
  fileId: string;
  content: string;
}

// Client → Server
export type WsClientMessage = WsEditorUpdate;

// Server → Client
export interface WsServerUpdate {
  type: "update";
  fileId: string;
  content: string;
  senderId: string;
}

export type WsServerMessage = WsServerUpdate;

export type ExecuteRequest = {
  language: string;
  version: string;
  code: string;
};

export type ExecuteResponse = {
  success: boolean;
  stdout: string;
  stderr: string;
  compileOutput?: string;
  error?: string;
};

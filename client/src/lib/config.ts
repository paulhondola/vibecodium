export const API_BASE = (import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "");
export const WS_BASE = API_BASE.replace(/^http/, "ws");

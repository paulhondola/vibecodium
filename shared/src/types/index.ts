export type ApiResponse = {
  message: string;
  success: true;
}

// ── WebSocket editor protocol ──────────────────────────────────────────────

export interface WsEditorUpdate {
    type:     "update";
    fileId:   string;
    content:  string;
}

// Client → Server
export type WsClientMessage = WsEditorUpdate;

// Server → Client
export interface WsServerUpdate {
    type:     "update";
    fileId:   string;
    content:  string;
    senderId: string;
}

export type WsServerMessage = WsServerUpdate;

export type ExecuteRequest = {
  language: string;
  version: string;
  code: string;
}

export type ExecuteResponse = {
  success: boolean;
  stdout: string;
  stderr: string;
  compileOutput?: string;
  error?: string;
}

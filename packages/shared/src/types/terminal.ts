// Client → Server (WebSocket)
export type WSTerminalClientMessage =
  | { type: "input"; data: string }
  | { type: "resize"; cols: number; rows: number };

// Server → Client (WebSocket)
export type WSTerminalServerMessage =
  | { type: "output"; data: string }
  | { type: "exit"; exitCode: number };

// REST API
export interface TerminalInfo {
  id: string;
  cwd: string;
  pid: number;
  createdAt: string;
}

export interface CreateTerminalRequest {
  cwd: string;
}

export interface CreateTerminalResponse {
  id: string;
}

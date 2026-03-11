// ── Node Info ──

export interface NodeInfo {
  nodeId: string;
  name: string;
  connectedAt: number;
}

// ── Hub ↔ Node WS protocol ──
// The hub and node communicate over a single WS connection.
// The hub sends requests and the node sends responses + push events.

/** Hub → Node: request envelope */
export interface HubToNodeRequest {
  type: "request";
  requestId: string;
  method: string; // "GET" | "POST" | "PUT" | "DELETE"
  path: string; // e.g. "/api/projects"
  query?: Record<string, string>;
  body?: unknown;
}

/** Hub → Node: WebSocket proxy — open a session WS on the node */
export interface HubToNodeWsOpen {
  type: "ws_open";
  channelId: string;
  path: string; // e.g. "/ws/sessions/abc123"
}

/** Hub → Node: WebSocket proxy — forward a client message to the node's session WS */
export interface HubToNodeWsMessage {
  type: "ws_message";
  channelId: string;
  data: string;
}

/** Hub → Node: WebSocket proxy — close a proxied WS channel */
export interface HubToNodeWsClose {
  type: "ws_close";
  channelId: string;
}

export type HubToNodeMessage =
  | HubToNodeRequest
  | HubToNodeWsOpen
  | HubToNodeWsMessage
  | HubToNodeWsClose;

/** Node → Hub: response to a request */
export interface NodeToHubResponse {
  type: "response";
  requestId: string;
  status: number;
  body: unknown;
}

/** Node → Hub: WebSocket proxy — message from node's session WS back to hub */
export interface NodeToHubWsMessage {
  type: "ws_message";
  channelId: string;
  data: string;
}

/** Node → Hub: WebSocket proxy — node's session WS closed */
export interface NodeToHubWsClose {
  type: "ws_close";
  channelId: string;
  code?: number;
  reason?: string;
}

/** Node → Hub: WebSocket proxy — node's session WS opened */
export interface NodeToHubWsOpen {
  type: "ws_open";
  channelId: string;
}

/** Node → Hub: push event for sync (session state, etc.) */
export interface NodeToHubSyncEvent {
  type: "sync_event";
  event: string;
  data: unknown;
}

// ── Handshake: Node verifies Hub's identity ──
//
// 1. Node connects WS, sends "challenge" with a random nonce
// 2. Hub computes HMAC-SHA256(nonce, accessCode) and replies "challenge_response"
// 3. Node verifies the HMAC — if correct, Hub knows the access code → trusted
// 4. Node sends "register" to complete the handshake

/** Node → Hub: challenge — Node asks Hub to prove its identity */
export interface NodeToHubChallenge {
  type: "challenge";
  nonce: string;
}

/** Hub → Node: challenge response — Hub proves it knows the access code */
export interface HubToNodeChallengeResponse {
  type: "challenge_response";
  proof: string; // HMAC-SHA256(nonce, accessCode)
}

/** Node → Hub: registration after successful verification */
export interface NodeToHubRegister {
  type: "register";
  name: string;
}

export type NodeToHubMessage =
  | NodeToHubResponse
  | NodeToHubWsMessage
  | NodeToHubWsClose
  | NodeToHubWsOpen
  | NodeToHubSyncEvent
  | NodeToHubChallenge
  | NodeToHubRegister;

// ── Hub mode detection ──

export interface HubInfoResponse {
  isHub: boolean;
  nodeCount: number;
}

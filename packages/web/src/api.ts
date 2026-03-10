import type {
  ProjectListItem,
  SessionSummary,
  SessionDetail,
  CreateSessionRequest,
  CreateSessionResponse,
  DeleteSessionResponse,
  TerminalInfo,
  CreateTerminalResponse,
} from "@lgtm-anywhere/shared";

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res
      .json()
      .catch(() => ({ error: { message: res.statusText } }));
    throw new Error(body.error?.message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function fetchProjects(): Promise<ProjectListItem[]> {
  return fetchJSON<ProjectListItem[]>("/api/projects");
}

export function fetchSessions(cwd: string): Promise<SessionSummary[]> {
  return fetchJSON<SessionSummary[]>(
    `/api/sessions?cwd=${encodeURIComponent(cwd)}`,
  );
}

export function fetchSessionDetail(sessionId: string): Promise<SessionDetail> {
  return fetchJSON<SessionDetail>(`/api/sessions/${sessionId}`);
}

export function createSession(
  cwd: string,
  req: CreateSessionRequest,
): Promise<CreateSessionResponse> {
  return fetchJSON<CreateSessionResponse>(
    `/api/sessions?cwd=${encodeURIComponent(cwd)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    },
  );
}

export function deleteSession(
  sessionId: string,
): Promise<DeleteSessionResponse> {
  return fetchJSON<DeleteSessionResponse>(`/api/sessions/${sessionId}`, {
    method: "DELETE",
  });
}

// ── Terminal API ──

export function createTerminal(cwd: string): Promise<CreateTerminalResponse> {
  return fetchJSON<CreateTerminalResponse>("/api/terminals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cwd }),
  });
}

export function fetchTerminals(cwd: string): Promise<TerminalInfo[]> {
  return fetchJSON<TerminalInfo[]>(
    `/api/terminals?cwd=${encodeURIComponent(cwd)}`,
  );
}

export function deleteTerminal(
  id: string,
): Promise<{ id: string; killed: boolean }> {
  return fetchJSON<{ id: string; killed: boolean }>(`/api/terminals/${id}`, {
    method: "DELETE",
  });
}

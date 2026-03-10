# AGENTS.md

## Project Overview

LGTM Anywhere is a web-based Claude Code session manager. It wraps the `@anthropic-ai/claude-agent-sdk` behind an Express server with a React frontend, enabling users to create, manage, and interact with Claude Code sessions through a browser UI.

Core capabilities:

- **Discover projects** by aggregating `listSessions({})` results by `cwd`
- **Create/resume sessions** using the SDK's streaming input mode (persistent subprocess per session)
- **Stream responses in real-time** via WebSocket with a two-category envelope protocol
- **Manage session lifecycle**: ACTIVE → IDLE → INACTIVE with auto-recycle
- **Support subagents**: `Agent` tool invocations rendered as nested collapsible timeline blocks
- **Intercept `AskUserQuestion`** via `canUseTool` — broadcast to clients, wait for user answer
- **Track todos**: Extract `TodoWrite` tool calls, broadcast updates to connected clients

## Monorepo Structure

```
lgtm-anywhere/
├── packages/
│   ├── shared/          # @lgtm-anywhere/shared — type contracts (server ↔ web)
│   ├── server/          # @lgtm-anywhere/server — Express + WebSocket backend
│   └── web/             # @lgtm-anywhere/web — React + Vite frontend
├── tests/e2e/           # Vitest E2E tests (REST + WebSocket)
├── eslint.config.mjs    # Flat ESLint config
├── .prettierrc          # Prettier: semi, double quotes, trailing commas
└── tsconfig.base.json   # Shared TS: ES2022, Node16 modules, strict
```

## Tech Stack

- **Runtime**: Node.js, TypeScript (ESM throughout, `"type": "module"`)
- **Backend**: Express.js v5, `ws` library, `@anthropic-ai/claude-agent-sdk` ^0.2.71
- **Frontend**: React 19, Vite 6, react-markdown + remark-gfm
- **Testing**: Vitest (E2E only)
- **Linting**: ESLint 9 (flat config) + Prettier
- **CI**: GitHub Actions — lint + format check on PRs to main

## Key Commands

| Command          | Description                                                   |
| ---------------- | ------------------------------------------------------------- |
| `npm run dev`    | Start server (port 3001, tsx watch) + web (Vite) concurrently |
| `npm run build`  | Build shared → server → web sequentially                      |
| `npm run test`   | Run E2E tests with Vitest                                     |
| `npm run lint`   | ESLint + Prettier check                                       |
| `npm run format` | Auto-fix with Prettier                                        |

## Package Details

### `packages/shared` — Type Contracts

Shared type definitions between server and web. Key files:

| File               | Contents                                          |
| ------------------ | ------------------------------------------------- |
| `types/ws.ts`      | WS protocol — the most important type file        |
| `types/session.ts` | `SessionState`, `SessionSummary`, `SessionDetail` |
| `types/api.ts`     | REST request/response types                       |
| `types/project.ts` | `ProjectListItem`                                 |
| `types/todo.ts`    | `TodoItem`                                        |
| `types/sse.ts`     | Legacy SSE types (unused, kept for reference)     |

**WS Protocol** (two-category envelope):

- `WSSdkMessage` (`category: "sdk"`) — raw SDK messages forwarded verbatim, zero translation
- `WSControlMessage` (`category: "control"`) — server-originated: `session_message`, `ask_user_question`, `error`, `history_batch_start/end`, `todo_update`
- Client → Server: `WSMessageSend` | `WSAnswerQuestion`
- Sync WS: `WSSessionStateChange` | `WSSessionCreated`

### `packages/server` — Express + WebSocket Backend

```
server/src/
├── index.ts               # Entry: HTTP server + WS attach + graceful shutdown
├── app.ts                 # Express app: CORS, JSON parsing, route mounting
├── config.ts              # port: 3001, idleTimeoutMs: 5min, recycleIntervalMs: 1min
├── routes/
│   ├── projects.ts        # GET /api/projects
│   └── sessions.ts        # CRUD /api/sessions
├── services/
│   ├── session-manager.ts # Core: ActiveSession lifecycle, consume loop, WS broadcast
│   ├── message-queue.ts   # AsyncIterable<SDKUserMessage> bridge
│   └── project-scanner.ts # listSessions({}) → aggregate by cwd
└── ws/
    └── handler.ts         # WS upgrade: /ws/sessions/:id + /ws/sync
```

**Core architecture**:

- `SessionManager` manages `ActiveSession` map (keyed by sessionId)
- Each session uses streaming input mode: `MessageQueue` (AsyncIterable) keeps the SDK subprocess alive
- `runSession()` is the consume loop: `for await (const message of query)` → filter → cache → broadcast
- `shouldForwardSdkMessage()` gates which SDK messages get cached/broadcast
- `pruneSdkMessages()` removes superseded transient events from cache (e.g., `stream_event` pruned when `assistant` arrives)
- `convertHistoryToWSEvents()` reads persisted messages from SDK disk for replay
- `makeCanUseTool()` intercepts `AskUserQuestion` — broadcasts to WS, waits for answer

**Session lifecycle**: ACTIVE (processing) → IDLE (result received, subprocess alive, waiting) → INACTIVE (idle timeout 5min, subprocess terminated, only JSONL on disk)

**API routes**:

- `GET /api/projects` — aggregated project list
- `GET /api/sessions?cwd=<encoded>` — list sessions for a cwd
- `POST /api/sessions?cwd=<encoded>` — create session (body: `CreateSessionRequest`)
- `GET /api/sessions/:session_id` — session detail with messages
- `PUT /api/sessions/:session_id` — update model
- `DELETE /api/sessions/:session_id` — stop session
- `WS /ws/sessions/:session_id` — per-session streaming
- `WS /ws/sync` — global session state broadcasts

### `packages/web` — React + Vite Frontend

```
web/src/
├── App.tsx                # Root: selectedProject, selectedSession state
├── api.ts                 # REST client (fetch wrappers)
├── hooks/
│   ├── useSessionSocket.ts  # Per-session WS: SDK/control message handling, subagent tracking
│   └── useSessionSync.ts    # Global /ws/sync: session state changes, reconnection
└── components/
    ├── Sidebar.tsx          # Left panel: ProjectList + SessionList
    ├── ProjectList.tsx      # /api/projects display
    ├── SessionList.tsx      # /api/sessions display with live state
    ├── ChatArea.tsx         # Main content: messages + input + question + todos
    ├── ChatInput.tsx        # Textarea + model selector (Auto/Opus/Sonnet/Haiku)
    ├── MessageList.tsx      # Scrollable message list with auto-scroll
    ├── MessageBubble.tsx    # Timeline rendering: text (markdown), tools, subagents
    ├── AskUserQuestion.tsx  # Tabbed multi-question modal
    └── TodoPanel.tsx        # Floating task panel
```

**`useSessionSocket.ts`** is the most complex client file (~530 lines):

- Two-level dispatch: `msg.category === "sdk"` → `handleSdkMessage()`, else `handleControlMessage()`
- Subagent tracking via `SubagentState` map (keyed by `toolUseId`)
- Stream buffering: accumulates `text_delta` events into placeholder, replaced by final `assistant` message
- History replay: `history_batch_start` clears state, batch messages rebuild UI, `history_batch_end` re-enables streaming indicators

## Claude Agent SDK Usage

Key SDK APIs used:

- `query({ prompt: AsyncIterable, options })` — streaming input mode, returns `Query` (AsyncGenerator)
- `listSessions({})` — all sessions; `listSessions({ dir })` — filter by cwd
- `getSessionMessages(sessionId, { limit })` — read persisted messages
- `Query` object: `.close()`, `.interrupt()`, `.setModel()`, `.setPermissionMode()`

SDK message types forwarded to clients: `assistant`, `stream_event`, `tool_progress`, `result`, `user` (tool results only), `system` (init, status, task_started/progress/notification)

## Conventions

- All packages use ESM (`"type": "module"`)
- `shared` has `"composite": true` for TypeScript project references
- Express v5 route params are `Record<string, string | string[]>` — use string extraction
- CWD passed as URL-encoded query parameter, no custom encoding
- Prettier: semicolons, double quotes, trailing commas, 80 char width
- ESLint: unused vars with `_` prefix are allowed, `no-explicit-any` is warn-only

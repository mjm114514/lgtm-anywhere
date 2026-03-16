# LGTM Anywhere

Claude Code in your browser.

LGTM Anywhere is a full-stack web application that lets you manage and interact with [Claude Code](https://docs.anthropic.com/en/docs/claude-code) agent sessions from any browser. It supports multi-session, multi-project, and multi-machine orchestration, with a complete set of features including conversational UI, tool approval, and terminal emulation.

## Why?

Claude Code is natively a CLI tool that runs in a local terminal. LGTM Anywhere addresses several limitations:

- **Remote access** — Use Claude Code from any device's browser, not just a local terminal
- **Multi-session management** — Run and switch between multiple Claude Code sessions, organized by project
- **Multi-machine orchestration** — Control Claude Code instances across multiple remote machines from a single web dashboard via the Hub-Node architecture
- **Rich UI** — Markdown rendering, tool call visualization, Todo panel, subagent tracking, and more

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (React)                      │
│  Chat UI · Tool Approval · Todo Panel · Terminal         │
└────────────────────────┬────────────────────────────────┘
                         │ WebSocket + REST API
┌────────────────────────▼────────────────────────────────┐
│                    Express Server                        │
│  SessionManager · MessageQueue · TerminalManager         │
└────────────────────────┬────────────────────────────────┘
                         │ Claude Agent SDK
┌────────────────────────▼────────────────────────────────┐
│                  Claude Code Process                     │
│  Code Generation · Tool Calls · File Edits · Commands    │
└─────────────────────────────────────────────────────────┘
```

### Project Structure

```
lgtm-anywhere/
├── packages/
│   ├── shared/     # Shared TypeScript type definitions (WS protocol, API interfaces)
│   ├── server/     # Express + WebSocket backend server
│   └── web/        # React + Vite frontend application
├── tests/e2e/      # End-to-end tests
└── docs/           # Documentation
```

This is an npm workspaces monorepo, fully written in TypeScript (ESM).

### Operating Modes

#### 1. Standalone (default)

The simplest way to run. The server runs locally and manages Claude Code sessions directly:

```
lgtm-anywhere
```

#### 2. Hub Mode

Acts as a central coordination server — does not run Claude Code itself, but proxies requests to connected Nodes:

```
lgtm-anywhere --hub
```

#### 3. Node Mode

Connects to a Hub, runs Claude Code locally and accepts dispatched requests:

```
lgtm-anywhere --connect <hub-url> --access-code <code>
```

**Hub-Node Architecture:**

```
┌──────────┐       ┌───────────────────┐       ┌──────────┐
│  Browser  │◄─────►│    Hub Server      │◄─────►│  Node A  │
└──────────┘       │  (Proxy/Aggregate) │       └──────────┘
                   │                    │◄─────►┌──────────┐
                   └───────────────────┘       │  Node B  │
                                               └──────────┘
```

Hub and Node communicate over a single persistent WebSocket connection, authenticated via HMAC-SHA256 challenge-response, multiplexing REST proxying, WS proxying, and sync events on the same link.

### How It Works

1. **Streaming input mode** — A `MessageQueue` (implementing `AsyncIterable<SDKUserMessage>`) feeds into the SDK's `query()`, keeping the Claude Code process alive across multiple conversational turns
2. **Zero-translation SDK passthrough** — SDK messages are forwarded verbatim to the frontend as `WSSdkMessage`, avoiding an additional protocol translation layer
3. **Message caching & pruning** — Each session maintains a full message cache; new WebSocket clients receive a full history replay on connect. Intermediate stream events are automatically pruned when finalized messages arrive
4. **Session lifecycle** — `ACTIVE` → `IDLE` (awaiting input) → `INACTIVE` (recycled after 5 min idle), with the ability to reactivate at any time

## Features

| Feature | Description |
|---------|-------------|
| Web Chat UI | Send messages and view streaming Claude responses with Markdown rendering |
| Multi-session | Create, switch between, stop, and resume multiple Claude Code sessions |
| Project Organization | Sessions automatically grouped by working directory (cwd) |
| Tool Approval | Tool calls surface for user approval/denial in non-bypass modes |
| Permission Modes | 5 modes: Bypass / Default / Accept Edits / Plan / Don't Ask |
| Interactive Q&A | AskUserQuestion prompts from Claude displayed in the UI |
| Todo Panel | Tracks Claude's TodoWrite calls with task status display |
| Subagent Tracking | Nested Agent tool calls shown in collapsible blocks |
| Terminal Emulator | Full PTY terminal in the browser via node-pty + xterm.js |
| Image Support | Attach base64 images to messages |
| Authentication | Token + signed cookie auth with rate limiting |
| Hub-Node | Multi-machine orchestration from a single dashboard |

## Getting Started

### Prerequisites

- **Node.js** >= 20
- **Anthropic API Key** (set as `ANTHROPIC_API_KEY` environment variable)
- C++ build toolchain (required for compiling the `node-pty` native module)

### Installation

```bash
git clone https://github.com/mjm114514/lgtm-anywhere.git
cd lgtm-anywhere
npm install
```

### Development

```bash
npm run dev
```

This starts concurrently:
- Backend server (port 3001, with hot reload via tsx)
- Vite dev server (with HMR, proxying API requests to port 3001)

### Production

```bash
# Build all packages (shared → server → web)
npm run build

# Start the server (serves both the API and the SPA)
npm run start
```

Then open `http://localhost:3001` in your browser.

### Authentication

On first run, the server generates a 128-bit auth token saved to `~/.lgtm-anywhere/auth-token` and displayed in the terminal. Enter this token on the browser login page. The session cookie is valid for 24 hours.

To disable authentication:

```bash
lgtm-anywhere --no-auth
```

To refresh the token:

```bash
lgtm-anywhere --refresh-token
```

## CLI Reference

```
Usage: lgtm-anywhere [options]

Options:
  -p, --port <port>              Port to listen on (default: 3001)
      --no-auth                  Disable authentication
      --hub                      Start in hub mode
      --connect <hub-url>        Connect to a hub server
      --access-code <code>       Access code for hub connection
      --refresh-token            Refresh the auth token and exit
  -h, --help                     Show help message
```

## Development

```bash
# Run end-to-end tests
npm run test

# Lint check
npm run lint

# Auto-format
npm run format
```

## Tech Stack

- **Frontend**: React 19 + Vite 6 + react-markdown + xterm.js
- **Backend**: Express 5 + WebSocket (ws) + node-pty
- **Agent SDK**: @anthropic-ai/claude-agent-sdk
- **Language**: TypeScript (ESM)
- **Monorepo**: npm workspaces
- **Testing**: Vitest (E2E)
- **Code Style**: ESLint 9 + Prettier

## License

MIT

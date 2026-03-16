# LGTM Anywhere

把 Claude Code 搬到浏览器里。

LGTM Anywhere 是一个全栈 Web 应用，让你通过浏览器远程管理和使用 [Claude Code](https://docs.anthropic.com/en/docs/claude-code) agent 会话。支持多会话、多项目、多机器协同，提供完整的对话交互、工具审批、终端模拟等功能。

## 为什么需要这个项目？

Claude Code 原生是一个命令行工具，只能在本地终端中使用。LGTM Anywhere 解决了以下痛点：

- **远程访问** — 在任何设备的浏览器中使用 Claude Code，不局限于本地终端
- **多会话管理** — 同时运行和切换多个 Claude Code 会话，按项目组织
- **多机器协同** — 通过 Hub-Node 架构，从一个 Web 面板控制多台机器上的 Claude Code
- **可视化交互** — Markdown 渲染、工具调用可视化、Todo 面板、子 Agent 追踪等

## 架构概览

```
┌─────────────────────────────────────────────────────┐
│                    浏览器 (React)                     │
│  对话界面 · 工具审批 · Todo 面板 · 终端模拟器          │
└──────────────────┬──────────────────────────────────┘
                   │ WebSocket + REST API
┌──────────────────▼──────────────────────────────────┐
│                   Express 服务器                      │
│  SessionManager · MessageQueue · TerminalManager     │
└──────────────────┬──────────────────────────────────┘
                   │ Claude Agent SDK
┌──────────────────▼──────────────────────────────────┐
│                 Claude Code 进程                      │
│  代码生成 · 工具调用 · 文件编辑 · 命令执行             │
└─────────────────────────────────────────────────────┘
```

### 项目结构

```
lgtm-anywhere/
├── packages/
│   ├── shared/     # 共享 TypeScript 类型定义（WS 协议、API 接口等）
│   ├── server/     # Express + WebSocket 后端服务器
│   └── web/        # React + Vite 前端应用
├── tests/e2e/      # 端到端测试
└── docs/           # 文档
```

这是一个 npm workspaces monorepo，全部使用 TypeScript（ESM）。

### 三种运行模式

#### 1. 单机模式（默认）

最简单的使用方式。服务器在本地运行，直接管理 Claude Code 会话：

```
lgtm-anywhere
```

#### 2. Hub 模式

作为中心协调服务器，本身不运行 Claude Code，而是将请求代理到已连接的 Node：

```
lgtm-anywhere --hub
```

#### 3. Node 模式

连接到 Hub，在本地运行 Claude Code 并接受 Hub 的调度：

```
lgtm-anywhere --connect <hub-url> --access-code <code>
```

**Hub-Node 架构示意：**

```
┌─────────┐       ┌─────────────┐       ┌──────────┐
│  浏览器  │◄─────►│   Hub 服务器  │◄─────►│  Node A  │
└─────────┘       │  (代理/聚合)  │       └──────────┘
                  │              │◄─────►┌──────────┐
                  └─────────────┘       │  Node B  │
                                        └──────────┘
```

Hub 和 Node 之间通过单条 WebSocket 连接进行通信，使用 HMAC-SHA256 挑战-响应认证，在同一条链路上多路复用 REST 代理、WS 代理和同步事件。

### 核心原理

1. **流式输入模式** — 使用 `MessageQueue`（实现 `AsyncIterable<SDKUserMessage>`）作为 SDK `query()` 的输入，使 Claude Code 进程在多轮对话中保持存活
2. **零翻译消息透传** — SDK 消息以 `WSSdkMessage` 形式原样转发到前端，避免额外的协议转换层
3. **消息缓存与裁剪** — 每个会话维护完整的消息缓存，新客户端连接时回放历史；流式事件在最终消息到达后被自动裁剪
4. **会话生命周期** — `ACTIVE`（活跃）→ `IDLE`（等待输入）→ `INACTIVE`（空闲 5 分钟后回收），可随时重新激活

## 功能特性

| 功能 | 说明 |
|------|------|
| Web 对话界面 | 发送消息，流式查看 Claude 回复（Markdown 渲染） |
| 多会话管理 | 创建、切换、停止、恢复多个 Claude Code 会话 |
| 项目组织 | 会话按工作目录（cwd）自动分组为项目 |
| 工具审批 | 非自动模式下，工具调用需要用户批准/拒绝 |
| 权限模式 | 5 种模式：Bypass / Default / Accept Edits / Plan / Don't Ask |
| 交互式问答 | Claude 发起的 AskUserQuestion 在 UI 中展示 |
| Todo 面板 | 追踪 Claude 的 TodoWrite 调用，显示任务状态 |
| 子 Agent 追踪 | 嵌套的 Agent 工具调用可折叠展示 |
| 终端模拟器 | 通过 node-pty + xterm.js 提供完整的浏览器内终端 |
| 图片支持 | 在消息中附加 base64 图片 |
| 身份认证 | Token + 签名 Cookie 认证，支持速率限制 |
| Hub-Node | 多机器编排，从一个面板控制远程 Claude Code |

## 快速开始

### 前置要求

- **Node.js** >= 20
- **Anthropic API Key**（设置为环境变量 `ANTHROPIC_API_KEY`）
- C++ 编译工具链（用于编译 `node-pty` 原生模块）

### 安装

```bash
git clone https://github.com/mao-code/lgtm-anywhere.git
cd lgtm-anywhere
npm install
```

### 开发模式

```bash
npm run dev
```

这会同时启动：
- 后端服务器（端口 3001，带热重载）
- Vite 开发服务器（带 HMR，自动代理 API 请求到 3001）

### 生产模式

```bash
# 构建所有包（shared → server → web）
npm run build

# 启动服务器（同时提供 API 和 SPA 静态文件）
npm run start
```

然后在浏览器中打开 `http://localhost:3001`。

### 认证

首次运行时，服务器会自动生成一个 128 位的认证 token，保存在 `~/.lgtm-anywhere/auth-token` 中，并在终端中显示。在浏览器登录页输入该 token 即可。Session cookie 有效期 24 小时。

如需禁用认证：

```bash
lgtm-anywhere --no-auth
```

如需刷新 token：

```bash
lgtm-anywhere --refresh-token
```

## CLI 参数

```
Usage: lgtm-anywhere [options]

Options:
  -p, --port <port>              监听端口（默认: 3001）
      --no-auth                  禁用认证
      --hub                      以 Hub 模式启动
      --connect <hub-url>        连接到 Hub 服务器
      --access-code <code>       Hub 连接的 access code
      --refresh-token            刷新认证 token 并退出
  -h, --help                     显示帮助信息
```

## 开发

```bash
# 运行端到端测试
npm run test

# 代码检查
npm run lint

# 自动格式化
npm run format
```

## 技术栈

- **前端**: React 19 + Vite 6 + react-markdown + xterm.js
- **后端**: Express 5 + WebSocket (ws) + node-pty
- **Agent SDK**: @anthropic-ai/claude-agent-sdk
- **语言**: TypeScript (ESM)
- **构建**: npm workspaces monorepo
- **测试**: Vitest (E2E)
- **代码规范**: ESLint 9 + Prettier

## License

MIT

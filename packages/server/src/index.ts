// Allow SDK to spawn Claude Code even when running inside a Claude Code session
delete process.env.CLAUDECODE;

import { createApp } from "./app.js";
import { openBrowser } from "./open-browser.js";
import { SessionManager } from "./services/session-manager.js";
import { TerminalManager } from "./terminal/terminal-manager.js";
import { attachWebSocket } from "./ws/handler.js";
import { config } from "./config.js";

export interface ServerOptions {
  port?: number;
  open?: boolean;
}

export async function startServer(options: ServerOptions = {}) {
  const port = options.port ?? config.port;
  const sessionManager = new SessionManager();
  const terminalManager = new TerminalManager();
  const app = createApp(sessionManager, terminalManager);

  const server = app.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`[lgtm-anywhere] Server listening on ${url}`);
    console.log(
      `[lgtm-anywhere] WebSocket at ws://localhost:${port}/ws/sessions/:session_id`,
    );
    if (options.open) {
      openBrowser(url);
    }
  });

  // Attach WebSocket handler to the same HTTP server
  attachWebSocket(server, sessionManager, terminalManager);

  // Graceful shutdown
  let shuttingDown = false;
  function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`\n[${signal}] Shutting down...`);
    terminalManager.shutdown();
    sessionManager.shutdown();
    server.close();
    process.exit(0);
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  return server;
}

// Support direct execution: `node dist/index.js`
const isDirectRun =
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isDirectRun) {
  startServer();
}

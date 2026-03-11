import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";

export interface HubHandle {
  port: number;
  baseUrl: string;
  wsUrl: string;
  accessCode: string;
  stop: () => Promise<void>;
}

export interface NodeHandle {
  port: number;
  baseUrl: string;
  wsUrl: string;
  stop: () => Promise<void>;
}

/** Bind a temporary TCP server to port 0 to discover a free port. */
function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, () => {
      const addr = srv.address();
      if (addr && typeof addr === "object") {
        const port = addr.port;
        srv.close(() => resolve(port));
      } else {
        srv.close(() => reject(new Error("Failed to get port")));
      }
    });
    srv.on("error", reject);
  });
}

function stopProcess(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (!child.pid || child.killed) {
      resolve();
      return;
    }
    const forceKill = setTimeout(() => child.kill("SIGKILL"), 5_000);
    child.on("exit", () => {
      clearTimeout(forceKill);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

/**
 * Start a hub server on a free port.
 * Waits for "Hub server listening" and extracts the access code from stdout.
 */
export async function startHub(): Promise<HubHandle> {
  const port = await findFreePort();

  const child = spawn(
    "npx",
    ["tsx", "packages/server/src/cli.ts", "--hub", "--port", String(port)],
    {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  let accessCode = "";

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Hub failed to start within 30s")),
      30_000,
    );

    let stdout = "";
    child.stdout!.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;

      // Extract access code from the box output
      const codeMatch = stdout.match(/Access code:\s+(\S+)/);
      if (codeMatch) {
        accessCode = codeMatch[1];
      }

      if (text.includes("Hub server listening")) {
        clearTimeout(timeout);
        // Wait a tick for the access code box to fully print
        setTimeout(resolve, 200);
      }
    });

    child.stderr!.on("data", (chunk: Buffer) => {
      process.stderr.write(`[hub stderr] ${chunk.toString()}`);
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    child.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Hub exited unexpectedly with code ${code}`));
    });
  });

  if (!accessCode) {
    throw new Error("Failed to extract access code from hub output");
  }

  return {
    port,
    baseUrl: `http://localhost:${port}`,
    wsUrl: `ws://localhost:${port}`,
    accessCode,
    stop: () => stopProcess(child),
  };
}

/**
 * Start a node server on a free port and connect it to a hub.
 * Waits for "Registered with hub" to confirm the connection is established.
 */
export async function startNode(
  hubUrl: string,
  accessCode: string,
): Promise<NodeHandle> {
  const port = await findFreePort();

  const child = spawn(
    "npx",
    [
      "tsx",
      "packages/server/src/cli.ts",
      "--port",
      String(port),
      "--connect",
      hubUrl,
      "--access-code",
      accessCode,
    ],
    {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Node failed to connect within 30s")),
      30_000,
    );

    let stdout = "";
    child.stdout!.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
      if (stdout.includes("Registered with hub")) {
        clearTimeout(timeout);
        resolve();
      }
    });

    child.stderr!.on("data", (chunk: Buffer) => {
      process.stderr.write(`[node stderr] ${chunk.toString()}`);
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    child.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Node exited unexpectedly with code ${code}`));
    });
  });

  return {
    port,
    baseUrl: `http://localhost:${port}`,
    wsUrl: `ws://localhost:${port}`,
    stop: () => stopProcess(child),
  };
}

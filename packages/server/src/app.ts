import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createProjectRoutes } from "./routes/projects.js";
import { createSessionRoutes } from "./routes/sessions.js";
import { createTerminalRoutes } from "./terminal/routes.js";
import { SessionManager } from "./services/session-manager.js";
import { TerminalManager } from "./terminal/terminal-manager.js";
import type { AuthConfig } from "./auth/config.js";
import { createAuthMiddleware } from "./auth/middleware.js";
import { createAuthRouter } from "./auth/routes.js";

// Resolve web dist path. Two possible layouts:
//   1. Packed CLI:  dist/public/   (web assets bundled inside server package)
//   2. Monorepo:    ../../web/dist/ (sibling workspace package)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bundledPath = path.resolve(__dirname, "../public");
const monorepoPath = path.resolve(__dirname, "../../web/dist");
const webDistPath = fs.existsSync(bundledPath) ? bundledPath : monorepoPath;

export function createApp(
  sessionManager: SessionManager,
  terminalManager: TerminalManager,
  authConfig: AuthConfig,
) {
  const app = express();

  app.use(express.json({ limit: "50mb" }));

  // CORS — tighten when auth is enabled (same-origin only)
  app.use((_req, res, next) => {
    if (!authConfig.enabled) {
      // Auth disabled (local dev) — wide-open CORS
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS",
      );
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    }
    if (_req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Auth routes (public — must be before auth middleware)
  app.use("/api/auth", createAuthRouter(authConfig));

  // Auth middleware (protects all subsequent /api/* routes)
  app.use("/api", createAuthMiddleware(authConfig));

  // Routes
  app.use(
    "/api/projects",
    createProjectRoutes(sessionManager, terminalManager),
  );
  app.use("/api/sessions", createSessionRoutes(sessionManager));
  app.use("/api/terminals", createTerminalRoutes(terminalManager));

  // Serve static files from web build output
  app.use(express.static(webDistPath));

  // SPA fallback: non-API/WS paths return index.html
  app.use((req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/ws")) {
      next();
      return;
    }
    res.sendFile(path.join(webDistPath, "index.html"));
  });

  // Error handling middleware
  app.use(
    (
      err: Error & { statusCode?: number; code?: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error("[error]", err);
      const statusCode = err.statusCode ?? 500;
      res.status(statusCode).json({
        error: {
          code: err.code ?? "INTERNAL_ERROR",
          message: err.message,
        },
      });
    },
  );

  return app;
}

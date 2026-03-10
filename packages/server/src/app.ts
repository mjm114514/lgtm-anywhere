import express from "express";
import { createProjectRoutes } from "./routes/projects.js";
import { createSessionRoutes } from "./routes/sessions.js";
import { createTerminalRoutes } from "./terminal/routes.js";
import { SessionManager } from "./services/session-manager.js";
import { TerminalManager } from "./terminal/terminal-manager.js";

export function createApp(
  sessionManager: SessionManager,
  terminalManager: TerminalManager,
) {
  const app = express();

  app.use(express.json({ limit: "50mb" }));

  // CORS for local development
  app.use((_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (_req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Routes
  app.use(
    "/api/projects",
    createProjectRoutes(sessionManager, terminalManager),
  );
  app.use("/api/sessions", createSessionRoutes(sessionManager));
  app.use("/api/terminals", createTerminalRoutes(terminalManager));

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

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import type { AuthConfig } from "../auth/config.js";
import { createAuthMiddleware } from "../auth/middleware.js";
import { createAuthRouter } from "../auth/routes.js";
import { HubNodeManager } from "./hub-node-manager.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bundledPath = path.resolve(__dirname, "../../public");
const monorepoPath = path.resolve(__dirname, "../../../web/dist");
const webDistPath = fs.existsSync(bundledPath) ? bundledPath : monorepoPath;

export function createHubApp(
  nodeManager: HubNodeManager,
  authConfig: AuthConfig,
) {
  const app = express();

  app.use(express.json({ limit: "50mb" }));

  // CORS
  app.use((_req, res, next) => {
    if (!authConfig.enabled) {
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

  // Auth routes (public)
  app.use("/api/auth", createAuthRouter(authConfig));

  // ── Hub info endpoint (public — before auth middleware) ──
  app.get("/api/hub/info", (_req, res) => {
    res.json({
      isHub: true,
      nodeCount: nodeManager.getNodeCount(),
    });
  });

  // Auth middleware (protects all subsequent /api/* routes)
  app.use("/api", createAuthMiddleware(authConfig));

  // ── Node list ──
  app.get("/api/nodes", (_req, res) => {
    res.json(nodeManager.getNodes());
  });

  // ── Node proxy: /api/node/:node_id/* ──
  // Proxies REST requests to the specified node
  app.all("/api/node/:node_id/*rest", async (req, res, next) => {
    try {
      const nodeId = req.params.node_id as string;
      const node = nodeManager.getNode(nodeId);
      if (!node) {
        res.status(404).json({
          error: {
            code: "NODE_NOT_FOUND",
            message: `Node ${nodeId} not found`,
          },
        });
        return;
      }

      // In Express v5, named wildcard params are stored under the given name
      const wildcardParam = req.params.rest as string | string[];
      const suffix = Array.isArray(wildcardParam)
        ? wildcardParam.join("/")
        : (wildcardParam ?? "");
      const targetPath = `/api/${suffix}`;

      // Build query params
      const query: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === "string") {
          query[key] = value;
        }
      }

      const response = await nodeManager.proxyRequest(
        nodeId,
        req.method,
        targetPath,
        Object.keys(query).length > 0 ? query : undefined,
        req.method !== "GET" && req.method !== "DELETE" ? req.body : undefined,
      );

      res.status(response.status).json(response.body);
    } catch (err) {
      next(err);
    }
  });

  // Serve static files
  app.use(express.static(webDistPath));

  // SPA fallback
  app.use((req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/ws")) {
      next();
      return;
    }
    res.sendFile(path.join(webDistPath, "index.html"));
  });

  // Error handling
  app.use(
    (
      err: Error & { statusCode?: number; code?: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error("[hub error]", err);
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

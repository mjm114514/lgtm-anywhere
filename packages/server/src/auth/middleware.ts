import type { Request, Response, NextFunction } from "express";
import type { IncomingMessage } from "node:http";
import { hasValidSession } from "./session.js";
import { isValidWsToken } from "./routes.js";
import type { AuthConfig } from "./config.js";

/** Check if an IP address is loopback (127.x.x.x / ::1 / ::ffff:127.x.x.x). */
function isLoopback(ip: string): boolean {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "::ffff:127.0.0.1" ||
    ip.startsWith("127.")
  );
}

/**
 * Create Express middleware that gates API routes.
 *
 * - If auth is disabled, all requests pass through.
 * - If auth is enabled, the session cookie must be valid.
 */
export function createAuthMiddleware(config: AuthConfig) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    if (!config.enabled) {
      next();
      return;
    }

    // Allow internal proxy requests from node-connector (localhost only)
    if (
      _req.headers["x-internal-proxy"] === "node-connector" &&
      isLoopback(_req.ip ?? _req.socket.remoteAddress ?? "")
    ) {
      next();
      return;
    }

    if (!hasValidSession(_req, config)) {
      res.status(401).json({
        error: "unauthenticated",
        message: "Authentication required",
      });
      return;
    }

    next();
  };
}

/**
 * Verify a WebSocket upgrade request.
 * Returns true if authenticated (or auth disabled), false otherwise.
 *
 * Checks cookie first, then falls back to ?token= query param.
 */
export function verifyWsUpgrade(
  req: IncomingMessage,
  config: AuthConfig,
): boolean {
  if (!config.enabled) return true;

  // Allow internal proxy requests from node-connector (localhost only)
  if (
    req.headers["x-internal-proxy"] === "node-connector" &&
    isLoopback(req.socket.remoteAddress ?? "")
  ) {
    return true;
  }

  // Try cookie (browser auto-sends on same-origin WS upgrade)
  if (hasValidSession(req, config)) return true;

  // Try ?token= query param (short-lived WS token)
  const url = new URL(
    req.url ?? "",
    `http://${req.headers.host ?? "localhost"}`,
  );
  const token = url.searchParams.get("token");
  if (token) {
    return isValidWsToken(token);
  }

  return false;
}

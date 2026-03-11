#!/usr/bin/env node
// CLI entry point for lgtm-anywhere

import { parseArgs } from "node:util";
import { startServer } from "./index.js";
import { loadAuthConfig } from "./auth/config.js";

const { values } = parseArgs({
  options: {
    port: { type: "string", short: "p", default: "3001" },
    "no-auth": { type: "boolean", default: false },
  },
});

const port = parseInt(values.port!, 10);
const authConfig = loadAuthConfig({
  enabled: !values["no-auth"],
});

startServer({ port, authConfig });

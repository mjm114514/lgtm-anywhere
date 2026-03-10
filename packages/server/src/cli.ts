#!/usr/bin/env node
// CLI entry point for lgtm-anywhere

import { parseArgs } from "node:util";
import { startServer } from "./index.js";

const { values } = parseArgs({
  options: {
    port: { type: "string", short: "p", default: "3001" },
  },
});

const port = parseInt(values.port!, 10);
startServer({ port });

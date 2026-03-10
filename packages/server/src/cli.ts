#!/usr/bin/env node
// CLI entry point for lgtm-anywhere

import { parseArgs } from "node:util";
import { startServer } from "./index.js";

const { values } = parseArgs({
  options: {
    port: { type: "string", short: "p", default: "3001" },
    open: { type: "boolean", default: false },
  },
});

const port = parseInt(values.port!, 10);
startServer({ port, open: values.open! });

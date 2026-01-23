#!/usr/bin/env node
"use strict";

const { execSync } = require("child_process");

function fail(msg) {
  process.stderr.write(msg + "\n");
  process.exit(42);
}

const mode = process.argv[2]; // allow|block
const cmd = process.argv.slice(3).join(" ").trim();

if (!mode || !cmd) {
  fail("Usage: node scripts/mova-guarded-run.js <allow|block> <command...>");
}

if (mode === "block") {
  fail("MOVA_BLOCK: tool execution denied by policy (guarded-runner)");
}

if (mode !== "allow") {
  fail("Unknown mode: " + mode);
}

try {
  execSync(cmd, { stdio: "inherit", shell: true });
  process.exit(0);
} catch (e) {
  process.exit(e && typeof e.status === "number" ? e.status : 1);
}

#!/usr/bin/env node
"use strict";

const { execFileSync } = require("child_process");

function run(payload) {
  const out = execFileSync(process.execPath, ["scripts/mova-guard.js", "--input-json", JSON.stringify(payload)], { encoding: "utf8" });
  return JSON.parse(out);
}

const allow = run({ any: "PROBE_ALLOW" });
if (allow.decision !== "ALLOW") {
  console.error("Expected ALLOW, got:", allow);
  process.exit(1);
}

const block = run({ any: "PROBE_BLOCK" });
if (block.decision !== "BLOCK") {
  console.error("Expected BLOCK, got:", block);
  process.exit(1);
}

console.log("PASS guard smoke");

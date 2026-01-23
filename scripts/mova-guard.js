#!/usr/bin/env node
"use strict";

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--input-json") out.input_json = argv[++i];
  }
  return out;
}

function safeJsonParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

function main() {
  const { input_json } = parseArgs(process.argv);
  const input = safeJsonParse(input_json || "{}") || {};
  const raw = JSON.stringify(input);

  // PROBE rule (v0): if PROBE_BLOCK appears anywhere in payload => BLOCK
  if (raw.includes("PROBE_BLOCK")) {
    process.stdout.write(JSON.stringify({
      decision: "BLOCK",
      reason: "probe_block",
      rule_id: "probe.block.v0"
    }));
    return;
  }

  // Default ALLOW
  process.stdout.write(JSON.stringify({
    decision: "ALLOW",
    reason: "default_allow",
    rule_id: "default.allow.v0"
  }));
}

main();

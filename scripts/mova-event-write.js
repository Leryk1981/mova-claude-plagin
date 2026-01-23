#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = process.cwd();
const TMP_DIR = path.join(ROOT, ".mova", "tmp");
const SESSION_FILE = path.join(TMP_DIR, "opencode_session.json");
const EVENTS_DIR = path.join(TMP_DIR, "opencode_events");

function nowIsoSafe() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function readJson(p) { return JSON.parse(fs.readFileSync(p, "utf8")); }
function writeJson(p, obj) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--kind") out.kind = argv[++i];
    else if (a === "--json") out.json = argv[++i];
  }
  return out;
}

function main() {
  if (!fs.existsSync(SESSION_FILE)) process.exit(0);
  const session = readJson(SESSION_FILE);
  if (!session.active || !session.run_id) process.exit(0);

  const { kind, json } = parseArgs(process.argv);
  if (!kind) process.exit(2);

  let payload = {};
  if (json) {
    try { payload = JSON.parse(json); } catch { payload = { raw: String(json) }; }
  }

  const runId = session.run_id;
  const dir = path.join(EVENTS_DIR, runId, kind);
  ensureDir(dir);
  const id = crypto.randomBytes(8).toString("hex");
  const file = path.join(dir, ${nowIsoSafe()}_.json);
  writeJson(file, {
    kind,
    ts: new Date().toISOString(),
    run_id: runId,
    payload
  });
}

main();

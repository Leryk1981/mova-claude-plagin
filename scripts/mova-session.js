#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = process.cwd();
const TMP_DIR = path.join(ROOT, ".mova", "tmp");
const EVENTS_DIR = path.join(TMP_DIR, "opencode_events");
const SESSION_FILE = path.join(TMP_DIR, "opencode_session.json");
const EPISODES_DIR = path.join(ROOT, ".mova", "episodes");

function nowIsoSafe() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function readJson(p) {
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, obj) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

function listFilesRecursive(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) stack.push(full);
      else out.push(full);
    }
  }
  return out;
}

function rel(p) {
  return path.relative(ROOT, p).replace(/\\/g, "/");
}

function writeEvent(runId, kind, payload) {
  const dir = path.join(EVENTS_DIR, runId, kind);
  ensureDir(dir);
  const id = crypto.randomBytes(8).toString("hex");
  const file = path.join(dir, `${nowIsoSafe()}_${id}.json`);
  writeJson(file, { kind, ts: new Date().toISOString(), run_id: runId, payload });
  return file;
}

function cmdStart() {
  ensureDir(TMP_DIR);
  ensureDir(EVENTS_DIR);
  const runId = nowIsoSafe();
  const session = {
    active: true,
    run_id: runId,
    started_at: new Date().toISOString(),
    finished_at: null
  };
  writeJson(SESSION_FILE, session);
  writeEvent(runId, "session.started", { cwd: ROOT });
  console.log(JSON.stringify({ ok: true, run_id: runId }, null, 2));
}

function cmdStatus() {
  const session = readJson(SESSION_FILE);
  if (!session || !session.active) {
    console.log(JSON.stringify({ ok: true, active: false }, null, 2));
    return;
  }
  const base = path.join(EVENTS_DIR, session.run_id);
  const files = listFilesRecursive(base);
  console.log(JSON.stringify({
    ok: true,
    active: true,
    run_id: session.run_id,
    started_at: session.started_at,
    events_dir: rel(base),
    events_count: files.length
  }, null, 2));
}

function cmdFinish() {
  const session = readJson(SESSION_FILE);
  if (!session || !session.active) {
    console.log(JSON.stringify({ ok: false, error: "No active session" }, null, 2));
    process.exitCode = 2;
    return;
  }

  session.active = false;
  session.finished_at = new Date().toISOString();
  writeJson(SESSION_FILE, session);

  const runId = session.run_id;
  writeEvent(runId, "session.finished", { cwd: ROOT });

  const runEventsDir = path.join(EVENTS_DIR, runId);
  const eventFilesAbs = listFilesRecursive(runEventsDir).sort();
  const eventFilesRel = eventFilesAbs.map(rel);

  const episodeDir = path.join(EPISODES_DIR, runId);
  ensureDir(episodeDir);

  writeJson(path.join(episodeDir, "artifacts_index.json"), {
    run_id: runId,
    created_at: new Date().toISOString(),
    events: eventFilesRel
  });

  writeJson(path.join(episodeDir, "summary.json"), {
    ok: true,
    run_id: runId,
    started_at: session.started_at,
    finished_at: session.finished_at,
    totals: {
      events: eventFilesRel.length
    },
    refs: {
      events_dir: rel(runEventsDir),
      artifacts_index: rel(path.join(episodeDir, "artifacts_index.json"))
    }
  });

  console.log(JSON.stringify({ ok: true, run_id: runId, episode_dir: rel(episodeDir) }, null, 2));
}

function main() {
  const cmd = process.argv[2];
  if (!cmd || !["start", "status", "finish"].includes(cmd)) {
    console.error("Usage: node scripts/mova-session.js <start|status|finish>");
    process.exit(2);
  }
  if (cmd === "start") return cmdStart();
  if (cmd === "status") return cmdStatus();
  return cmdFinish();
}

main();

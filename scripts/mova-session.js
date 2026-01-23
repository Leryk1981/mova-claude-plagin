#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const MOVA_DIR = path.join(ROOT, ".mova");
const TMP_DIR = path.join(MOVA_DIR, "tmp");
const EVENTS_DIR = path.join(TMP_DIR, "opencode_events");
const SESSION_FILE = path.join(MOVA_DIR, "session.json");
const POLICY_FILE = path.join(MOVA_DIR, "policy_v0.json");
const EPISODES_DIR = path.join(MOVA_DIR, "episodes");

function nowIsoSafe() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function readJson(p) {
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(p, obj) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

function rel(p) {
  return path.relative(ROOT, p).replace(/\\/g, "/");
}

function eventLogPath(runId) {
  return path.join(EVENTS_DIR, `${runId}.jsonl`);
}

function readEventLines(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) return [];
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function summarizeOutcomes(events) {
  const counts = {};
  let lastDecision = null;
  for (const evt of events) {
    const code = evt && evt.outcome_code ? String(evt.outcome_code) : "UNKNOWN";
    counts[code] = (counts[code] || 0) + 1;
    lastDecision = code;
  }
  return { counts, lastDecision };
}

function cmdStart() {
  const existing = readJson(SESSION_FILE);
  if (existing && existing.active && existing.run_id) {
    console.log(
      JSON.stringify(
        { ok: true, run_id: existing.run_id, session_file: rel(SESSION_FILE) },
        null,
        2
      )
    );
    return;
  }

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
  ensureDir(path.dirname(eventLogPath(runId)));
  fs.writeFileSync(eventLogPath(runId), "", "utf8");
  console.log(JSON.stringify({ ok: true, run_id: runId, session_file: rel(SESSION_FILE) }, null, 2));
}

function cmdStatus() {
  const session = readJson(SESSION_FILE);
  if (!session || !session.active || !session.run_id) {
    console.log(JSON.stringify({ ok: true, active: false }, null, 2));
    return;
  }
  console.log(
    JSON.stringify(
      { ok: true, active: true, run_id: session.run_id, session_file: rel(SESSION_FILE) },
      null,
      2
    )
  );
}

function cmdFinish() {
  const session = readJson(SESSION_FILE);
  if (!session || !session.active || !session.run_id) {
    console.log(JSON.stringify({ ok: false, error: "No active session" }, null, 2));
    process.exitCode = 2;
    return;
  }

  session.active = false;
  session.finished_at = new Date().toISOString();
  writeJson(SESSION_FILE, session);

  const runId = session.run_id;
  const tmpEventsFile = eventLogPath(runId);
  const events = readEventLines(tmpEventsFile);
  const eventsCount = events.length;
  const { counts, lastDecision } = summarizeOutcomes(events);

  const episodeDir = path.join(EPISODES_DIR, runId);
  ensureDir(episodeDir);

  const episodeEvents = path.join(episodeDir, "events.jsonl");
  if (fs.existsSync(tmpEventsFile)) {
    fs.copyFileSync(tmpEventsFile, episodeEvents);
  } else {
    fs.writeFileSync(episodeEvents, "", "utf8");
  }

  if (fs.existsSync(POLICY_FILE)) {
    fs.copyFileSync(POLICY_FILE, path.join(episodeDir, "policy_snapshot.json"));
  }

  writeJson(path.join(episodeDir, "artifacts_index.json"), {
    run_id: runId,
    created_at: new Date().toISOString(),
    events_file: "events.jsonl",
    events_count: eventsCount,
    policy_snapshot: fs.existsSync(POLICY_FILE) ? "policy_snapshot.json" : null
  });

  writeJson(path.join(episodeDir, "summary.json"), {
    ok: true,
    run_id: runId,
    started_at: session.started_at,
    finished_at: session.finished_at,
    totals: { events: eventsCount },
    outcomes: counts,
    last_decision: lastDecision,
    refs: {
      events_file: rel(episodeEvents),
      policy_snapshot: fs.existsSync(POLICY_FILE)
        ? rel(path.join(episodeDir, "policy_snapshot.json"))
        : null
    }
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        run_id: runId,
        episode_dir: rel(episodeDir),
        events_count: eventsCount
      },
      null,
      2
    )
  );
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

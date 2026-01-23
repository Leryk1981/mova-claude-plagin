#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const MOVA_DIR = path.join(ROOT, ".mova");
const POLICY_FILE = path.join(MOVA_DIR, "policy_v0.json");
const TMP_DIR = path.join(MOVA_DIR, "tmp");
const POLICY_LOG = path.join(TMP_DIR, "policy_change.log");

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

function loadPolicy() {
  const fallback = {
    policy_version: "v0",
    bash: {
      mode_outside_session: "observe_only",
      default_inside_session: "allow",
      deny_contains: [],
      allow_contains: []
    }
  };
  const existing = readJson(POLICY_FILE);
  if (!existing || typeof existing !== "object") return fallback;
  const bash = existing.bash || {};
  return {
    policy_version: existing.policy_version || "v0",
    bash: {
      mode_outside_session: bash.mode_outside_session || "observe_only",
      default_inside_session: bash.default_inside_session || "allow",
      deny_contains: Array.isArray(bash.deny_contains) ? bash.deny_contains : [],
      allow_contains: Array.isArray(bash.allow_contains) ? bash.allow_contains : []
    }
  };
}

function appendLog(op, value) {
  ensureDir(TMP_DIR);
  const line = `ts=${new Date().toISOString()} op=${op} value="${String(value)}"`;
  fs.appendFileSync(POLICY_LOG, line + "\n", "utf8");
}

function uniquePush(list, value) {
  if (!value) return list;
  if (!list.includes(value)) list.push(value);
  return list;
}

function usage() {
  console.error("Usage: node scripts/mova-policy.js <show|deny-add|allow-add> [pattern]");
  process.exit(2);
}

function main() {
  const cmd = process.argv[2];
  const value = process.argv.slice(3).join(" ").trim();

  if (!cmd) usage();

  const policy = loadPolicy();

  if (cmd === "show") {
    writeJson(POLICY_FILE, policy);
    process.stdout.write(JSON.stringify(policy, null, 2) + "\n");
    return;
  }

  if (!value) usage();

  if (cmd === "deny-add") {
    uniquePush(policy.bash.deny_contains, value);
    writeJson(POLICY_FILE, policy);
    appendLog("deny-add", value);
    process.stdout.write(JSON.stringify({ deny_contains: policy.bash.deny_contains }, null, 2) + "\n");
    return;
  }

  if (cmd === "allow-add") {
    uniquePush(policy.bash.allow_contains, value);
    writeJson(POLICY_FILE, policy);
    appendLog("allow-add", value);
    process.stdout.write(JSON.stringify({ allow_contains: policy.bash.allow_contains }, null, 2) + "\n");
    return;
  }

  usage();
}

main();

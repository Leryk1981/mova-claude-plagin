import fs from "node:fs";
import path from "node:path";

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

function extractCommand(args) {
  if (!args) return "";
  if (typeof args.command === "string") return args.command;
  if (typeof args.cmd === "string") return args.cmd;
  if (typeof args.input === "string") return args.input;
  if (args.input && typeof args.input.command === "string") return args.input.command;
  if (args.args && typeof args.args.command === "string") return args.args.command;
  return "";
}

function appendEventLine(eventsFile, event) {
  ensureDir(path.dirname(eventsFile));
  fs.appendFileSync(eventsFile, JSON.stringify(event) + "\n", "utf8");
}

function loadPolicy(policyFile) {
  const fallback = {
    policy_version: "v0",
    bash: {
      mode_outside_session: "observe_only",
      default_inside_session: "allow",
      deny_contains: [],
      allow_contains: []
    },
    debug: { write_plugin_log: false }
  };
  const policy = readJson(policyFile);
  if (!policy || typeof policy !== "object") return fallback;
  return {
    policy_version: policy.policy_version || "v0",
    bash: {
      mode_outside_session: policy?.bash?.mode_outside_session || "observe_only",
      default_inside_session: policy?.bash?.default_inside_session || "allow",
      deny_contains: Array.isArray(policy?.bash?.deny_contains) ? policy.bash.deny_contains : [],
      allow_contains: Array.isArray(policy?.bash?.allow_contains) ? policy.bash.allow_contains : []
    },
    debug: { write_plugin_log: Boolean(policy?.debug?.write_plugin_log) }
  };
}

function maybeAppendLog(root, enabled, line) {
  if (!enabled) return;
  const dir = path.join(root, ".mova", "tmp");
  ensureDir(dir);
  fs.appendFileSync(path.join(dir, "opencode_plugin_debug.log"), line + "\n", "utf8");
}

function matchesAny(haystack, list) {
  return list.some((needle) => needle && haystack.includes(needle));
}

export default function movaPlugin(ctx) {
  const root = ctx?.worktree || ctx?.directory || process.cwd();
  const movaDir = path.join(root, ".mova");
  const sessionFile = path.join(movaDir, "session.json");
  const policyFile = path.join(movaDir, "policy_v0.json");
  const eventsDir = path.join(movaDir, "tmp", "opencode_events");

  return {
    "tool.execute.before": async (input, output) => {
      const tool = String(input?.tool || "");
      if (tool !== "bash") return;

      const policy = loadPolicy(policyFile);
      const args = output?.args;
      const command = extractCommand(args);
      const session = readJson(sessionFile);
      const active = Boolean(session && session.active && session.run_id);

      let outcomeCode = "ALLOW";
      if (!active) {
        outcomeCode = "NO_SESSION_OBSERVE_ONLY";
      } else if (matchesAny(command, policy.bash.deny_contains)) {
        outcomeCode = "BLOCKED_BY_POLICY";
      } else {
        const allowList = policy.bash.allow_contains;
        const defaultMode = policy.bash.default_inside_session;
        if (allowList.length > 0) {
          if (matchesAny(command, allowList)) {
            outcomeCode = "ALLOW";
          } else if (defaultMode === "block") {
            outcomeCode = "BLOCKED_BY_POLICY";
          }
        } else if (defaultMode === "block") {
          outcomeCode = "BLOCKED_BY_POLICY";
        }
      }

      const eventsFile = active
        ? path.join(eventsDir, `${session.run_id}.jsonl`)
        : path.join(movaDir, "tmp", "observe.jsonl");
      appendEventLine(eventsFile, {
        ts: new Date().toISOString(),
        session_active: active,
        run_id: active ? session.run_id : null,
        tool: "bash",
        command,
        outcome_code: outcomeCode
      });

      if (!active) {
        const marker = path.join(movaDir, "tmp", "observe.marker");
        ensureDir(path.dirname(marker));
        fs.appendFileSync(marker, `WROTE_OBSERVE ${new Date().toISOString()}\n`, "utf8");
      }

      maybeAppendLog(
        root,
        policy.debug.write_plugin_log,
        `ts=${new Date().toISOString()} tool=${tool} outcome=${outcomeCode} cmd="${command
          .replace(/\s+/g, " ")
          .slice(0, 200)}"`
      );

      if (outcomeCode === "BLOCKED_BY_POLICY") {
        throw new Error("MOVA_BLOCK: tool execution denied by policy");
      }
    }
  };
}

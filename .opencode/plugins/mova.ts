import fs from "node:fs";
import path from "node:path";

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function readSession(sessionFile) {
  if (!fs.existsSync(sessionFile)) return null;
  try {
    return JSON.parse(fs.readFileSync(sessionFile, "utf8"));
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

export default function movaPlugin(ctx) {
  const root = ctx?.worktree || ctx?.directory || process.cwd();
  const sessionFile = path.join(root, ".mova", "session.json");
  const eventsDir = path.join(root, ".mova", "tmp", "opencode_events");

  return {
    "tool.execute.before": async (input, output) => {
      const tool = String(input?.tool || "");
      if (tool !== "bash") return;

      const args = output?.args;
      const command = extractCommand(args);
      const session = readSession(sessionFile);
      const active = Boolean(session && session.active && session.run_id);
      const decision =
        active && command.includes("PROBE_BLOCK") ? "BLOCK" : "ALLOW";

      if (active) {
        const eventsFile = path.join(eventsDir, `${session.run_id}.jsonl`);
        appendEventLine(eventsFile, {
          ts: new Date().toISOString(),
          tool: "bash",
          command,
          decision
        });
      }

      if (decision === "BLOCK") {
        throw new Error("MOVA_BLOCK: tool execution denied by policy");
      }
    }
  };
}

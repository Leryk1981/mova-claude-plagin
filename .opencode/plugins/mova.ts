import fs from "node:fs";
import path from "node:path";

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function safeStringify(v) {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
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

function appendLog(root, line) {
  const dir = path.join(root, ".mova", "tmp");
  ensureDir(dir);
  fs.appendFileSync(path.join(dir, "opencode_plugin_debug.log"), line + "\n", "utf8");
}

export default function movaPlugin(ctx) {
  const root = ctx?.worktree || ctx?.directory || process.cwd();

  return {
    hooks: {
      "tool.execute.before": async (input, output) => {
        const tool = String(input?.tool || "");
        const args = output?.args;
        const command = extractCommand(args);
        const raw = safeStringify({ input, output });
        const decision =
          tool === "bash" && (command.includes("PROBE_BLOCK") || raw.includes("PROBE_BLOCK"))
            ? "BLOCK"
            : "ALLOW";
        const cleanCmd = command.replace(/\s+/g, " ").slice(0, 500);
        appendLog(
          root,
          `ts=${new Date().toISOString()} tool=${tool} command="${cleanCmd}" decision=${decision}`
        );

        if (decision === "BLOCK") {
          throw new Error("MOVA_BLOCK: tool execution denied by policy");
        }
      }
    },
    tools: []
  };
}

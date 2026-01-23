function safeStringify(v) {
  try { return JSON.stringify(v); } catch (e) { return String(v); }
}

function writeLog(root, line) {
  var fs = require("node:fs");
  var path = require("node:path");
  var dir = path.join(root, ".mova", "tmp");
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, "opencode_plugin_debug.log"), line + "\n", "utf8");
}

function extractCommand(payload) {
  var cmd = "";
  if (!payload || typeof payload !== "object") return cmd;
  if (typeof payload.command === "string") return payload.command;
  if (payload.input && typeof payload.input.command === "string") return payload.input.command;
  if (payload.args && typeof payload.args.command === "string") return payload.args.command;
  if (payload.params && typeof payload.params.command === "string") return payload.params.command;
  if (payload.tool && typeof payload.tool.command === "string") return payload.tool.command;
  return cmd;
}

function extractToolName(payload) {
  if (!payload || typeof payload !== "object") return "";
  if (typeof payload.name === "string") return payload.name;
  if (typeof payload.tool === "string") return payload.tool;
  if (payload.tool && typeof payload.tool.name === "string") return payload.tool.name;
  if (typeof payload.id === "string") return payload.id;
  return "";
}

export default function movaPlugin(ctx) {
  var root = (ctx && (ctx.worktree || ctx.directory)) || process.cwd();

  return {
    hooks: {
      "tool.execute.before": async function (payload) {
        var raw = safeStringify(payload);
        var toolName = extractToolName(payload);
        var cmd = extractCommand(payload);
        var decision = "ALLOW";

        if (raw.indexOf("PROBE_BLOCK") >= 0 || (cmd && cmd.indexOf("PROBE_BLOCK") >= 0)) {
          decision = "BLOCK";
        } else if (raw.indexOf("PROBE_ALLOW") >= 0 || (cmd && cmd.indexOf("PROBE_ALLOW") >= 0)) {
          decision = "ALLOW";
        }

        var head = raw.length > 2000 ? raw.slice(0, 2000) : raw;
        var line = new Date().toISOString() +
          " tool=" + toolName +
          " cmd=" + (cmd || "") +
          " decision=" + decision +
          " raw=" + head;
        writeLog(root, line);

        if (decision === "BLOCK") {
          throw new Error("MOVA_BLOCK: tool execution denied by policy");
        }
      }
    },
    tools: []
  };
}

import fs from "node:fs";
import path from "node:path";

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function append(root: string, line: string) {
  const dir = path.join(root, ".mova", "tmp");
  ensureDir(dir);
  fs.appendFileSync(path.join(dir, "opencode_hook_probe.log"), line + "\n", "utf8");
}

function safeStr(v: any) {
  try { return JSON.stringify(v); } catch { return String(v); }
}

export default function movaPlugin(ctx: any) {
  const root = ctx?.worktree || ctx?.directory || process.cwd();
  append(root, [init] root= ts=);

  return {
    hooks: {
      "tool.execute.before": async (payload: any) => {
        const raw = safeStr(payload);
        append(root, [before] ts= raw=);

        if (raw.includes("PROBE_BLOCK")) {
          append(root, [block] ts= reason=probe_block);
          throw new Error("MOVA_BLOCK: tool execution denied by policy");
        }
      }
    },
    tools: []
  };
}

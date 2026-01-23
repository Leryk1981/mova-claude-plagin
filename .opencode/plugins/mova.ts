import fs from "node:fs";
import path from "node:path";

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function append(root: string, line: string) {
  const dir = path.join(root, ".mova", "tmp");
  ensureDir(dir);
  fs.appendFileSync(path.join(dir, "plugin_loaded.log"), line + "\n", "utf8");
}

// TOP-LEVEL SIDE EFFECT (proof of load)
append(process.cwd(), [load] cwd= ts=);

export default function movaPlugin(ctx: any) {
  const root = ctx?.worktree || ctx?.directory || process.cwd();
  append(root, [init] root= ts=);

  return {
    hooks: {
      "tool.execute.before": async (payload: any) => {
        append(root, [hook] tool.execute.before ts=);
      }
    },
    tools: []
  };
}

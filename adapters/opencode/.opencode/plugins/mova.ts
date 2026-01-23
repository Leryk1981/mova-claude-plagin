import type { Plugin } from "@opencode-ai/plugin";
import fs from "node:fs";
import path from "node:path";

function nowStamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3,"0")}Z`;
}

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function writeEvent(baseDir: string, kind: string, payload: any) {
  const dir = path.join(baseDir, "opencode_events", kind);
  ensureDir(dir);
  const file = path.join(dir, `${nowStamp()}.json`);
  const event = {
    mova_adapter: "opencode",
    kind,
    ts: new Date().toISOString(),
    payload
  };
  fs.writeFileSync(file, JSON.stringify(event, null, 2));
  return file;
}

export const movaPlugin: Plugin = async ({ client, directory, worktree, project, $ }) => {
  const log = (level: "info" | "debug" | "error", msg: string) =>
    client.app.log(level, `[mova/opencode] ${msg}`);

  const repoDir = worktree || directory || process.cwd();
  const movaTmp = path.join(repoDir, ".mova", "tmp");

  async function runScript(scriptRel: string, eventFile: string) {
    // Convention: scripts accept --event-file <path>
    // If your scripts currently use a different flag, adjust here ONLY (adapter stays thin).
    const scriptPath = path.join(repoDir, scriptRel);
    const res = await $`node ${scriptPath} --event-file ${eventFile}`;
    return {
      code: res.exitCode ?? 0,
      stdout: String(res.stdout ?? ""),
      stderr: String(res.stderr ?? "")
    };
  }

  return {
    hooks: {
      "session.created": async (session: any) => {
        const eventFile = writeEvent(movaTmp, "session.created", { session, directory, worktree, project });
        log("info", `session.created -> ${eventFile}`);
        await runScript("scripts/mova-observe.js", eventFile);
      },

      "tool.execute.before": async (toolCall: any) => {
        const eventFile = writeEvent(movaTmp, "tool.execute.before", { toolCall });
        log("debug", `tool.execute.before -> ${eventFile}`);

        const out = await runScript("scripts/mova-guard.js", eventFile);

        // Protocol v0: guard blocks if stdout contains "MOVA_BLOCK"
        if (out.stdout.includes("MOVA_BLOCK")) {
          log("error", `BLOCK tool=${toolCall?.name ?? "?"}`);
          throw new Error("MOVA_BLOCK: tool execution denied by policy");
        }
      },

      "tool.execute.after": async (result: any) => {
        const eventFile = writeEvent(movaTmp, "tool.execute.after", { result });
        log("debug", `tool.execute.after -> ${eventFile}`);
        await runScript("scripts/mova-observe.js", eventFile);
      }
    },
    tools: []
  };
};

export default movaPlugin;
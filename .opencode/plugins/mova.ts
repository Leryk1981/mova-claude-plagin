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

  function truncateValue(value: unknown): unknown {
    if (typeof value === "string") {
      return value.length > 2000 ? value.slice(0, 2000) : value;
    }
    if (Array.isArray(value)) {
      return value.map(truncateValue);
    }
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        out[k] = truncateValue(v);
      }
      return out;
    }
    return value;
  }

  async function writeTraceEvent(kind: string, payload: unknown) {
    const scriptPath = path.join(repoDir, "scripts/mova-event-write.js");
    const payloadJson = JSON.stringify(truncateValue(payload));
    await $`node ${scriptPath} --kind ${kind} --json ${payloadJson}`;
  }

  async function runGuardWithInput(payload: { input: unknown; output: unknown }) {
    const scriptPath = path.join(repoDir, "scripts/mova-guard.js");
    const payloadJson = JSON.stringify(payload);
    const res = await $`node ${scriptPath} --input-json ${payloadJson}`;
    return {
      code: res.exitCode ?? 0,
      stdout: String(res.stdout ?? ""),
      stderr: String(res.stderr ?? "")
    };
  }

  return {
    hooks: {
      "file.edited": async (file: any) => {
        const p = String(file?.path ?? '');
        await writeTraceEvent("file.edited", { path: p });
        const protectedPrefixes = [
          'scripts/mova-guard.js',
          'scripts/mova-security.js',
          'scripts/mova-observe.js',
          'mova/control_v0.json',
          'presets/'
        ];
        const isProtected = protectedPrefixes.some(x => p === x || (x.endsWith('/') && p.startsWith(x)));
        if (isProtected) {
          client.app.log('error', `[mova/opencode] EDIT DENIED: ${p}`);
        }
      },

      "session.created": async (session: any) => {
        const eventFile = writeEvent(movaTmp, "session.created", { session, directory, worktree, project });
        log("info", `session.created -> ${eventFile}`);
        await runScript("scripts/mova-observe.js", eventFile);
      },

      "tool.execute.before": async (input: any, output: any) => {
        const eventFile = writeEvent(movaTmp, "tool.execute.before", { input, output });
        log("debug", `tool.execute.before -> ${eventFile}`);

        const rawPayload = { hook: "tool.execute.before", input, output };
        await writeTraceEvent("tool.execute.before.raw", rawPayload);

        const toolName = String(
          input?.name ?? input?.tool ?? input?.id ?? output?.tool ?? output?.name ?? ""
        );
        const toolArgs =
          input?.args ??
          input?.arguments ??
          input?.input ??
          input?.params ??
          output?.args ??
          output?.arguments ??
          output?.input ??
          output?.params ??
          {};
        await writeTraceEvent("tool.execute.before", { tool: toolName, args: toolArgs });

        const guardOut = await runGuardWithInput({ input, output });
        let decision = "ALLOW";
        let reason = "unknown";
        let ruleId = "unknown";
        try {
          const parsed = JSON.parse(guardOut.stdout);
          decision = String(parsed.decision || "ALLOW").toUpperCase();
          reason = String(parsed.reason || "unknown");
          ruleId = String(parsed.rule_id || "unknown");
        } catch {}

        if (decision === "BLOCK") {
          await writeTraceEvent("tool.blocked", {
            decision,
            reason,
            rule_id: ruleId
          });
          throw new Error("MOVA_BLOCK: tool execution denied by policy");
        }
      },

      "tool.execute.after": async (result: any) => {
        const eventFile = writeEvent(movaTmp, "tool.execute.after", { result });
        log("debug", `tool.execute.after -> ${eventFile}`);
        const toolName = String(result?.tool ?? result?.name ?? result?.id ?? "");
        const status = String(result?.status ?? result?.state?.status ?? "");
        const ok = status === "completed";
        await writeTraceEvent("tool.execute.after", { tool: toolName, status, ok });
        await runScript("scripts/mova-observe.js", eventFile);
      }
    },
    tools: []
  };
};

export default movaPlugin;

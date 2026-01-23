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

  async function runGuardWithInput(payload: {
    tool_name: string;
    tool_args: unknown;
    cwd: string;
    file_path?: string;
  }) {
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

      "tool.execute.before": async (toolCall: any) => {
        const eventFile = writeEvent(movaTmp, "tool.execute.before", { toolCall });
        log("debug", `tool.execute.before -> ${eventFile}`);

        const toolName = String(
          toolCall?.name ?? toolCall?.tool ?? toolCall?.id ?? ""
        );
        const toolArgs =
          toolCall?.args ??
          toolCall?.arguments ??
          toolCall?.input ??
          toolCall?.params ??
          {};
        await writeTraceEvent("tool.execute.before", { tool: toolName, args: toolArgs });
        const cmd =
          typeof toolArgs === "string"
            ? toolArgs
            : typeof toolArgs?.command === "string"
              ? toolArgs.command
              : "";
        if (toolName === "bash" && cmd.includes("PROBE_BLOCK")) {
          await writeTraceEvent("tool.blocked", {
            tool: "bash",
            command: cmd,
            reason: "probe_block"
          });
          throw new Error("MOVA_BLOCK: tool execution denied by policy");
        }
        const payload: {
          tool_name: string;
          tool_args: unknown;
          cwd: string;
          file_path?: string;
        } = { tool_name: toolName, tool_args: toolArgs, cwd: repoDir };
        if (typeof toolCall?.path === "string") {
          payload.file_path = toolCall.path;
        } else if (typeof toolCall?.file?.path === "string") {
          payload.file_path = toolCall.file.path;
        } else if (typeof toolArgs?.path === "string") {
          payload.file_path = toolArgs.path;
        }

        const out = await runGuardWithInput(payload);

        // Protocol v0: parse explicit decision line
        const m = out.stdout.match(/^MOVA_DECISION=(ALLOW|BLOCK|WARN)\s*$/m);
        const decision = (m ? m[1] : 'ALLOW');
        const reasonMatch = out.stdout.match(/^MOVA_REASON=(.*)$/m);
        const reason = reasonMatch ? reasonMatch[1].trim() : "";
        if (decision === 'BLOCK') {
          const blockedEventFile = writeEvent(movaTmp, "tool.blocked", {
            toolCall,
            decision,
            reason,
            stdout: out.stdout,
            stderr: out.stderr
          });
          log('error', `BLOCK tool=${toolCall?.name ?? '?'} -> ${blockedEventFile}`);
          await runScript("scripts/mova-observe.js", blockedEventFile);
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

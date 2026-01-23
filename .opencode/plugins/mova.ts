function safeStringify(v: any) {
  try { return JSON.stringify(v); } catch { return String(v); }
}

export default function movaPlugin({ client }: any) {
  client?.app?.log?.("info", "MOVA plugin loaded (throw-block v0)");

  return {
    hooks: {
      "tool.execute.before": async (payload: any) => {
        const raw = safeStringify(payload);
        // Log only a small prefix to avoid huge payload issues
        client?.app?.log?.("debug", MOVA before: );

        if (raw.includes("PROBE_BLOCK")) {
          client?.app?.log?.("error", "MOVA_BLOCK: probe_block matched; denying tool execution");
          throw new Error("MOVA_BLOCK: tool execution denied by policy");
        }
      }
    },
    tools: []
  };
}

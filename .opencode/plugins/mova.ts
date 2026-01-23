function safeStringify(v) {
  try { return JSON.stringify(v); } catch (e) { return String(v); }
}

export default function movaPlugin(ctx) {
  var client = ctx && ctx.client;

  if (client && client.app && typeof client.app.log === "function") {
    client.app.log("info", "MOVA plugin loaded (ultra-compatible v0)");
  }

  return {
    hooks: {
      "tool.execute.before": async function (payload) {
        var raw = safeStringify(payload);
        // keep logs small
        var head = raw.length > 800 ? raw.slice(0, 800) : raw;

        if (client && client.app && typeof client.app.log === "function") {
          client.app.log("debug", "MOVA before: " + head);
        }

        if (raw.indexOf("PROBE_BLOCK") >= 0) {
          if (client && client.app && typeof client.app.log === "function") {
            client.app.log("error", "MOVA_BLOCK: probe_block matched; denying tool execution");
          }
          throw new Error("MOVA_BLOCK: tool execution denied by policy");
        }
      }
    },
    tools: []
  };
}

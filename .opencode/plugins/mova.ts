function safeStringify(v) {
  try { return JSON.stringify(v); } catch (e) { return String(v); }
}

export default function movaPlugin(ctx) {
  var client = ctx && ctx.client;
  function log(level, msg) {
    if (client && client.app && typeof client.app.log === "function") client.app.log(level, msg);
  }

  log("info", "MOVA plugin loaded (event-discovery v0)");

  function mk(name) {
    return async function (payload) {
      var raw = safeStringify(payload);
      var head = raw.length > 1200 ? raw.slice(0, 1200) : raw;
      log("info", "MOVA EVENT " + name);
      log("debug", "MOVA PAYLOAD " + name + ": " + head);

      // Try hard-block on ANY event that sees PROBE_BLOCK
      if (raw.indexOf("PROBE_BLOCK") >= 0) {
        log("error", "MOVA_BLOCK hit in event " + name);
        throw new Error("MOVA_BLOCK: denied in " + name);
      }
    };
  }

  return {
    hooks: {
      // from docs list
      "tui.command.execute": mk("tui.command.execute"),
      "command.executed": mk("command.executed"),
      "tool.execute.before": mk("tool.execute.before"),
      "tool.execute.after": mk("tool.execute.after")
    },
    tools: []
  };
}

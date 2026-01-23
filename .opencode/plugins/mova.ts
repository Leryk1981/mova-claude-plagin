export default function movaPlugin({ client }: any) {
  client?.app?.log?.("info", "MOVA plugin loaded (no-import baseline)");
  return {
    hooks: {
      "tool.execute.before": async (_payload: any) => {
        client?.app?.log?.("info", "MOVA hook: tool.execute.before");
      }
    },
    tools: []
  };
}

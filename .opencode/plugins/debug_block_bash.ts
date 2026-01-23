import type { Plugin } from "@opencode-ai/plugin";

export const DebugBlockBash: Plugin = async ({ client }) => {
  await client.app.log({
    service: "mova-debug",
    level: "info",
    message: "DebugBlockBash loaded"
  });

  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool === "bash") {
        await client.app.log({
          service: "mova-debug",
          level: "warn",
          message: "Blocking bash via debug plugin",
          extra: { command: (output as any)?.args?.command }
        });
        throw new Error("DEBUG_BLOCK: bash denied (hook is firing)");
      }
    }
  };
};

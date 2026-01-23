import type { Plugin } from "@opencode-ai/plugin";

export const movaPlugin: Plugin = async ({ client }) => {
  client.app.log("info", "[mova/opencode] plugin loaded");
  return { hooks: {}, tools: [] };
};

export default movaPlugin;
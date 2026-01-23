#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const home = process.env.USERPROFILE || process.env.HOME;
if (!home) {
  console.error("No USERPROFILE/HOME found");
  process.exit(2);
}

const globalPluginsDir = path.join(home, ".config", "opencode", "plugins");
fs.mkdirSync(globalPluginsDir, { recursive: true });

const target = path.join(globalPluginsDir, "mova-loader.js");

const content = [
  "import fs from \"node:fs\";",
  "import path from \"node:path\";",
  "import { pathToFileURL } from \"node:url\";",
  "",
  "function ensureDir(p){ fs.mkdirSync(p,{recursive:true}); }",
  "function append(root,line){",
  "  const dir = path.join(root,\".mova\",\"tmp\");",
  "  ensureDir(dir);",
  "  fs.appendFileSync(path.join(dir,\"opencode_global_loader.log\"), line+\"\\n\",\"utf8\");",
  "}",
  "",
  "append(process.cwd(), \"[global-load] cwd=\" + process.cwd() + \" ts=\" + new Date().toISOString());",
  "",
  "export default async function movaGlobalLoader(ctx){",
  "  const root = ctx?.worktree || ctx?.directory || process.cwd();",
  "  append(root, \"[global-init] root=\" + root + \" ts=\" + new Date().toISOString());",
  "",
  "  const projectPluginPath = path.join(root,\".opencode\",\"plugins\",\"mova.ts\");",
  "  let projectPlugin = null;",
  "  try{",
  "    if (fs.existsSync(projectPluginPath)) {",
  "      const mod = await import(pathToFileURL(projectPluginPath).href);",
  "      projectPlugin = mod?.default;",
  "      append(root, \"[global-init] project-plugin-loaded path=\" + projectPluginPath);",
  "    } else {",
  "      append(root, \"[global-init] project-plugin-missing path=\" + projectPluginPath);",
  "    }",
  "  }catch(e){",
  "    append(root, \"[global-init] project-plugin-load-error \" + String(e && e.message || e));",
  "  }",
  "",
  "  const delegate = projectPlugin ? await projectPlugin(ctx) : null;",
  "",
  "  return {",
  "    hooks: {",
  "      \"tool.execute.before\": async (p) => {",
  "        append(root, \"[global-hook] tool.execute.before ts=\" + new Date().toISOString());",
  "        if (delegate?.hooks?.[\"tool.execute.before\"]) return delegate.hooks[\"tool.execute.before\"](p);",
  "      },",
  "      \"tool.execute.after\": async (p) => {",
  "        if (delegate?.hooks?.[\"tool.execute.after\"]) return delegate.hooks[\"tool.execute.after\"](p);",
  "      },",
  "      \"file.edited\": async (p) => {",
  "        if (delegate?.hooks?.[\"file.edited\"]) return delegate.hooks[\"file.edited\"](p);",
  "      }",
  "    },",
  "    tools: delegate?.tools || []",
  "  };",
  "}",
  ""
].join("\n");

fs.writeFileSync(target, content, "utf8");
console.log(JSON.stringify({ ok: true, installed: target }, null, 2));

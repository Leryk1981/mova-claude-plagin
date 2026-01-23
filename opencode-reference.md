# OpenCode: Reference Documentation
## Skills, Plugins, Slash Commands, MCP, and Native Tools

**Version**: OpenCode 0.0.55+ (Latest 2026)  
**License**: MIT (Open Source)  
**Repository**: https://github.com/sst/opencode  
**Documentation**: https://opencode.ai/docs

---

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Plugins System](#plugins-system)
3. [Custom Commands](#custom-commands)
4. [Skills Implementation](#skills-implementation)
5. [MCP (Model Context Protocol)](#mcp-model-context-protocol)
6. [Native Tools & LSP](#native-tools--lsp)
7. [Configuration Reference](#configuration-reference)

---

## Core Concepts

### Architecture Overview

OpenCode is a Go-based CLI AI coding agent with these key layers:

```
┌─────────────────────────────────────┐
│   Terminal User Interface (TUI)     │
│   (Plan & Build modes)              │
├─────────────────────────────────────┤
│   Plugin Engine                     │
│   (Event hooks, custom tools)       │
├─────────────────────────────────────┤
│   Tool Runtime                      │
│   (Native tools, LSP, MCP, custom)  │
├─────────────────────────────────────┤
│   AI Provider Integration           │
│   (Anthropic, OpenAI, Gemini, etc)  │
├─────────────────────────────────────┤
│   Session Management                │
│   (Persistent state, context)       │
└─────────────────────────────────────┘
```

### Multi-Model Support

OpenCode supports 75+ LLM providers through unified interface:
- Anthropic (Claude)
- OpenAI (GPT-4, GPT-3.5)
- Google (Gemini 2.5)
- Grok (xAI)
- DeepSeek (R1)
- Local models (Ollama, LLaMA)
- And 70+ others

Switch models with `Ctrl+O` in TUI or `/model` command.

---

## Plugins System

### Overview

Plugins extend OpenCode by:
- Hooking into lifecycle events
- Adding custom tools
- Modifying default behavior
- Integrating external services

### Plugin Structure

```
~/.config/opencode/plugins/           # Global plugins (Linux/macOS)
~/.opencode/plugins/                   # Windows location
./.opencode/plugins/                   # Project-level plugins
```

OpenCode loads plugins in order:
1. Global configuration
2. Project configuration
3. Global plugins directory
4. Project plugins directory

### Creating a Plugin

#### Basic Structure (JavaScript)

```javascript
// .opencode/plugins/my-plugin.js
export default function myPlugin({ project, directory, worktree, client, $ }) {
  return {
    hooks: {
      // Event handlers
    },
    tools: [
      // Custom tools
    ]
  };
}
```

#### TypeScript Support

```typescript
// .opencode/plugins/my-plugin.ts
import type { Plugin } from "@opencode-ai/plugin";

export const myPlugin: Plugin = async ({ client, $ }) => {
  console.log("Plugin loaded!");
  
  return {
    hooks: {
      // hooks here
    },
    tools: []
  };
};
```

### Plugin Context Object

| Parameter | Type | Description |
|-----------|------|-------------|
| `project` | string | Current project information |
| `directory` | string | Current working directory |
| `worktree` | string | Git worktree path |
| `client` | object | OpenCode SDK client |
| `$` | function | Bun shell API for executing commands |

### Event Hooks (Complete Reference)

#### Command Events
- `command.executed` — After command execution

#### File Events
- `file.edited` — File modified
- `file.watcher.updated` — File changed (watch mode)

#### LSP Events
- `lsp.client.diagnostics` — Diagnostics received
- `lsp.updated` — LSP status changed

#### Message Events
- `message.updated` — Message updated
- `message.part.updated` — Message part updated
- `message.part.removed` — Message part removed
- `message.removed` — Message deleted

#### Permission Events
- `permission.replied` — User responded to permission prompt
- `permission.updated` — Permission state changed

#### Server Events
- `server.connected` — Server connection established

#### Session Events
- `session.created` — New session created
- `session.updated` — Session state changed
- `session.error` — Session error occurred
- `session.idle` — Session became idle
- `session.status` — Status changed
- `session.compacted` — Context compacted (summarization)
- `session.deleted` — Session removed
- `session.diff` — Diff generated

#### Todo Events
- `todo.updated` — Todo item changed

#### Tool Events
- `tool.execute.before` — Before tool execution
- `tool.execute.after` — After tool execution

#### TUI Events
- `tui.prompt.append` — Prompt added to TUI
- `tui.command.execute` — Command executed in TUI
- `tui.toast.show` — Notification displayed

### Custom Tools

Tools define actions the AI agent can perform.

#### Tool Definition

```javascript
const tool = {
  name: 'example-tool',
  description: 'What this tool does',
  args: z.object({
    param1: z.string().describe('Description of param1'),
    param2: z.number().optional()
  }),
  execute: async ({ param1, param2 }) => {
    // Implementation
    return result;
  }
};
```

#### Using Zod for Schema

```javascript
import { z } from 'zod';

export default function myPlugin({ $ }) {
  return {
    tools: [
      {
        name: 'fetch-data',
        description: 'Fetch data from external API',
        args: z.object({
          url: z.string().url(),
          method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('GET'),
          headers: z.record(z.string()).optional()
        }),
        execute: async ({ url, method, headers }) => {
          const result = await $`curl -X ${method} ${url}`;
          return result.stdout;
        }
      }
    ]
  };
}
```

### Plugin Examples

#### Example 1: Event Logging

```javascript
export default function loggingPlugin({ client }) {
  return {
    hooks: {
      'session.created': async (session) => {
        client.app.log('info', `Session created: ${session.id}`);
      },
      'tool.execute.before': async (tool) => {
        client.app.log('debug', `Executing: ${tool.name}`);
      },
      'tool.execute.after': async (result) => {
        client.app.log('debug', `Tool completed: ${result.status}`);
      }
    }
  };
}
```

#### Example 2: File Protection

```javascript
export default function securityPlugin({ client }) {
  return {
    hooks: {
      'file.edited': async (file) => {
        const protectedPatterns = ['.env', 'secrets.json', 'private*'];
        const isProtected = protectedPatterns.some(p => file.path.includes(p));
        
        if (isProtected) {
          client.app.log('error', `Access denied: ${file.path}`);
          throw new Error(`Cannot edit protected file: ${file.path}`);
        }
      }
    }
  };
}
```

#### Example 3: Environment Integration

```javascript
import axios from 'axios';

export default function externalServicePlugin({ client, $ }) {
  return {
    tools: [
      {
        name: 'call-external-api',
        description: 'Call external API and return response',
        args: z.object({
          endpoint: z.string(),
          data: z.record(z.any()).optional()
        }),
        execute: async ({ endpoint, data }) => {
          try {
            const response = await axios.post(endpoint, data);
            return JSON.stringify(response.data, null, 2);
          } catch (error) {
            return `Error: ${error.message}`;
          }
        }
      }
    ]
  };
}
```

### Plugin Dependencies

If plugins require external npm packages:

```json
// ~/.config/opencode/package.json
{
  "dependencies": {
    "axios": "^1.6.0",
    "lodash": "^4.17.21",
    "cheerio": "^1.0.0"
  }
}
```

OpenCode runs `bun install` at startup to install dependencies.

---

## Custom Commands

### Overview

Custom commands are predefined prompts in Markdown files, accessible via `Ctrl+K` in TUI.

### Command Locations

```
~/.config/opencode/commands/    # Global commands (prefix: user:)
./.opencode/commands/            # Project commands (prefix: project:)
```

File hierarchy preserved:
```
.opencode/commands/debug.md              → project:debug
.opencode/commands/git/commit.md         → project:git:commit
```

### Basic Command

```markdown
# Analyze Code Quality

Review the codebase for:
- Performance issues
- Security vulnerabilities
- Dead code
- Code duplication
- Best practice violations

Provide actionable recommendations.
```

### Commands with Arguments

OpenCode supports named placeholders: `$ARGUMENT_NAME` (alphanumeric + underscore)

```markdown
# Debug Issue $ISSUE_ID

Analyze and fix GitHub issue #$ISSUE_ID:

RUN gh issue view $ISSUE_ID --json title,body,comments
RUN git log --grep="$ISSUE_ID" -n 5
RUN grep -r "$SEARCH_PATTERN" $DIRECTORY --include="*.js"
```

When executed, prompts for values:
```
Issue ID: 123
Search Pattern: console.log
Directory: ./src
```

### Command Features

| Feature | Syntax | Example |
|---------|--------|---------|
| Run command | `RUN` | `RUN npm test` |
| Read file | `READ` | `READ package.json` |
| Analyze structure | `ANALYZE_STRUCTURE` | `ANALYZE_STRUCTURE` |
| Git operations | `RUN git ...` | `RUN git log -n 10` |
| Search files | `RUN grep` | `RUN grep -r "error" .` |
| Named arguments | `$VAR_NAME` | `$FILE_PATH, $LANGUAGE` |

### Built-in Commands

OpenCode provides these automatically:

- `/init` — Initialize AGENTS.md file for project context
- `/undo` — Undo last change
- `/redo` — Redo undone change
- `@` — Fuzzy search files
- `Tab` — Switch Plan/Build mode

---

## Skills Implementation

### Concept

OpenCode doesn't have native "Skills" like Claude, but you can implement them through:

1. **Plugins with organized tools**
2. **AGENTS.md documentation**
3. **Ecosystem plugins** (oh-my-opencode, opencode-skillful)

### Approach 1: Plugin-Based Skills

```javascript
// .opencode/plugins/skills.js
import { z } from 'zod';

const apiSkill = {
  name: 'api-development',
  description: 'RESTful API development and testing',
  tools: [
    {
      name: 'generate-endpoint',
      description: 'Generate REST endpoint with validation',
      args: z.object({
        method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
        path: z.string(),
        responseType: z.string()
      }),
      execute: async ({ method, path, responseType }) => {
        // Generate endpoint code
      }
    },
    {
      name: 'test-endpoint',
      description: 'Test endpoint with sample data',
      args: z.object({
        url: z.string().url(),
        payload: z.record(z.any()).optional()
      }),
      execute: async ({ url, payload }) => {
        // Test implementation
      }
    }
  ]
};

export default function skillsPlugin({ client }) {
  return {
    tools: apiSkill.tools,
    hooks: {
      'session.created': async () => {
        client.app.log('info', `Skills loaded: ${apiSkill.name}`);
      }
    }
  };
}
```

### Approach 2: AGENTS.md Documentation

```markdown
# Project Agent Configuration

## Available Skills

### Web Development Skill
- **Tool**: generate-component
- **Tool**: style-component
- **Tool**: add-responsive-design

### API Development Skill
- **Tool**: generate-endpoint
- **Tool**: add-authentication
- **Tool**: write-tests

### Database Skill
- **Tool**: design-schema
- **Tool**: create-migration
- **Tool**: optimize-query

## Skill Activation

Skills activate automatically based on:
- Project structure detection
- File patterns
- User intent in messages
```

### Approach 3: Ecosystem Plugins

Use community plugins for pre-built skills:

```json
{
  "plugins": [
    "opencode-skillful",
    "oh-my-opencode",
    "opencode-background-agents"
  ]
}
```

---

## MCP (Model Context Protocol)

### Overview

MCP enables AI agents to access external services through standardized protocol.

### Configuration

```json
{
  "mcpServers": {
    "server-name": {
      "type": "stdio",
      "command": "node",
      "args": ["./server.js"],
      "env": {
        "API_KEY": "${ENVIRONMENT_VAR}"
      }
    },
    "http-server": {
      "type": "sse",
      "url": "https://api.example.com/mcp",
      "headers": {
        "Authorization": "Bearer ${TOKEN}"
      }
    }
  }
}
```

### Connection Types

#### 1. Stdio (Local Process)

```json
{
  "type": "stdio",
  "command": "executable-path",
  "args": ["arg1", "arg2"],
  "env": {
    "VAR": "value"
  }
}
```

**Use case**: Local scripts, internal services

#### 2. SSE (HTTP Server-Sent Events)

```json
{
  "type": "sse",
  "url": "https://example.com/mcp",
  "headers": {
    "Authorization": "Bearer token"
  }
}
```

**Use case**: Remote APIs, cloud services, SaaS integrations

### MCP Server Example

```javascript
// mcp-server.js
import stdio from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequest, ListToolsRequest } from '@modelcontextprotocol/sdk/types.js';

const server = new stdio.StdioServer({
  name: 'my-service',
  version: '1.0.0',
});

// Define available tools
server.setRequestHandler(ListToolsRequest, async () => ({
  tools: [
    {
      name: 'get_data',
      description: 'Retrieve data from service',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          limit: { type: 'number', default: 10 }
        },
        required: ['query']
      }
    },
    {
      name: 'process_data',
      description: 'Process and transform data',
      inputSchema: {
        type: 'object',
        properties: {
          data: { type: 'object' },
          operation: { type: 'string' }
        },
        required: ['data', 'operation']
      }
    }
  ]
}));

// Handle tool calls
server.setRequestHandler(CallToolRequest, async (request) => {
  const { name, arguments: args } = request;
  
  if (name === 'get_data') {
    const result = await fetchData(args.query, args.limit);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  }
  
  if (name === 'process_data') {
    const result = await processData(args.data, args.operation);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  }
  
  throw new Error(`Unknown tool: ${name}`);
});

async function fetchData(query, limit) {
  // Implementation
  return { results: [] };
}

async function processData(data, operation) {
  // Implementation
  return { status: 'completed' };
}

server.start();
```

---

## Native Tools & LSP

### Built-in Tools

OpenCode provides these tools automatically to AI agents:

#### File Tools

| Tool | Parameters | Description |
|------|-----------|-------------|
| `glob` | `pattern` (required), `path` | Find files by pattern |
| `grep` | `pattern` (required), `path`, `include` | Search file contents |
| `ls` | `path`, `ignore` (array) | List directory contents |
| `view` | `file_path` (required), `offset`, `limit` | Read file |
| `write` | `file_path` (required), `content` | Write to file |
| `edit` | Various (structure edits) | Modify file content |
| `patch` | `file_path`, `diff` (required) | Apply patch |

#### System Tools

| Tool | Parameters | Description |
|------|-----------|-------------|
| `bash` | `command` (required), `timeout` | Execute shell command |
| `fetch` | `url` (required), `format`, `timeout` | Fetch from URL |

#### Code Intelligence Tools

| Tool | Parameters | Description |
|------|-----------|-------------|
| `diagnostics` | `file_path` | Get LSP diagnostics |
| `sourcegraph` | `query` (required), `count`, `context_window` | Search public repositories |
| `agent` | `prompt` (required) | Run sub-task with AI |

### LSP Integration

#### What is LSP?

Language Server Protocol provides code intelligence:
- Real-time error detection
- Type information
- Code navigation
- Auto-completion
- Refactoring

#### LSP Configuration

```json
{
  "lsp": {
    "typescript": {
      "disabled": false,
      "command": "typescript-language-server",
      "args": ["--stdio"]
    },
    "python": {
      "disabled": false,
      "command": "pylsp"
    },
    "go": {
      "disabled": false,
      "command": "gopls"
    },
    "rust": {
      "disabled": false,
      "command": "rust-analyzer"
    }
  }
}
```

#### Supported Languages

- TypeScript/JavaScript
- Python
- Go
- Rust
- Java
- C/C++
- Ruby
- And more (auto-detected)

### Using LSP

AI automatically uses LSP for:
- Finding errors in code
- Understanding type signatures
- Proposing fixes
- Refactoring code
- Finding usages

Example interaction:

```
User: "Fix all TypeScript errors in src/"

AI:
1. diagnostics(file_path="src/main.ts")
   → Returns: [{line: 15, message: "Type 'number' not assignable to 'string'"}]
2. view(file_path="src/main.ts", offset=15)
   → Shows context
3. edit(file_path="src/main.ts", ...)
   → Applies fix

Result: "Fixed 1 type error."
```

---

## Configuration Reference

### opencode.json Structure

```json
{
  "$schema": "https://opencode.ai/config.json",
  
  "data": {
    "directory": ".opencode"
  },
  
  "providers": {
    "anthropic": {
      "apiKey": "${ANTHROPIC_API_KEY}",
      "disabled": false
    },
    "openai": {
      "apiKey": "${OPENAI_API_KEY}",
      "disabled": false
    },
    "gemini": {
      "apiKey": "${GEMINI_API_KEY}",
      "disabled": false
    }
  },
  
  "agents": {
    "coder": {
      "model": "claude-3-5-sonnet",
      "instructions": "You are a senior developer..."
    }
  },
  
  "mcpServers": {
    "external-service": {
      "type": "stdio",
      "command": "node",
      "args": ["./mcp-servers/service.js"]
    }
  },
  
  "lsp": {
    "typescript": {
      "disabled": false,
      "command": "typescript-language-server"
    }
  },
  
  "plugins": [
    "./plugins/my-plugin.js",
    "@opencode/plugin-name"
  ]
}
```

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Claude API key | `sk-ant-...` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `GEMINI_API_KEY` | Google Gemini key | `AIza...` |
| `OPENCODE_DATA_DIR` | Config directory | `.opencode` |
| `OPENCODE_EXPERIMENTAL_*` | Feature flags | `OPENCODE_EXPERIMENTAL_LSP_TOOL=1` |

### Command-Line Flags

| Flag | Description |
|------|-------------|
| `--refresh` | Refresh models cache |
| `--verbose` | Verbose output (includes costs) |
| `--help` | Show help |
| `--version` | Show version |

---

## Core Workflows

### Planning vs Building

OpenCode has two modes (switch with `Tab`):

**Plan Mode**
- AI drafts approach
- Shows reasoning
- Waits for approval
- Useful for complex tasks

**Build Mode**
- AI writes code directly
- Creates files
- Applies changes
- Useful for implementation

### Session Management

Sessions persist across restarts:

```
opencode                    # List sessions
opencode --session [name]   # Resume specific session
```

### File Watching

OpenCode monitors file changes and notifies AI:

```
OPENCODE_EXPERIMENTAL_FILEWATCHER=1 opencode
```

---

## Best Practices

### Plugin Development

1. **Use TypeScript** for type safety
2. **Error handling** — wrap tool execution in try-catch
3. **Logging** — use `client.app.log()` not `console.log`
4. **Permissions** — respect file protection rules
5. **Performance** — avoid blocking operations

### Tool Design

1. **Single responsibility** — one tool per action
2. **Clear naming** — descriptive tool names
3. **Zod schemas** — strict input validation
4. **Documentation** — detailed descriptions
5. **Error messages** — actionable error feedback

### MCP Servers

1. **Isolation** — run as separate process (stdio)
2. **Timeout handling** — set reasonable timeouts
3. **Streaming** — handle large responses
4. **Error recovery** — graceful failure modes
5. **Logging** — debug capabilities

---

## Resources

- **Official Docs**: https://opencode.ai/docs
- **GitHub Repository**: https://github.com/sst/opencode
- **Community Plugins**: https://opencode.ai/ecosystem
- **Discord**: OpenCode Community Discord
- **Issue Tracker**: GitHub Issues

---

**Last Updated**: January 2026  
**OpenCode Version**: 0.0.55+  
**License**: MIT (Open Source)
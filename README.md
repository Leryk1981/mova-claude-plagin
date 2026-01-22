# MOVA Plugin for Claude Code

[![Version](https://img.shields.io/badge/version-0.3.2-blue.svg)](package.json)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](package.json)
[![Claude Code](https://img.shields.io/badge/claude--code-%3E%3D1.0.0-purple.svg)](.claude-plugin/plugin.json)

**MOVA** (Monitoring, Observing, Validating Agent) is a comprehensive observability and security layer for Claude Code. It provides real-time monitoring, security event detection, human-in-the-loop confirmations, and full audit trails for AI agent operations.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Commands Reference](#commands-reference)
- [Configuration](#configuration)
- [Security](#security)
- [Observability](#observability)
- [Human-in-the-Loop](#human-in-the-loop)
- [Presets](#presets)
- [Directory Structure](#directory-structure)
- [Environment Variables](#environment-variables)
- [Development](#development)
- [License](#license)

## Features

- **Real-time Monitoring**: Track all tool executions with detailed episode logging
- **Security Detection**: Automatic detection of prompt injection, sensitive data access, and policy violations
- **Human-in-the-Loop**: Configurable confirmation requirements for dangerous operations
- **Guardrail Rules**: Define custom rules to block, warn, or audit specific patterns
- **OpenTelemetry Export**: Export metrics to OTLP-compatible backends
- **Preset System**: Switch between development, staging, and production configurations
- **Retention Management**: Automatic cleanup and archival of old sessions
- **Export Capabilities**: Export episodes and audit reports in JSONL, CSV, or JSON formats

## Installation

### From marketplace (recommended)

```bash
/plugin marketplace add Leryk1981/mova-claude-plagin
/plugin install mova@mova-plugins
```

### Local Development

```bash
git clone https://github.com/Leryk1981/mova-claude-plagin.git
cd mova-claude-plagin
claude --plugin-dir ./
```

### npm package (distribution only)

```bash
npm install mova-claude-plugin
```

Claude Code does not load plugins from `node_modules`. Use `/plugin install` or `claude --plugin-dir`.

## Quick Start

### 1. Initialize MOVA in Your Project

```bash
/mova:init
```

This launches an interactive wizard to configure:
- Security preset (development, staging, or production)
- Real-time dashboard
- OpenTelemetry export

### 2. Verify Configuration

```bash
/mova:status
```

### 3. Start Working

MOVA automatically monitors all Claude Code operations once initialized.

## Commands Reference

### Core Commands

| Command | Description |
|---------|-------------|
| `/mova:init [--preset <name>]` | Initialize MOVA with interactive wizard or specific preset |
| `/mova:status` | Show current MOVA status and active session info |
| `/mova:context` | Display full context including profile, permissions, and rules |
| `/mova:lint [--fix]` | Validate configuration and optionally fix issues |

### Session Management

| Command | Description |
|---------|-------------|
| `/mova:start` | Manually start a new observation session |
| `/mova:finish` | Finalize current session and generate summary |

### Monitoring & Metrics

| Command | Description |
|---------|-------------|
| `/mova:metrics [--format json\|table]` | Show aggregated metrics and statistics |
| `/mova:dashboard [start\|stop\|status]` | Control the WebSocket monitoring dashboard |
| `/mova:debug [--tail <n>]` | Show detailed debug information and recent episodes |

### Data Management

| Command | Description |
|---------|-------------|
| `/mova:export <type> [--format <fmt>] [--output <path>]` | Export episodes, summaries, or security events |
| `/mova:retention <status\|cleanup\|archives>` | Manage retention, cleanup, and archives |

### Preset Management

| Command | Description |
|---------|-------------|
| `/mova:preset:list` | List all available presets |
| `/mova:preset:info <name>` | Show detailed preset configuration |
| `/mova:preset:apply <name>` | Apply a preset to current project |

## Configuration

MOVA stores its configuration in `mova/control_v0.json`:

```json
{
  "profile_id": "mova_claude_control_v1",
  "version": "1.0.0",
  "environment": "development",

  "policy": {
    "permissions": {
      "allow": ["Read", "Glob", "Grep", "Edit", "Write", "Bash"],
      "deny": [],
      "on_conflict": "deny_wins",
      "on_unknown": "report_only"
    }
  },

  "guardrail_rules": [
    {
      "rule_id": "block-rm-rf",
      "description": "Block recursive force delete on root paths",
      "effect": "deny",
      "target": { "tool": "Bash", "pattern": "rm\\s+-rf\\s+[/~]" },
      "severity": "critical",
      "on_violation": ["block", "log"]
    }
  ],

  "observability": {
    "enabled": true,
    "log_level": "info",
    "otel_enabled": false
  },

  "human_in_the_loop": {
    "escalation_threshold": "high",
    "auto_approve": ["Read", "Glob", "Grep"],
    "always_confirm": [],
    "confirmation_timeout_ms": 60000
  },

  "retention": {
    "episodes_days": 90,
    "security_events_days": 365,
    "auto_cleanup": true,
    "archive_before_delete": true
  }
}
```

## Security

### Security Event Types

MOVA detects and logs six types of security events:

| Event Type | Severity | Description |
|------------|----------|-------------|
| `instruction_profile_invalid` | high | Invalid or tampered profile configuration |
| `prompt_injection_suspected` | high | Potential prompt injection attempt detected |
| `forbidden_tool_requested` | medium | Attempt to use a blocked tool |
| `rate_limit_exceeded` | medium | Tool usage rate limit violation |
| `sensitive_data_access_suspected` | high | Access to sensitive files detected |
| `guardrail_violation` | varies | Custom guardrail rule triggered |

### Guardrail Rules

Define custom rules to control tool behavior:

```json
{
  "rule_id": "protect-env-files",
  "description": "Block access to environment files",
  "effect": "deny",
  "target": {
    "tool": "Read|Edit|Write",
    "path_glob": "**/*.env*"
  },
  "severity": "critical",
  "on_violation": ["block", "alert", "log"],
  "enabled": true
}
```

### Severity Levels

| Level | Priority | Description |
|-------|----------|-------------|
| `critical` | 1 | Immediate block, requires human review |
| `high` | 2 | Block with detailed logging |
| `medium` | 3 | Warning with confirmation option |
| `low` | 4 | Logged for audit purposes |
| `info` | 5 | Informational only |

## Observability

### Episode Structure (MOVA 4.1.1)

Each operation is recorded as an episode:

```json
{
  "episode_id": "ep_20260121_abc123",
  "episode_type": "execution",
  "mova_version": "4.1.1",
  "recorded_at": "2026-01-21T10:30:00Z",
  "executor": {
    "executor_id": "claude-code",
    "role": "agent",
    "executor_kind": "AI model"
  },
  "result_status": "completed",
  "result_summary": "File edited successfully",
  "result_details": {
    "tool_name": "Edit",
    "duration_ms": 150,
    "files_affected": ["src/app.js"]
  },
  "meta_episode": {
    "session_id": "sess_20260121_xyz",
    "correlation_id": "corr_abc123",
    "trace_id": "trace_def456"
  }
}
```

### OpenTelemetry Export

Enable OTEL export for integration with observability platforms:

```json
{
  "observability": {
    "otel_enabled": true,
    "otel_endpoint": "http://localhost:4318/v1/metrics",
    "otel_format": "otlp"
  }
}
```

Supported formats: `otlp`, `prometheus`

### Metrics Available

- `mova_episodes_total` - Total episodes by type and status
- `mova_security_events_total` - Security events by type and severity
- `mova_tool_duration_ms` - Tool execution duration histogram
- `mova_session_duration_ms` - Session duration

## Human-in-the-Loop

Configure when human confirmation is required:

```json
{
  "human_in_the_loop": {
    "escalation_threshold": "medium",
    "auto_approve": ["Read", "Glob", "Grep", "WebSearch"],
    "always_confirm": [
      { "tool": "Bash", "pattern": "rm\\s+-rf", "description": "Recursive delete" },
      { "tool": "Bash", "pattern": "sudo", "description": "Privileged command" },
      { "tool": "Write", "path_glob": "**/.env*", "description": "Env file modification" }
    ],
    "confirmation_timeout_ms": 60000
  }
}
```

### Escalation Thresholds

| Threshold | Confirms On |
|-----------|-------------|
| `critical` | Only critical severity events |
| `high` | Critical and high severity |
| `medium` | Critical, high, and medium severity |
| `low` | All except info |

## Presets

### Available Presets

| Preset | Use Case | Key Features |
|--------|----------|--------------|
| `base` | Minimal | Safe defaults, basic logging |
| `development` | Local work | Full tool access, verbose logging, dashboard enabled |
| `production` | Live systems | Restricted access, OTEL export, all confirmations required |

### Applying Presets

```bash
# Interactive selection
/mova:init

# Direct application
/mova:preset:apply production

# View preset details
/mova:preset:info development
```

### Preset Inheritance

Presets can inherit from others using `$inherit`:

```json
{
  "preset_id": "staging",
  "$inherit": "base",
  "description": "Staging environment preset",
  "observability": {
    "otel_enabled": true
  }
}
```

## Directory Structure

```
project/
├── mova/
│   └── control_v0.json          # MOVA configuration
├── .mova/
│   ├── episodes/                 # Session data
│   │   ├── sess_20260121_abc/
│   │   │   ├── events.jsonl      # Episode stream
│   │   │   └── summary.json      # Session summary
│   │   ├── index.jsonl           # Session index
│   │   └── .current_session_id   # Active session pointer
│   ├── backups/                  # Configuration backups
│   └── archives/                 # Archived sessions
└── CLAUDE.md                     # Contains MOVA_CONTROL_ENTRY marker
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CLAUDE_PLUGIN_ROOT` | Plugin installation directory | (set by Claude Code) |
| `CLAUDE_PROJECT_DIR` | Current project directory | (set by Claude Code) |
| `MOVA_LOG_LEVEL` | Override log level | `info` |
| `MOVA_DEBUG` | Enable debug mode | `false` |
| `MOVA_DASHBOARD_PORT` | Dashboard WebSocket port | `2773` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP endpoint URL | - |

## Development

### Running Tests

```bash
cd mova-claude-plagin
node test/test-runner.js
```

### Local Plugin Testing

```bash
# Start Claude Code with local plugin
claude --plugin-dir ./

# Test commands
/mova:status
/mova:lint
/mova:metrics
```

### Project Structure

```
./
├── .claude-plugin/
│   └── plugin.json       # Plugin manifest
├── commands/             # Slash commands
├── hooks/                # Hook definitions
├── scripts/              # Hook handlers
├── services/             # Core services
├── presets/              # Configuration presets
├── schemas/              # JSON schemas
├── config/               # Default configurations
├── skills/               # Agent skills
├── agents/               # Agent definitions
├── rules/                # Rule files
└── test/                 # Test suite
```

## License

MIT License - see [LICENSE](LICENSE) for details.

---

**MOVA** - Secure, Observable, Controllable AI Agent Operations

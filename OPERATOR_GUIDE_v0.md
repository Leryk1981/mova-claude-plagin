# MOVA Operator Guide v0

This guide provides comprehensive documentation for operators managing MOVA-enabled Claude Code environments. It covers all commands, configuration options, operational procedures, and troubleshooting guidelines.

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Command Reference](#command-reference)
4. [Configuration Deep Dive](#configuration-deep-dive)
5. [Security Operations](#security-operations)
6. [Monitoring & Observability](#monitoring--observability)
7. [Session Management](#session-management)
8. [Data Management](#data-management)
9. [Preset Management](#preset-management)
10. [Troubleshooting](#troubleshooting)
11. [Best Practices](#best-practices)
12. [Appendix](#appendix)

---

## 1. Overview

MOVA (Monitoring, Observing, Validating Agent) provides enterprise-grade observability and security for Claude Code operations. As an operator, you are responsible for:

- Initial configuration and preset selection
- Monitoring security events and agent behavior
- Managing data retention and exports
- Responding to escalated confirmations
- Maintaining audit compliance

### Key Concepts

| Concept | Description |
|---------|-------------|
| **Episode** | A single recorded operation (tool execution, plan, security event) |
| **Session** | A collection of episodes from a single Claude Code interaction |
| **Guardrail Rule** | A policy that blocks, warns, or audits specific patterns |
| **Preset** | A pre-configured set of policies for different environments |
| **HITL** | Human-in-the-Loop confirmation requirements |

---

## 2. Getting Started

### Prerequisites

- Claude Code >= 1.0.0
- Node.js >= 18.0.0
- Write access to project directory

### Initial Setup

```bash
# Install the plugin
/plugin marketplace add Leryk1981/mova-claude-plagin
/plugin install mova@mova-plugins

# Initialize in your project
/mova:init
```

The interactive wizard will guide you through:

1. **Preset Selection**: Choose development, staging, or production
2. **Dashboard**: Enable/disable real-time monitoring (port 2773)
3. **OTEL Export**: Enable/disable OpenTelemetry metrics export

### Verify Installation

```bash
/mova:status
```

Expected output:
```
MOVA: active | Profile: mova_claude_control_v1 v1.0.0 | Session: sess_20260121_abc (5 events, 00:02:30)
```

---

## 3. Command Reference

### 3.1 Initialization Commands

#### `/mova:init [--preset <name>]`

Initialize MOVA in the current project.

**Arguments:**
- `--preset <name>`: Skip wizard and apply preset directly (base|development|production)

**Example:**
```bash
# Interactive wizard
/mova:init

# Direct preset application
/mova:init --preset production
```

**Creates:**
- `mova/control_v0.json` - Configuration file
- `.mova/episodes/` - Episode storage directory
- `.mova/backups/` - Configuration backup directory

---

### 3.2 Status Commands

#### `/mova:status`

Display current MOVA status.

**Output Modes:**

*Minimal (default):*
```
MOVA: active | Profile: mova_claude_control_v1 v1.0.0 | Session: sess_20260121_abc (12 events, 00:05:30)
```

*Extended (when issues detected):*
```
MOVA Status
───────────────────────────────────
Status:     active
Profile:    mova_claude_control_v1 v1.0.0
Preset:     development
───────────────────────────────────
Session:    sess_20260121_abc
Events:     12
Duration:   00:05:30
───────────────────────────────────
Security:   2 events
  Critical: 0  High: 1
  Medium:   1  Low:  0
───────────────────────────────────
Features:
  Observability: on
  Dashboard:     on (port 2773)
  OTEL Export:   off
  HITL:          threshold high
```

#### `/mova:context`

Display full MOVA context with configuration details.

**Output:**
| Section | Content |
|---------|---------|
| Profile | ID, version, environment |
| Preset | Active preset, inheritance chain |
| Permissions | Allow/deny lists, conflict resolution |
| Guardrails | Rules count by severity |
| Observability | Enabled features, log level |
| HITL | Escalation threshold, auto-approve tools |

---

### 3.3 Validation Commands

#### `/mova:lint [--fix]`

Validate MOVA configuration structure.

**Arguments:**
- `--fix`: Automatically fix issues where possible

**Validations Performed:**
1. `mova/control_v0.json` exists and is valid JSON
2. Schema compliance (control_v1.schema.json)
3. Referenced presets exist
4. Guardrail rules have valid structure
5. Episodes directory is writable
6. Required fields are present

**Example Output:**
```
MOVA Lint Results
─────────────────────────────────
[PASS] Configuration file exists
[PASS] Valid JSON structure
[WARN] Missing optional field: observability.otel_endpoint
[PASS] Guardrail rules valid
[PASS] Episodes directory writable
─────────────────────────────────
Status: PASS (1 warning)
```

---

### 3.4 Session Commands

#### `/mova:start`

Manually start a new observation session.

**Actions:**
1. Generate new correlation_id and session_id
2. Create session directory in `.mova/episodes/`
3. Initialize `events.jsonl`
4. Record SessionStart episode

**Output:**
```
MOVA session started
Correlation ID: corr_a1b2c3d4
Session ID: sess_20260121_xyz
```

#### `/mova:finish`

Finalize current session and generate summary.

**Actions:**
1. Write final episode to `events.jsonl`
2. Generate `summary.json` with aggregated metrics
3. Update `.mova/episodes/index.jsonl`
4. Export to OTEL if enabled

**Output:**
```
MOVA session completed
Duration: 00:45:30
Episodes: 127
Security events: 3 (0 critical, 1 high, 2 medium)
Summary: .mova/episodes/sess_20260121_xyz/summary.json
```

---

### 3.5 Monitoring Commands

#### `/mova:metrics [--format json|table|csv]`

Display aggregated metrics from all sessions.

**Arguments:**
- `--format`: Output format (default: table)

**Metrics Displayed:**

| Metric | Description |
|--------|-------------|
| Total Episodes | Count by type (execution, plan, security_event) |
| Error Rate | Percentage of failed episodes |
| Tool Distribution | Usage count per tool |
| Performance | Average, P95, max duration |
| Security Events | Count by severity |
| Recent Sessions | Last 5 sessions with summary |

**Example (table format):**
```
MOVA Metrics
═══════════════════════════════════════════════════
Episodes
  Total:          1,247
  Execution:      1,180 (94.6%)
  Plan:           52 (4.2%)
  Security:       15 (1.2%)
───────────────────────────────────────────────────
Performance
  Avg Duration:   145ms
  P95 Duration:   890ms
  Max Duration:   12,340ms
───────────────────────────────────────────────────
Security Events (last 30 days)
  Critical:       0
  High:           3
  Medium:         8
  Low:            4
═══════════════════════════════════════════════════
```

#### `/mova:dashboard [start|stop|status]`

Control the WebSocket monitoring dashboard.

**Subcommands:**

| Subcommand | Description |
|------------|-------------|
| `start` | Start dashboard server |
| `stop` | Stop dashboard server |
| `status` | Check current status |

**Default Port:** 2773 (configurable in `control_v0.json`)

**Example:**
```bash
/mova:dashboard start
# Dashboard started on http://localhost:2773

/mova:dashboard status
# Dashboard running on port 2773
```

#### `/mova:debug [--tail <n>]`

Display verbose debug information.

**Arguments:**
- `--tail <n>`: Number of recent episodes to show (default: 10)

**Output Includes:**
- Current session correlation_id and trace_id
- Full episode JSON structure
- Security events with detection details
- Performance traces
- Hook execution log

---

### 3.6 Data Management Commands

#### `/mova:export <type> [--format <fmt>] [--output <path>]`

Export MOVA data in various formats.

**Export Types:**

| Type | Description |
|------|-------------|
| `episodes` | All episodes from all sessions |
| `summaries` | Session summary data only |
| `security` | Security events only |
| `audit` | Comprehensive audit report |

**Formats:**

| Format | Description |
|--------|-------------|
| `jsonl` | Line-delimited JSON (default) |
| `csv` | Comma-separated values |
| `json` | Pretty-printed JSON |

**Arguments:**
- `--format <fmt>`: Output format
- `--output <path>`: File path (stdout if not specified)
- `--sessions <ids>`: Comma-separated session IDs to include

**Examples:**
```bash
# Export all episodes as CSV
/mova:export episodes --format csv --output ./export.csv

# Export security events
/mova:export security --format jsonl --output ./security.jsonl

# Generate audit report
/mova:export audit --output ./audit-report.json
```

**Audit Report Structure:**
```json
{
  "generated_at": "2026-01-21T10:00:00Z",
  "period": {
    "from": "2026-01-14T00:00:00Z",
    "to": "2026-01-21T10:00:00Z"
  },
  "summary": {
    "total_sessions": 15,
    "total_episodes": 450,
    "total_security_events": 12,
    "security_by_severity": {"high": 2, "medium": 5, "low": 5},
    "tools_used": {"Edit": 120, "Bash": 80, "Read": 250},
    "episodes_by_status": {"completed": 440, "failed": 10}
  },
  "sessions": [...]
}
```

#### `/mova:retention <status|cleanup|archives|restore>`

Manage data retention and archival.

**Subcommands:**

| Subcommand | Description |
|------------|-------------|
| `status` | Show retention status and statistics |
| `cleanup [--dry-run]` | Run cleanup based on retention policy |
| `archives` | List archived sessions |
| `restore <name>` | Restore session from archive |

**Status Output:**
```
Retention Status
────────────────────────────────────
Configuration:
  Episodes:        90 days
  Security Events: 365 days
  Metrics:         30 days
  Auto Cleanup:    enabled
  Archive:         enabled (gzip)
────────────────────────────────────
Statistics:
  Total Sessions:  25
  Total Size:      12.5 MB
  Oldest:          sess_20251001_abc (112 days)
  Newest:          sess_20260121_xyz (today)
────────────────────────────────────
Status:
  Expired:         3 sessions
  Expiring Soon:   5 sessions (within 7 days)
  With Security:   8 sessions
────────────────────────────────────
```

**Cleanup Example:**
```bash
# Preview cleanup
/mova:retention cleanup --dry-run

# Execute cleanup
/mova:retention cleanup
```

---

### 3.7 Preset Commands

#### `/mova:preset:list`

List all available presets.

**Output:**
```
Available presets:
  base          - Minimal safe configuration
  development   - Full development access with verbose logging
  production    - Locked-down production with audit logging

Current: development
```

#### `/mova:preset:info <name>`

Show detailed preset configuration.

**Arguments:**
- `name`: Preset name (required)

**Output:**
```
Preset: development
────────────────────────────────────
Description: Full development access with verbose logging
Inherits: base
────────────────────────────────────
Permissions:
  Allow: Bash, Read, Edit, Write, Glob, Grep, WebSearch, WebFetch
  On Unknown: allow
────────────────────────────────────
Guardrail Rules: 1
  - warn-sudo (medium): Warn on sudo usage
────────────────────────────────────
Human-in-the-Loop:
  Threshold: critical
  Auto-approve: Read, Glob, Grep, Edit, Write, WebSearch, WebFetch
  Always Confirm: rm -rf, sudo
────────────────────────────────────
Observability:
  Enabled: true
  OTEL: false
  Dashboard: port 2773
```

#### `/mova:preset:apply <name>`

Apply a preset to the current project.

**Arguments:**
- `name`: Preset name (required)

**Actions:**
1. Load preset from `presets/<name>.preset.json`
2. Resolve `$inherit` chain
3. Merge with current `control_v0.json`
4. Write updated configuration
5. Create backup of previous version

**Output:**
```
Applied preset: production

Changes:
  - permissions.on_unknown: allow -> deny
  - guardrail_rules: +2 rules
  - observability.otel_enabled: false -> true
  - human_in_the_loop.escalation_threshold: critical -> medium

Backup: .mova/backups/control_v0_20260121_103000.json
```

---

## 4. Configuration Deep Dive

### 4.1 Configuration File Structure

Location: `mova/control_v0.json`

```json
{
  "profile_id": "mova_claude_control_v1",
  "version": "1.0.0",
  "environment": "development",
  "$preset": "development",

  "policy": {
    "permissions": {
      "allow": ["Read", "Glob", "Grep"],
      "deny": [],
      "on_conflict": "deny_wins",
      "on_unknown": "report_only"
    }
  },

  "guardrail_rules": [],

  "observability": {
    "enabled": true,
    "log_level": "info",
    "otel_enabled": false,
    "otel_endpoint": null
  },

  "human_in_the_loop": {
    "escalation_threshold": "high",
    "auto_approve": [],
    "always_confirm": [],
    "confirmation_timeout_ms": 60000
  },

  "monitoring": {
    "enabled": false,
    "port": 2773
  },

  "retention": {
    "episodes_days": 90,
    "security_events_days": 365,
    "auto_cleanup": true,
    "archive_before_delete": true,
    "archive_format": "gzip"
  }
}
```

### 4.2 Permissions Configuration

| Field | Type | Description |
|-------|------|-------------|
| `allow` | string[] | Tools explicitly allowed |
| `deny` | string[] | Tools explicitly denied (supports patterns) |
| `on_conflict` | enum | Resolution when tool in both lists |
| `on_unknown` | enum | Action for tools not in either list |

**on_conflict Options:**
- `deny_wins`: Deny takes precedence (recommended)
- `allow_wins`: Allow takes precedence

**on_unknown Options:**
- `allow`: Allow unlisted tools
- `deny`: Deny unlisted tools
- `report_only`: Allow but log for review

### 4.3 Guardrail Rules

Each rule has the following structure:

```json
{
  "rule_id": "unique-identifier",
  "description": "Human-readable description",
  "effect": "deny|warn|audit",
  "target": {
    "tool": "ToolName|Pattern",
    "pattern": "regex-pattern",
    "path_glob": "glob-pattern"
  },
  "severity": "critical|high|medium|low|info",
  "on_violation": ["block", "warn", "log", "alert"],
  "enabled": true
}
```

**Effect Types:**

| Effect | Action |
|--------|--------|
| `deny` | Block the operation |
| `warn` | Allow with warning message |
| `audit` | Allow and log for review |

**Target Matching:**

| Field | Description |
|-------|-------------|
| `tool` | Tool name or regex pattern |
| `pattern` | Regex to match command/content |
| `path_glob` | Glob pattern for file paths |

### 4.4 Human-in-the-Loop Configuration

| Field | Type | Description |
|-------|------|-------------|
| `escalation_threshold` | enum | Minimum severity requiring confirmation |
| `auto_approve` | string[] | Tools that never require confirmation |
| `always_confirm` | object[] | Operations that always require confirmation |
| `confirmation_timeout_ms` | number | Timeout for confirmation requests |

**always_confirm Entry:**
```json
{
  "tool": "Bash",
  "pattern": "rm\\s+-rf",
  "path_glob": null,
  "description": "Recursive force delete"
}
```

---

## 5. Security Operations

### 5.1 Security Event Types

| Event Type | Default Severity | Detection |
|------------|------------------|-----------|
| `instruction_profile_invalid` | high | Schema validation failure |
| `prompt_injection_suspected` | high | Injection pattern matching |
| `forbidden_tool_requested` | medium | Deny list match |
| `rate_limit_exceeded` | medium | Usage threshold exceeded |
| `sensitive_data_access_suspected` | high | Sensitive path pattern match |
| `guardrail_violation` | varies | Custom rule triggered |

### 5.2 Response Actions

| Action | Description |
|--------|-------------|
| `block` | Prevent operation execution |
| `warn` | Display warning, allow operation |
| `log` | Record to episode stream |
| `alert` | Trigger external notification |

### 5.3 Investigating Security Events

```bash
# View recent security events
/mova:export security --format json

# Get detailed debug info
/mova:debug --tail 20

# Generate security audit
/mova:export audit
```

### 5.4 Prompt Injection Detection

MOVA detects common injection patterns:
- System prompt override attempts
- Instruction boundary manipulation
- Role confusion attacks
- Hidden instructions in content

Detection confidence is reported (0.0-1.0).

---

## 6. Monitoring & Observability

### 6.1 Episode Structure

Every operation generates an episode following MOVA 4.1.1 schema:

```json
{
  "episode_id": "ep_20260121_abc123",
  "episode_type": "execution",
  "mova_version": "4.1.1",
  "recorded_at": "2026-01-21T10:30:00Z",
  "started_at": "2026-01-21T10:30:00Z",
  "finished_at": "2026-01-21T10:30:00.150Z",
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
    "trace_id": "trace_def456",
    "parent_episode_id": null
  },
  "security_event": null,
  "compliance": {
    "data_classification": "internal",
    "retention_days": 90,
    "exportable": true
  }
}
```

### 6.2 OpenTelemetry Integration

Enable OTEL export:

```json
{
  "observability": {
    "otel_enabled": true,
    "otel_endpoint": "http://localhost:4318/v1/metrics",
    "otel_format": "otlp"
  }
}
```

**Exported Metrics:**

| Metric | Type | Labels |
|--------|------|--------|
| `mova_episodes_total` | Counter | type, status |
| `mova_security_events_total` | Counter | event_type, severity |
| `mova_tool_duration_ms` | Histogram | tool_name |
| `mova_session_duration_ms` | Histogram | - |

### 6.3 Dashboard

The WebSocket dashboard provides real-time visibility:

- Live episode stream
- Security event alerts
- Session metrics
- Tool usage distribution

Default URL: `http://localhost:2773`

---

## 7. Session Management

### 7.1 Session Lifecycle

```
SessionStart → Tool Operations → Security Checks → SessionEnd
     ↓              ↓                   ↓              ↓
  init.jsonl    events.jsonl     security.log    summary.json
```

### 7.2 Session Files

| File | Purpose |
|------|---------|
| `events.jsonl` | Episode stream (append-only) |
| `summary.json` | Aggregated session metrics |
| `index.jsonl` | Session index (parent directory) |
| `.current_session_id` | Active session pointer |

### 7.3 Correlation IDs

Each session has:
- **session_id**: Unique session identifier (e.g., `sess_20260121_abc`)
- **correlation_id**: Request correlation (e.g., `corr_xyz123`)
- **trace_id**: Distributed trace ID (e.g., `trace_def456`)

---

## 8. Data Management

### 8.1 Retention Policy

| Data Type | Default Retention | Configurable |
|-----------|-------------------|--------------|
| Episodes | 90 days | Yes |
| Security Events | 365 days | Yes |
| Metrics | 30 days | Yes |

### 8.2 Archival

Expired sessions can be archived before deletion:

```json
{
  "retention": {
    "archive_before_delete": true,
    "archive_format": "gzip"
  }
}
```

Archives stored in: `.mova/archives/`

### 8.3 Backup Management

Configuration backups created automatically:
- Before preset application
- Before configuration changes
- Location: `.mova/backups/`

---

## 9. Preset Management

### 9.1 Built-in Presets

#### Base Preset
- Minimal permissions (Read, Glob, Grep only)
- Basic guardrails
- HITL threshold: high
- No OTEL export

#### Development Preset
- Full tool access
- Relaxed guardrails (warn only)
- HITL threshold: critical
- Dashboard enabled
- Debug mode

#### Production Preset
- Restricted permissions
- Strict guardrails (block destructive)
- HITL threshold: medium
- OTEL export enabled
- Full audit logging

### 9.2 Creating Custom Presets

Create `presets/custom.preset.json`:

```json
{
  "preset_id": "custom",
  "$inherit": "base",
  "description": "Custom preset for specific use case",
  "policy": {
    "permissions": {
      "allow": ["Read", "Glob", "Grep", "Edit"],
      "on_unknown": "deny"
    }
  },
  "guardrail_rules": [
    {
      "rule_id": "custom-rule",
      "description": "Custom guardrail",
      "effect": "warn",
      "target": { "tool": "Edit", "path_glob": "**/config/*" },
      "severity": "medium",
      "on_violation": ["warn", "log"],
      "enabled": true
    }
  ]
}
```

---

## 10. Troubleshooting

### 10.1 Common Issues

#### MOVA Not Initializing

```bash
# Check plugin installation
/plugin

# Verify configuration
/mova:lint

# Check file permissions
ls -la mova/
ls -la .mova/
```

#### Sessions Not Recording

```bash
# Check hook configuration
cat hooks/hooks.json

# Verify session directory
ls -la .mova/episodes/

# Check current session
cat .mova/episodes/.current_session_id
```

#### Security Events Not Detected

```bash
# Verify security module
/mova:debug

# Check guardrail rules
/mova:context

# Review security configuration
cat mova/control_v0.json | jq '.guardrail_rules'
```

### 10.2 Debug Mode

Enable verbose logging:

```json
{
  "observability": {
    "log_level": "debug"
  }
}
```

Or via environment:
```bash
MOVA_LOG_LEVEL=debug claude
```

### 10.3 Recovery Procedures

#### Restore from Backup
```bash
cp .mova/backups/control_v0_TIMESTAMP.json mova/control_v0.json
/mova:lint
```

#### Restore Archived Session
```bash
/mova:retention restore sess_20251001_abc
```

#### Reset Configuration
```bash
rm mova/control_v0.json
/mova:init
```

---

## 11. Best Practices

### 11.1 Security

1. **Use production preset** for any environment with sensitive data
2. **Enable OTEL export** for centralized security monitoring
3. **Review security events** weekly
4. **Configure always_confirm** for destructive operations
5. **Set appropriate retention** for compliance requirements

### 11.2 Performance

1. **Adjust log_level** to info in production
2. **Configure retention cleanup** to manage disk usage
3. **Use dashboard sparingly** in high-volume environments

### 11.3 Operations

1. **Run lint regularly** to catch configuration drift
2. **Export audit reports** monthly
3. **Test presets** in development before production use
4. **Document custom guardrails** for team awareness

---

## 12. Appendix

### A. Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CLAUDE_PLUGIN_ROOT` | Plugin directory | (set by Claude) |
| `CLAUDE_PROJECT_DIR` | Project directory | (set by Claude) |
| `MOVA_LOG_LEVEL` | Log level override | `info` |
| `MOVA_DEBUG` | Debug mode | `false` |
| `MOVA_DASHBOARD_PORT` | Dashboard port | `2773` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP endpoint | - |

### B. File Locations

| Path | Purpose |
|------|---------|
| `mova/control_v0.json` | Configuration |
| `.mova/episodes/` | Episode storage |
| `.mova/backups/` | Config backups |
| `.mova/archives/` | Archived sessions |

### C. Schema References

| Schema | Location |
|--------|----------|
| Episode v1 | `schemas/episode_v1.schema.json` |
| Security Event | `schemas/security_event.schema.json` |
| Guardrail Rule | `schemas/guardrail_rule.schema.json` |
| Control Profile | `schemas/control_v1.schema.json` |

### D. Support

- Issues: https://github.com/Leryk1981/mova-claude-plagin/issues
- Documentation: https://github.com/Leryk1981/mova-claude-plagin/wiki

---

*MOVA Operator Guide v0 - Last Updated: January 2026*

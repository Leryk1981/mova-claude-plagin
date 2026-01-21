---
description: Export MOVA data in various formats
argument-hint: "<type> [--format <format>] [--output <path>]"
allowed-tools:
  - Read
  - Write
  - Bash
---

Export MOVA episodes, metrics, and reports in various formats.

## Export Types

### Episodes
Export all episodes from sessions:
```bash
node ${CLAUDE_PLUGIN_ROOT}/services/export_manager.js episodes --format $FORMAT --output $OUTPUT
```

### Summaries
Export session summaries:
```bash
node ${CLAUDE_PLUGIN_ROOT}/services/export_manager.js summaries --output $OUTPUT
```

### Security Events
Export security events only:
```bash
node ${CLAUDE_PLUGIN_ROOT}/services/export_manager.js security --format $FORMAT --output $OUTPUT
```

### Audit Report
Generate comprehensive audit report:
```bash
node ${CLAUDE_PLUGIN_ROOT}/services/export_manager.js audit
```

## Formats

| Format | Description | Use Case |
|--------|-------------|----------|
| jsonl | Line-delimited JSON (default) | Machine processing, log aggregation |
| csv | Comma-separated values | Spreadsheet analysis, reporting |
| json | Pretty-printed JSON | Human review, API consumption |

## Arguments

- $1: Export type (episodes|summaries|security|audit)
- --format: Output format (jsonl|csv|json)
- --output: File path to write (optional, stdout if not specified)
- --sessions: Comma-separated session IDs to include (optional, all if not specified)

## Examples

Export all episodes as CSV:
```
/mova:export episodes --format csv --output ./mova-export.csv
```

Export security events:
```
/mova:export security --format jsonl --output ./security-events.jsonl
```

Generate audit report:
```
/mova:export audit --output ./audit-report.json
```

## Audit Report Structure

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

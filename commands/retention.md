---
description: Manage episode retention and cleanup
argument-hint: "<status|cleanup|archives> [--dry-run]"
allowed-tools:
  - Read
  - Bash
---

Manage MOVA episode retention, cleanup, and archiving.

## Commands

### Status
Show retention status and statistics:
```bash
node ${CLAUDE_PLUGIN_ROOT}/services/retention_manager.js status
```

### Cleanup
Run cleanup based on retention policy:
```bash
node ${CLAUDE_PLUGIN_ROOT}/services/retention_manager.js cleanup [--dry-run]
```

Use --dry-run to preview what would be deleted without making changes.

### Archives
List archived sessions:
```bash
node ${CLAUDE_PLUGIN_ROOT}/services/retention_manager.js archives
```

### Restore
Restore a session from archive:
```bash
node ${CLAUDE_PLUGIN_ROOT}/services/retention_manager.js restore <archive-name>
```

## Retention Configuration

Configured in mova/control_v0.json under `retention`:

```json
{
  "retention": {
    "episodes_days": 90,
    "security_events_days": 365,
    "metrics_days": 30,
    "auto_cleanup": true,
    "archive_before_delete": true,
    "archive_format": "gzip"
  }
}
```

## Status Output

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

## Cleanup Output

```
Cleanup Results
────────────────────────────────────
Checked:    25 sessions
Expired:    3 sessions
Archived:   3 sessions
Deleted:    3 sessions
Retained:   2 (security events)
Errors:     0
────────────────────────────────────
```

## Notes

- Sessions with security events use `security_events_days` retention
- Archives are stored in .mova/archives/
- Use --dry-run before actual cleanup to review changes

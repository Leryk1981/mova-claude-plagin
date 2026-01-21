---
description: Show MOVA observability metrics
argument-hint: "[--format json|table]"
allowed-tools:
  - Read
  - Bash
---

Display aggregated metrics from .mova/episodes/

## Execution:
```bash
node ${CLAUDE_PLUGIN_ROOT}/services/episode_metrics_collector.js --format ${1:-table}
```

## Metrics shown:
- Total episodes / by type (execution, plan, security_event)
- Total events / error rate
- Tool usage distribution
- Performance stats (avg/p95/max duration)
- Security events by severity
- Session history (last 5)

## Formats:
- table (default): Human-readable table
- json: Machine-readable JSON
- csv: Spreadsheet format

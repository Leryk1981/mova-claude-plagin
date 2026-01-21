---
description: Show detailed MOVA debug information
argument-hint: "[--tail <n>]"
allowed-tools:
  - Read
  - Bash
---

Display verbose debug information including full episodes and traces.

## Output includes:
1. Current session correlation_id and trace_id
2. Last N episodes (default 10, configurable with --tail)
3. Full episode JSON structure
4. Security events with detection details
5. Performance traces
6. Hook execution log

## Execution:
```bash
node ${CLAUDE_PLUGIN_ROOT}/services/episode_metrics_collector.js --debug --tail ${2:-10}
```

## Format: Full JSONL output with syntax highlighting

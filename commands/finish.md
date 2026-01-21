---
description: Finish MOVA session
allowed-tools:
  - Read
  - Bash
---

Finalize current MOVA observation session.

## Actions:
1. Write final episode to events.jsonl
2. Generate summary.json with aggregated metrics
3. Update .mova/episodes/index.jsonl
4. Export to OTEL if enabled
5. Display session summary

## Execution:
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/mova-observe.js --finalize
```

## Output:
```
MOVA session completed
Duration: [time]
Episodes: [count]
Security events: [count] ([by severity])
Summary: .mova/episodes/[session_id]/summary.json
```

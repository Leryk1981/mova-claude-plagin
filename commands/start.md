---
description: Start MOVA session
allowed-tools:
  - Read
  - Bash
---

Initialize a new MOVA observation session.

## Actions:
1. Generate new correlation_id and session_id
2. Create session directory in .mova/episodes/
3. Initialize events.jsonl
4. Record SessionStart episode
5. Set environment variables for hooks

## Execution:
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/mova-observe.js --init
```

## Output:
```
MOVA session started
Correlation ID: sess_[uuid]
Session ID: sess_[timestamp]_[random]
```

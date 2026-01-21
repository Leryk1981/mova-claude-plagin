---
description: Start/stop MOVA monitoring dashboard
argument-hint: "[start|stop|status]"
allowed-tools:
  - Bash
---

Control the MOVA WebSocket dashboard server.

## Commands:
- start: Start dashboard server
- stop: Stop dashboard server
- status: Check if running

## Execution:
```bash
node ${CLAUDE_PLUGIN_ROOT}/services/dashboard_server.js ${1:-status}
```

## Default port: 2773 (configurable in control_v0.json)

## Output:
- start: "Dashboard started on http://localhost:2773"
- stop: "Dashboard stopped"
- status: "Dashboard [running|stopped] on port [port]"

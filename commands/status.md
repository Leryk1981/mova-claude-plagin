---
description: Show MOVA status (minimal output)
allowed-tools:
  - Read
---

Show minimal MOVA status for current project.

## Check Files

1. Read mova/control_v0.json for profile info
2. Read .mova/episodes/.current_session_id for active session
3. Count episodes in current session
4. Check .mova/episodes/index.jsonl for recent activity

## Output Format (Single Line Status)

If MOVA is active:
```
MOVA: active | Profile: [profile_id] v[version] | Session: [id] ([n] events, [duration])
```

If MOVA is inactive (no control file):
```
MOVA: inactive | Run /mova:init to initialize
```

If MOVA has errors:
```
MOVA: error | [error description]
```

## Extended Status (if session active)

```
MOVA Status
───────────────────────────────────
Status:     active
Profile:    [profile_id] v[version]
Preset:     [preset name if detected]
───────────────────────────────────
Session:    [session_id]
Events:     [count]
Duration:   [hh:mm:ss]
───────────────────────────────────
Security:   [n] events
  Critical: [n]  High: [n]
  Medium:   [n]  Low:  [n]
───────────────────────────────────
Features:
  Observability: [on/off]
  Dashboard:     [on/off] (port [n])
  OTEL Export:   [on/off]
  HITL:          threshold [level]
```

## Notes

- Keep output minimal by default
- Show extended status only if explicitly requested or if issues detected
- Security event count should highlight non-zero critical/high counts

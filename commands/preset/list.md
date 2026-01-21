---
description: List available MOVA presets
allowed-tools:
  - Read
  - Bash
---

List all available configuration presets.

## Execution:
```bash
node ${CLAUDE_PLUGIN_ROOT}/services/preset_manager.js list
```

## Output format:
```
Available presets:
  base          - Minimal safe configuration
  development   - Full development access with verbose logging
  production    - Locked-down production with audit logging

Current: [active preset name]
```

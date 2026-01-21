---
description: Show preset information
argument-hint: "<preset-name>"
allowed-tools:
  - Read
---

Display detailed information about a specific preset.

## Arguments:
- $1: preset name (required)

## Output includes:
1. Preset metadata (name, description)
2. Inheritance chain ($inherit)
3. Permissions configuration
4. Guardrail rules count and severities
5. Observability settings
6. Human-in-the-loop settings
7. Diff from base preset

## Execution:
```bash
node ${CLAUDE_PLUGIN_ROOT}/services/preset_manager.js info $1
```

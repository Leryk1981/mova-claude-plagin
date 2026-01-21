---
description: Apply a MOVA configuration preset
argument-hint: "<preset-name>"
allowed-tools:
  - Read
  - Write
  - Bash
---

Apply the specified preset to mova/control_v0.json.

## Arguments:
- $1: preset name (required) - base|development|production

## Execution:
```bash
node ${CLAUDE_PLUGIN_ROOT}/services/preset_manager.js apply $1
```

## Actions:
1. Load preset from presets/[name].preset.json
2. Resolve $inherit chain
3. Merge with current control_v0.json
4. Write updated control_v0.json
5. Backup previous version

## Output:
```
Applied preset: [name]
Changes:
  - permissions.allow: +3 tools
  - guardrail_rules: +2 rules
  - observability.otel_enabled: false -> true
Backup: .mova/backups/control_v0_[timestamp].json
```

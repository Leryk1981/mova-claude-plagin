---
description: Run MOVA structural validation
argument-hint: "[--fix]"
allowed-tools:
  - Read
  - Write
  - Bash
---

Run MOVA structural checks on the project.

## Validations:
1. mova/control_v0.json exists and valid JSON
2. Schema validation against control_v1.schema.json
3. All referenced presets exist
4. Guardrail rules have valid structure
5. Episodes directory writable
6. Required fields present

## If --fix is passed:
- Create missing directories
- Add missing required fields with defaults
- Fix schema violations where possible

## Execution:
```bash
node ${CLAUDE_PLUGIN_ROOT}/services/preset_manager.js lint $ARGUMENTS
```

## Output:
- List of issues found (if any)
- Fix actions taken (if --fix)
- Validation status: PASS/FAIL

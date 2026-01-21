---
description: Initialize MOVA in current project
argument-hint: "[--preset <name>]"
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
---

Initialize MOVA structure in the current project.

## Interactive Wizard

If no --preset is provided, run the interactive wizard:

1. **Check existing configuration**
   - If mova/control_v0.json exists, ask: "Overwrite, Merge, or Cancel?"

2. **Select Security Preset**
   Ask user to choose using AskUserQuestion:
   ```
   Question: "Which security preset should we use?"
   Options:
     - Development (Recommended for local work): Full tool access, verbose logging, dashboard enabled
     - Staging: Sandboxed environment, moderate logging, some confirmations required
     - Production: Restricted access, audit logging, OTEL export, confirmations required for most operations
   ```

3. **Enable Dashboard?**
   Ask user:
   ```
   Question: "Enable real-time monitoring dashboard?"
   Options:
     - Yes: Start WebSocket dashboard on port 2773
     - No (Recommended): Dashboard disabled by default
   ```

4. **Enable OTEL Export?**
   Ask user:
   ```
   Question: "Enable OpenTelemetry metrics export?"
   Options:
     - Yes: Export metrics to OTLP endpoint (configure OTEL_EXPORTER_OTLP_ENDPOINT)
     - No (Recommended): Local metrics only
   ```

## Apply Configuration

After wizard completes:

1. Create directory structure:
   - mova/control_v0.json
   - .mova/episodes/
   - .mova/backups/

2. Apply selected preset

3. Update CLAUDE.md with MOVA_CONTROL_ENTRY marker if not present

## Direct Preset Application

If --preset is provided, skip wizard and apply directly:

```bash
node ${CLAUDE_PLUGIN_ROOT}/services/preset_manager.js init --preset $2
```

## Output Summary

Display:
```
MOVA Initialized Successfully

Configuration:
  Profile: mova_claude_control_v1 v1.0.0
  Preset: [selected preset]
  Location: mova/control_v0.json

Directories Created:
  - mova/
  - .mova/episodes/
  - .mova/backups/

Features Enabled:
  - Observability: [enabled/disabled]
  - Dashboard: [enabled/disabled] (port [port])
  - OTEL Export: [enabled/disabled]
  - Human-in-the-Loop: escalation threshold [level]

Next Steps:
  - Run /mova:status to verify configuration
  - Run /mova:lint to validate structure
  - Use /mova:preset:list to see available presets
```

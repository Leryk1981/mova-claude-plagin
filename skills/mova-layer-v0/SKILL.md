---
name: mova-layer-v0
version: v0
description: MOVA Layer baseline behavior for Claude Code
---

# MOVA Layer v0

This skill provides baseline behavior for the MOVA (Monitoring, Observing, Validating Agent) layer.

## Capabilities

- Understanding MOVA control configuration
- Working with episodes and observability
- Applying guardrail rules
- Managing presets and permissions

## When Active

This skill is automatically loaded when user prompts mention:
- mova, observe, guard, episode, hook, control, preset, guardrail

## Guidelines

1. Always respect guardrail rules defined in control_v0.json
2. Log significant operations as episodes
3. Redact sensitive data in outputs
4. Follow the permission policy for tool usage

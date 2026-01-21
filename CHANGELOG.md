# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-01-21

### Changed

- Updated plugin metadata to the new repository
- Added marketplace manifest for Claude Code installation
- Refreshed installation instructions to use `/plugin` and marketplaces

## [0.2.0] - 2026-01-21

### Added

- **Core Plugin Structure**
  - Claude Code plugin manifest (`.claude-plugin/plugin.json`)
  - 14 slash commands for MOVA operations
  - Hook system for all Claude Code events (SessionStart, PreToolUse, PostToolUse, Stop)

- **Security Features**
  - Security event detection (6 event types)
  - Guardrail rules with configurable severity levels
  - Prompt injection detection
  - Sensitive data access monitoring
  - Forbidden tool blocking

- **Observability**
  - Episode recording following MOVA 4.1.1 specification
  - OpenTelemetry (OTLP) metrics export
  - Real-time WebSocket dashboard
  - Metrics aggregation and reporting

- **Human-in-the-Loop**
  - Configurable escalation thresholds
  - Auto-approve and always-confirm patterns
  - Confirmation timeout handling
  - Destructive operation detection

- **Preset System**
  - Base, Development, and Production presets
  - Preset inheritance via `$inherit`
  - Interactive initialization wizard

- **Data Management**
  - Retention policy configuration
  - Automatic cleanup and archival
  - Export to JSONL, CSV, JSON formats
  - Audit report generation

- **Documentation**
  - Comprehensive README with examples
  - Operator Guide v0 with full command reference

### Commands

| Command | Description |
|---------|-------------|
| `/mova:init` | Initialize MOVA with wizard |
| `/mova:status` | Show current status |
| `/mova:context` | Display full context |
| `/mova:lint` | Validate configuration |
| `/mova:start` | Start new session |
| `/mova:finish` | Finalize session |
| `/mova:metrics` | Show metrics |
| `/mova:dashboard` | Control dashboard |
| `/mova:debug` | Debug information |
| `/mova:export` | Export data |
| `/mova:retention` | Manage retention |
| `/mova:preset:list` | List presets |
| `/mova:preset:info` | Show preset details |
| `/mova:preset:apply` | Apply preset |

## [0.1.0] - 2026-01-15

### Added

- Initial embedded MOVA layer implementation
- Basic hook scripts
- Control profile structure

---

[0.3.0]: https://github.com/Leryk1981/mova-claude-plagin/releases/tag/v0.3.0
[0.2.0]: https://github.com/Leryk1981/mova-claude-plagin/releases/tag/v0.2.0
[0.1.0]: https://github.com/Leryk1981/mova-claude-plagin/releases/tag/v0.1.0

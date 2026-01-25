# REPO_MAP v0

## 1) Components (what exists now)

- CAPTURE_RUN v0
  - Paths: tools/capture_run_v0.mjs, src/capture_run/, docs/CAPTURE_RUN_V0.md
  - Run: node tools/capture_run_v0.mjs --cmd "node -e \"console.log('ok')\""

- EPISODES v0
  - Paths: tools/capture_run_to_episodes_v0.mjs
  - Run: node tools/capture_run_to_episodes_v0.mjs --run-dir artifacts/capture_run/<run_id>

- PATTERN_ANALYZE basic v0
  - Paths: tools/analyze_patterns_basic_v0.mjs, schemas/patterns_basic_v0.schema.json
  - Run: node tools/analyze_patterns_basic_v0.mjs --run-dir artifacts/capture_run/<run_id>

- CLAUDE integration
  - Paths: .claude-plugin/, commands/, hooks/, scripts/, services/, agents/, rules/, presets/, config/, schemas/
  - Run: Claude Code plugin commands (see README.md and OPERATOR_GUIDE_v0.md)

- OPENCODE integration
  - Paths: adapters/opencode/, .opencode/, opencode.jsonc, opencode-reference.md
  - Run: OpenCode adapter usage (see opencode-reference.md)

- CODEX integration (currently missing)
  - Paths: integrations/codex/
  - Run: capture_run blackbox recipe (see integrations/codex/README.md)

## 2) Folder map (tree)

- .claude-plugin/  Claude Code plugin metadata
- .github/         GitHub workflows and templates
- .mova/           Local runtime state (ignored)
- .opencode/       OpenCode bridge commands
- adapters/        Platform adapters (OpenCode)
- agents/          Agent profiles
- commands/        Claude command docs
- config/          Control configs
- docs/            Project docs (audit, quickstart, contracts)
- hooks/           Claude hook definitions
- integrations/    External integration recipes
- local-notes/     Local notes (ignored)
- mova/            MOVA data
- presets/         Preset configs
- rules/           Guardrail rules
- schemas/         JSON schemas
- scripts/         CLI scripts and utilities
- services/        Core services
- skills/          Skills
- test/            Tests
- tools/           CLI tools (capture_run, episodes, patterns)

## 3) Scripts map

### CAPTURE_RUN / EPISODES / PATTERN_ANALYZE
- smoke:capture_run
- smoke:capture_run:episodes
- smoke:capture_run:patterns
- smoke:capture_run:patterns:neg

### CLAUDE / MOVA general
- test


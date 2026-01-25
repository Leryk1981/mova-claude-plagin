# Codex Blackbox Capture Recipe

This is a blackbox capture recipe for Codex runs (no connector).

## How to run

1) Start Codex as a wrapped command:

- Example (CLI mode):
  node tools/capture_run_v0.mjs --cmd "codex exec --json \"summarize repo\""

- Example (TUI mode):
  node tools/capture_run_v0.mjs --cmd "codex"

2) After the run completes, convert to episodes:

- node tools/capture_run_to_episodes_v0.mjs --run-dir artifacts/capture_run/<run_id>

3) Optional pattern analysis:

- node tools/analyze_patterns_basic_v0.mjs --run-dir artifacts/capture_run/<run_id>

## Artifacts

Artifacts are written under:
- artifacts/capture_run/<run_id>/

Key files to inspect:
- env.json
- events.jsonl
- hashes.json
- stdout_tail.txt
- stderr_tail.txt
- episodes/episodes.jsonl
- patterns/patterns.json

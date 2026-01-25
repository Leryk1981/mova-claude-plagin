# CAPTURE_RUN v0 (User-side MOVA Control Layer)

## Purpose
Implement a user-side capture layer that runs ANY command/process (agent platform or script) and writes:
- deterministic evidence artifacts,
- episode-like events (JSONL),
without integrating into the platform internals.

This is the "blackbox" mode: we capture decisions via observable effects (process + repo deltas + receipts).

## Definitions
- Run = one managed process execution.
- Event = one recorded fact about the run (start/finish/snapshots/etc).
- Episode = derived grouping of events per run (no platform connector required).

## Non-goals
- No deep integration with Codex/IDE internals.
- No parsing of private prompts by default.
- No storing secrets.

## Inputs
A single command line to execute, plus options:
- cmd (string) — command to run
- cwd (string) — working directory
- git (boolean) — if true, capture git snapshots/diff
- tails (numbers) — limits for stdout/stderr tails (bytes/lines)
- allow_raw_logs (boolean) — default false; if true, store full logs (still redacted)

## Outputs (required per run)
All artifacts go to:
`artifacts/capture_run/<run_id>/`

Required files:
- env.json
- events.jsonl
- hashes.json
- stdout_tail.txt
- stderr_tail.txt

If git is enabled and repo exists:
- repo_before.json
- repo_after.json
- repo_diff.patch

Optional:
- redaction_report.json
- repo_status_before.txt / repo_status_after.txt

## run_id format
Use:
`YYYY-MM-DDTHH-mm-ss-SSSZ_<8hex>`
Example:
`2026-01-25T12-00-00-000Z_a1b2c3d4`

## env.json (minimal shape)
- run_id
- started_at_ms
- finished_at_ms
- cwd
- cmd (array of tokens or raw string, but DO NOT include secrets)
- exit_code
- git_enabled
- host (os/platform/node version)
- tool_versions (best-effort; no failures if missing)

## events.jsonl
Each line is JSON with:
- ts_ms (number)
- run_id (string)
- type (string)
- data (object)

Required event types (in this order):
1) run_start
2) repo_snapshot_before (only if git_enabled)
3) command_started
4) command_finished
5) repo_snapshot_after (only if git_enabled)
6) run_finish

Event `data` minimal fields:
- run_start: { cwd, cmd_redacted, git_enabled }
- repo_snapshot_*: { head, branch, status_summary, diff_hash }
- command_started: { pid? }
- command_finished: { exit_code, stdout_tail_hash, stderr_tail_hash }
- run_finish: { exit_code, artifact_dir }

## Redaction rules (MUST)
Never write secrets to artifacts. Apply redaction to:
- command line tokens
- environment variables passed through
- stdout/stderr content

Minimum redaction:
- Replace values for keys matching: /token|secret|password|key|bearer|authorization/i
- For URLs with credentials, strip userinfo.
- For headers-like lines, keep only presence/length.
Write redaction_report.json with:
- redacted_fields (paths)
- counts
- examples WITHOUT original values (only lengths/hashes)

## Hashes
hashes.json must include:
- stdout_tail_hash
- stderr_tail_hash
- repo_diff_hash (if git)
- env_hash (hash of env.json canonical form)

Hash algorithm: SHA-256 (hex).

## Git snapshot capture
If inside a git repo:
- capture: branch, head sha, `git status --porcelain`
- capture diff as patch: `git diff` (working tree)
- hash the diff content (sha256)

If not a git repo, git snapshots are SKIP (write event with data.reason = "NOT_A_GIT_REPO").

## Determinism rules
- The business-core objects must be stable: env.json should contain only factual run metadata.
- Do not embed absolute machine-specific paths except artifact_dir and cwd.
- Do not write timestamps inside derived core objects beyond ts_ms in events.

## Smoke test (must exist)
A smoke test runs a safe command and asserts:
- artifacts directory exists
- required files exist
- events.jsonl contains required event types in order
- hashes.json contains sha256 hex strings
- no obvious secret patterns in outputs (basic scan)

Smoke command example (Windows):
`node tools/capture_run_v0.mjs --cmd "node -e \"console.log('ok')\""`

## Acceptance
- npm test PASS
- smoke command PASS
- artifacts produced and validated
- no secrets leaked (redaction enforced)

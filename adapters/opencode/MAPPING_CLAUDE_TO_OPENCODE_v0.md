# Mapping: Claude Code -> OpenCode (v0)

Status: scaffold (to be filled in Step 2)

## Hooks
- SessionStart -> session.created
- PreToolUse -> tool.execute.before
- PostToolUse -> tool.execute.after
- Stop -> session.deleted / session.status(end)
- (Optional) compact/summarize -> session.compacted

## Commands
- /mova:init -> project:mova:init (Markdown command)
- /mova:status -> project:mova:status
- /mova:export -> project:mova:export
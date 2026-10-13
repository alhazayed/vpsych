# Hooks

`security_reminder_hook.py` is copied from
[alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills) at commit
`19392f7` (2026-08-26), path `engineering/security-guidance/hooks/`, MIT licensed
(`LICENSE-claude-skills`). It is a pinned copy: nothing updates from upstream automatically.

It is registered as a `PreToolUse` hook on `Edit|Write|MultiEdit` in `.claude/settings.json`.
It blocks the first edit per file and rule in a session that matches one of its security
patterns, then allows the retry. Its `exec(` pattern also matches `RegExp.prototype.exec`, so
expect occasional false positives. Disable it for a session with `ENABLE_SECURITY_REMINDER=0`.

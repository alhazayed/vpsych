# Vendored skills

These skills are copied from
[alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills) at commit
`19392f7` (2026-08-26), MIT licensed (`LICENSE-claude-skills`). They are pinned copies:
nothing updates from upstream automatically. To update one, diff it against a newer upstream
commit and review the change in a PR.

| Skill | Upstream path |
|---|---|
| `security-guidance` | `engineering/security-guidance/skills/security-guidance` (+ `hooks/security_reminder_hook.py` → `.claude/hooks/`) |
| `ai-security` | `engineering-team/skills/ai-security` |
| `a11y-audit` | `engineering-team/a11y-audit/skills/a11y-audit` |
| `pw-review` | `engineering-team/playwright-pro/skills/pw-review` |
| `pw-fix` | `engineering-team/playwright-pro/skills/fix` |
| `pw-coverage` | `engineering-team/playwright-pro/skills/coverage` |
| `statistical-analyst` | `engineering/statistical-analyst/skills/statistical-analyst` |
| `prompt-governance` | `engineering/prompt-governance/skills/prompt-governance` |
| `senior-prompt-engineer` | `engineering-team/skills/senior-prompt-engineer` |
| `adversarial-reviewer` | `engineering-team/skills/adversarial-reviewer` |

All bundled scripts use the Python standard library only: no network calls, no subprocesses.

## Local changes

- `fix` and `coverage` renamed to `pw-fix` and `pw-coverage` (directory and `name:`) so the
  generic names don't collide with other skills.
- `pw-coverage` / `pw-fix`: references to playwright-pro's `templates/`, `/pw:generate` and
  `/debug`, which were not vendored, replaced with `e2e/` and `npx playwright show-trace`.
- `security-guidance`: plugin install instructions replaced; the vendored hook is registered in
  `.claude/settings.json`.
- Not vendored: playwright-pro's hooks (its post-write check matches `*.test.ts`, so it would
  flag Vitest files) and its BrowserStack/TestRail integrations (external services, credentials).

## Caveats for this repo

- `statistical-analyst` speaks of "validating" differences. Competency scores are **not
  validated** (see CLAUDE.md); report its output as consistency statistics, with the limitations.
- `a11y-audit` covers WCAG 2.2 but not RTL; check the Arabic UI separately.
- `pw-fix` suggests CI `retries: 2` for flaky tests. Find the root cause first; a retry is not a fix.
- The security hook blocks the first matching edit per file and rule in a session, then allows
  the retry. Its `exec(` pattern also matches `RegExp.prototype.exec`, so expect occasional
  false positives. Disable for a session with `ENABLE_SECURITY_REMINDER=0`.

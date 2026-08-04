# RC5 — Release Checklist (`v1.0.0`)

**Trigger:** RC3 PASS (or board-waived CONDITIONAL waves with signed risk acceptance) **and** RC4 freeze complete with no open Critical/High.

**Status:** BLOCKED — RC3 NOT PASSED (2026-08-04)

## Tasks (do in order)

| # | Task | Owner | Done? |
|---|---|---|---|
| 1 | Confirm production deploy SHA == `main` | Release eng | ☐ |
| 2 | Confirm migration parity (`npm run test:migrations` + `SUPABASE_DB_URL`) `ok: true` | Release eng | ☐ |
| 3 | Set `package.json` `"version": "1.0.0"` | Release eng | ☐ |
| 4 | Create annotated git tag `v1.0.0` on release SHA | Release eng | ☐ |
| 5 | Publish GitHub Release for `v1.0.0` with notes + cert archive | Release eng | ☐ |
| 6 | Set `approval.sign_off_status: approved` in `RELEASE_MANIFEST.md` | Executive Board | ☐ |
| 7 | Archive certification reports (`docs/RC3_*`, `docs/rc3/**`, security/functional certs) as release artifacts | Release eng | ☐ |
| 8 | Record final production deployment ID + release timestamp in `RELEASE_MANIFEST.md` | Release eng | ☐ |
| 9 | Post-launch monitoring window (errors, auth, session success) | Ops | ☐ |

## `RELEASE_MANIFEST.md` fields (required at sign-off)

```yaml
version: "1.0.0"
git_sha: "<sha>"
production_deployment_id: "dpl_…"
production_url: "https://vpsych.vercel.app"
supabase_project: "rrzudbkxigeavfdnidnm"
approval:
  sign_off_status: approved   # only at RC5
  board_date: "YYYY-MM-DD"
  rc3_report: "docs/RC3_PRODUCTION_VALIDATION.md"
release_timestamp: "YYYY-MM-DDTHH:MM:SSZ"
```

## Explicit non-goals at RC5

- Merging v1.1 backlog
- Claiming assessment score validation
- Silent schema changes without migrations on git

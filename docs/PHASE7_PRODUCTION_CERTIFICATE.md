# Phase 7 — Production Certificate

**Title:** VPsych Platform-Admin Educational Console — Production Verified  
**Not:** institution-ready multi-tenant administration

| Field | Value |
|-------|-------|
| Production URL | https://vpsych.vercel.app |
| Production commit | `ff15236` (merge of Phase 6 / #229; redeploy `dpl_HNQXVbMYdfv7gp6KD7nhQsiiWEHf`) |
| Release date | 2026-09-21 |
| GitHub CI | **GREEN** — [run 35634419445](https://github.com/alhazayed/vpsych/actions/runs/35634419445) on `ff15236` |
| Vercel deployment | READY · SHA `ff15236` · production target |
| Supabase project | `rrzudbkxigeavfdnidnm` |
| Tests (CI) | verify job: lint, typecheck, test, migrations, perf-smoke, build — SUCCESS |
| Build | VERIFIED (CI + Vercel READY) |
| Cron endpoint | VERIFIED `/api/cron/expire-sessions` |
| Scheduler | **BLOCKED** for GitHub Actions (secret set/dispatch 403); endpoint **VERIFIED** via controlled Bearer invoke |
| CRON_SECRET | **PRESENT** (Vercel sensitive; production + preview) |
| SERVICE_ROLE_KEY | **PRESENT** (Vercel sensitive; production) |
| Session lifecycle | VERIFIED (unchanged contract) |
| Admin authorization | VERIFIED |
| RLS | VERIFIED (prior + release regression) |
| IDOR | VERIFIED (focused; anon/admin API denied) |
| EN | VERIFIED (production smoke) |
| AR | VERIFIED (production smoke) |
| RTL | VERIFIED |
| Mobile | VERIFIED |
| Historical tenancy | VERIFIED untouched — 603/603 `institution_id` NULL |
| Retention | DEFERRED · automatic purge DISABLED |
| Institutional readiness | **NOT CLAIMED** |

## Merge chain (executed)

```text
main @ 5c0947e
  → #226 MERGED 9454231 (CI GREEN)
  → #227 MERGED b3b0d20 (CI GREEN)
  → #228 MERGED 77c6757 (CI GREEN)
  → #229 MERGED ff15236 (CI GREEN)
```

## Cron production tests

| Test | Result |
|------|--------|
| A no Authorization | 401 |
| B wrong Bearer | 401 |
| C correct Bearer | 200 `{ok, scanned, expired}` |
| D controlled ACTIVE→EXPIRED | VERIFIED |
| E idempotent re-run | scanned=0 expired=0 |
| F completed unchanged | VERIFIED |
| G expired unchanged | VERIFIED |

## Remaining operator action

1. Set GitHub Actions repository secret `CRON_SECRET` to match Vercel production value so `.github/workflows/expire-sessions.yml` can run on schedule.
2. Optionally confirm first scheduled workflow run after secret is set.

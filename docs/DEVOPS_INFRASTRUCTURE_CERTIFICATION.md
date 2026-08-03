# VPsych DevOps & Infrastructure Certification — Mission 14

**Date:** 2026-08-03  
**Branch:** `cursor/devops-infrastructure-certification-8acf`  
**Roles:** Chief DevOps / Cloud Architect / SRE / Platform Security / GitHub Actions / Vercel / Supabase Ops  
**Targets:** GitHub `alhazayed/vpsych`, Vercel `vpsych` (`prj_qiJ1mQvX0s5lJZ9KJnpWAx4EXjNm`), Supabase `rrzudbkxigeavfdnidnm`

---

## Infrastructure Score

| Domain | Score (0–100) | Notes |
|---|---|---|
| GitHub repository health | **72** | Public `main`; CI green; branch protection / scanning not writable via token (ops) |
| CI/CD pipeline | **90** | Lint/typecheck/tests/migrations/build + audit + Node 24 + least privilege |
| Vercel platform | **88** | Prod HTTPS; preview SSO enabled; domains live |
| Supabase operations | **86** | `ACTIVE_HEALTHY`; Postgres 17; trigger RPC revoked |
| Environment management | **78** | Drift: remote migrations ahead of `main` until cert PRs merge |
| Monitoring & observability | **74** | Runtime logs + security_audit_events; no dedicated alert routing |
| Operational readiness / DR | **80** | Runbooks in SECURITY.md + this report; Supabase PITR/plan-dependent |
| Security operations | **84** | Preview SSO; health probe; secret docs; Dependabot |
| Infra performance | **86** | Prod `/login` TTFB ~1.5s cold; health intended &lt;200ms post-deploy |
| **Overall** | **83** | |

### Verdict

**⚠ DEVOPS CERTIFIED WITH RECOMMENDATIONS**

---

## Phase 1 — GitHub Assessment

| Control | Evidence | Status |
|---|---|---|
| Default branch | `main` | Pass |
| Visibility | Public | Pass (with preview SSO) |
| CI workflow | `.github/workflows/ci.yml` | Pass (hardened) |
| Recent CI | Multiple `success` on cert branches | Pass |
| Dependabot config | `.github/dependabot.yml` | **Fixed** (was missing) |
| Dependabot alerts API | Disabled at org/repo | Recommendation |
| Branch protection API | 403 / not accessible | Recommendation — require CI + reviews |
| Code / secret scanning API | 403 | Recommendation |
| `delete_branch_on_merge` | false | Recommendation |
| Tags / release automation | None | Recommendation (semver tags) |

---

## Phase 2 — CI/CD Assessment

**Pipeline (after remediations):**

1. `npm ci`
2. `npm audit --audit-level=high` (0 High+ currently)
3. Lint → Typecheck → Tests → Migration parity → Build
4. Failure injection: smoke script exits 2 without `SMOKE_BASE_URL`

**Hardening applied:**

- `permissions: contents: read`
- Concurrency cancel-in-progress
- Node **24** (matches Vercel project)
- 20-minute job timeout
- Optional remote migration parity via `SUPABASE_DB_URL` secret

**Gaps remaining:** No automated production deploy gate from GitHub (Vercel Git integration handles deploy); no rollback workflow file (use Vercel Instant Rollback UI/CLI).

---

## Phase 3 — Vercel Assessment

| Item | Finding |
|---|---|
| Domains | `vpsych.vercel.app` (+ team aliases) |
| HTTPS | Yes |
| Node | `24.x` |
| Preview deploys | Auto per branch/PR |
| Production | Git `main` |
| Deployment protection | **Preview SSO enabled** (Mission 14) |
| Password / Trusted IPs | Off (optional) |
| Framework field | Project `framework: null` (vercel.json sets nextjs) — cosmetic |
| Logs | Runtime logs available via Vercel |
| Analytics | Speed Insights CSP allowlisted |

---

## Phase 4 — Supabase Assessment

| Item | Finding |
|---|---|
| Status | `ACTIVE_HEALTHY` |
| Region | `us-east-1` |
| Postgres | 17.6.x |
| Auth | Active (password + refresh flows in logs) |
| Edge Functions | `send-email-hook` ACTIVE (`verify_jwt: false` — review) |
| Cron | None observed |
| Backups | Platform-managed (confirm PITR on plan) |
| Advisors | Leaked-password protection WARN (Auth dashboard) |
| Trigger RPC | `finish_session_on_report` EXECUTE revoked from anon/authenticated |

### Migration drift (High operational risk)

Remote has versions not present on `main` (certification branches applied ahead of merge). Local also uses different timestamps for some engine migrations. **Recommendation:** merge certification PRs, then reconcile with `supabase migration list` / repair.

---

## Phase 5 — Environment Management

| Env | Role |
|---|---|
| Local | `.env.example` → `.env.local` |
| Preview | Vercel Preview env + SSO |
| Production | Vercel Production env |

**Parity gaps:** Upstash may be unset (in-memory rate limits); service role / report key must be present for full session write path; AI keys required for non-fallback chat.

---

## Phase 6 — Monitoring & Observability

| Signal | Present |
|---|---|
| Vercel runtime logs | Yes |
| Supabase API/Auth logs | Yes (24h) |
| App `security_audit_events` | Yes |
| Structured AI/voice warn logs | Yes |
| Central alerting (PagerDuty/Slack) | No — recommendation |
| Distributed tracing | No — recommendation |
| Error budgets / SLOs | Documented targets only |

---

## Phase 7 — Operational Readiness & DR

### Deploy

1. Merge to `main` → Vercel production deploy  
2. Smoke: `SMOKE_BASE_URL=https://vpsych.vercel.app npm run test:smoke`  
3. Watch Vercel runtime logs + Supabase advisors  

### Rollback

1. Vercel Dashboard → Deployments → Promote previous READY production deployment  
2. Or `vercel rollback` (CLI)  
3. Re-run smoke  

### Backup / Recovery

1. Supabase dashboard backups / PITR (plan-dependent)  
2. Migrations are source-of-truth in git (`supabase/migrations`)  
3. Edge function source should be mirrored in repo if customized  

### Incident response (abbreviated)

1. Declare severity; freeze deploys if needed  
2. Check `/api/health`, Vercel status, Supabase status  
3. Rotate compromised secrets (see `SECURITY.md`)  
4. Postmortem within 48h  

---

## Phase 8 — Security Operations

| Control | Status |
|---|---|
| Preview SSO | **Enabled** |
| Public health probe | **Added** |
| API unauth → JSON 401 | **Fixed** |
| Secret rotation runbook | `SECURITY.md` |
| Dependency scanning | Dependabot + `npm audit` in CI |
| HIBP leaked password protection | Ops dashboard enable (WARN) |

---

## Phase 9 — Infrastructure Performance (measured)

| Probe | Result |
|---|---|
| Prod `/login` | HTTP 200, TTFB ~1.5s (cold) |
| Prod `/api/health` (pre-fix) | **307** (middleware) → fixed in this branch |
| Supabase Auth/API | Healthy 200s in recent logs |
| CI duration | Typically minutes (Node cache) |

---

## Phase 10 — Failure Injection

| Simulation | Result |
|---|---|
| Missing `SMOKE_BASE_URL` | Exit 2 (CI step) |
| Unauth API | 401 JSON (post-fix) |
| npm audit High+ | Would fail CI (currently 0) |
| Failed Vercel build | Preview not promoted; production untouched |
| DB advisor on trigger RPC | Cleared via REVOKE |

---

## Applied Fixes

1. Public `GET /api/health` + middleware short-circuit  
2. Unauthenticated `/api/*` → JSON **401** (not HTML 307)  
3. CI hardening (Node 24, audit, permissions, concurrency, smoke fail-closed)  
4. Dependabot for npm + GitHub Actions  
5. `scripts/smoke-prod.mjs` + `npm run test:smoke`  
6. Preview **Vercel Authentication (SSO)** enabled  
7. Migration revoke `finish_session_on_report` RPC grants (applied)  
8. `SECURITY.md` + this certification report  
9. Regression tests: `src/lib/devops.test.ts`, architecture health invariants  

---

## Remaining Risks (Recommendations)

1. Enable GitHub branch protection: required CI + 1 review on `main`  
2. Enable Dependabot alerts, secret scanning, code scanning  
3. Merge outstanding certification PRs to clear migration drift  
4. Provision Upstash for horizontal rate limits  
5. Enable Supabase Auth leaked-password protection  
6. Wire alerts (Vercel/Supabase → Slack/email)  
7. Mirror `send-email-hook` Edge Function in git; set `verify_jwt` appropriately  
8. Confirm PITR / backup retention on Supabase plan  

---

## Regression Results

| Check | Result |
|---|---|
| Lint | 0 errors |
| Typecheck | pass |
| Tests | **173** passed (incl. devops invariants) |
| Build | pass |
| `npm audit --audit-level=high` | 0 vulnerabilities |
| Preview SSO | enabled |
| Trigger RPC grants | revoked |

---

## Production Recommendation

Ship after merge + production smoke. Treat GitHub branch protection and migration-drift reconciliation as the next ops sprint items.

**⚠ DEVOPS CERTIFIED WITH RECOMMENDATIONS**

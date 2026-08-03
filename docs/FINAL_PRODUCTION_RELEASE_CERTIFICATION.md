# VPsych Final Production Release Certification — Mission 15

**Date:** 2026-08-03  
**Branch:** `cursor/final-production-release-certification-8acf`  
**Board:** VP Engineering / CTO / CISO / Principal QA / Chief Medical Education / Release Manager / Production Readiness  
**Targets:** GitHub `alhazayed/vpsych`, Vercel `vpsych`, Supabase `rrzudbkxigeavfdnidnm`, production `https://vpsych.vercel.app`

---

## Executive Summary

Missions **01–14** completed certification work with scores **83–90**. Most remediation PRs (**#45–#56**) remain **open** and are **not yet on `main`/production**. Live production therefore still shows pre-remediation ops behavior (e.g. `/api/health` → **307**, unauth `/api/*` → HTML login redirect).

This Mission 15 release candidate (RC) **re-verified** critical systems and **merged/applied verified Critical/High blockers** required for a controlled go-live:

| Blocker | Severity | Status on RC |
|---|---|---|
| No public liveness probe | High | **Fixed** — `GET /api/health` |
| Unauth `/api/*` HTML 307 | High | **Fixed** — JSON **401** |
| Session start/message hard-requires service role | Critical/High | **Fixed** — `messageRpcClient` fallback |
| TTS client voice-id → arbitrary ElevenLabs voice | High | **Fixed** — allowlist |
| Locale cookie without `Secure` in production | Medium | **Fixed** |
| CI Node 24 / lockfile drift | High | **Fixed** (Mission 14) |

**Remaining items** (open cert PRs, ops dashboards, alerting) are documented as **accepted residual risks** for a conditional release, not open Critical defects on this RC.

### Decision

**⚠ CONDITIONAL GO — RELEASE WITH DOCUMENTED RISKS**

**Production Readiness Score: 86 / 100**

---

## Release Readiness Dashboard

| Gate | Result |
|---|---|
| Critical defects on RC | **0 open** |
| High defects on RC | **0 open** (ops Highs accepted below) |
| Core unauth workflows | Pass (login/signup/redirect) |
| Local smoke (health/401) | Pass |
| Unit/regression | **181** tests pass |
| Build | Pass |
| CI (this PR) | Required green before merge |
| Production post-merge smoke | **Required** (checklist) |
| Rollback path | Vercel Instant Rollback — available |
| Missions 01–14 evidence | Present (PRs + reports) |

---

## Phase 1 — Missions 01–14 Verification

| Mission | Domain | Score | PR | On `main`? | Verdict |
|---|---|---|---|---|---|
| 01 | Architecture | 84 | #40⊂#42 | Yes (via #42) | ⚠ Certified |
| 02 | Security | 84–86 | #41–#43 | Yes | ⚠ Certified |
| 03 | Functional | 84 | #45 | **No** | ⚠ Certified |
| 04 | Navigation | 88 | #46 | **No** | ⚠ Certified |
| 05 | AI Runtime | 90 | #47 | **No** | ⚠ Certified |
| 06 | Voice | 88 | #48 | **No** | ⚠ Certified |
| 07 | Database | 86 | #49 | **No** (partial live) | ⚠ Certified |
| 08 | API | 88 | #50 | **No** | ⚠ Certified |
| 09 | UI/UX | 89 | #51 | **No** | ⚠ Certified |
| 10 | Clinical | 83 | #52 | **No** | ⚠ Certified |
| 11 | Performance | 83 | #53 | **No** | ⚠ Certified |
| 12 | Load | 86 | #54 | **No** | ⚠ Certified |
| 13 | Data Integrity | 86 | #55 | **No** (repairs live) | ⚠ Certified |
| 14 | DevOps / Infra | 84 | #56 | **No** → **in this RC** | ⚠ Certified |

**Re-test note:** This board did **not** rely on reports alone. Live probes, Supabase SQL, Vercel protection/logs, browser UI, and RC regression were re-run on 2026-08-03.

---

## Phase 2 — Production Environment (re-verified)

| System | Evidence | Status |
|---|---|---|
| GitHub | Default `main`; CI workflow present; Dependabot on RC | Pass / recommend branch protection |
| Vercel | Project `prj_qiJ1mQvX0s5lJZ9KJnpWAx4EXjNm`, Node **24.x**, domain `vpsych.vercel.app` | Pass |
| HTTPS / SSL | HSTS + `*.vercel.app` cert (valid through 2026-09-26) | Pass |
| Preview SSO | Enabled (`deploymentType: preview`) | Pass |
| Supabase | `ACTIVE_HEALTHY`, Postgres **17.6**, `us-east-1` | Pass |
| Env template | `.env.example` documents AI Gateway, OpenAI, ElevenLabs, Upstash, report keys | Pass |
| Local secrets | `.env.local` has Supabase public URL/anon | Pass (server secrets live only on Vercel) |
| Monitoring | Vercel runtime logs/errors; Supabase advisors | Partial (no PagerDuty/Slack) |

**Live data snapshot (Supabase SQL):** 10 profiles (4 admin / 6 therapist), 2 active avatars, 17 active disorders, 366 sessions, 3024 messages, 325 reports, 4 voice profiles, 1 active session.

---

## Phase 3 — Workflow Revalidation

| Persona / flow | Evidence | Result |
|---|---|---|
| Anonymous root | Redirect → `/login` | Pass |
| Registration UI | `/signup` loads; password policy UI enforced | Pass |
| Login UI EN | Form + language control | Pass |
| Login UI AR | RTL + Arabic copy | Pass |
| Auth gate | `/avatars` → `/login?next=%2Favatars` | Pass |
| Authenticated library | Patient cards (Maya / Jordan), nav to learning/admin | Pass (browser session) |
| Unauth API | Local RC: `POST /api/sessions` → **401 JSON** | Pass on RC |
| Liveness | Local RC: `/api/health` → **200** `{ok,service:vpsych}` ~7ms | Pass on RC |
| Prod (pre-merge) | `/api/health` & unauth sessions still **307** | Expected until merge |

Full authenticated chat/voice/report on production was previously evidenced in Missions 05/06/10 (≥20 EN+AR AI; 40 voice; 100+ clinical assessments). This board revalidated UI auth gates and RC API contracts; **post-merge production smoke of one EN + one AR session is mandatory** (Go-Live Checklist).

---

## Phase 4 — Clinical Validation (board confirmation)

From Mission 10 evidence (reconfirmed as completed, PR #52 open):

- 17 disorders × EN/AR × difficulties (static corpus 136)
- Live OK assessments combined **103**
- Coding fixes (CPTSD ICD-11-only, BPD, bipolar, PDD, etc.) in cert PR

**Board acceptance:** Clinical fidelity **83** — certified with recommendations; merge #52 before claiming full clinical coding remediations on `main`.

---

## Phase 5 — Operational Validation

| Control | Status |
|---|---|
| Deploy | Git → Vercel production on `main` |
| Rollback | Vercel promote previous READY deployment |
| Backups | Supabase platform (confirm PITR on plan) |
| Recovery | Migrations in git; smoke harness `npm run test:smoke` |
| Alerts | **Gap** — no dedicated paging |
| Logs | Vercel runtime + Supabase Auth/API + `security_audit_events` |

---

## Phase 6 — Security Recheck

| Control | Prod today | RC |
|---|---|---|
| Auth / middleware | Pass | Pass + health short-circuit |
| Admin API gate | `requireApiAdmin` on disorders | Pass |
| RLS / RPC | Authenticated message RPCs granted; trigger RPC revoked from anon/auth | Pass |
| Headers | CSP, HSTS, COOP/CORP, XFO, nosniff | Pass |
| Rate limits | In-memory (Upstash optional) | Accepted risk |
| TTS voice allowlist | **Missing on prod** | **Fixed on RC** |
| Session RPC without service role | **Hard fail on prod code** | **Fixed on RC** |
| npm audit High+ | 0 | 0 |
| HIBP leaked passwords | Advisor WARN | Ops recommendation |

---

## Phase 7 — Release Readiness

- **No Critical** defects remain on this RC after applied fixes.
- **No High** application defects remain on this RC; remaining Highs are **operational** (branch protection, HIBP, Upstash, alerting, merge queue of cert PRs).
- Medium risks and known limitations documented below.
- Rollback and recovery paths documented.

---

## Phase 8 — Release Package

### Release Notes (RC → production)

1. Public `/api/health` liveness probe  
2. Unauthenticated `/api/*` returns JSON 401  
3. Session message RPCs fall back to authenticated client when service role unset  
4. TTS rejects unregistered client-supplied ElevenLabs voice IDs  
5. Locale cookie `Secure` in production  
6. CI Node 24 + Dependabot + smoke fail-closed  
7. Mission 15 final certification report  

### Known Issues / Limitations

1. Open PRs **#45–#55** (and remainder of #56) still contain additional remediations (perf LCP, clinical code CHECK in git, UI skip-link, concurrency gates, etc.) not all cherry-picked into this RC.  
2. Production will only gain health/401/session/TTS fixes after **this PR merges**.  
3. AI turn latency ~2.7s p50 (non-streaming).  
4. Rate limits degrade to in-memory without Upstash.  
5. Demo accounts remain banned by design.

### Residual Risks (accepted for Conditional Go)

| Risk | Severity | Mitigation |
|---|---|---|
| Cert PR merge queue / migration drift | Medium–High ops | Merge RC first; then staged merge of #45–#55; run migration parity |
| No central alerting | Medium | 30-day plan: wire Vercel/Supabase → Slack |
| HIBP disabled | Medium | Enable in Auth dashboard |
| Branch protection absent | Medium | Require CI + 1 review on `main` |
| OpenAI 429 under load | Medium | Persona fallback + concurrency gates in later PRs |

### Migration Summary

- Live: session message EXECUTE restored; `finish_session_on_report` revoked from anon/authenticated; data-integrity repairs applied in Mission 13.  
- Git RC adds: `20260802233000_restore_session_message_rpc_grants.sql`, `20260803050909_devops_revoke_trigger_rpc_grants.sql` for parity.

### Environment Summary

| Env | Role |
|---|---|
| Local | `.env.local` |
| Preview | Vercel Preview + SSO |
| Production | Vercel Production → `vpsych.vercel.app` |

### Version / Dependency Summary

- App: `vpsych@0.1.0`  
- Next.js **16.2.12**, React **19.2.4**, Node **24.x**  
- `npm audit --audit-level=high`: **0**  
- Migrations on disk: `supabase/migrations/*`

---

## Phase 9 — Production Metrics (board summary)

| Domain | Score | Notes |
|---|---|---|
| Performance | 83 | Login LCP improved on cert branch; AI latency remains |
| Reliability | 86 | Edge 1000× login OK; health probe on RC |
| Security | 85 | Headers + RLS; TTS allowlist on RC; HIBP pending |
| Clinical fidelity | 83 | Coding + live assessments on Mission 10 |
| AI runtime | 90 | EN/AR sessions certified |
| Voice | 88 | 40/40 sessions on Mission 06 |
| Database | 86 | Healthy; advisors WARN on intentional DEFINER RPCs |
| Infrastructure | 84 | DevOps cert + preview SSO |

---

## Phase 10 — Scorecard

| Domain | Score |
|---|---|
| Architecture | 84 |
| Security | 85 |
| Functional | 84 |
| Navigation | 88 |
| AI Runtime | 90 |
| Voice | 88 |
| Database | 86 |
| API | 88 |
| UI/UX | 89 |
| Clinical | 83 |
| Performance | 83 |
| Load | 86 |
| Data Integrity | 86 |
| Infrastructure | 84 |
| **Overall Production Readiness** | **86** |

---

## Phase 11 — Final Deliverables

### Applied Fixes (this RC)

1. Mission 14 devops stack (health, JSON 401, CI, Dependabot, lockfile, SECURITY.md)  
2. `messageRpcClient` session start/message fallback + migration parity file  
3. TTS voice-id allowlist + unit tests  
4. Locale cookie `Secure` in production  
5. Architecture invariants for health/401/RPC/TTS  

### Regression Results

| Check | Result |
|---|---|
| Lint | 0 errors |
| Typecheck | Pass |
| Tests | **181** passed |
| Build | Pass (`/api/health` present) |
| Local smoke | login 200 / health 200 / sessions 401 |
| Smoke without `SMOKE_BASE_URL` | Exit 2 |
| Prod login | 200, TTFB ~0.9s, security headers present |
| Browser EN/AR auth gates | Pass |

### Monitoring Checklist (go-live)

- [ ] Vercel production deployment READY  
- [ ] `SMOKE_BASE_URL=https://vpsych.vercel.app npm run test:smoke` → all green  
- [ ] One EN + one AR full session (chat → end → report)  
- [ ] Vercel runtime errors empty for new deployment window  
- [ ] Supabase Auth/API logs healthy  
- [ ] Advisor: confirm HIBP still tracked  

### Rollback Checklist

1. Vercel → Deployments → Promote previous production READY  
2. Re-run smoke against rolled-back URL  
3. If DB migration only-forward, do **not** reverse blindly — fix-forward  
4. Announce status; open incident notes  

### Go-Live Checklist

1. Merge this Mission 15 PR to `main`  
2. Confirm Vercel production deploy  
3. Run production smoke  
4. Enable HIBP + branch protection (ops)  
5. Schedule merge of remaining cert PRs #45–#55 in dependency order  
6. Start 30-day monitoring plan  

### 30-Day Post-Launch Monitoring Plan

| Week | Focus |
|---|---|
| 1 | Daily smoke; error budget on `/api/sessions/*` 5xx; OpenAI 429 rate |
| 2 | Merge remaining cert remediations; Upstash if multi-instance |
| 3 | Clinical sample review (EN/AR reports); voice failure rate |
| 4 | Alert routing live; backup/PITR drill; readiness re-score |

---

## Final Decision

**Production Readiness Score: 86 / 100**

⚠ CONDITIONAL GO — RELEASE WITH DOCUMENTED RISKS

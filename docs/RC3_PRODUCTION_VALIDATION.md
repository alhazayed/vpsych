# RC3 — Production Validation

**Board date:** 2026-08-04  
**Phase:** Prove, do not build  
**Production:** `https://vpsych.vercel.app`  
**GitHub `main`:** `52a7610d732500c3c91067c270740edf4a1aaef3` (`RC1 Code Freeze — sole v1.0 candidate (#100)`)  
**Production deploy:** `dpl_2mBqyfzFEDCETctTSL7aFQR3HnDv` (target=`production`, SHA=`52a7610…`)  
**Supabase:** `rrzudbkxigeavfdnidnm` (ACTIVE_HEALTHY, us-east-1)  
**Vercel project:** `prj_qiJ1mQvX0s5lJZ9KJnpWAx4EXjNm`  
**Branch (this report):** `cursor/rc3-production-validation-b5ac`

**Rule:** Evidence collected only against production / `main` / production Supabase / production Vercel. No localhost, preview deployments, or feature-branch app binaries.

---

## Executive verdict

### ❌ RC3 NOT PASSED — Wave 1 gate failed

| Gate | Result |
|---|---|
| Wave 1 — Zero Critical or High technical defects | **FAIL** |
| Wave 2 — Disorders/scenarios certification | **CONDITIONAL** (data PASS; runtime BLOCKED) |
| Wave 3 — Competency / adaptive / analytics E2E | **CONDITIONAL** (schema PASS; runtime BLOCKED) |
| Wave 4 — Scientific reproducibility | **FAIL** (not production-demonstrable) |
| Wave 5 — Enterprise requirements | **CONDITIONAL** (security baseline PASS; gaps remain) |
| Wave 6 — Executive approval | **NOT APPROVED** |
| Wave 7 — Public launch readiness | **CONDITIONAL** (public SEO surface partial PASS) |

**Blocking Critical (must clear before re-running RC3 Wave 1):**

| ID | Severity | Finding | Remediation |
|---|---|---|---|
| RC3-C1 | **Critical** | Production `schema_migrations` = **54**; `main` git migrations = **28**. Git is not yet the deployed code-line’s migration source of truth on `main`. Reconciliation proven on PR #103 but **not merged**. | Merge [#103](https://github.com/alhazayed/vpsych/pull/103), redeploy if needed, re-run `npm run test:migrations` with `SUPABASE_DB_URL`. |
| RC3-C2 | **Critical** | Authenticated therapist/admin/AI/voice/session E2E **could not be executed**: no `VPSYCH_AUDIT_*` credentials in the RC3 environment; signup rejects `@example.com`. | Inject production audit therapist + admin secrets; re-run Missions 4–5, 10, 11–15 runtime paths. |

**Non-blocking High / Medium (do not alone fail Wave 1 if C1/C2 cleared, but must be tracked):**

| ID | Severity | Finding |
|---|---|---|
| RC3-H1 | High | Supabase Auth **leaked-password protection disabled** (HaveIBeenPwned). |
| RC3-M1 | Medium | Landing HTML lacks Open Graph tags (`og:*`). |
| RC3-M2 | Medium | Advisor WARN: many intentional `SECURITY DEFINER` RPCs callable by `authenticated` (expected for session/report helpers; review `purge_training_sessions_older_than` remains admin-gated in body — OK). |
| RC3-M3 | Medium | Runtime clone preset `cbt-skills-gp-en-copy-msdflwu3` exists disabled — not migration-sourced. |

---

## Preflight (RC2 exit → RC3 entry)

| Check | Evidence | Pass? |
|---|---|---|
| #100 on `main` | `52a7610` | ✅ |
| Production deploy SHA == `main` | `dpl_2mBqyfz…` meta `githubCommitSha` = `52a7610…` | ✅ |
| `/api/health` | 200 `{"ok":true,"service":"vpsych",…}` | ✅ |
| `/robots.txt`, `/sitemap.xml`, `/privacy`, `/terms` | 200 | ✅ |
| Anon `/api/sessions` | **401 JSON** `{"error":"Unauthorized"}` (not 307 HTML) | ✅ |
| Locale cookie `Secure` | `locale=en; … Secure; SameSite=lax` | ✅ |
| Security headers | CSP, HSTS preload, COOP/CORP, XFO DENY, nosniff, Permissions-Policy | ✅ |
| Vercel runtime errors (24h) | None reported | ✅ |
| Migration parity `main` ↔ prod | 28 vs 54 | ❌ **RC3-C1** |

---

## Mission matrix (production evidence)

Legend: **PASS** · **FAIL** · **CONDITIONAL** (data/schema OK, runtime not executed) · **BLOCKED** (credentials)

| # | Mission | Wave | Verdict | Evidence |
|---:|---|---|---|---|
| 1 | UI / UX / Navigation | 1 | **PASS** | Browser prod screenshots; EN/AR RTL; mobile 390px; 0 Critical/High UI defects. Artifacts: `/opt/cursor/artifacts/rc3/screenshots/`, `docs/rc3/M01_UI_UX.md` |
| 2 | Authentication & Authorization | 1 | **PASS** (public + API gates) | Soft auth: `/avatars|/admin|/sessions|/learning` → **307** `/login?next=…`. APIs → **401 JSON**. Anon PostgREST → permission denied on all probed tables. Authenticated role matrix **BLOCKED** (no audit user). |
| 3 | Database / Supabase | 1 | **FAIL** | Live DB healthy (56 tables, RLS on all, 54 migrations, message RPC grants include `authenticated`). **Git `main` migration tree diverges** → RC3-C1. Detail: `docs/rc3/M03_DATABASE.md` |
| 4 | API Runtime | 1 | **CONDITIONAL** | Anon contract PASS (401 JSON, `no-store`). Authenticated session create/message/end **BLOCKED**. |
| 5 | AI Runtime | 1 | **BLOCKED** | `/api/health/openai` correctly admin-gated (401). Live GPT path not probed without admin. |
| 6 | Clinical Templates | 2 | **PASS** (data) | 3 enabled templates; all have objectives + diagnoses; comorbidities present. |
| 7 | Persona Engine | 2 | **PASS** (data) | 2 active avatars (`jordan-hale`, `maya-chen`) with `en-US` + `ar-JO`. |
| 8 | Scenario Engine | 2 | **CONDITIONAL** | Catalog/templates ready; generation path needs auth. |
| 9 | DSM-5 / ICD-11 Integrity | 2 | **PASS** | 17 disorders; all have ICD-11; only `complex-ptsd` lacks DSM-5 (ICD-11-only construct — accepted). |
| 10 | Voice & Conversation | 2 | **BLOCKED** | TTS/STT APIs 401 without auth; 3 active voice profiles in DB. |
| 11 | Instructor Presets | 3 | **PASS** (data) | 7 enabled presets across learner roles; all have objectives. |
| 12 | Competency Graph | 3 | **PASS** (data) | 34 nodes, 42 edges, 0 orphan edges, 34 domains. |
| 13 | Adaptive Curriculum | 3 | **PASS** (data) | ACE tables present; 4 adaptive rules; `apply_ace_session_progress` service_role-only. |
| 14 | Learning Analytics | 3 | **CONDITIONAL** | 390 sessions / 333 reports / 98.2% report coverage (14d); UI analytics **BLOCKED**. |
| 15 | Educational Outcomes | 3 | **CONDITIONAL** | CBME schema + seeds present; outcome dashboards **BLOCKED**. |
| 16 | Scientific Validation | 4 | **FAIL** | Assessment reliability **not validated**; corpus needs clinician ratings (`docs/ASSESSMENT_RELIABILITY` posture on `main`). |
| 17 | Scientific Metrics | 4 | **FAIL** | Weighted metrics engines largely deferred to v1.1 branches — not on production code SHA. |
| 18 | Quality Ledger | 4 | **FAIL** | Not on production `main` SHA. |
| 19 | Research Readiness | 4 | **FAIL** | Not demonstrated on production release train. |
| 20 | Security | 5 | **CONDITIONAL** | Headers, RLS, anon denial, JSON 401, RPC restore: PASS. Leaked-password protection OFF → RC3-H1. Definer advisories → RC3-M2. |
| 21 | Performance & Scalability | 5 | **CONDITIONAL** | Public p50 ~70–130ms; health max spike 752ms. **No declared-scale load test** executed. |
| 22 | Compliance | 5 | **CONDITIONAL** | `/privacy` `/terms` live; consent/DSAR surfaces incomplete vs enterprise cert drafts. |
| 23 | Institutional Readiness | 5 | **CONDITIONAL** | 5 institutions in DB; faculty UX **BLOCKED**. |
| 24 | Disaster Recovery | 5 | **CONDITIONAL** | Supabase ACTIVE_HEALTHY; backup/restore drill **not evidenced** in this run. |
| 25 | Executive Release Board | 6 | **NOT APPROVED** | See below. |
| 26 | Technical SEO | 7 | **CONDITIONAL** | robots/sitemap/title/description PASS; OG tags missing (RC3-M1). |
| 27 | AEO | 7 | **FAIL** | No production AEO artifact pack on `main`. |
| 28 | GEO | 7 | **FAIL** | No production GEO artifact pack on `main`. |
| 29 | Brand / Conversion | 7 | **PASS** (public) | Brand-first login/landing, legal links, bilingual — browser PASS. |
| 30 | Public Launch | 7 | **FAIL** | Blocked by RC3 Waves 1/4/6. |

---

## Wave gates (detail)

### Wave 1 — Platform Validation → **FAIL**

Public platform surfaces from RC1 are live and correct. The Wave 1 gate still fails on **RC3-C1** (migration source-of-truth) and cannot clear authenticated API/AI (**RC3-C2**).

### Wave 2 — Clinical Validation → **CONDITIONAL**

Disorder/template/persona **data integrity PASS** on production Postgres. Scenario generation + voice conversation runtime **not proven** without audit sessions.

### Wave 3 — Educational Validation → **CONDITIONAL**

Presets/CGE/ACE **schema + seeds PASS**. Competency tracking / adaptive learning / analytics **E2E not executed**.

### Wave 4 — Scientific Validation → **FAIL**

Scientific ledgers/metrics/reliability claims are **not** on the production release train at `52a7610`. Do not imply validated scores.

### Wave 5 — Enterprise Validation → **CONDITIONAL**

Security baseline strong; enterprise compliance/DR/load incomplete.

### Wave 6 — Executive Release Board → **NOT APPROVED**

| Seat | Vote |
|---|---|
| CTO | **NO** — migration drift on `main` |
| CISO | **CONDITIONAL NO** — HIBP off; auth E2E missing |
| CMO | **CONDITIONAL** — catalog OK; live clinical session not witnessed |
| Medical Education | **CONDITIONAL** — engines seeded; outcomes E2E missing |
| CSO | **NO** — scientific validation absent on prod |
| QA | **NO** — Wave 1 gate failed; authenticated suite blocked |
| Product / Launch | **NO** — public launch not cleared |

**Executive Certification Score:** **52 / 100**  
**Confidence Score:** **58 / 100** (strong public/prod SHA sync; weak migration git sync + no auth E2E)

### Wave 7 — Public Launch → **FAIL**

Discoverability basics exist; launch blocked until RC3 Waves 1+6 pass.

---

## Required actions before RC3 re-run

1. **Merge PR #103** (migration reconciliation) into `main` and confirm deploy/parity.  
2. **Provision RC3 audit secrets:** `VPSYCH_AUDIT_THERAPIST_EMAIL/PASSWORD`, `VPSYCH_AUDIT_ADMIN_EMAIL/PASSWORD`.  
3. Re-execute Missions **4, 5, 8, 10–15** with `scripts/prod-validate-sessions.mjs` against `https://vpsych.vercel.app` only.  
4. Enable Supabase **leaked password protection** (RC3-H1).  
5. Optionally add OG tags (RC3-M1) before Wave 7 re-score.  
6. Keep scientific ledgers on **v1.1** unless explicitly promoted — do not claim Wave 4 PASS without clinician-rated reliability.

---

## Artifacts

| Path | Contents |
|---|---|
| `/opt/cursor/artifacts/rc3/screenshots/` | M01/M02 browser evidence |
| `/opt/cursor/artifacts/rc3/wave1_public_probes.json` | HTTP/security probes |
| `/opt/cursor/artifacts/rc3/waves_2_7_evidence.json` | SEO/perf/API samples |
| `/opt/cursor/artifacts/rc3/db_inventory_summary.json` | Live DB counts |
| `docs/rc3/*` | Per-mission briefs |
| `docs/RC4_BUGFIX_FREEZE.md` | Post-RC3 freeze rules |
| `docs/RC5_RELEASE_CHECKLIST.md` | Tag/release tasks |

---

## RC4 / RC5 pointer

- **RC4** starts only after a **PASS** RC3 Wave 1 re-run (and board acceptance of remaining CONDITIONAL waves or their promotion to PASS).  
- **RC5** (`v1.0.0` tag, GitHub Release, `package.json`, `RELEASE_MANIFEST.md` sign-off) is **forbidden** while this document’s verdict is NOT PASSED.

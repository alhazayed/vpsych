# VPsych Supabase Certification Report

**Mission:** Supabase Certification  
**Board:** Independent Release Certification Board  
**Date:** 2026-08-03  
**Scope:** Postgres schema, RLS, SECURITY DEFINER RPCs, Auth advisors, Edge Functions, migration reproducibility, Data API exposure  
**Baselines:** GitHub `main` @ `3e3077e`, production `https://vpsych.vercel.app`, Supabase project `rrzudbkxigeavfdnidnm`  
**Remediation branch:** `cursor/supabase-certification-e57e` (PR #72)  
**Evidence:** `/opt/cursor/artifacts/supabase-cert/`

---

## Executive Summary

Live audit of production Supabase and `main` verified **Critical** ACE score forgery via a client-callable SECURITY DEFINER RPC, **High** re-granted transcript message RPCs, and **High** migration-history drift (production migrations absent from `main`).

All Critical/High defects were remediated, applied to production where required, and regression-probed. Remaining items are advisor WARNs with compensating controls and ops recommendations.

**Certification outcome:**

⚠ CERTIFIED WITH RECOMMENDATIONS

**Board score:** 91 / 100

---

## Audit Method

| Surface | Method |
|---|---|
| Security advisors | `get_advisors` type=security |
| Performance advisors | `get_advisors` type=performance (0 ERROR; WARN/INFO only) |
| RLS inventory | All 45 `public` tables: `rls_enabled=true`, policies present |
| Views | All public views use `security_invoker=true` |
| Anon Data API | Table SELECT → `42501 permission denied` (no anon grants) |
| Authenticated JWT probes | Password grant + REST/RPC forge attempts |
| Edge Functions | `send-email-hook` source review (`verify_jwt=false` + Standard Webhooks) |
| Migration drift | `list_migrations` vs `supabase/migrations` on `main` |
| Storage | No buckets configured |
| Postgres/Auth logs | Recent errors corroborate pre-fix forge and post-fix denials |

---

## Verified Findings and Fixes

### C1 — Critical — Authenticated ACE score / certification forgery

| Field | Detail |
|---|---|
| **Severity** | Critical |
| **Evidence** | Therapist JWT `POST /rest/v1/rpc/apply_ace_session_progress` returned **200 true**; profile became `certification_status=certified`, `completed_case_count=77`, competency `diagnostic_interview` score **98** (`ace-forge-probes.txt`) |
| **Root cause** | SECURITY DEFINER RPC granted to `authenticated`, sets `vpsych.allow_learner_scoring` to bypass `enforce_learner_profile_guard`, then writes scoring tables |
| **Fix** | Migration `20260803172000_supabase_cert_revoke_privileged_rpcs` — REVOKE from `PUBLIC`/`anon`/`authenticated`, GRANT `service_role` only (**applied to production**). ACE `persistLearnerUpdate` now calls the RPC via `createServiceClient()` |
| **Regression** | Authenticated call → **403** `permission denied for function apply_ace_session_progress` (`post-fix-probes.txt`). Advisors no longer list this RPC |
| **Residual risk** | Low — requires service role key compromise; ensure `SUPABASE_SERVICE_ROLE_KEY` remains server-only |

### H1 — High — Transcript forge RPCs executable by authenticated

| Field | Detail |
|---|---|
| **Severity** | High |
| **Evidence** | Pre-fix ACLs granted `authenticated` EXECUTE on `insert_assistant_message` / `insert_system_message` (despite Mission 02 revoke; re-granted by `restore_session_message_rpc_grants`). App routes already use service client |
| **Root cause** | Compatibility restore left Data API surface open; ownership checks mitigate but do not remove privileged entrypoint |
| **Fix** | Same revoke migration — service_role only |
| **Regression** | Authenticated forge → **403** `permission denied` for both RPCs |
| **Residual risk** | Low — ownership checks remain defense-in-depth inside function bodies |

### H2 — High — Production migration history missing from `main`

| Field | Detail |
|---|---|
| **Severity** | High |
| **Evidence** | Prod had 39 migrations; `main` had 26. Missing included ACE RPC, database/data-integrity/devops/clinical/performance certs, profiles RLS recursion (`migration-drift.txt`) |
| **Root cause** | Certifications applied to production via MCP without landing on `main` |
| **Fix** | Synced applied SQL into `supabase/migrations/` under production version IDs (`021077a`) |
| **Regression** | Repo now contains the missing versions; new revoke migration present |
| **Residual risk** | Medium/Info — early engine migrations still use alternate timestamps on prod vs repo combined files (schema equivalent; history keys differ) |

---

## Controls Verified Pass

| Control | Result | Evidence |
|---|---|---|
| RLS on all public tables | Pass | 45/45 `rls_enabled` |
| Anon table access | Pass | `42501` on representative tables |
| Views security_invoker | Pass | All public views |
| Cross-learner ACE forge | Pass (pre-revoke ownership) / N/A post-revoke | Foreign learner list empty; Forbidden path in function |
| Direct learner score PATCH | Pass | Trigger `Learner cannot mutate instructor or scoring fields` |
| Direct `competency_scores` INSERT | Pass | RLS 403 |
| Session message table forge | Pass | RLS 403 for assistant/foreign user |
| `create_session_report` foreign | Pass | `Not authorized` / invalid signature |
| Email hook without secrets | Observed | Returns 500 “not configured” before verify; when secrets set, Standard Webhooks required |
| Role escalate on profiles | Pass | `Cannot change role` |

---

## Regression Matrix

| Gate | Result |
|---|---|
| Live JWT post-fix probes | ACE/message RPCs **403**; profile scores reset |
| ACL query | EXECUTE only `postgres` + `service_role` for revoked RPCs |
| Security advisors | Revoked RPCs cleared; remaining WARN intentional |
| `npm test` | **172/172** on this branch |
| `npm run build` | Pass |
| Unit guards | `supabase-certification.test.ts` 4/4 |

---

## Residual Risks & Recommendations

| ID | Severity | Item | Recommendation |
|---|---|---|---|
| R1 | Medium (advisor WARN) | Auth leaked-password (HIBP) disabled | Enable in Supabase Auth settings |
| R2 | Low–Medium (advisor WARN) | Remaining SECURITY DEFINER EXECUTE for `create_session_report` (HMAC), `is_admin`, `current_user_role`, `log_security_event`, `session_has_report` | Keep; ownership/HMAC verified. Optionally restrict further if unused by clients |
| R3 | Medium (ops) | `send-email-hook` secrets not fully configured in this environment | Set `RESEND_API_KEY`, `SEND_EMAIL_HOOK_SECRET`, `AUTH_EMAIL_FROM` |
| R4 | Info | Performance advisor WARNs (initplan, multiple permissive policies, unused indexes) | Track in performance backlog; 0 ERROR |
| R5 | Info | Engine migration version timestamp drift | Optional future rebase of history for greenfield clarity |
| R6 | Ops | ACE persistence requires `SUPABASE_SERVICE_ROLE_KEY` on Vercel | Confirm production env has service role (required for scoring writes) |

---

## Commits (subsystem grouping)

1. `021077a` — `chore(supabase):` sync production migration history into main  
2. `3ad8bc5` — `fix(supabase):` revoke authenticated EXECUTE on privileged RPCs  
3. `8565024` — `fix(ace):` persist learner scoring via service-role RPC  
4. `e4159f9` — `test(supabase):` guard privileged RPC revoke and ACE service persist  

---

## Board Verdict

No remaining **Critical** or **High** Supabase defects after remediation and live regression. Residual items are ops/advisor recommendations with compensating controls.

⚠ **CERTIFIED WITH RECOMMENDATIONS**

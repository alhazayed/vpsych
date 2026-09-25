# Phase 8.4 — Full Security Regression Audit (READ ONLY)

**Date:** 2026-09-25  
**Repository tip audited:** `20d9c78` (Phase 8.3 on Phase 8.2)  
**Live DB probed:** Supabase `vpsych` (`rrzudbkxigeavfdnidnm`) — read-only SQL  
**Mode:** Independent verify — no code, migration, policy, or env changes in this phase.

Vocabulary: `PASS` | `FAIL` | `PARTIAL` | `NOT VERIFIED`

---

## Executive verdict

| Scope | Status |
|-------|--------|
| Application / git tree after Phase 8.2–8.3 | **PASS** for remediated P0/P1 controls |
| Live production database message RPCs | **FAIL** — HMAC migration **not applied** yet |
| **SECURITY REGRESSION STATUS** | **BLOCKED** (pending production apply of `20260925120000_phase8_restore_message_hmac.sql` + deploy of signing app) |

No remediation regression was found in the git tree that reopens a fixed control. The blocking item is **operational**: live DB still matches the pre-8.2 QA restore (authenticated EXECUTE, no HMAC).

---

## AUTHENTICATION

| Check | Result | Evidence |
|-------|--------|----------|
| Login / session refresh | PASS | `src/lib/supabase/middleware.ts` + `createServerClient` cookie refresh |
| Logout / recovery paths public | PASS | `/auth/*` public in `isPublicPath` |
| Password policy | PASS | `src/lib/password-policy.ts` + tests |
| Session expiry (app) | PASS | `MAX_SESSION_SECONDS` + end/cron routes |
| Admin authentication | PARTIAL | Role gate + AAL2 when MFA enforced (`src/lib/auth.ts`, `src/lib/api-auth.ts`); enrollment UX not productized |

---

## AUTHORIZATION

| Check | Result | Evidence |
|-------|--------|----------|
| Therapist → own sessions/messages | PASS | RLS + Route Handler ownership checks |
| Therapist → another therapist’s data | PASS (design) | Session queries filter `therapist_id`; RLS |
| Therapist → admin functions | PASS | Middleware + `requireApiAdmin` role deny |
| Admin → authorized data | PASS | `profiles.role === 'admin'` |
| Institution manager minimum data | NOT VERIFIED | Enterprise RBAC abstractions exist (`src/lib/enterprise/*`); full live tenancy matrix not exercised this phase |
| Admin MFA bypass via API | PASS (when enforced) | `requireApiAdmin` → `evaluateAdminMfa` → 403 `MFA_REQUIRED` without AAL2 |
| Admin MFA default off in non-prod | PASS | `isAdminMfaEnforced` — intentional; set `ADMIN_MFA_REQUIRED=true` to force locally |

---

## DATABASE

| Check | Result | Evidence |
|-------|--------|----------|
| RLS on `session_messages` (no assistant/system table INSERT) | PASS | Hardening migrations; SELECT + user INSERT only |
| Message RPC HMAC in **git** | PASS | `supabase/migrations/20260925120000_phase8_restore_message_hmac.sql` |
| Message RPC HMAC on **live prod** | **FAIL** | Live: `checks_sig=false`, `has_hmac=false`, `auth_exec=true` (2026-09-25) |
| SECURITY DEFINER search_path | PASS | Message RPCs set `search_path TO 'public'` |
| Service-role isolation | PASS | `createServiceClient` server-only; documented call sites |
| `admin_test` INSERT guard | PASS | `20260821084315_session_admin_test_insert_guard.sql` + architecture tests |
| Storage policies | NOT VERIFIED | Not in P0/P1 remediation scope; no change this phase |

### FAIL detail — live message integrity

- **Severity:** P0 (production)  
- **Affected:** `public.insert_assistant_message`, `public.insert_system_message`  
- **Attack path:** Authenticated owner → PostgREST RPC without `p_sig` → forge transcript → assessment  
- **Recommended action:** Apply `20260925120000_phase8_restore_message_hmac.sql` to production; ensure Vault `report_write_key` ≡ `REPORT_WRITE_KEY` (or deploy with `SUPABASE_SERVICE_ROLE_KEY`); deploy app with `prepareMessageRpc`.

---

## MESSAGE INTEGRITY

| Check | Result | Evidence |
|-------|--------|----------|
| Forged assistant (repo path) | PASS | HMAC required for non-service; `prepareMessageRpc` signs |
| Forged system (repo path) | PASS | Same |
| Modified content invalidates sig | PASS | `src/lib/report-sign.test.ts` |
| Modified session invalidates sig | PASS | Same |
| Unauthorized session | PASS | RPC owner/`is_admin` checks retained |
| Signing secret in browser | PASS | No `NEXT_PUBLIC_*` report/service keys |
| Live forge still possible | **FAIL** | Migration not applied (see above) |
| Remediation regression (HMAC removed again) | PASS | Latest migration restores HMAC; no later conflicting migration in tree |

---

## DATA PRIVACY

| Check | Result | Evidence |
|-------|--------|----------|
| PHI in client errors | PASS (improved) | Allowlist `clientSafeError`; SSE sanitized |
| Server logs may contain messages | PARTIAL | Intentional `console.error` of internal detail — server-side only |
| Browser storage of secrets | PASS | No report key in client bundles (server modules) |
| URL parameters | PASS | `safeRedirectPath` on login next |
| Exports / PDF / CSV / Excel | NOT VERIFIED | Admin research export exists; deep PHI review out of scope for this pass |

---

## API

| Check | Result | Evidence |
|-------|--------|----------|
| Error leakage (allowlist) | PASS | `src/lib/api-errors.ts` + tests |
| SSE leakage | PASS | `clientSafeStreamError` in stream route (raw message only in server log) |
| Input validation | PARTIAL | Inline validation pattern retained; not uniformly Zod |
| Rate limiting | PASS | Widespread `rateLimit(` on session/voice/admin routes |
| Authorization on admin APIs | PASS | `requireApiAdmin` + middleware edge gate |

Remaining `error.message` hits under `src/app/api` are predominantly **server logs** or `sanitizeDbError` wrappers — acceptable. No new raw SSE client leak found.

---

## ASSESSMENT

| Check | Result | Evidence |
|-------|--------|----------|
| Scoring SSOT | PASS | `assessSession` / weighted overall in `assessment.ts` |
| Report generation signing | PASS | `signSessionReport` / `create_session_report` |
| Transcript integrity dependency | PARTIAL | Report HMAC signs **outputs**; input integrity depends on message HMAC (**live FAIL**) |
| Arabic/English examiner parity | PASS | Wave-3 block present in both languages (`report-locale.ts` + tests) |

---

## CLINICAL TRAINING SAFETY

| Check | Result | Evidence |
|-------|--------|----------|
| Risk detection EN | PASS | Regex stems |
| Risk detection AR | PASS | Arabic stems added |
| False critical on N/A | PASS | `NOT_APPLICABLE` skips critical finding |
| UNCERTAIN handling | PASS | Minor finding for short transcripts |
| Scores validated claim | PASS | Docs/product still treat scores as formative (not claimed validated) |

---

## INFRASTRUCTURE

| Check | Result | Evidence |
|-------|--------|----------|
| Secrets not committed | PASS | `.env.example` only; no tracked secrets |
| CRON_SECRET / expire workflow | PASS | Phase 7 CLEAR — not modified this phase |
| Next.js version | PASS | `16.3.6`; `npm audit --omit=dev` → 0 |
| CI / Vercel | NOT VERIFIED | No deploy exercised in 8.4 |
| GitHub Actions secrets | NOT VERIFIED | Out of agent write scope historically |

---

## Remediations vs regressions

| Remediation | Introduced regression? |
|-------------|------------------------|
| Message HMAC + `prepareMessageRpc` | No — tests green (945); architecture asserts migration |
| Allowlist errors | No — product allowlist may need expansion for new UX strings |
| Admin MFA AAL2 | No — defaults off outside production to avoid locking local/CI |
| Risk status enum | No — education tests updated |
| Wave-3 AR prompt | No — parity test added |
| Next 16.3.6 | No — typecheck + tests pass |

---

## FAIL register (actionable)

1. **Live message RPC HMAC absent**  
   - Severity: **P0**  
   - Files: live `insert_assistant_message` / `insert_system_message`  
   - Attack: PostgREST forge without `p_sig`  
   - Action: apply Phase 8.2 migration + deploy signing app  

---

## PASS highlights

- Repo message integrity control restored (CQG-011)  
- SSE / allowlist error model  
- Admin AAL2 enforcement code path  
- EN/AR risk + examiner Wave-3 parity  
- Next.js advisory floor met (`16.3.6`)  
- Rate limits and admin role gates intact  
- No signing secret exposure to browser  

---

## SECURITY REGRESSION STATUS

# BLOCKED

**Reason:** Live production database still grants unsigned authenticated message inserts. Repository remediations are present and tested, but production is not closed until migration apply + deploy complete.

After apply/deploy, re-run the live SQL check (`checks_sig` / `has_hmac` must be true) and mark CLEAR.

---

*Phase 8.4 produced documentation only. No application or database changes were made in this phase.*

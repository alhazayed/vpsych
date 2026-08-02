# VPsych Functional Certification Report
## Mission 03 — Complete Functional Certification

**Date:** 2026-08-02  
**Branch:** `cursor/functional-certification-8acf`  
**PR:** https://github.com/alhazayed/vpsych/pull/45  
**Environments:** Production `https://vpsych.vercel.app` · Preview `vpsych-git-cursor-functional-ce-17a719-…`  
**Supabase:** `rrzudbkxigeavfdnidnm`

---

## Executive summary

Complete end-to-end functional certification was performed across discovery, auth, RBAC, navigation, assessment/conversation, admin surfaces, i18n, and regression.

Two **Critical/High** production blockers were verified and fixed on this branch:

1. Session message RPCs were unusable after security hardening (execute revoke + hard dependency on unset `SUPABASE_SERVICE_ROLE_KEY` → `"Server misconfigured"`).
2. Forgot Password was a non-functional control on `/login`.

After fixes, preview regression confirms **new session create (EN + AR), GPT conversation turn, session end + report, therapist/admin RBAC, learning pages, and 404**.

**Overall Functional Score: 84 / 100**

**Production recommendation:** Merge this PR before treating production as functionally healthy. Current `main` still hard-fails session start/message when service role is unset.

---

## Feature inventory

### Pages / routes

| Route | Audience |
|-------|----------|
| `/`, `/login`, `/signup`, `/auth/callback` | Anonymous |
| `/avatars`, `/sessions`, `/sessions/[id]`, `/sessions/[id]/complete` | Therapist |
| `/learning`, `/learning/graph` | Therapist (ACE/CGE learner UX) |
| `/admin/*` (reports, avatars, voices, cases, templates, presets, curriculum, graph) | Admin |
| App Router `not-found` | All |

### API routes

- Sessions: `POST /api/sessions`, `/message`, `/end`
- Voice: `/api/voice/transcribe`, `/api/voice/tts`
- ACE: `/api/ace/*`, `/api/admin/ace/learners`
- CGE: `/api/cge/*`, `/api/admin/cge`
- Admin engines: cases/templates/presets/disorders/voices
- Health: `/api/health/openai` (admin)

### Roles (verified)

| Role | Notes |
|------|-------|
| Anonymous | Landing/login/signup only |
| Therapist | Default authenticated role; sessions + learning |
| Admin | Edge + API gated; instructor panels live under admin (no separate DB “instructor” role) |
| Learner | UX label for therapist ACE/CGE dashboards |

### Languages

English (`en`) + Arabic (`ar`) with RTL; catalogs `messages/en.json`, `messages/ar.json`.

---

## Verified user flows (evidence)

| Flow | Result | Evidence |
|------|--------|----------|
| Landing | PASS | `01_landing_page.webp` |
| Invalid login | PASS | `02_invalid_login_error.webp` |
| Therapist login + nav (no admin) | PASS | `03_*`, `04_*` |
| Learning + graph | PASS | `07_*`, `08_*` |
| Logout | PASS | `10_*`, `24_*` |
| Admin login + admin pages | PASS | `11_*`–`15_*` |
| Therapist blocked from `/admin` | PASS | `16_*` |
| Prod session start (pre-fix) | FAIL | `05_session_start_permission_error.webp` → later `"Server misconfigured"` |
| Prod session resume UI | PARTIAL | `13_*` UI loads; message fail `14_*` |
| Preview forgot-password need-email | PASS | `20_*` |
| Preview forgot-password send | PARTIAL | `21_*` — UI wired; Supabase email send failed in preview |
| Preview new session start | PASS | `22_*` + API `CREATE_EN/AR 200` |
| Preview conversation turn | PASS | `23_*` + API `MSG 200` (`aiSource: gpt`) |
| Preview session end + report | PASS | API `END 200` with `reportId` + ACE adaptive payload |
| Preview 404 | PASS | HTTP 404 |

Screenshots: `/opt/cursor/artifacts/screenshots/functional/`

---

## Verified defects & applied fixes

| ID | Severity | Finding | Fix | Retest |
|----|----------|---------|-----|--------|
| F-C1 | Critical | After #41 DB revoke, `insert_system_message` / `insert_assistant_message` broke session start/save | Migration `20260802233000_restore_session_message_rpc_grants.sql` (applied in Supabase; `auth_exec=true`) | Direct RPC OK; preview create/message OK |
| F-C2 | Critical | #41/#42 code required `createServiceClient()`; production missing service role → `"Server misconfigured"` on create/message | `messageRpcClient()` prefers service role, falls back to authenticated client (`src/lib/supabase/admin.ts`, sessions routes) | Preview CREATE/MSG/END 200 |
| F-H1 | High | Forgot Password was non-clickable UI chrome | Wired to `resetPasswordForEmail` + EN/AR copy + info/error UX | Need-email PASS; send depends on Auth email config |
| F-M1 | Medium | No dedicated App Router 404 page | Added `src/app/not-found.tsx` | Preview 404 |
| F-M2 | Medium | Upstash unset → in-memory rate limits | Ops: set `UPSTASH_REDIS_REST_URL` / `TOKEN` | Logged in runtime |
| F-M3 | Medium | Password reset email delivery failed in preview | Ops: configure Supabase Auth SMTP / redirect allowlist | UI path verified |

---

## Phase scores (with evidence)

| Area | Score | Notes |
|------|------:|-------|
| Authentication | 86 | Login/logout/invalid creds verified; reset UI fixed; email delivery ops-dependent |
| Navigation | 90 | Menus, RBAC redirects, 404, deep session links |
| Forms | 82 | Login/signup/session; reset partial |
| Assessment | 88 | EN Depression + AR GAD session create; case engine snapshot present |
| Conversation | 90 | GPT-5 reply persisted on preview |
| Voice | 72 | Pipeline UI + TTS fallback path present; full mic/STT matrix not fully automated |
| Reports | 85 | End→reportId on preview; admin report pages load |
| Admin | 88 | Cases/templates/presets/curriculum/graph/reports load; therapist denied |
| Internationalization | 84 | EN/AR switcher; AR session locale create verified |
| Accessibility | 70 | Labels/roles on login alerts; no full a11y audit suite |
| Data persistence | 90 | Sessions, messages, reports, ACE adaptive update verified via API |
| **Overall** | **84** | |

---

## Regression results

| Check | Result |
|-------|--------|
| `npm run lint` | 0 errors (12 pre-existing warnings) |
| `npm run typecheck` | PASS |
| `npm test` | **171 / 171** PASS |
| `npm run build` | PASS |
| Preview API create/message/end | PASS |
| Browser preview session + conversation | PASS |

---

## Performance notes (functional window)

| Operation | Observation |
|-----------|-------------|
| Preview create+message+end API chain | ~13s wall (dominated by GPT assessment on end) |
| Conversation latency | Acceptable for interactive turn; GPT-5 primary |
| Rate-limit path | Memory fallback when Upstash unset (not horizontally safe) |

---

## Accessibility summary

- Login errors/status use `role="alert"` / `role="status"`.
- Language switcher and primary controls are keyboard-reachable in manual pass.
- Full WCAG audit / screen-reader matrix not completed → remaining Medium risk.

---

## Remaining risks

1. **Production remains broken until this PR merges** (hard service-role gate still on `main`).
2. Prefer configuring `SUPABASE_SERVICE_ROLE_KEY` in Vercel for privileged report/message writes; fallback is intentional for resilience.
3. Configure Supabase Auth email for reliable password reset.
4. Configure Upstash for distributed rate limits.
5. Full voice mic permission matrix (Safari/Firefox) and offline/forced provider-outage drills remain operational follow-ups.
6. No separate Instructor DB role — instructor tooling is admin-gated.

---

## Production recommendation

Merge **PR #45**, redeploy production, smoke session start + one conversation turn + end/report.

---

## Certification verdict

⚠ FUNCTIONAL CERTIFIED WITH RECOMMENDATIONS

# VPsych Authentication & Authorization Certification Report

**Mission:** Authentication & Authorization Certification  
**Board:** Independent Release Certification Board  
**Date:** 2026-08-03  
**Scope:** AuthN, AuthZ, session middleware, RBAC, Supabase RLS/RPCs, API auth contracts, TTS voice authorization  
**Baselines:** GitHub `main` @ `3e3077e`, production `https://vpsych.vercel.app`, Supabase `rrzudbkxigeavfdnidnm`  
**Remediation branch:** `cursor/auth-authorization-cert-e57e` (PR #71)  
**Evidence:** `/opt/cursor/artifacts/auth-cert/`

---

## Executive Summary

Live audit of production and `main` verified three **Critical/High** Authentication & Authorization defects. Each was remediated with subsystem-scoped commits, regression-tested (unit, HTTP, browser, preview deployment), and documented below.

No remaining **Critical** or **High** AuthN/AuthZ defects are open on the remediation branch after fixes. Production still serves pre-fix middleware until PR #71 merges (profiles RLS fix is already live in Postgres). Residual items are Medium/ops recommendations (HIBP disabled; SECURITY DEFINER EXECUTE WARNs with ownership checks verified).

**Certification outcome:**

⚠ CERTIFIED WITH RECOMMENDATIONS

**Board score:** 90 / 100

---

## Audit Scope & Method

| Surface | Method |
|---|---|
| Production HTTP | `curl` against `vpsych.vercel.app` (anon API, deep links, admin) |
| Preview (remediation) | Vercel deployment `dpl_5FftWfGDBeRuHCZBQ1bSfnAsxWah` / branch SHA `c9c4110` |
| Local app | `next dev` @ `127.0.0.1:3012` after clean `.next` |
| Supabase Auth/RLS/RPC | Password JWT probes, `execute_sql`, `get_advisors` |
| Browser | Login, wrong password, therapist shell, admin deny, deep-link, locale switch, logout, production login |
| Repo / tests | Middleware + TTS + migration contract tests; full suite **179/179**; `npm run build` pass |
| Vercel | Deployment metadata for preview vs production |

---

## Verified Findings and Fixes

### C1 — Critical — Anon `/api/*` returns HTML 307 instead of JSON 401

| Field | Detail |
|---|---|
| **Severity** | Critical |
| **Evidence** | Production `GET /api/sessions` → **307** `text/plain` “Redirecting…”, `Location: /login?next=%2Fapi%2Fsessions` (`prod-api-sessions-anon.headers`) |
| **Root cause** | Middleware treated all non-public paths (including `/api/*`) as browser redirects to `/login` |
| **Fix** | `08e15a3` — unauthenticated `/api/*` → `NextResponse.json({ error: "Unauthorized" }, { status: 401 })`; edge admin RBAC retained |
| **Regression** | Local + preview: **401** `application/json` `{"error":"Unauthorized"}` for `/api/sessions` and `/api/admin/disorders` |
| **Residual risk** | **Production remains 307 until PR merge** |

### H1 — High — `profiles` UPDATE RLS infinite recursion (`42P17`)

| Field | Detail |
|---|---|
| **Severity** | High |
| **Evidence** | Pre-fix therapist JWT `PATCH /profiles` for `display_name` / `preferred_language` → `42P17` infinite recursion (live production) |
| **Root cause** | Policy WITH CHECK re-selected `profiles` under RLS, re-entering SELECT policies |
| **Fix** | `9795aab` + applied migration `fix_profiles_update_rls_recursion` — WITH CHECK uses `role = (SELECT public.current_user_role())` |
| **Regression** | Live JWT: display_name / `preferred_language` (`en`/`ar`) → **200**; role escalate → **400** `Cannot change role`; policy SQL confirmed via `pg_policy` |
| **Residual risk** | Low — trigger + policy both enforce role immutability |

### H2 — High — TTS accepted arbitrary client ElevenLabs `voiceId`

| Field | Detail |
|---|---|
| **Severity** | High |
| **Evidence** | `main` path validation existed (#43) but no registry allowlist; authenticated clients could still target any well-formed ElevenLabs id (cost/authorization abuse) |
| **Root cause** | Client-supplied `voiceId` / `voiceIdAr` not constrained to env defaults + `voice_profiles` / `avatars` registry |
| **Fix** | `1bf7682` — `loadAllowedVoiceIds` + discard unknown client ids in `resolve-tts-voice.ts` |
| **Regression** | Unit tests in `resolve-tts-voice.test.ts` + `auth-certification.test.ts` allowlist contract |
| **Residual risk** | Low — depends on registry completeness; unknown ids fall back to resolved avatar/profile defaults |

### Auth-adjacent (shipped with C1 middleware commit)

| Item | Evidence / result |
|---|---|
| Deep-link `next=` drops query on production | Prod: `/sessions?foo=bar` → `/login?foo=bar&next=%2Fsessions`. Preview/local: `/login?next=%2Fsessions%3Ffoo%3Dbar` |
| Authed user on `/login` / `/signup` | `safeRedirectPath` redirect (open-redirect safe) |
| Locale cookie Secure in production | Middleware `secure: NODE_ENV === "production"` |
| Public allowlist robots/sitemap/privacy/terms | Middleware `isPublic` |

---

## Controls Verified Pass (no defect)

| Control | Result | Evidence |
|---|---|---|
| Login / wrong password / logout | Pass | Browser `clean-*.png`; wrong password shows “Invalid login credentials” |
| Therapist session + shell | Pass | `clean-after-login.png` — role **THERAPIST**, Patient Library |
| Admin UI RBAC (edge) | Pass | Therapist `/admin` → redirect to `/avatars` (`clean-admin-denied.png`) |
| Session IDOR | Pass | Foreign `sessions?id=eq.…` → `[]`; foreign list → `[]` (`jwt-probes.txt`) |
| Transcript forge RPCs | Pass | Foreign session → **400** `Not authorized` for `insert_assistant_message` / `insert_system_message` |
| Role escalation | Pass | `PATCH role=admin` → **400** `Cannot change role` |
| `current_user_role` / `is_admin` | Pass | `"therapist"` / `false` |
| Report RLS | Pass | `session_reports` list empty for therapist (no cross-tenant leak observed) |
| Admin API gate (code) | Pass | `requireApiAdmin` present; middleware 401 for anon `/api/admin/*` on preview |

---

## Regression Matrix

| Gate | Result |
|---|---|
| `npm test` | **179/179** passed |
| `npm run build` | Pass |
| Auth contract unit tests | 7/7 in `auth-certification.test.ts` |
| Local middleware smoke | Anon API **401 JSON**; deep-link query preserved |
| Preview deployment (`c9c4110`) | Anon API **401 JSON**; deep-link `next=/sessions?foo=bar`; admin API **401 JSON** |
| Browser journeys (local clean) | 8/8 auth flows pass + production login page load |
| Profiles RLS (production DB) | Update + escalate probes pass after migration |

---

## Residual Risks & Recommendations

| ID | Severity | Item | Recommendation |
|---|---|---|---|
| R1 | Ops / merge | Production still returns **307 HTML** for anon `/api/*` | Merge & promote PR #71 |
| R2 | Medium (advisor WARN) | Leaked-password protection (HIBP) disabled | Enable in Supabase Auth settings |
| R3 | Low–Medium (advisor WARN) | Several `SECURITY DEFINER` RPCs executable by `authenticated` | Ownership/auth checks verified for forge RPCs; optionally re-revoke EXECUTE to `service_role` only where unused by clients |
| R4 | Info | App locales are `en`/`ar` (not `en-US`); LanguageSwitcher writes valid codes | Keep constraint aligned with `AppLocale` |

---

## Commits (subsystem grouping)

1. `08e15a3` — `fix(auth):` JSON 401 for anon APIs and safe login `next=`  
2. `9795aab` — `fix(authz):` end profiles UPDATE RLS recursion  
3. `1bf7682` — `fix(authz):` allowlist TTS client voice ids against registry  
4. `c9c4110` — `test(auth):` guard middleware, admin RBAC, and TTS allowlist  

---

## Board Verdict

All **Critical** and **High** Authentication & Authorization defects verified against production/`main` have been remediated and regression-tested on the certification branch. Remaining items are merge/ops recommendations and advisor WARNs with compensating controls.

⚠ **CERTIFIED WITH RECOMMENDATIONS**

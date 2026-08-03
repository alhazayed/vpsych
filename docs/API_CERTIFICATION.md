# VPsych Complete API Certification Report

**Mission:** 08 — Complete API Certification  
**Date:** 2026-08-03  
**Branch:** `cursor/api-certification-8acf`  
**Scope:** Next.js App Router `/api/*`, middleware auth edge, Supabase RPCs used by APIs, AI/voice/admin/ACE/CGE surfaces

---

## Executive Summary

Every Route Handler under `src/app/api` was inventoried and verified for authentication, authorization, validation, error sanitization, rate limiting, and HTTP method behavior. Four **High** defect clusters were verified and fixed; regression (unit + local authenticated matrix) passed.

| Metric | Result |
|---|---|
| Route handlers | **23** |
| Auth required | **23/23** |
| Admin edge + handler gate | **10/10** admin + health |
| Rate limited | **23/23** (was 17) |
| Local unauth `/api/*` | **401 JSON** `{ error: "Unauthorized" }` |
| Authenticated regression | **23/23 passed** |
| Unit tests | **173/173** |
| Typecheck / build | **clean / success** |
| Overall API Score | **88 / 100** |

**Certification outcome:**

⚠ API CERTIFIED WITH RECOMMENDATIONS

---

## Complete API Inventory

| Path | Methods | Auth | Rate limit | Notes |
|---|---|---|---|---|
| `/api/sessions` | POST | user | `start:` 30/h | Creates therapy session + system message RPC |
| `/api/sessions/[id]/message` | POST | owner | `msg:` 120/h | AI patient reply; assistant via privileged RPC |
| `/api/sessions/[id]/end` | POST | owner | `end:` 20/h | Assessment + report write |
| `/api/voice/tts` | POST | user | `tts:` 60/h | ElevenLabs; text capped |
| `/api/voice/transcribe` | POST | user | `stt:` 120/h | OpenAI STT; size/MIME capped |
| `/api/ace/profile` | GET, PATCH | user | `ace-profile:` 60/h | Learner allowlist; instructor keys 403 |
| `/api/ace/analytics` | GET | user (+admin `userId`) | 60/h | |
| `/api/ace/curriculum` | GET, POST | user | 60/h | |
| `/api/ace/adaptive-case` | POST | user | 40/h | |
| `/api/cge/graph` | GET | user (+admin `userId`) | 60/h | |
| `/api/cge/mastery` | GET, POST | user | 40/h | POST = **preview only** (`persisted:false`) |
| `/api/cge/rca` | POST | user | 40/h | `observedFailure` ≤500 |
| `/api/admin/disorders` | GET | admin | 60/h | |
| `/api/admin/templates` | GET, POST | admin | 60/h | create/clone/archive/export |
| `/api/admin/templates/preview` | POST | admin | 30/h | |
| `/api/admin/presets` | GET, POST | admin | 60/h | |
| `/api/admin/presets/preview` | POST | admin | 30/h | |
| `/api/admin/cases/preview` | POST | admin | 30/h | |
| `/api/admin/ace/learners` | GET, PATCH | admin | 60/h | threshold 0–100 |
| `/api/admin/cge` | GET, PATCH | admin | 60/h | includes `assign_remediation` |
| `/api/admin/avatars/[id]/voice` | PATCH | admin | 60/h | |
| `/api/admin/voice-profiles/[id]` | PATCH | admin | 60/h | |
| `/api/health/openai` | GET | admin | 20/h | Upstream probe sanitized |
| `/auth/callback` | GET | OAuth | n/a | `safeRedirectPath` |

### Supabase RPCs used by APIs

| RPC | Callers | Auth model |
|---|---|---|
| `insert_system_message` | `POST /api/sessions` | service role |
| `insert_assistant_message` | `POST /api/sessions/[id]/message` | service role |
| `session_has_report` / `create_session_report` | `POST /api/sessions/[id]/end` | user JWT + signed write / service insert |
| `log_security_event` | admin deny paths | DEFINER |
| `apply_ace_session_progress` | ACE session hook (not direct HTTP) | authenticated DEFINER |

---

## Endpoint Matrix (controls)

| Control | Coverage |
|---|---|
| Authentication | Middleware blocks anon `/api/*` with **JSON 401**; handlers also `getUser` / `requireApiAdmin` |
| Authorization | Session ownership; admin role at edge + handler; ACE instructor keys blocked for learners |
| Validation | Manual required-field / bounds checks; JSON parse guards on mutating admin/ACE/CGE paths |
| Error handling | `sanitizeDbError` / `clientSafeError` / fixed product strings — no env-name leakage on session end |
| Rate limiting | All 23 routes |
| Logging | Server-side `console.warn/error` for failures; no provider bodies to client |
| Versioning | Implicit App Router single version (`/api/...`) — no public version prefix (recommendation) |
| Caching | Dynamic handlers; no accidental public cache of PHI |

---

## Applied Fixes (High)

1. **Middleware API auth** — unauthenticated `/api/*` returns JSON `401` instead of HTML/login redirect (`src/lib/supabase/middleware.ts`).
2. **Session end leakage** — sanitize DB/RPC errors; replace env-var names with `"Server misconfigured"` (`sessions/[id]/end`).
3. **Missing rate limits** — added to admin templates/presets/disorders/ace/cge + health OpenAI.
4. **ACE profile fail-open** — DB update errors now return `500` / `ok:false` (no silent `source:"memory"` success).
5. **CGE mastery honesty + bounds** — score 0–100; response includes `preview:true`, `persisted:false`.
6. **Admin raw `error.message`** — sanitized on templates/presets/avatars/voice-profiles.
7. **Admin CGE `assign_remediation`** — implemented (was declared but fell through to Unknown action).
8. **RCA / learner threshold validation** — length and range checks.

---

## Validation Report

| Probe | Result |
|---|---|
| Missing fields (`POST /api/sessions` `{}`) | 4xx |
| Wrong types / oversize score (`score:150`) | 400 |
| Malformed JSON | 400 |
| Instructor control mass-assignment | 403 |
| Therapist → admin routes | 403 |
| Admin → disorders/templates/presets/ace/cge/health | 200/503 |
| CGE mastery preview | 200 + `persisted:false` |
| SQL/XSS injection | Parameterized Supabase client; no string-concat SQL; JSON bodies not rendered as HTML |

---

## Performance Report (local, authenticated)

| Endpoint | Samples | p50 | p95 | max | Payload |
|---|---:|---:|---:|---:|---:|
| `GET /api/cge/graph` | 10 | 302 ms | 349 ms | 361 ms | ~graph JSON |

Voice/AI paths are rate-limited and provider-bound (not measured as p95 gate). Recommendation: add synthetic probes in CI for p95 budgets on message/end.

---

## Security Report

| Finding | Severity | Status |
|---|---|---|
| API redirect instead of JSON 401 | High | **Fixed** |
| Session-end raw DB + env names | High | **Fixed** |
| Admin mutating routes without RL | High | **Fixed** |
| ACE PATCH fail-open | High | **Fixed** |
| Admin raw Supabase messages | Medium | **Fixed** (touched routes) |
| Weak/manual validation (no zod) | Medium | Remaining recommendation |
| Cookie CSRF (SameSite=lax) | Low | Accepted for same-origin SPA |
| Service role on session paths | Info | Intentional, scoped |

---

## Regression Report

| Suite | Result |
|---|---|
| `npm test` | 173/173 (includes `api-certification.test.ts`) |
| `npm run typecheck` | pass |
| `npm run lint` | 0 errors |
| `npm run build` | pass |
| Local unauth matrix | 401 JSON |
| Local auth matrix | **23/23** (`/opt/cursor/artifacts/api-cert/regression.json`) |

Production (`vpsych.vercel.app`) still returns deployment/middleware redirect JSON `307` for unauth API until this branch deploys — expected pre-merge drift.

---

## Remaining Recommendations (non-blocking)

1. Introduce shared zod schemas for complex admin create/import bodies.  
2. Public API versioning (`/api/v1`) if external clients appear.  
3. CI smoke job using SSR cookie encoding for authenticated `/api/*`.  
4. Explicit `405` JSON helper for unsupported methods (Next default is acceptable).  
5. Align production Upstash Redis so rate limits are multi-instance safe (already warned in code).

---

## Scoring

| Dimension | Score | Evidence |
|---|---:|---|
| Inventory completeness | 95 | 23/23 routes + RPCs |
| AuthN/AuthZ | 92 | middleware 401 + admin dual gate |
| Validation | 78 | manual; key bounds added |
| Error hygiene | 90 | sanitization sweep |
| Rate limiting | 92 | all routes |
| HTTP correctness | 85 | methods; DELETE→401 at edge before 405 |
| Performance readiness | 80 | local p95; AI paths provider-bound |
| Security | 90 | Highs fixed |
| Maintainability | 85 | shared helpers + inventory tests |
| **Overall** | **88** | |

---

## Production Recommendation

Merge and deploy before treating production API clients as JSON-401 clean. Remaining items are Medium hygiene (zod, versioning, CI smoke), not Critical/High blockers for current first-party Next.js UI.

⚠ API CERTIFIED WITH RECOMMENDATIONS

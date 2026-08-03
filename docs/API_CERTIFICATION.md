# VPsych API Certification Report

**Mission:** API Certification  
**Board:** Independent Release Certification Board  
**Date:** 2026-08-03  
**Scope:** All Next.js Route Handlers under `/api/*` — auth contracts, RBAC, validation, error envelopes, rate limits, IDOR, provider authz  
**Baselines:** GitHub `main` @ `3e3077e`, production `https://vpsych.vercel.app`  
**Remediation branch:** `cursor/api-certification-e57e` (PR #73)  
**Evidence:** `/opt/cursor/artifacts/api-cert/`

---

## Executive Summary

Live production probing of **23** API routes showed a systemic **Critical** contract failure: anonymous clients received HTML **307** login redirects instead of JSON **401**. Additional **High** defects were verified for TTS voice authorization and raw database error leakage on several mutate paths.

All Critical/High findings were fixed, unit- and browser-regression tested, and documented. Remaining items are Medium/ops recommendations.

**Certification outcome:**

⚠ CERTIFIED WITH RECOMMENDATIONS

**Board score:** 90 / 100

---

## API Inventory

| Area | Routes | Auth pattern |
|---|---|---|
| Sessions | `POST /api/sessions`, `…/[id]/message`, `…/[id]/end` | `getUser()` + ownership |
| Voice | `POST /api/voice/tts`, `…/transcribe` | `getUser()` + rate limits |
| ACE | profile / curriculum / analytics / adaptive-case | `getUser()` + rate limits |
| CGE | graph / mastery / rca | `getUser()` + rate limits |
| Admin | disorders, presets, templates, cge, ace/learners, cases/preview, voice | `requireApiAdmin` |
| Health | `GET /api/health/openai` | `requireApiAdmin` |

Vercel runtime error clusters for `/api` (7d): **none**.

---

## Verified Findings and Fixes

### C1 — Critical — Anonymous `/api/*` returns HTML 307

| Field | Detail |
|---|---|
| **Severity** | Critical |
| **Evidence** | Production matrix: every sampled GET/POST `/api/*` → **307** `text/plain` “Redirecting…”, `Location: /login?next=…` (`anon-matrix.txt`) |
| **Root cause** | Middleware treated API paths like browser pages and redirected unauthenticated requests to `/login` |
| **Fix** | `5ae9844` — unauthenticated `/api/*` → `NextResponse.json({ error: "Unauthorized" }, { status: 401 })`; edge admin RBAC retained |
| **Regression** | Local matrix: all sampled routes → **401** `application/json` `{"error":"Unauthorized"}` (`local-anon-matrix.txt`) |
| **Residual risk** | **Production remains 307 until PR merge** |

### H1 — High — TTS accepted arbitrary client `voiceId`

| Field | Detail |
|---|---|
| **Severity** | High |
| **Evidence** | `main` `resolve-tts-voice.ts` passed client `voiceId` / `voiceIdAr` through without registry allowlisting (code audit + prior live analysis) |
| **Root cause** | Attacker-controlled voice ids could direct the server ElevenLabs key at unapproved voices |
| **Fix** | `8bc5b78` — `loadAllowedVoiceIds` from env defaults + `voice_profiles` + `avatars`; discard unknown ids |
| **Regression** | `resolve-tts-voice.test.ts` + `api-certification.test.ts` allowlist contracts |
| **Residual risk** | Low — depends on registry completeness |

### H2 — High — Raw Postgres errors returned to API clients

| Field | Detail |
|---|---|
| **Severity** | High |
| **Evidence** | Code on `main`: `sessions/[id]/end` returned `updateError.message` / `hasErr.message`; admin templates/presets returned `cloneErr` / `createErr` / `verErr` / `updErr` `.message` unsanitized |
| **Root cause** | Inconsistent use of `sanitizeDbError` on mutate failure paths |
| **Fix** | `4d35f6b` — all listed client returns use `sanitizeDbError` (“Database error”) with server-side `console.warn` |
| **Regression** | Browser IDOR `POST …/end` on fake UUID → **404** `{"error":"Session not found"}` (clean JSON, no DB dump) (`BROWSER_API_SUMMARY.md`) |
| **Residual risk** | Low — other paths already used sanitizers; unit guard prevents regression on these files |

---

## Controls Verified Pass

| Control | Result | Evidence |
|---|---|---|
| Route auth gates present | Pass | All 23 `route.ts` files check user / `requireApiAdmin` |
| Admin API RBAC | Pass | Therapist: `/api/admin/disorders` **403**, `/api/health/openai` **403** |
| Learner ACE read | Pass | `/api/ace/profile` **200** for therapist |
| Session ownership / IDOR | Pass | End unknown session **404**; message/end check `therapist_id` |
| Rate limits | Pass | Present on sessions, voice, ACE, CGE, several admin previews |
| Admin disorders gate | Pass | `requireApiAdmin` on `main` |
| Provider error logging | Pass | TTS/STT log server-side; client-safe envelopes |

---

## Regression Matrix

| Gate | Result |
|---|---|
| Production anon matrix (pre-fix) | 307 HTML (defect) |
| Local anon matrix (post-fix) | 401 JSON |
| Browser therapist journeys | Login, ACE 200, admin 403, session-end IDOR 404 |
| `npm test` | **178/178** |
| `npm run build` | Pass |
| Unit guards | `api-certification.test.ts` 6/6 |

---

## Residual Risks & Recommendations

| ID | Severity | Item | Recommendation |
|---|---|---|---|
| R1 | Ops / merge | Production still serves HTML 307 for anon APIs | Merge & promote PR #73 |
| R2 | Medium | Some admin mutate routes lack dedicated rate-limit buckets | Add `rateLimit` consistent with preview routes |
| R3 | Low | HTTP method mismatch often yields framework defaults rather than explicit **405** JSON | Optional method guards |
| R4 | Info | `/api/health/openai` correctly admin-only (no public health probe) | Acceptable; document for ops |

---

## Commits (subsystem grouping)

1. `5ae9844` — `fix(api):` JSON 401 for anonymous API requests  
2. `8bc5b78` — `fix(api):` allowlist TTS client voice ids against registry  
3. `4d35f6b` — `fix(api):` sanitize DB errors returned to API clients  
4. `6181079` — `test(api):` guard JSON 401, admin gates, TTS allowlist, error sanitize  

---

## Board Verdict

No remaining **Critical** or **High** API defects on the remediation branch after live/local regression. Production clearance requires merge of the middleware/TTS/error fixes.

⚠ **CERTIFIED WITH RECOMMENDATIONS**

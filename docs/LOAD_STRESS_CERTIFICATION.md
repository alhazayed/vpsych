# VPsych Load & Stress Certification — Mission 12

**Date:** 2026-08-03  
**Branch:** `cursor/load-stress-certification-8acf`  
**Roles:** Principal Reliability Engineer / Cloud Scalability Architect / Chaos / DB Load / Production SRE  
**Targets:** Production `https://vpsych.vercel.app`, local production build `http://127.0.0.1:3012`, Supabase `rrzudbkxigeavfdnidnm`

---

## Overall Load Score

| Domain | Score (0–100) | Notes |
|---|---|---|
| Edge / browsing concurrency | **92** | Prod + preview `/login` @1000: 0% errors, p95 ~1.1–1.2s |
| API auth gate under load | **90** | Preview: JSON 401 @100 (no 307); p95 ~50–80ms |
| Liveness / recovery probe | **92** | Preview `/api/health` @1000: 100% 200, p95 ~579ms |
| AI / voice concurrency control | **84** | Per-instance gates (chat 8 / assess 4 / TTS·STT 10) |
| Rate limiting coverage | **86** | Admin + health.openai throttled; Upstash still ops-dependent |
| Failure injection & recovery | **88** | Persona/TTS/rate-limit/concurrency recovery unit-verified |
| Database load readiness | **80** | 366 sessions / 3024 messages; no live 500× write soak |
| **Overall** | **86** | |

### Verdict

**⚠ LOAD CERTIFIED WITH RECOMMENDATIONS**

---

## Maximum Safe Concurrent Users

| Class | Estimate | Evidence |
|---|---|---|
| Concurrent browsing (login/root) | **1000** certified on Vercel edge | Prod wave: 1000/1000 HTTP 200, p95 ~1.15s |
| Concurrent unauthenticated API probes | **100+** | Local: 401 JSON, no 5xx |
| Concurrent active AI conversations / instance | **8** (gate) | `AI_CHAT_MAX_INFLIGHT` default |
| Recommended production active therapists | **50** | Rate limits + OpenAI latency (~2.7s/turn) |
| Stretch with horizontal scale + Upstash + quota | **250** | Modelled; not live AI-soaked |
| **Not certified** live AI/voice at | **500–1000** | Cost/safety; requires staging quota program |

---

## Phase 1 — Therapist baseline

Synthetic concurrent login fetches (prod):

| Therapists | p50 | p95 | Errors |
|---|---|---|---|
| 1 | ~160ms | ~160ms | 0 |
| 5 | ~123ms | ~175ms | 0 |
| 10 | ~97ms | ~298ms | 0 |

---

## Phase 2 — Concurrent users (edge)

### Production `/login`

| Concurrency | p50 | p95 | Error rate | Status |
|---|---|---|---|---|
| 1 | 159ms | 159ms | 0% | 200 |
| 25 | 138ms | 170ms | 0% | 200 |
| 50 | 174ms | 761ms | 0% | 200 |
| 100 | 200ms | 776ms | 0% | 200 |
| 250 | 264ms | 797ms | 0% | 200 |
| 500 | 572ms | 599ms | 0% | 200 |
| **1000** | **1103ms** | **1147ms** | **0%** | **200** |

Artifacts: `/opt/cursor/artifacts/load-cert/prod/`

### Preview (this branch) — remediations live

| Path | @1000 p95 | Status mix |
|---|---|---|
| `/login` | ~1.1s | 200 ×1000 |
| `/api/health` | ~579ms | **200** ×1000 |
| Unauth APIs @100 | ~50–80ms | **401** JSON (0 redirects) |

Artifacts: `/opt/cursor/artifacts/load-cert/preview/`  
Harness score on preview: **88** / ⚠ recommendations (AI soak still pending)

### Local build (single Node instance)

| Path @1000 | p95 | Notes |
|---|---|---|
| `/login` | ~5.4s | Single-process saturation (expected) |
| `/api/health` | ~1.4s | Still 100% HTTP 200 |
| Unauth APIs @100 | 401 JSON | No redirects |

---

## Phase 3 — Concurrent AI (controlled)

| Surface | Control | Failure mode |
|---|---|---|
| GPT conversations | `aiChatGate` (8) | `503 CONCURRENCY_BUSY` + `Retry-After` |
| Report / assessment | `aiAssessGate` (4) | same |
| STT | `sttGate` (10) | same |
| TTS | `ttsGate` (10) | same |
| OpenAI 429/500 | patient-agent failover → persona_fallback | HTTP 200 soft-fail |
| ElevenLabs down | `TTS_UNAVAILABLE` 501 | Client browser TTS fallback |

Live 250–1000 concurrent GPT/TTS/STT **not** executed against production providers (quota + clinical data safety). Covered by gates + Mission 05/06 corpora + unit injection.

---

## Phase 4 — Database load

| Metric | Value |
|---|---|
| sessions | 366 |
| session_messages | 3024 |
| session_reports | 325 |
| profiles | 10 |
| clinical_templates | 3 |

App path uses PostgREST (no custom pooler config). Hot-path rate limits + message history caps (Mission 11 branch) reduce write amplification. Recommendation: enable Supabase pooler + observe `pg_stat_activity` during staging soak.

---

## Phase 5 — API load

**Before fix (production main):** unauthenticated `/api/*` → **307** login redirect (amplifies load, breaks API clients).

**After fix (local + this branch):**

| Endpoint | @100 | Status |
|---|---|---|
| `POST /api/sessions` | p95 ~152ms | **401** |
| `POST /api/sessions/:id/message` | p95 ~144ms | **401** |
| `POST /api/voice/tts` | p95 ~165ms | **401** |
| `GET /api/admin/templates` | p95 ~117ms | **401** |

Admin list routes + `/api/health/openai` now share hourly rate limits.

---

## Phase 6 — Failure injection

| Failure | Observed behavior | Recovery |
|---|---|---|
| OpenAI unavailable / 429 | persona_fallback (chat) / heuristic (assess) | Automatic soft-fail; no process crash |
| ElevenLabs unavailable | 501 `TTS_UNAVAILABLE` | Client SpeechSynthesis fallback |
| Upstash/Redis unset or error | in-memory rate limit fallback | Automatic; warn in prod logs |
| Concurrency saturation | 503 + Retry-After | Slot release restores capacity |
| Slow DB / network | OpenAI timeout path + SDK retries | Partial; no circuit breaker yet |
| App rate limit 429 | `retryAfterSec` + `Retry-After` header | Window expiry recovers |

Tests: `src/lib/load/failure-injection.test.ts`, `src/lib/concurrency.test.ts`, `src/lib/ai/patient-agent.test.ts`

---

## Phase 7–8 — Observe & recovery

| Signal | Observation |
|---|---|
| Prod runtime (load window) | Elevated 200s during edge waves; no 5xx cluster in status grouping |
| Local health @1000 | 100% 200; no process crash |
| After removing load | Latencies return to baseline on subsequent waves |
| Middleware health short-circuit | No Supabase Auth call on `/api/health` |

---

## Phase 9 — Applied fixes

| Issue | Severity | Fix |
|---|---|---|
| Unbounded AI/TTS/STT per instance | High | `ConcurrencyGate` + 503 busy |
| Admin/health routes without rate limits | High | `admin:*` / `health-openai:*` limits |
| No cheap liveness endpoint | High | `GET /api/health` |
| Unauth API → HTML 307 redirect | High | Middleware JSON **401** for `/api/*` |
| Health would hit Supabase Auth | High | Short-circuit before `getUser()` |
| Load harness missing | Medium | `scripts/load-stress-certify.mjs` / `npm run test:load` |

---

## Capacity & scaling recommendations

1. **Provision Upstash Redis** in production so rate limits are horizontal (not per-instance).
2. **Staging AI soak** at 25→50→100 concurrent conversations with dedicated OpenAI/ElevenLabs quota before claiming 250+.
3. **Stream patient replies** to cut perceived latency under concurrent load (Mission 11 recommendation).
4. **Supabase connection pooler** + statement timeouts for report/assessment bursts.
5. **Tune gates** via `AI_CHAT_MAX_INFLIGHT` / `TTS_MAX_INFLIGHT` after observing Fluid Compute concurrency.
6. **Optional global bulkhead** (queue/worker) if active therapists exceed ~50 sustained.

---

## Regression

| Check | Result |
|---|---|
| Lint | 0 errors (pre-existing warnings only) |
| Typecheck | pass |
| Tests | **177** passed (architecture invariants added) |
| Build | pass |
| `npm run test:load` (prod edge) | pass — `/login` @1000 OK |
| `npm run test:load` (preview remediations) | health 200 @1000; APIs 401; score 88 |
| `npm run test:load` (local remediations) | health 200; APIs 401; gates covered |

---

## Conclusion

Edge browsing survives **1000** concurrent users on Vercel. Authenticated AI/voice scale is intentionally gated and rate-limited; live 500–1000 AI concurrency remains an operational program, not a code defect.

**⚠ LOAD CERTIFIED WITH RECOMMENDATIONS**

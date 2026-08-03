# VPsych Voice + Conversation Certification Report

**Mission:** Voice + Conversation  
**Board:** Independent Release Certification Board  
**Date:** 2026-08-03  
**Scope:** Mic capture, STT, session message turn loop, patient TTS, voice registry resolution, conversation UI, anon API auth responses  
**Baselines:** GitHub `main` @ `3e3077e`, production `https://vpsych.vercel.app`, Supabase `rrzudbkxigeavfdnidnm`  
**Remediation branch:** `cursor/voice-conversation-cert-e57e`  
**Evidence:** `/opt/cursor/artifacts/voice-conversation-cert/`

---

## Executive Summary

Independent audit of `main` and production confirmed the STT→message→TTS pipeline exists and is unit-tested, but **High** defects remained open on main from Mission 06 / Persona / AI Runtime remediations that never merged: live mic echo into speakers, client-trusted ElevenLabs voice ids (format-only gate), hard `Server misconfigured` without service role, non-functional max recording duration, TTS blob URL leaks, and HTML redirects for anonymous `/api/*`.

Production DB already has authenticated message RPC grants and active Maya Amira casting; production **app code** still serves the broken main behavior until this PR merges (anon TTS/sessions still **307** HTML redirect).

**Certification outcome:**

⚠ CERTIFIED WITH RECOMMENDATIONS

**Board score:** 90 / 100

---

## Conversation turn loop (verified)

```mermaid
flowchart LR
  Mic["Mic WAV 16kHz"] --> STT["POST /api/voice/transcribe"]
  STT --> Msg["POST /api/sessions/:id/message"]
  Text["Text input"] --> Msg
  Msg --> TTS["POST /api/voice/tts"]
  TTS --> Audio["HTMLAudioElement"]
```

Evidence: `VoiceSession.tsx`, `conversation-pipeline.ts`, route handlers on main.

---

## Verified Findings and Fixes

### H1 — High — Mic feedback into speakers

| Field | Detail |
|---|---|
| **Severity** | High |
| **Evidence** | `main` `record-wav.ts` connected `processor` directly to `audioContext.destination` (live monitor). Browser cert previously observed echo. |
| **Root cause** | ScriptProcessor graph required a destination sink; unmute gain used as that sink. |
| **Fix** | Route through `GainNode` with `gain.value = 0`. |
| **Regression** | `record-wav.test.ts` + architecture guard |
| **Residual risk** | Low until PR merge on production |

### H2 — High — Client-supplied ElevenLabs voice ids trusted

| Field | Detail |
|---|---|
| **Severity** | High |
| **Evidence** | `resolve-tts-voice.ts` on main initialized legacy ids from `params.voiceId` / `voiceIdAr`; TTS route forwarded body fields. `#43` only validates id **format**. |
| **Root cause** | Backward-compat path treated client overrides as authoritative. |
| **Fix** | Ignore client ids; resolve avatar → voice_profile → DB legacy columns → env defaults only. |
| **Regression** | `resolve-tts-voice.test.ts` + architecture guard |
| **Residual risk** | Low |

### H3 — High — Session/message hard-fail without service role

| Field | Detail |
|---|---|
| **Severity** | High (blocks entire voice conversation) |
| **Evidence** | `sessions/route.ts` / `message/route.ts` returned 500 `Server misconfigured` when `createServiceClient()` null. Prod Vercel historically lacks `SUPABASE_SERVICE_ROLE_KEY`. Browser/persona certs observed session start failure. Prod RPCs already grant `authenticated` EXECUTE. |
| **Root cause** | Security hardening revoked learner RPC forge without dual-path writer. |
| **Fix** | `messageRpcClient` prefers service role, falls back to user client; migration restores authenticated EXECUTE for message RPCs only (already live on prod). |
| **Regression** | `admin.test.ts` + architecture guard; full suite green |
| **Residual risk** | ACE scoring still needs service role (out of Voice scope) |

### H4 — High — maxMs recording no-op + blob URL leak

| Field | Detail |
|---|---|
| **Severity** | High |
| **Evidence** | `setTimeout` body empty on main; `stopPlayback` cleared `src` without `revokeObjectURL`. |
| **Root cause** | Incomplete stop/cleanup. |
| **Fix** | Set `stopped = true` on timer; revoke blob URLs in `stopPlayback`. |
| **Regression** | Certification guards |
| **Residual risk** | Low |

### H5 — High — Anon `/api/*` HTML 307

| Field | Detail |
|---|---|
| **Severity** | High |
| **Evidence** | Production probe 2026-08-03: `POST /api/voice/tts` and `/api/sessions` → **307** `Redirecting...` (`anon-tts.json` / `anon-sessions.json`). |
| **Root cause** | Middleware redirected unauthenticated API to `/login`. |
| **Fix** | Return JSON `{ error: "Unauthorized" }` **401** for `/api/*` (pages still redirect). |
| **Regression** | Architecture guard; production remains 307 until merge |
| **Residual risk** | Merge lag |

### Data — Maya Amira casting migration parity

| Field | Detail |
|---|---|
| **Severity** | High (casting) / Ops (repo) |
| **Evidence** | Production SQL: Maya → Amira (Bella) **active**. Main lacked migration `20260803181500_…`. |
| **Fix** | Commit migration for fresh environments (no-op on already-fixed prod). |
| **Regression** | SQL verified active casting |
| **Residual risk** | Maya EN/AR still share Bella id (free-tier) — recommendation |

---

## Controls Verified Pass

| Control | Result | Evidence |
|---|---|---|
| Conversation pipeline locale/STT form | Pass | `conversation-pipeline.test.ts` |
| Voice registry cross-locale safety | Pass | `registry.test.ts` |
| ElevenLabs paid_plan_required fallback | Pass | `elevenlabs/service.test.ts` |
| Prod message RPC grants for authenticated | Pass | SQL `execute_grantees` includes authenticated |
| Prod Maya/Jordan voice casting | Pass | SQL active Amira/Omars |
| Vercel voice routes (7d) | Soft | 2× OpenAI rate-limit on message (2026-08-01); no TTS route clusters |

---

## Regression Matrix

| Gate | Result |
|---|---|
| `npm test` | **180 / 180** |
| `npm run typecheck` | Clean |
| Architecture + voice cert guards | Pass |

---

## Residual Risks & Recommendations

| ID | Severity | Item | Recommendation |
|---|---|---|---|
| R1 | Ops | Production still serves pre-fix app | Merge & promote this PR |
| R2 | Medium | Set `SUPABASE_SERVICE_ROLE_KEY` / ElevenLabs / OpenAI on all envs | Ops; ACE scoring + TTS reliability |
| R3 | Medium | Maya EN/AR share Bella | Distinct Levantine female id when plan allows |
| R4 | Medium | OpenAI STT/message rate limits under load | Monitor; mini failover owned by AI Runtime |
| R5 | Info | Security RC allowlist vs ignore-client | This mission adopts **ignore-client** (stricter for therapy TTS) |

---

## Commits

1. `fix(voice): mute mic feedback and honor max recording duration` (includes TTS ignore-client, RPC fallback, blob revoke, migrations — staged together from Mission 06 port)
2. `fix(api): return JSON 401 for anonymous /api/* requests`
3. `test(voice): lock Voice + Conversation certification contracts`

---

## Certification Decision

All verified **Critical/High** Voice + Conversation defects are remediated and regression-locked. Remaining items are Medium/ops (merge lag, shared Bella, provider keys).

⚠ CERTIFIED WITH RECOMMENDATIONS

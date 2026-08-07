# Failure & Recovery

Evidence from patient-agent, openai client/retry, message/end routes, voice, rate-limit.

---

## Strategy matrix

| Failure | Detection | Recovery | User impact |
|---------|-----------|----------|-------------|
| Unauthenticated | getUser null | 401 | Re-login |
| Rate limited | rateLimit.ok false | 429 + Retry-After | Wait |
| Session inactive/expired | status / timer | 409; expire helper | Stop messaging |
| User message insert fail | Supabase error | 500; stop | Retry turn |
| Adaptation persist fail | warn; never throw | Continue; void race | Stance may drop |
| LTM fail | catch empty | Continue without memory | Less continuity |
| Emotion fail | catch | Continue without affect block | Flatter affect |
| CBE fail | catch | Continue without plan | No gating/direct |
| Humanization fail | catch | Continue | Less micro-realism |
| OpenAI 429/quota | error kind | Fallback model → Gateway → persona_fallback | Degraded reply; aiSource set |
| OpenAI timeout | SDK 60s | Retries then failover path | Latency / fallback |
| No AI keys | hasAnyAiKey | persona_fallback immediately | Safe degraded |
| Unexpected agent throw | catch | 502 | User msg saved; no assistant |
| Assistant RPC fail | error | 500 | Orphaned generation |
| End report keys missing | neither key | 500 | Session closed; no report |
| Report already exists | session_has_report | Short-circuit ok | Idempotent |
| ACE/LTM/QL fail | catch | Continue | Missing aftercare |
| STT fail | route/client | Client error / FSM retry | Re-speak |
| TTS / ElevenLabs fail | service | Browser speechSynthesis fallback | Voice quality drop |
| TTS barge-in | AbortSignal client | Stop audio; TRM LISTENING | Interruption |
| Network blip | fetch fail | Client retry UX | Manual |
| Upstash down | catch | In-memory rate limit | Weaker multi-instance |

---

## Retries

| Layer | Policy |
|-------|--------|
| OpenAI SDK | `OPENAI_MAX_RETRIES` default **3** |
| `withOpenAIRetry` | default **2** attempts, 250ms exp + jitter |
| Patient agent model | Primary → `OPENAI_FALLBACK_CHAT_MODEL` (gpt-4o-mini) on 429 |
| Patient agent provider | OpenAI → Gateway → persona |
| ElevenLabs | Voice-id fallback loop; **no** timed retry budget documented |
| Session create insert | Legacy column fallback retries |
| Message/end | No automatic HTTP retry server-side |

---

## Timeouts

| Call | Timeout |
|------|---------|
| OpenAI SDK | `OPENAI_TIMEOUT_MS` default **60000** |
| ElevenLabs server fetch | **None** (AbortSignal not wired) |
| Client fetch STT/message/TTS | Optional AbortSignal from TRM/pipeline |
| Session wall clock | `MAX_SESSION_SECONDS` = **2400** |

---

## Cancellation

| Kind | Support |
|------|---------|
| Client abort playback | Yes (TRM / pipeline) |
| Cancel in-flight LLM on server | **No** — request runs to completion or timeout |
| Cancel assistant persist | N/A mid-RPC |
| therapistInterrupted to CBE | API yes; **clients do not send** |

---

## Rollback

| Situation | Rollback |
|-----------|----------|
| Turn soft-engine fail | No DB rollback needed |
| GENERATE fails after user insert | User message remains (intentional) |
| Assistant RPC fails after generate | No assistant row; no automatic delete of user msg |
| End assess fails before report | Status may already be completed — ops concern |
| Report HMAC fail | No report row; retry end (idempotent if partial) |
| Snapshot | Never rolled back — immutable |

---

## Provider & streaming interruption

- **LLM:** non-streaming — interruption = abandon client wait; server may still finish.  
- **TTS stream:** client AbortSignal stops playback; server may continue generating audio.  
- **Voice interruption:** TRM BARGE_IN; classic cancels speechSynthesis.

---

## Partial failure philosophy

**Prefer a coherent degraded patient reply over a failed session.**  
Hard-fail only for auth, limits, ownership, transcript integrity, and report credentialing.

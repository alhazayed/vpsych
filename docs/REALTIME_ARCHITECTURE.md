# Realtime Architecture — Stage 11

**Status:** Implemented · Needs Human Review  
**Code:** `src/lib/realtime/`  
**Principle:** Voice and avatar are **presentation layers only**. Patient cognition remains exclusively owned by existing patient engines.

## Mission

Transform VPsych into a production-grade real-time clinical simulation platform with conversational voice, avatar animation, streaming infrastructure, multilingual interaction, and human-like therapy sessions — without redesigning Stages 1–10 or forking patient engines.

## Ownership

| Concern | Owner | Stage 11 role |
|---------|-------|---------------|
| Patient mind / DecisionPlan / snapshot | Case Engine + Clinical Intelligence | **Forbidden** |
| Emotion / Adaptation / Memory / CBE | Emotion · Adaptation · LTM · CBE | **Forbidden** |
| Patient reply text | Patient Agent (classic message path) | Read / stream presentation of result |
| STT / TTS providers | Voice (`lib/voice`) | Extended, not replaced |
| Nonverbal behaviour plans | NBE | Consumed by avatar controller |
| Clinical delivery params | CVP | Read for voice personality |
| Tenancy / RBAC | Enterprise (Stage 10) | Untouched |
| Voice gateway · streaming audio · avatar sync · session chrome · media metrics | `lib/realtime` | Authoritative realtime presentation layer |

## Extends (does not replace)

- `lib/voice` conversation pipeline (STT → message → TTS)
- Therapy Room VAD / hands-free FSM (complements)
- NBE animation scheduler (avatar controller maps cues)
- Classic `VoiceSession` remains default when flags are off

## Modules

| Module | File |
|--------|------|
| Types / version | `types.ts`, `versions.ts` |
| Feature flags | `feature-flag.ts` |
| Voice gateway | `voice-gateway.ts` |
| Streaming audio / buffers | `streaming-audio.ts`, `audio-buffer.ts` |
| Mic / speaker | `microphone-pipeline.ts`, `speaker-pipeline.ts` |
| Turn / interrupt / VAD / silence | `turn-detection.ts`, `interrupt-handling.ts`, `vad.ts`, `silence-detection.ts` |
| Latency / reconnect / quality | `latency-controller.ts`, `reconnect.ts`, `quality-adaptation.ts` |
| LLM stream control | `llm-streaming.ts`, `stream-message.ts` |
| Avatar / nonverbal / personality | `avatar-controller.ts`, `nonverbal-sync.ts`, `voice-personality.ts` |
| Multilingual | `multilingual.ts` |
| Session experience | `session-experience.ts` |
| Observability / a11y / security | `observability.ts`, `accessibility.ts`, `security.ts` |
| Engine / bridge | `engine.ts`, `session-bridge.ts` |

## Runtime

```
POST /api/sessions/:id/message          → cognition SSOT (unchanged owners)
POST /api/sessions/:id/message/stream   → SSE presentation adapter over classic turn
POST /api/sessions/:id/end
  → assess → education → validation → supervisor → enterprise
  → runRealtimeAfterAssessment()   // soft-fail; never blocks report
```

```
GET  /api/realtime/summary
GET  /api/admin/realtime
```

## Feature flags

| Flag | Default | Effect |
|------|---------|--------|
| `FEATURE_REALTIME_SIMULATION` / `NEXT_PUBLIC_…` | off | Enables realtime chrome + streaming APIs |
| `FEATURE_REALTIME_STREAMING` / `NEXT_PUBLIC_…` | on when simulation on | SSE `/message/stream` |

## Streaming model

1. **Cognition SSOT:** classic message route still runs Adaptation → Emotion → CBE → DecisionPlan → Humanization → Patient Agent → `insert_assistant_message`.
2. **SSE adapter:** `/message/stream` invokes the classic handler, then progressively emits tokens for partial UI / incremental speech scheduling.
3. **True provider streaming:** `generatePatientReplyStream` + `openAIService.chatStream` are additive APIs for deeper integration without forking soft engines (see `STREAMING_ENGINE.md`).

## Latency honesty

- **Interaction loops** (VAD decision, barge-in abort, local avatar tick): target **&lt;250ms** where supported.
- **E2E voice turn** (STT→LLM→TTS): still dominated by LLM; soft targets remain **3–6s p50 / 15s p95** per `LATENCY_BUDGET.md`.

## Related docs

- [`VOICE_PIPELINE.md`](./VOICE_PIPELINE.md)
- [`AVATAR_ARCHITECTURE.md`](./AVATAR_ARCHITECTURE.md)
- [`STREAMING_ENGINE.md`](./STREAMING_ENGINE.md)
- [`MULTILINGUAL_ENGINE.md`](./MULTILINGUAL_ENGINE.md)
- [`PERFORMANCE_GUIDE.md`](./PERFORMANCE_GUIDE.md)
- [`runtime/ENGINE_OWNERSHIP.md`](./runtime/ENGINE_OWNERSHIP.md)

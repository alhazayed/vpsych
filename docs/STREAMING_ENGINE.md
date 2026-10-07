# Streaming Engine — Stage 11

**Code:** `src/lib/sessions/clinical-turn.ts` (shared cognition),
`src/lib/sessions/stream-turn.ts` (SSE orchestration),
`src/lib/sessions/speech-release-gate.ts`,
`src/lib/realtime/{client-pipeline,sse-parser,sentence-segmenter,progressive-tts,turn-fence}.ts`
**Patient stream APIs:** `generatePatientReplyStream`, `openAIService.chatStream`
**Flag:** `FEATURE_REALTIME_SIMULATION=true` **and** `FEATURE_REALTIME_STREAMING=true` (explicit; off by default)
**Therapy Room:** voice turns use the SSE route by default
(`THERAPY_ROOM_STREAMING` / `NEXT_PUBLIC_THERAPY_ROOM_STREAMING`, set `false` to
opt out) — see *Therapy Room voice turns* below.

## One clinical pipeline, two transports

Patient-turn cognition lives in `lib/sessions/clinical-turn.ts` and is shared
verbatim by both routes:

```
prepareClinicalTurn()     session/ownership/active/expiry checks
                          → Adaptation → resolveAvatar → Long-term memory
                          → therapist message insert → history
                          → Emotion → CBE → PatientDecisionPlan → Humanization
generateValidatedReply()  draft → canonical-fact + contentless gate
                          → ONE regeneration with the correction cue
                          → persona fallback if rejected twice
persistAssistantReply()   insert_assistant_message (live 4-arg contract,
                          p_user_message_id = the therapist message)
buildTurnResponse()       the /message JSON body + observability headers
```

`POST /message` drafts with `generatePatientReplyDetailed` (blocking).
`POST /message/stream` drafts with `generatePatientReplyStream` (true provider
token streaming). Nothing else differs. `architecture.test.ts` fails if either
route calls an engine directly or the stream route reintroduces
`progressiveTokens` / re-invokes the classic handler.

## SSE route

`POST /api/sessions/:id/message/stream` — body
`{ message, therapistInterrupted?, clientTurnId? }`.

1. `isRealtimeStreamingEnabled()` else 404 · auth (401) · rate limit `msg-stream` 120/h (429) · body (400)
2. `prepareClinicalTurn()` — any failure answers with the **same status + JSON
   as /message, before the SSE stream opens and before the therapist message
   is persisted** (so the client may fall back to /message)
3. SSE stream; every event carries a monotonically increasing `sequence` and
   the `turnId` (the client's `clientTurnId` when supplied)

| Event | Meaning |
|-------|---------|
| `started` | therapist message persisted; `userMessage`, `voiceHints`, `locale` |
| `token` | provisional delta for draft `attempt` (presentation only) |
| `sentence` | a sentence the client may speak (`attempt`, `index`, `validated`) |
| `regenerating` | the current draft was discarded: `canonical_rejected`, `provider_reset`, `stream_failed`, `persona_fallback`, `final_text`. Client drops that attempt's text **and audio** |
| `interrupted` | aborted (barge-in / disconnect). Nothing persisted |
| `done` | validated reply persisted; full /message body (+ `attempt`, `streamed`) |
| `error` | turn failed after `started`; `assistantPersisted: false` |

### Invariants

- Partial tokens are never persisted. Only the validated final reply reaches
  `persistAssistantReply`, exactly once. `done` is emitted only after
  validation **and** persistence.
- `request.signal` (client disconnect) and stream `cancel()` abort one
  controller that is passed to the provider request. After abort: no more
  token/sentence events, no provider failover, no persona fallback, no
  persistence — including a reply that was already validated but not yet
  persisted.
- Canonical rejection of a streamed draft → `regenerating` → the replacement
  streams under the next attempt → validated → persisted.
- Stream failure (before or after partial output, e.g. an org not permitted to
  stream the model) → `regenerating(stream_failed)` → the **classic**
  `generatePatientReplyDetailed` drafts the reply for the same attempt, which
  the same gate validates. The client is never asked to re-post to /message
  after `started`: that would duplicate the therapist message and tick
  Adaptation / Emotion / DecisionPlan twice for one utterance.

## Speech release gate (progressive TTS vs. the canonical gate)

The classic rule is "never persist or hand to TTS until a valid utterance
exists". Progressive TTS speaks before the reply is complete, so
`speech-release-gate.ts` decides which sentences may be spoken early:

- released early only if the reply so far has lexical content and **no
  canonical-fact exposure** (no digit, no authored medication name) — such
  text cannot by itself fail `validatePatientReply`;
- if the therapist's turn names an authored medication (anaphoric "yes, I take
  it"), the whole reply is held;
- once exposure appears the gate latches; the rest is spoken only after the
  full reply is validated and persisted (`validated: true`).

The gate never edits text and never replaces `validatePatientReply`. If a
later sentence makes the full draft fail, the client cuts the early
(fact-free) audio on `regenerating` and speaks the validated replacement.

## Client

`submitStreamingConversationTurn()` (`client-pipeline.ts`):

- spec-compliant incremental SSE parsing (`sse-parser.ts`);
- drops events with a replayed `sequence`, another `turnId`, an older
  `attempt`, or after the turn fence moved (`isCurrent()`);
- returns `completed` (persisted reply) | `interrupted` (partial text is never
  a reply) | `failed` (`fallbackToClassic` only for HTTP 404/405/5xx before the
  stream opened) | `stale`.

## Progressive TTS

`progressive-tts.ts` — per draft attempt: ≤ 2 concurrent `/api/voice/tts`
requests, ≤ 6 pending chunks (extra sentences merge into the last unsynthesized
chunk, capped at 400 chars, never dropped or reordered), strict in-order
playback, abort-all on barge-in, object URLs revoked, nothing plays once the
turn fence moved. Chunks call `/api/voice/tts?progressive=1` (own bucket
`tts-chunk` 360/h, 400-char cap — same character ceiling as the classic
60 × 2500 bucket). Classic full-response TTS (`playPatientSpeech`) remains the
fallback.

## Barge-in (VoiceSession, realtime mode)

Mic press or a typed message while the patient is generating/speaking:
abort TTS queue → abort SSE + LLM (turn fence) → generation++ → clear pending
audio → capture → the next turn carries `therapistInterrupted: true`.

## Therapy Room voice turns

`TherapyRoomSession` calls `submitStreamingConversationTurn()` and voices the
reply in at most two parts (`lib/voice/streamed-reply.ts` +
`playPatientSpeechSegments` in `lib/voice/conversation-pipeline.ts`):

1. the first sentence the server released (it passed the speech release gate),
   after the persona's thinking pause, while the rest is still generating;
2. the rest of the **final** persisted reply (`done`), synthesized while part 1
   plays.

A `regenerating` event cuts part 1 if it came from a discarded draft and the
whole final reply is spoken instead; if nothing was released early, the final
reply is spoken whole, as on `/message`. The cognition is the same
`clinical-turn.ts` path, pinned by the "streamed vs classic turn" parity tests
in `message-routes.test.ts`.

Barge-in here stops the patient's **audio only**: the stream is not aborted,
so the reply is validated and persisted exactly as on `/message`, and the next
turn waits for it (`streamInFlightRef`) to keep turn order. The heard portion is
reported against the final saved text. If the stream route returns 404/405/5xx
before opening, the turn falls back to `/message`.


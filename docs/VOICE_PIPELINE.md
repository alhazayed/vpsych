# Voice Pipeline — Stage 11

**Code:** `src/lib/voice/*` + `src/lib/realtime/voice-gateway.ts`  
**Principle:** Voice is a presentation layer. Reply text is owned by Patient Agent.

## Classic path (default)

```
Therapist speech
  → OpenAI STT (/api/voice/transcribe)
  → Patient cognition (/api/sessions/:id/message)
  → ElevenLabs TTS (/api/voice/tts)
  → Browser audio
```

Orchestrated by `conversation-pipeline.ts`. Text-only sessions skip STT/TTS.

## Realtime turn path (`FEATURE_REALTIME_STREAMING=true`)

```
Therapist speech
  → OpenAI STT (/api/voice/transcribe)
  → /api/sessions/:id/message/stream  (same clinical pipeline; SSE tokens)
  → sentence events (speech release gate)
  → progressive ElevenLabs TTS (/api/voice/tts?progressive=1, ≤2 in flight, ≤6 queued)
  → ordered browser playback
```

Barge-in aborts TTS, the SSE request and the LLM generation, advances the
client turn fence, and clears pending audio. Classic `/message` + full-reply
TTS stays the fallback. See `STREAMING_ENGINE.md`.

## Realtime gateway (flag-gated)

`createVoiceGateway()` composes:

| Subsystem | Responsibility |
|-----------|----------------|
| Microphone pipeline | Permission, AGC/echo/noise constraints |
| VAD + silence detection | Energy frames, silence commit (≈850ms) |
| Turn detection | therapist_speaking → patient_thinking → … |
| Interrupt handling | Barge-in abort; sets `therapistInterrupted` for next turn |
| Streaming audio manager | Chunk queue + backpressure |
| Speaker pipeline | Playback queue, volume normalize |
| Latency controller | Stage samples + network suggestion |
| Reconnect controller | Exponential backoff + jitter |
| Quality adaptation | TTS chunk size / token budget under poor RTT |

## Interrupt contract (RT-06)

Clients should send `therapistInterrupted: true` on the next message when barge-in cuts patient audio.  
`submitConversationTurn({ therapistInterrupted: true })` now wires this.

## Voice personality

`buildVoicePersonality()` maps age, gender presentation, accent/culture hints, education register, prosody (pace/energy/stability/style), confidence, and emotional tone for TTS settings — **without inventing diagnosis**.

## Provider ownership

| Concern | Owner |
|---------|-------|
| Voice ID allowlist / registry | `lib/voice` |
| Clinical live-switch params | CVP |
| Capture / playback / VAD UX | Realtime gateway |
| STT/TTS HTTP routes | Existing `/api/voice/*` (rate-limited) |

## Voice turn outcomes and diagnostics (Therapy Room)

Every hands-free turn ends in one visible outcome:

| Outcome | What the therapist sees |
|---|---|
| Success | therapist caption + patient caption + patient audio |
| Partial | both captions + "Patient audio unavailable" naming ElevenLabs or playback, with a "Play patient audio" button |
| Error | a line naming the failed stage, e.g. `Speech-to-text failed (HTTP 429): OpenAI quota or credit balance is exhausted.` |

Order is strictly serial: STT → therapist caption → `/message` → patient caption → TTS → playback.
Neither caption depends on TTS or playback.

- `lib/voice/voice-diagnostics.ts` — pure stage reducer + safe error wording.
- `components/therapy-room/VoiceTurnPanel.tsx` — captions, alert line, and the per-stage
  debug grid (dev, `NEXT_PUBLIC_VOICE_DEBUG=true`, or `?voiceDebug=1`).
- `[VOICE][MIC|STT|TTS|TURN]` console lines (same switch) carry sizes, statuses and lengths
  only — never transcript text, patient text, audio, or keys.
- `/api/voice/transcribe` maps provider quota / credit exhaustion to `OPENAI_QUOTA_EXHAUSTED`.
- `/api/voice/tts` maps "no approved voice for this language" to `VOICE_LANGUAGE_UNAVAILABLE` (503).
- Barge-in is on by default (`NEXT_PUBLIC_VOICE_BARGE_IN=false` turns voice barge-in off). The
  mic monitor arms 400 ms after audio is actually playing, spends 450 ms learning the patient's
  residual echo level, then fires on ≥300 ms of speech at 2.5× that level
  (`createBargeInDetector` in `lib/therapy-room/vad.ts`). On fire the patient clip stops and the
  same open mic stream, plus the therapist's first words from a short ring buffer, is handed to
  the next listen turn, so the transcript does not lose its opening words.
- An Interrupt control (✋, or Space) appears while the patient is speaking and works even when
  voice barge-in is off or the device's echo cancellation is too weak for it.

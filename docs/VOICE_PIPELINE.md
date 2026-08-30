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

## Arabic Speech Preparation (ASPE)

When `locale=ar`, `/api/voice/tts` runs `prepareArabicSpeech()` before ElevenLabs:
selective clinical tashkeel, number/abbreviation expansion, markup strip.
Stored transcripts are not rewritten. See `docs/ARABIC_SPEECH_PREPARATION_ENGINE.md`.

## Provider ownership

| Concern | Owner |
|---------|-------|
| Voice ID allowlist / registry | `lib/voice` |
| Arabic TTS orthography | `lib/arabic-speech` (ASPE) |
| Clinical live-switch params | CVP |
| Capture / playback / VAD UX | Realtime gateway |
| STT/TTS HTTP routes | Existing `/api/voice/*` (rate-limited) |

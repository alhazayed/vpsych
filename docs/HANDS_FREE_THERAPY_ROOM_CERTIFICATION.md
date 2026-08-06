# Hands-Free Therapy Room — Production Certification

**Date:** 2026-08-06  
**Feature:** True Hands-Free Therapy Room (full-duplex conversational FSM)  
**Flag:** `NEXT_PUBLIC_THERAPY_ROOM_MODE`  
**Verdict:** **CERTIFIED for production** behind the existing optional flag.

## Scope certified

| Requirement | Evidence |
|---|---|
| Continuous conversation without mic clicks | FSM `PLAYBACK_END` / `BARGE_IN` → `LISTENING` + auto `startHandsFreeVad` |
| Explicit FSM | `conversation-fsm.ts` + architecture test |
| VAD 700–1000 ms silence | `resolveSilenceMs` + `HANDS_FREE_PERF_BUDGETS` |
| Avatar playback lock | Mic capture only in `LISTENING`; barge-in monitor during TTS |
| Barge-in | `BARGE_IN` aborts TTS via AbortSignal, reopens mic |
| AEC / NS / AGC | `HANDS_FREE_AUDIO_CONSTRAINTS` |
| Pause / Resume / End | FSM events + abort controllers + `/end` unchanged |
| Status feedback | `ConversationStatus` + i18n en/ar |
| Error + Retry | `ERROR` → `RETRY` → `LISTENING` |
| Telemetry without PHI | `conversation-telemetry.ts` counters only |
| Security model unchanged | No new keys; notes still PATCH therapy-room only |
| Regression | Classic VoiceSession path untouched; flag still required |

## Regression surface (must remain green)

- Avatar generation, reports, transcript, scoring, admin dashboard
- Session history, auth, Professional Preview, validation, invite codes
- Clinical Validation Platform / VMHC clinic flows
- Existing Vitest suite + migration parity + build

## Performance benchmark notes

Budgets are encoded in `HANDS_FREE_PERF_BUDGETS` and asserted in unit tests.
Wall-clock STT/GPT/TTS remain provider-bound (identical to classic pipeline).
Client-side mic reopen and speech-end→STT handoff are event-driven (no artificial delay beyond VAD silence).

## Browser compatibility report

| Platform | Status |
|---|---|
| Chrome desktop | Pass (primary) |
| Edge desktop | Pass (Chromium Web Audio) |
| Firefox desktop | Pass (ScriptProcessor + getUserMedia) |
| Safari iOS | Pass with Start-Session user gesture for AudioContext/autoplay |
| Chrome Android | Pass with platform AEC |

## Residual risks / known limits

1. `ScriptProcessorNode` is deprecated; functionally supported across target browsers. Future upgrade: AudioWorklet without changing FSM contracts.
2. Barge-in sensitivity may need clinic-floor calibration (threshold / minSpeechMs).
3. Feature remains **opt-in** until expert validation of immersion UX.

## Sign-off checklist

- [x] Architecture + FSM + sequence docs published (`docs/HANDS_FREE_THERAPY_ROOM.md`)
- [x] Implementation wired through `TherapyRoomSession`
- [x] Automated tests for loop, VAD, barge-in, pause/resume, errors, telemetry
- [x] Architecture guardrail for hands-free FSM
- [x] en/ar status strings
- [x] No security model changes
- [x] Classic VoiceSession preserved

**Certification:** Ready to enable via `NEXT_PUBLIC_THERAPY_ROOM_MODE=true` after standard CI (lint → typecheck → test → migrations → build).

# Therapy Room Mode (TRM)

**Status:** The only session experience (2026-10-04). The classic
`VoiceSession` screen and the Classic / Therapy Room toggle were removed.  
**Mission:** 34 — transform the live session from a chatbot layout into a
psychiatric consultation room.

`NEXT_PUBLIC_THERAPY_ROOM_MODE` no longer gates anything. Every session started
from the patient library (and every admin test session) is created with
`sessions.interaction_mode = 'therapy_room'`, and `/sessions/[id]` always
renders `TherapyRoomSession`. Rows created earlier with `interaction_mode =
'classic'` stay in the database untouched; an active one opens in the Therapy
Room, and completed ones keep their history and report pages.

Migration `20260806133411_therapy_room_mode.sql` adds `interaction_mode`,
`private_notes`, and `immersion_metrics`. If the column is missing, session
start retries without it (see `app/api/sessions/route.ts`).

## Design principles

- Less interface, more patient
- Fullscreen first-person consultation room
- No speech bubbles, AI badges, typing indicators, or markdown chat chrome
- Transcript **off** by default; optional live transcript; full transcript after end
- Hands-free conversation with automatic turn detection (VAD)
- Small floating controls only: Pause, Resume, Private Notes, Mute, Repeat,
  Settings, End (+ optional transcript toggle)

## Architecture

```
src/lib/therapy-room/          # domain + PME bridge + TRII + VAD + ambience
src/components/therapy-room/   # TherapyRoomSession + scene + presence + controls
```

### Scene renderer contract

`TherapyRoomScene` is tagged `data-trm-renderer="css2d"`. Themes are identified
by stable ids (`modern_clinic`, `academic_hospital`, …). A future 3D / VR
renderer can swap the scene component without changing session orchestration,
PME behavior packets, or APIs.

### PME bridge

Full Patient Mind Engine is not yet merged. `pme-bridge.ts` derives
deterministic nonverbal cues, thinking latency, voice modulation, and
interrupt eligibility from the session diagnosis + HCF speech profiles.

**Invariant:** every nonverbal cue originates from the PME bridge — never
`Math.random`. Jitter uses a seeded hash of session id + turn index.

When PME ships, replace `derivePatientBehavior` with the engine output; the
room UI already consumes `PatientBehaviorState`.

### Hands-free pipeline

True hands-free full-duplex conversation (no per-turn mic clicks):

```
Start → FSM LISTENING → continuous VAD
  → silence (700–1000 ms) / max / patient-interrupt ends turn
  → PROCESSING_STT → OpenAI STT
  → WAITING_GPT → /api/sessions/:id/message (unchanged)
  → diagnosis-linked thinking latency + look-away
  → AVATAR_SPEAKING → ElevenLabs / browser TTS (AbortSignal + onended)
  → barge-in monitor (therapist may interrupt → LISTENING immediately)
  → PLAYBACK_END → LISTENING (mic reopens automatically)
```

Therapist controls: **Pause**, **Resume**, **End Session** only (plus notes/settings).

See `docs/HANDS_FREE_THERAPY_ROOM.md` for FSM diagrams, telemetry, browser notes,
and `docs/HANDS_FREE_THERAPY_ROOM_CERTIFICATION.md` for production sign-off.

No audio recordings are stored. WAV blobs exist only in memory for STT upload.
Transcript persistence remains server-side (existing message RPCs).

### Private notes

Typed in the floating panel. Autosaved via
`PATCH /api/sessions/:id/therapy-room`. Notes are **never** included in the
patient message body and never shown in the live room transcript.

### Therapy Room Immersion Index (TRII)

Computed client-side from immersion events (hands-free vs text turns,
transcript opens, pauses, interrupts, control usage) and written to
`sessions.immersion_metrics` at end.

Sub-scores (0–100, higher = more immersive):

| Score | Meaning |
|---|---|
| interfaceDistraction | Fewer control / notes / settings opens |
| conversationContinuity | Fewer pauses and text fallbacks |
| handsFreeUsage | Share of hands-free turns |
| interruptionFrequency | Fewer barge-ins (still clinically allowed) |
| transcriptDependency | Less live-transcript reliance |
| userImmersion | Composite presence score |
| overall | Weighted TRII |

## Security

- Existing auth, RLS, rate limits, and PHI protections unchanged
- Reports remain admin-only
- No audio retention
- Feature flag defaults **off** until expert validation

## Accessibility

Keyboard: `P` pause/resume, `N` notes, `Esc` close panels, `Ctrl/Cmd+E` end.  
Focusable silent text input for voice-unavailable fallback.  
Touch / mouse / desktop / tablet supported. Scene contract is VR-ready.

## Post-session

Assessment, ACE, and admin reports follow the existing `/end` path. Therapists
still land on `/sessions/:id/complete` without scores. Immersion metrics are
stored on the session row for admin/research review.

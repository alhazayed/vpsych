# Hands-Free Therapy Engine (HFTE) v1

Conversation UX layer for natural therapist ↔ avatar dialogue.

## Scope

HFTE changes **only** how turns are captured and paced in the voice session UI:

- Conversation state machine (`Listening` → `Processing` → `AvatarSpeaking` → …)
- Voice activity detection (speech start/end, interruption, noise rejection)
- Pause / resume, status bar, waveform, shortcuts, preferences
- Thinking delay + optional TTS vocalization prefixes (PME-cue adapter)

HFTE **must not** change clinical reasoning, patient personality, diagnostic
behavior, therapy engines, scoring, ACE, TRE, PME, or fictional safety
architecture. Patient replies still flow through the existing
`/api/sessions/:id/message` path.

## Feature flag

```bash
ENABLE_HANDS_FREE_THERAPY=true
# optional client mirror:
NEXT_PUBLIC_ENABLE_HANDS_FREE_THERAPY=true
```

When unset/false, the classic push-to-talk `VoiceSession` path is unchanged.

## Security

- Microphone audio is ephemeral (STT upload only). Never logged or stored by HFTE.
- Metrics are aggregates only (`hfte_session_metrics`).
- Private therapist notes stay client-local and are never sent to the avatar.

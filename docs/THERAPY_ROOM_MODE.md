# Therapy Room Mode

**Status:** Optional — enabled only when `NEXT_PUBLIC_THERAPY_ROOM_MODE=true`  
**Architecture (canonical):** [`THERAPY_ROOM_ARCHITECTURE.md`](./THERAPY_ROOM_ARCHITECTURE.md)

Classic `VoiceSession` remains the default. Therapy Room does **not** replace
it when the flag is unset.

## Enable

```bash
NEXT_PUBLIC_THERAPY_ROOM_MODE=true
```

Apply migrations:

- `20260806133411_therapy_room_mode.sql` — `interaction_mode`, immersion metrics
- `20260806140000_therapy_room_vmhc.sql` — clinic day + `session_private_notes`
- `20260806150000_therapy_room_architecture_consolidation.sql` — drops duplicate
  `ui_mode` / `sessions.private_notes` after backfill

When the flag is on:

- Start Session offers **Classic** vs **Therapy Room**
- Chosen mode is stored on `sessions.interaction_mode`
- Room UI is always `TherapyRoomSession` on `/sessions/[id]`
- `/clinic` provides the optional Virtual Mental Health Center day workflow
  (schedule → chart → invite → same room)

## Design principles

- Less interface, more patient
- Fullscreen first-person consultation room
- No speech bubbles, AI badges, typing indicators, or markdown chat chrome
- Transcript **off** by default; optional live transcript; full transcript after end
- Hands-free conversation with automatic turn detection (VAD)
- Small floating controls: Pause, Resume, Private Notes, Mute, Repeat, Settings, End

## Notes

Canonical store: `session_private_notes` (SOAP / DAP / BIRP / free / voice).  
API: `GET|POST|PATCH /api/sessions/:id/notes`.  
Never included in the patient message body.

## Immersion (TRII)

Canonical event system: `immersion-index.ts`. Metrics written to
`sessions.immersion_metrics` via `PATCH /api/sessions/:id/therapy-room`.

## Security

- Existing auth, RLS, rate limits unchanged
- Reports remain admin-only
- Feature flag defaults **off**

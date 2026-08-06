# Virtual Mental Health Center (VMHC) — Therapy Room

Mission 35 immersion surface. Feature-flagged; does **not** replace the legacy
chat session UI, session APIs, assessment pipeline, or admin report RLS.

## Enable

```bash
FEATURE_THERAPY_ROOM=true
# Optional client mirror:
NEXT_PUBLIC_FEATURE_THERAPY_ROOM=true
```

When unset/false: `/clinic` redirects to `/avatars`; clinic APIs return 404;
`Start Session` → `/sessions/[id]` + `VoiceSession` unchanged.

## Clinical day flow

1. **Clinic dashboard** (`/clinic`) — today's appointments (initials / first
   name), time, session number, referral source, urgency, optional diagnosis
   (difficulty-gated), outstanding tasks, supervisor note count.
2. **Pre-session chart** (`/clinic/chart/[appointmentId]`) — referral, chief
   complaint, risk alerts, prior notes / meds / homework / labs / testing only
   when difficulty allows (`chartSectionsForDifficulty`).
3. **Invite patient** — creates a normal session via `POST /api/sessions`,
   links `clinic_appointments.session_id`, opens the room with arrival
   choreography (knock → open → enter → sit → greet).
4. **Consultation room** (`/clinic/room/[sessionId]`) — room-first UI, no chat
   bubbles. Floating toolbar only: Pause, Resume, Private Notes, Risk Flag,
   Emergency, Repeat, Mute, Settings, End. Voice turns reuse
   `conversation-pipeline` (same message / STT / TTS APIs).
5. **Departure** — stand → thanks → leave → door; then debrief.
6. **Debrief + supervisor** — transcript + ACE `coach_feedback` residency
   briefing. **Never** returns `session_reports` (admin-only).
7. **End of day** — clinic summary (patients seen, risk events, objectives,
   reflection, study topics).

## Architecture

| Area | Path |
|---|---|
| Feature flag | `src/lib/features.ts` |
| Engine | `src/lib/therapy-room/` |
| UI | `src/components/therapy-room/` |
| Routes | `src/app/(app)/clinic/**` |
| APIs | `/api/clinic/day`, `/api/clinic/appointments/[id]`, `/api/sessions/[id]/notes`, `/api/sessions/[id]/supervisor` |
| Schema | `supabase/migrations/20260806140000_therapy_room_vmhc.sql` |

### Patient behaviour

`resolvePatientNonverbal()` derives posture, eye contact, tempo, fidgeting,
breathing, defences, alliance, and disclosure timing from the case snapshot +
disorder speech profile — deterministic, never random. CSS modifiers + the
immersion bus prepare facial/body animation without redesign.

### Immersion bus (future VR / AR / haptics / eye tracking)

`registerImmersionAdapter` / `publishImmersionEvent` in
`src/lib/therapy-room/immersion.ts`. Channels: `room.state`, `patient.pose`,
`patient.gaze`, `patient.expression`, `patient.body`, `audio.*`, `haptic`,
`eye_tracking`, `session.phase`.

### Private notes

`session_private_notes` — therapist-owned, RLS-gated. Architecture tests assert
the patient message route never references this table. Notes must not influence
patient replies.

## Compatibility invariants

- Legacy `VoiceSession` remains the only UI on `/sessions/[id]`.
- Session start / message / end contracts unchanged.
- Reports stay admin-only; supervisor uses ACE coach feedback + educational copy.
- Fictional safeguards and certification constraints unchanged.

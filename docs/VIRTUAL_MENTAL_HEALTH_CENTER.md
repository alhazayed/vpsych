# Virtual Mental Health Center (VMHC)

**Architecture (canonical):** [`THERAPY_ROOM_ARCHITECTURE.md`](./THERAPY_ROOM_ARCHITECTURE.md)

Clinic-day workflow layered on the single Therapy Room. Not a second room UI.

## Enable

```bash
NEXT_PUBLIC_THERAPY_ROOM_MODE=true
```

(Same flag as Therapy Room Mode.)

## Clinical day flow

1. **Clinic dashboard** (`/clinic`) — today’s appointments
2. **Pre-session chart** (`/clinic/chart/[appointmentId]`)
3. **Invite patient** — `POST /api/sessions` with `interactionMode: therapy_room`
4. **Consultation** — redirects to `/sessions/[id]` → `TherapyRoomSession`
5. **Debrief / supervisor** — `/clinic/room/[id]/debrief`, `…/supervisor`
6. **End of day** — `/clinic/day-end`

## Notes

Uses the canonical `session_private_notes` table (SOAP/DAP/BIRP/free).

## Compatibility

- Classic `/sessions/[id]` + `VoiceSession` when `interaction_mode=classic`
- Admin reports remain admin-only
- Patient message route never reads private notes

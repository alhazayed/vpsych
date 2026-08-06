# Therapy Room Architecture (Mission 35 consolidation)

**Verdict: READY TO MERGE**

Architectural duplication between Mission 34 (TRM) and Mission 35 (VMHC) has
been eliminated. Classic `VoiceSession` remains the default when the flag is
off — production behavior with the flag unset is unchanged.

---

## Old architecture (pre-consolidation)

Two parallel products shared a folder but not a model:

| Concern | Mission 34 (TRM) | Mission 35 (VMHC) |
|---|---|---|
| Flag | `NEXT_PUBLIC_THERAPY_ROOM_MODE` | `FEATURE_THERAPY_ROOM` + `NEXT_PUBLIC_FEATURE_THERAPY_ROOM` |
| Session mode | `sessions.interaction_mode` | `sessions.ui_mode` |
| Notes | `sessions.private_notes` text + `PATCH …/therapy-room` | `session_private_notes` table + `/notes` |
| Room UI | `TherapyRoomSession` on `/sessions/[id]` | `TherapyRoom` on `/clinic/room/[id]` |
| Immersion | TRII `ImmersionEvent` + `immersion-index.ts` | Unused clinic bus `ClinicImmersion*` + `immersion.ts` |

---

## New architecture (canonical)

```
NEXT_PUBLIC_THERAPY_ROOM_MODE=true
        │
        ├─ Start Session → interaction_mode=therapy_room → /sessions/[id]
        │                      └─ TherapyRoomSession (only room UI)
        │
        └─ /clinic (schedule → chart → invite)
                 └─ creates session with interaction_mode=therapy_room
                 └─ redirects to /sessions/[id] (same TherapyRoomSession)
                 └─ optional completeHref → /clinic/room/[id]/debrief
```

| Concern | Canonical |
|---|---|
| Flag | `NEXT_PUBLIC_THERAPY_ROOM_MODE` only (`isTherapyRoomModeEnabled`) |
| Session mode | `sessions.interaction_mode` (`classic` \| `therapy_room`) |
| Notes | `session_private_notes` (SOAP / DAP / BIRP / free / voice) |
| Room UI | `TherapyRoomSession` only, mounted on `/sessions/[id]` |
| Immersion | TRII tracker only (`immersion-index.ts` → `sessions.immersion_metrics`) |
| Clinic workflow | `/clinic/*` schedule/chart/supervisor/day-end (not a second room) |

---

## Migration map

| From | To |
|---|---|
| `FEATURE_THERAPY_ROOM` / `NEXT_PUBLIC_FEATURE_THERAPY_ROOM` | Removed — use `NEXT_PUBLIC_THERAPY_ROOM_MODE` |
| `sessions.ui_mode` | Backfill → `interaction_mode`, then **dropped** |
| `sessions.private_notes` | Backfill → `session_private_notes` (`free`), then **dropped** |
| `PATCH …/therapy-room` `privateNotes` | Removed — notes via `/api/sessions/[id]/notes` |
| `PATCH …/therapy-room` `immersionMetrics` | Kept (TRII only) |
| Clinic `/clinic/room/[id]` room UI | Redirects to `/sessions/[id]` after stamping mode |

Migration file:
`supabase/migrations/20260806150000_therapy_room_architecture_consolidation.sql`

Apply after `20260806133411_therapy_room_mode.sql` and
`20260806140000_therapy_room_vmhc.sql`.

---

## Deleted components / modules

| Path | Reason |
|---|---|
| `src/lib/features.ts` | Duplicate flag module |
| `src/lib/features.test.ts` | Covered by therapy-room flag tests |
| `src/lib/therapy-room/immersion.ts` | Unused clinic immersion bus |
| `src/components/therapy-room/TherapyRoom.tsx` | Duplicate room pipeline |
| `src/components/therapy-room/PrivateNotebook.tsx` | Merged into `PrivateNotesPanel` |

Deprecated type aliases (`ClinicImmersion*`, `ui_mode`, `TherapySession.private_notes`) removed.

---

## Unified APIs

| Method | Path | Role |
|---|---|---|
| GET/POST/PATCH | `/api/sessions/[id]/notes` | Canonical private notes (structured) |
| PATCH | `/api/sessions/[id]/therapy-room` | Immersion metrics only |
| GET | `/api/clinic/day` | Clinic schedule (flag-gated) |
| POST | `/api/clinic/day/[id]/close` | End-of-day summary |
| PATCH | `/api/clinic/appointments/[id]` | Appointment status / session link |
| GET | `/api/sessions/[id]/supervisor` | Educational supervisor briefing |

Patient message / STT / TTS / end routes unchanged.

---

## Unified database

**Keep**

- `sessions.interaction_mode`
- `sessions.immersion_metrics`
- `session_private_notes` (+ RLS)
- `clinic_days`, `clinic_appointments`

**Drop (via consolidation migration)**

- `sessions.ui_mode`
- `sessions.private_notes`

---

## Risk assessment

| Risk | Mitigation |
|---|---|
| Env still set to old FEATURE_* flags | Documented; flag-off by default — enable `NEXT_PUBLIC_THERAPY_ROOM_MODE` |
| Rows with only `ui_mode` set | Backfill before drop |
| Free-text notes only on old sessions | Copied into `session_private_notes` as `free` |
| Clinic arrival choreography removed with `TherapyRoom.tsx` | Documented; room UX is TRM `TherapyRoomSession` (no second pipeline) |
| Migration not applied remotely | Soft-fail on missing immersion column retained; notes APIs 404 cleanly when flag off |

---

## Rollback plan

1. Revert this PR / restore previous branch tip.
2. Do **not** re-run the drop migration on production without a restore —
   if already applied, restore `ui_mode` / `private_notes` from backup or
   recreate nullable columns and reverse-copy from `session_private_notes`.
3. Re-enable dual env vars only if rolling back the application code.

---

## Final recommendation

**READY TO MERGE**

Duplication is eliminated at the flag, mode, notes, room component, API, and
immersion layers. Remaining `/clinic` routes are workflow shell only — they do
not host a second consultation room.

Enable with:

```bash
NEXT_PUBLIC_THERAPY_ROOM_MODE=true
```

See also: `docs/THERAPY_ROOM_MODE.md`, `docs/VIRTUAL_MENTAL_HEALTH_CENTER.md`
(update to point at this document as source of truth for architecture).

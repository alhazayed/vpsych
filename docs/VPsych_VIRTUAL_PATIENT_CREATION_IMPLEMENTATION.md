# VPsych — Virtual Patient Creation Implementation (Phase 3B)

**Date:** 2026-08-09  
**Branch:** `cursor/vp-creation-phase3b-b432`  
**Authoritative contract:** `docs/VPsych_VIRTUAL_PATIENT_CREATION_CONTRACT.md`  
**Baselines:** Phase 2 Admin UX, system inventory, Admin UX assessment  

---

## 1. Architecture

Phase 3B adds a production-safe **authoring workflow** on top of existing engines. No new clinical engines, lifecycle enums, archive columns, personality schemas, or voice tables.

```text
Admin Wizard (Phase 2 UI, now functional)
   ↓
Route Handlers (requireApiAdmin + rateLimit + audit)
   ↓
lib/admin/virtual-patient (validate → persist)
   ↓
SECURITY INVOKER RPCs (atomic avatars + personas)
   ↓
Existing sync_avatar_flat_from_v2 trigger
   ↓
Runtime: resolveAvatar / createCaseForSession (unchanged)
```

**Lifecycle (existing `is_active` only):**

| State | Representation |
|---|---|
| DRAFT | `is_active = false` |
| READY | validation passes, still `is_active = false` |
| PUBLISHED | `is_active = true` |
| INACTIVE | `is_active = false` after deactivate |

Never labeled “Archived.”

---

## 2. API endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/admin/avatars` | Create draft (`is_active=false`) |
| `GET` | `/api/admin/avatars/[id]` | Load avatar + persona + validation |
| `PATCH` | `/api/admin/avatars/[id]` | Update draft (refuses published) |
| `POST` | `/api/admin/avatars/validate` | Validate without persist |
| `POST` | `/api/admin/avatars/[id]/publish` | Publish gate → `is_active=true` |
| `POST` | `/api/admin/avatars/[id]/deactivate` | `is_active=false` |
| `POST` | `/api/admin/avatars/[id]/duplicate` | Copy as new inactive draft |
| `POST` | `/api/admin/avatars/[id]/preview` | Real `resolveAvatar` (+ optional case) |

All use `requireApiAdmin`, rate limits, and sanitized errors. Create/update/publish/deactivate/duplicate emit `logSecurityEvent` on success (`admin.avatar.*`).

Client cannot set: `id`, `created_at`, `updated_at`, `available_locales`, or `is_active` on create/update.

---

## 3. Database operations

**Migration:** `supabase/migrations/20260809155313_admin_virtual_patient_atomic.sql`

| Function | Role |
|---|---|
| `admin_create_virtual_patient(jsonb)` | Insert avatar (`is_active=false`) + optional persona |
| `admin_update_virtual_patient(uuid, jsonb)` | Update avatar + upsert persona; never sets `is_active=true` |
| `admin_duplicate_virtual_patient(uuid, text)` | Copy content to new ids/slug; inactive |

- `SECURITY INVOKER` — RLS remains in force; `is_admin()` defense in depth  
- Grants: `authenticated`, `service_role` EXECUTE  
- No `draft_status` / `published_at` / `archived_at` / `tenant_id`  
- Flat columns derived server-side; sync trigger maintains `available_locales`  

Publish/deactivate use direct admin RLS `UPDATE` on `avatars` / `personas` (single-table).

---

## 4. Transaction strategy

Create/update/duplicate run inside one Postgres function call ⇒ **one transaction**. If persona insert fails after avatar insert, the whole RPC rolls back — no orphan avatar.

Service role is **not** required; admin JWT + INVOKER RPC is sufficient.

---

## 5. Validation gates

Module: `src/lib/admin/virtual-patient/validation.ts`

| Gate | Draft | Publish |
|---|---|---|
| Slug format | required | required |
| Clinical core structure | warnings | errors |
| EN / AR personalities (native, independent) | warnings | errors (AR≠EN prompt) |
| Human personality EN/AR (`validateHumanPersonality`) | warnings | errors |
| Voice coverage + active profile | warning | error |
| Active default disorder linkage | warning | error |
| Completeness soft checks | reused | reused |

Reuses: `validateHumanPersonality`, `assessVirtualPatientCompleteness`, `isActiveVoiceProfile`.

---

## 6. Publish semantics

1. Load avatar + persona + voice + disorder  
2. `assessPublishReadiness`  
3. On failure → 400 + structured `issues` (no activation)  
4. On success → `avatars.is_active=true` (+ persona active)  
5. Audit `admin.avatar.publish`  
6. **Does not** mutate historical `sessions.clinical_snapshot` / reports  

---

## 7. Deactivation

`POST .../deactivate` sets `is_active=false`. Does **not** delete sessions, reports, snapshots, learner/ACE/CGE data.

---

## 8. Duplication

Copies: clinical_core, personalities, human_personality, rubric, ideal_guidelines, voice refs.  
Regenerates: avatar id, persona id, slug.  
Resets: `is_active=false`.  
Never copies: sessions, messages, reports, case_instances, clinical_snapshots, case_memory, learner/ACE/CGE, audit history.

---

## 9. Security

- `requireApiAdmin` on every route  
- Rate limits (create/publish/duplicate 20/h; update/deactivate 30/h; validate/read 60/h; preview 30/h)  
- Audit events without persona prompts / clinical narratives  
- `clientSafeError` on persistence failures  
- RLS preserved (INVOKER RPCs)  
- No CSP/HMAC/session changes  

---

## 10. Clinical safety

**Unchanged:** case engine, patient agent, diagnostic reasoning, competency scoring, ACE, CGE, clinical snapshot semantics, risk/suicide/violence behavior, memory engine.

This phase only authors configuration those systems already consume via `resolveAvatar` / `createCaseForSession`.

New patients use the **generic** runtime path (persona `default_disorder_id` + clinical_core) — no Maya/Jordan hard-coding for new slugs.

---

## 11. Tests

| Suite | Coverage |
|---|---|
| `virtual-patient.test.ts` | Draft/publish gates, bilingual independence, voice/disorder/HP |
| `persist.test.ts` | Create inactive, publish gate, deactivate, duplicate, slug 409, published immutable edit |
| `architecture.test.ts` | Routes auth/rateLimit/audit; migration INVOKER; no archive columns |

Therapist visibility is enforced by existing RLS (`is_active=true OR is_admin`) — drafts are invisible to therapists by construction.

---

## 12. Known limitations

1. Migration must be applied to each environment before RPCs work in that environment.  
2. Persistent admin sandbox / test conversation is **Phase 3C** (preview uses `resolveAvatar` only).  
3. Wizard collects full publishable fields but advanced AvatarPersonality modules remain simplified stubs + Advanced JSON.  
4. Single `voice_profile_id` (+ legacy sync) — dual-locale TTS still relies on existing architecture.  
5. Remote DB application of the migration is ops/deploy responsibility (file is in repo).  

---

## 13. Phase 3C recommendations

1. Non-learner sandbox chat that reuses patient-agent / message pipeline **without** ACE ingest or formal reports.  
2. Stronger nested Ajv (or hand validator) for full `AvatarPersonality` richness.  
3. Optional dual voice assignment UX clarifying EN/AR coverage.  
4. Consider publish confirmation modal + diff of last draft.  
5. Do **not** add archive columns unless product explicitly revisits Phase 3A §15.  

---

## Files / artifacts

**APIs created:** 8 route modules under `src/app/api/admin/avatars/`  
**DB functions created:** 3 (`admin_create_virtual_patient`, `admin_update_virtual_patient`, `admin_duplicate_virtual_patient`)  
**Migrations created:** 1 (`20260809155313_admin_virtual_patient_atomic.sql`)  
**Lib:** `src/lib/admin/virtual-patient/*`  
**UI:** `VirtualPatientWizard`, `VirtualPatientLifecycleActions`, wired `avatars/new` + detail  
**Docs:** this file + contract copied onto branch  

**STOP:** Phase 3C not started.

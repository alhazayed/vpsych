# Phase 10C-1 — Edit Integrity Foundation

**Phase:** 10C-1 (implementation)  
**Date (UTC):** 2026-09-26  
**Baseline:** Phase 10B CLEAR (`8ea204e`); Phase 10C audit COMPLETE  
**Audit:** `docs/PHASE10C_EDIT_RESUME_AUDIT.md`  
**Production security (Phase 8):** MFA / AAL2 / HMAC / RLS / authorization / rate limiting / audit logging — **UNCHANGED**  
**Scope:** Fix Advanced edit wipe risks, wire Advanced edit from detail, enforce published immutability on side mutation routes.  
**Explicitly out of scope:** Guided Edit, `avatarToGuidedDraft`, merge PATCH API, AI edit, autosave, revision history, dirty guards, migrations.

---

## 1. Original issue

Phase 10C audit found:

1. **`ideal_guidelines ?? {}` wipe** — `buildRpcPayload` always sent `ideal_guidelines` (default `{}`). `admin_update_virtual_patient` uses key-presence semantics, so Advanced save erased authored guidelines (`case_type`, frameworks, interaction profile, etc.).
2. **No Advanced edit entry from detail** — wizard supported `avatarId` load but was never mounted from `/admin/avatars/[id]`.
3. **Published mutability gaps** — `PATCH …/voice` and `PUT /api/admin/personality` could update published rows without lifecycle checks.

---

## 2. Implementation

| Change | Location |
|---|---|
| `buildRpcPayload(input, ctx, mode)` omits unspecified guidelines/HP/rubric/voice on **update** | `src/lib/admin/virtual-patient/persist.ts` |
| Wizard loads + round-trips `ideal_guidelines` and `rubric` | `VirtualPatientWizard.tsx` |
| Advanced edit page for draft\|testing | `src/app/(app)/admin/avatars/[id]/edit/page.tsx` |
| Detail CTA **Continue authoring** | `VirtualPatientDetail.tsx` + i18n en/ar |
| `assertAvatarContentMutable` | `src/lib/admin/virtual-patient/mutability.ts` |
| Voice assign gated | `src/app/api/admin/avatars/[id]/voice/route.ts` |
| Human personality save gated | `src/lib/personality-engine/persist.ts` + personality route status mapping |
| Leaf lifecycle helpers (no import cycle) | `persist-lifecycle.ts` |

---

## 3. Lifecycle rules (enforced server-side)

| Status | Content editable? | How to change content |
|---|---|---|
| **draft** | Yes | Advanced edit / PATCH update / voice / personality |
| **testing** | Yes | Same |
| **published** | **No** | Duplicate → new draft; then edit |
| **archived** | **No** | Restore → draft (existing workflow); then edit |

Published/archived mutations return **409** with an explicit error (not silent no-op). Publish behavior unchanged.

---

## 4. Data preservation guarantees

On Advanced update when the client omits a field:

- `ideal_guidelines` — **preserved** (key omitted from RPC payload)
- `human_personality` — preserved if omitted
- `rubric` — preserved if omitted
- `clinical_core` / `personalities` — preserved if omitted
- `voice_profile_id` — preserved if omitted

When the wizard loads an existing patient, it **round-trips** persisted `ideal_guidelines` and `rubric` so a full Save draft does not replace them with empty/default alliance-only content.

Does **not** invent new clinical values. Does **not** implement Guided merge writers.

---

## 5. Published immutability

| Route / function | Gate |
|---|---|
| `updateVirtualPatientDraft` | Existing draft\|testing check (unchanged semantics) |
| `PATCH /api/admin/avatars/[id]/voice` | `assertAvatarContentMutable` → 409 if published/archived |
| `saveHumanPersonalityProfile` | `assertAvatarContentMutable` → 409; API maps status |
| `admin_update_virtual_patient` RPC | Already refuses published/archived |

UI redirects published/archived away from `/edit` to detail; **server gates are authoritative**.

---

## 6. Tests

| Suite | Coverage |
|---|---|
| `edit-integrity.test.ts` | Payload omit/preserve, lifecycle gate, personality refuse published, partial update |
| `persist.test.ts` | Existing lifecycle/immutability (still green) |
| `architecture.test.ts` | Voice/personality gates, no wipe default, edit page wiring, no Guided Edit |

Security regression: existing Phase 8 architecture + HMAC/MFA/AAL2 tests unchanged and must pass.

---

## 7. Security regression

- Reused `requireAdmin` / `requireApiAdmin` — no new auth model
- No MFA / AAL2 / HMAC / RLS / rate-limit / audit architecture changes
- No client secrets
- Audit events on avatar update / voice assign unchanged

---

## 8. Known limitations (later Phase 10C)

- **No Guided Edit / resume**
- Advanced symptom text remapping still uses `sx_N` ids on save (descriptions preserved; ids may change)
- No dirty-change guards / autosave / revision history
- Voice/personality panels still reachable for published patients in UI — server rejects writes
- Interaction profile remains inside `ideal_guidelines` (not a first-class column)

---

## 9. Migrations

**None.**

---

**PHASE 10C-1 COMPLETE** when CI green and this document matches the shipped branch.

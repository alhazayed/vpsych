# Phase 10C-2 — Guided Edit / Resume Existing Cases

**Phase:** 10C-2 (implementation)  
**Date (UTC):** 2026-09-27  
**Baseline:** Phase 10C-1 production CLEAR (`b2ef8a7`); Phase 10B readiness CLEAR  
**Production security (Phase 8):** MFA / AAL2 / HMAC / RLS / authorization / rate limiting / audit logging — **UNCHANGED**  
**Scope:** Guided Edit for existing fictional Virtual Patients with **merge-only** persistence.  
**Explicitly out of scope:** Autosave, revision history, automatic merge/deploy, new migrations (none required).

---

## 1. Architecture

| Layer | Responsibility |
|---|---|
| `avatarToGuidedDraft` | Map persisted avatar (+ persona) → `GuidedCaseDraft` without inventing clinical content |
| `change-tracking` | Field-level UNCHANGED / CHANGED / AI-SUGGESTED / USER-APPROVED |
| `buildGuidedMergeWriteInput` | Build **partial** `VirtualPatientWriteInput` from approved diffs only |
| `GET/PATCH /api/admin/case-builder/[id]` | Load Guided draft; merge-save via existing `updateVirtualPatientDraft` |
| `GuidedCaseBuilder` `mode: "edit"` | Same builder as CREATE; Review Changes + Save steps |
| `EditPatientModeSwitch` | Guided (default) ↔ Advanced with dirty confirmation |

**Invariant:** Guided Edit must **merge**. It must not reconstruct and overwrite the entire Virtual Patient. Only administrator-approved field changes are written.

Persistence reuses Phase 10C-1 key-presence semantics on `admin_update_virtual_patient` via `buildRpcPayload(..., "update")`. No second persistence engine.

---

## 2. Data merge model

1. Server loads existing avatar (authoritative baseline).
2. Client sends current Guided draft + approvals + `approvedFields` + `confirmReview: true`.
3. Server recomputes baseline with `avatarToGuidedDraft`.
4. `buildGuidedMergeWriteInput` includes **only** approved+changed fields in the partial write input.
5. Nested objects (`clinical_core`, `ideal_guidelines`, `personalities`) are cloned from existing then patched — omitted top-level keys stay untouched in Postgres.
6. `human_personality` and `rubric` are never sent by Guided Edit (preserved by omission).
7. No-op (zero approved fields) returns success without calling the update RPC.

---

## 3. Change tracking

Editable fields: `presentation`, `profile`, `goals`, `symptoms`, `framework`, `interaction`, `voice`, `severity`, `riskProfile`, `disclosureRules`, `context`.

| Status | Meaning |
|---|---|
| UNCHANGED | Diff equal to baseline |
| CHANGED | Administrator edited locally |
| AI-SUGGESTED | AI proposal pending approve/reject (not yet in case) |
| USER-APPROVED | Explicitly approved for merge save |

Review Changes table shows Field / Current / New / Source. Source is `Administrator` or `AI suggestion approved by administrator`.

---

## 4. AI suggestion model

- AI is advisory only (`/api/admin/case-builder/generate` unchanged).
- UI shows CURRENT vs SUGGESTED with Approve / Reject.
- Rejected suggestions never enter the draft or the merge payload.
- Approved suggestions mark the field `user_approved` with source `ai_suggestion_approved`.
- AI never writes the case, never auto-publishes, never silently replaces authored content.

---

## 5. Arabic preservation

Hard requirement:

- If Arabic is **authored**, English Guided Edit copies existing `ar-JO` unchanged into any personalities payload (or omits personalities when EN is untouched).
- If Arabic is a **stub** (`مسودة عربية` / independent-authoring prompt), stub remains stub.
- If Arabic is **missing**, it stays missing unless the administrator authors Arabic elsewhere (Advanced).
- English edits never auto-generate Arabic or replace authored Arabic with translation.

`detectArabicAuthorship` → `missing` | `stub` | `authored`.

---

## 6. Lifecycle behavior

| Status | Guided Edit |
|---|---|
| draft | Editable |
| testing | Editable |
| published | Immutable (409); Duplicate → New Draft |
| archived | Immutable (409); Restore → draft first |

Server gate: `assertAvatarContentMutable` on PATCH. Edit page redirects non-editable lifecycles to detail.

---

## 7. Readiness integration

After save (and on load), readiness uses Phase 10B:

`assessCaseReadinessFromAvatar` → `assessCaseReadiness` → `assessPublishReadiness`

Statuses: COMPLETE / WARNING / BLOCKED with existing blocker explanations. No second readiness engine.

---

## 8. Dirty state & Advanced ↔ Guided

- `beforeunload` when Guided draft is dirty.
- Cancel / leave links confirm discard.
- Guided → Advanced and Advanced → Guided require confirmation when unsaved work may be lost.
- No autosave.

---

## 9. Security

Unchanged Phase 8 controls:

- `requireApiAdmin` (MFA / AAL2 when enforced)
- Rate limiting on GET/PATCH case-builder
- Lifecycle immutability
- Audit: `admin.case_builder.update` with applied fields + change sources
- No browser secrets; AI credentials remain server-only
- HMAC / RLS / report signing not modified

---

## 10. APIs

| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/case-builder/[id]` | Guided load + readiness |
| PATCH | `/api/admin/case-builder/[id]` | Merge-only save (`confirmReview` required) |
| PATCH | `/api/admin/avatars/[id]` | Unchanged Advanced path |

---

## 11. Migrations

**None.** Application-level merge semantics only.

---

## 12. Test coverage (A–T)

Suite: `src/lib/admin/case-builder/guided-edit.test.ts` (+ architecture wiring).

| ID | Coverage |
|---|---|
| A | Existing → Guided load |
| B | No-op save |
| C | One-field edit |
| D | Multi-field edit |
| E | ideal_guidelines preservation |
| F | clinical_core / case_file preservation |
| G | human_personality omission |
| H | Authored Arabic preservation |
| I | Arabic stub preservation |
| J | AI rejected → no change |
| K | AI approved → only that field |
| L/M | Published/archived immutable |
| N | Unsupported presentation rejected |
| O | Readiness reuse |
| P | No duplicate avatar |
| Q | Dirty / review helpers |
| R/S/T | Auth, MFA wiring, HMAC/RLS regression via architecture |

---

## 13. Known limitations

- Context narrative is not fully reverse-mapped from existing persona prompts (loads empty; new context appends a marked EN section only when approved).
- Comorbidity authoring remains Case Engine / Advanced surfaces; Guided Edit does not invent comorbidity UI.
- Advanced wizard dirty state is confirmed on switch but not fully mirrored into Guided draft.
- No autosave / revision history (deferred).

---

## 14. Production verification (manual, after deploy — do not auto-deploy)

1. Open a **draft** training patient → Continue authoring → confirm **EDITING EXISTING CASE**.
2. Change one symptom → Review Changes → approve → Save → confirm only that field changed in Advanced/detail.
3. Confirm Arabic stub/authored unchanged after English profile edit.
4. Reject an AI symptom suggestion → Save → no symptom change.
5. Open a **published** patient → Guided Edit unavailable / PATCH 409; Duplicate → New Draft works.
6. Confirm readiness panel updates after save (COMPLETE / WARNING / BLOCKED).

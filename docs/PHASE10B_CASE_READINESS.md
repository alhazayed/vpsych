# Phase 10B — Admin Case Lifecycle & Readiness

**Phase:** 10B  
**Date (UTC):** 2026-09-26  
**Baseline:** `main` (Phase 10A audit merged)  
**Branch:** `cursor/phase10b-case-readiness-fc9c`  
**Status:** Implementation complete — awaiting review (do not merge automatically; do not start 10C)

---

## Goal

A non-technical administrator must understand, for any Virtual Patient:

1. What lifecycle state it is in (`draft` / `testing` / `published` / `archived`)
2. What is missing
3. What must be completed next
4. Why Preview / Test / Publish is unavailable
5. What action moves the case forward

---

## Readiness model

**Module:** `src/lib/admin/virtual-patient/readiness.ts`  
**API:** `GET /api/admin/avatars/[id]/readiness` (admin + rate-limited)

`assessCaseReadiness(input, publishContext, options)` returns a single
server-authoritative `CaseReadinessResult`:

| Field | Meaning |
|---|---|
| `lifecycleStatus` | Canonical lifecycle (unchanged semantics) |
| `readyToPublish` | Gates pass **and** lifecycle is `draft` or `testing` |
| `publishGatesPassed` | Content/schema gates pass (ignores lifecycle) |
| `overallStatus` | `COMPLETE` \| `WARNING` \| `BLOCKED` |
| `summary` | `READY TO PUBLISH` / `NOT READY TO PUBLISH` / `PUBLISHED` / `ARCHIVED` |
| `nextAction` | Human-readable next step |
| `items[]` | Section checklist |
| `publishBlockers[]` | Why Publish is unavailable |
| `arabicAuthorship` | `complete` \| `stub` \| `missing` \| `incomplete` |

Each item:

- `status`: `COMPLETE` | `WARNING` | `BLOCKED`
- `label`, `explanation` (educator-facing; no stack/DB detail)
- optional `remediation` / `action` (focus hint)

### Sections

| Id | Maps from |
|---|---|
| `clinical_presentation` | disorder + default disorder linkage |
| `patient_profile` | age, gender |
| `symptoms` | `clinical_core.symptom_profile` |
| `session_goals` | `clinical_core.session_goals` |
| `therapeutic_framework` | `clinical_core.ideal_approach` |
| `english_personality` | `personality_en` + `human_personality_en` gates |
| `arabic_personality` | `personality_ar` + `human_personality_ar` + stub |
| `voice` | voice gate |
| `preview` | schema_version ≥ 2 + structure ready for resolve |
| `validation` | identity / disorder / runtime / schema |
| `safety` | risk_profile + disclosure_rules |

---

## Authoritative validators (do not fork)

Readiness **consumes** — it does not replace:

| Function | Role |
|---|---|
| `assessPublishReadiness` | Publish content gates |
| `validateVirtualPatientWrite` | Draft vs publish mode |
| `assessDraftWrite` | Draft save + publish-gate projection |
| `isArabicPersonalityStub` | Guided Arabic stub detection (shared) |
| `publishVirtualPatient` | Lifecycle + schema_version + gates (server authz) |

Soft library completeness (`assessVirtualPatientCompleteness`) is **not** the
publish/readiness authority. Detail overview now shows Case Readiness instead of
the soft “Ready” badge as the primary signal.

---

## Lifecycle semantics (unchanged)

```
draft → testing | published | archived
testing → draft | published | archived
published → archived
archived → draft
```

- Therapist visibility only when `published` (`is_active` projection).
- Readiness messaging overlays lifecycle; it does **not** change the transition graph.
- Published / archived cases are never `readyToPublish`.

---

## Publish gates

Publish remains **server-side** (`POST …/publish` → `publishVirtualPatient`):

1. Lifecycle allows `→ published`
2. `assessPublishReadiness` has zero **error** issues
3. `schema_version >= 2`
4. Arabic is not a Guided stub (`personality_ar_stub`)

UI behavior (Detail):

- When blocked: Publish control disabled **and** “Publish unavailable” lists blockers + Review readiness
- When ready: “Ready to publish” + enabled Publish

Readiness is never a client authorization mechanism.

---

## Arabic requirement

Invariant preserved and strengthened for Guided stubs:

- English AI generation / Guided create **must not** make Arabic authoritative.
- Guided `map-to-write` still writes `مسودة عربية` stub content.
- Stub markers (`مسودة عربية` in display name, or finish-independently prompt text)
  emit `personality_ar_stub` on publish validation.
- Readiness shows Arabic as **BLOCKED** with `arabicAuthorship: "stub"` until
  independently authored content satisfies the same publish criteria.

---

## UI surfaces (one result)

| Surface | Source |
|---|---|
| Virtual Patient detail overview | Server-computed `initialReadiness` + refresh via GET readiness |
| Publish callout | Same `CaseReadinessResult` |
| Guided Mode create step (after draft create) | Same GET `/readiness` by avatar id |

Component: `CaseReadinessPanel` / `PublishReadinessCallout`  
i18n: `admin.avatars.readiness.*` (EN + AR), lifecycle `publishBlockedHint`

Accessibility: status glyphs + text (not color-only), `role="status"` / `aria-live`,
focusable readiness heading, keyboard-operable Review control, RTL via existing locale.

---

## Security boundary

Preserved (Phase 8 frozen):

- MFA / AAL2 admin gate
- RLS
- `requireApiAdmin` on readiness route
- Rate limiting
- Audit logging on publish
- HMAC report/message paths untouched
- `clientSafeError` — no raw provider/DB detail in readiness explanations

---

## Test coverage

`src/lib/admin/virtual-patient/readiness.test.ts` (+ stub case in `virtual-patient.test.ts`):

- complete draft → ready to publish
- missing symptoms / goals / framework
- missing English personality
- missing Arabic / Arabic stub
- failed preview validation (`schema_version < 2`)
- ready-to-publish case
- archived / published lifecycle
- alignment with `assessPublishReadiness`
- no raw implementation errors in explanations

Also run existing MFA/HMAC regression suites and full CI gates.

---

## Out of scope (explicit STOP)

- No new clinical diagnoses or comorbidity rules
- No new AI providers
- No Phase 8 security changes
- No full admin dashboard redesign
- No edit-by-id / Guided resume (10C+)
- No case variations
- Do not start Phase 10C in this branch

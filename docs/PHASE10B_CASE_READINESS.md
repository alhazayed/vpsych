# Phase 10B — Admin Case Lifecycle & Readiness

**Phase:** 10B  
**Date (UTC):** 2026-09-26  
**Baseline:** `main`  
**PR:** [#248](https://github.com/alhazayed/vpsych/pull/248) — **MERGED**  
**Merge commit:** `8ea204e9ea33a34fde6c2cacee76c5c319b8d6c0`  
**Production verification status:** **CLEAR**

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

---

## Production verification (final — 2026-09-26)

**Decision: CLEAR**  
Host: `https://vpsych.vercel.app`  
All probes below hit production (`x-vercel-id` recorded in evidence). Earlier CONDITIONAL record (pre-merge) is superseded.

### 1. Deployment

| Field | Value |
|---|---|
| Deployment ID | `dpl_Ezpst552MBW9ETDFp1TLwnA5z2GR` |
| State | **READY** |
| Production commit | `8ea204e9ea33a34fde6c2cacee76c5c319b8d6c0` |
| Subject | Merge pull request **#248** — Phase 10B Case Readiness |
| Alias | `vpsych.vercel.app` |
| `/api/health` | **200** `{ ok: true, service: "vpsych", version: "1.0.0-rc.1", certId: "VPSYCH-1.0-RC1-STAGE12" }` |

### 2. Authorization matrix (production)

| Identity | `GET …/readiness` | Result |
|---|---|---|
| Logged out | 401 `Unauthorized` | **PASS** |
| Therapist (non-admin) | 403 `Forbidden` | **PASS** |
| Admin AAL1 | 403 `MFA_REQUIRED` | **PASS** |
| Admin AAL2 | 200 + readiness payload | **PASS** |

### 3. Readiness API (production AAL2)

| Lifecycle | Summary | Notes |
|---|---|---|
| Draft | `NOT READY TO PUBLISH` | Statuses ∈ {COMPLETE, WARNING, BLOCKED}; no internal leak |
| Testing | `NOT READY TO PUBLISH` | Includes **BLOCKED** clinical sections |
| Published | `PUBLISHED` | `readyToPublish: false` |
| Archived | — | No archived corpus row; unit tests cover ARCHIVED |

### 4. Guided Builder ↔ Detail parity (production)

Created fictional draft `phase10b-prod-muik2a5i` (`4ad06d1c-…`):

| Check | Result |
|---|---|
| Create | **200**, lifecycle `draft`, `is_active: false` |
| Double `GET /readiness` | **identical** |
| Detail UI Case Readiness panel | **renders** (`#case-readiness-heading` / `#case-readiness-panel`) |
| UI shows | NOT READY TO PUBLISH; Arabic **Blocked** (draft stub) |

### 5. Arabic boundary + publish gate (production)

| Check | Result |
|---|---|
| AR name contains `مسودة عربية` | **PASS** |
| `personality_ar_stub` | **PASS** |
| Arabic section status | **BLOCKED** |
| `POST …/publish` | **400** codes include `personality_ar_stub` |
| EN auto-completes AR | **not observed** |

### 6. Lifecycle

Draft / testing / published summaries correct; semantics unchanged. Guided create lands as **DRAFT** / inactive.

### 7. Phase 8 security regression

| Suite | Result |
|---|---|
| `admin-mfa.test.ts` | **PASS** (13) |
| `report-sign.test.ts` | **PASS** (17) |
| `supabase/admin.test.ts` | **PASS** (7) |
| `architecture.test.ts` | **PASS** (55) |

No browser secrets; MFA / AAL2 / HMAC / RLS / rate-limit / audit untouched by this verification (docs-only).

### 8. Automated gates (`main` @ `8ea204e`)

| Gate | Result |
|---|---|
| `npm test` | **1000 passed / 106 files** |
| `npm run lint` | **0 errors** (13 pre-existing warnings) |
| `npm run typecheck` | **PASS** |
| `npm run build` | **PASS** (`/api/admin/avatars/[id]/readiness` present) |

Evidence: `/opt/cursor/artifacts/phase10b-final-prod-evidence.json`, `phase10b-final-ui-evidence.json`, `phase10b-prod-case-readiness.png`.

### CLEAR checklist

| Requirement | Status |
|---|---|
| production contains merged #248 | **YES** (`8ea204e`) |
| deployment READY | **YES** |
| health 200 | **YES** |
| auth matrix passes | **YES** |
| readiness API passes | **YES** |
| Guided/detail readiness agrees | **YES** |
| Arabic stub protection passes | **YES** |
| publish gate remains server-side | **YES** |
| lifecycle unchanged | **YES** |
| MFA/HMAC/RLS unchanged | **YES** |
| tests/lint/typecheck/build pass | **YES** |

**STOP.** Do not begin Phase 10C.

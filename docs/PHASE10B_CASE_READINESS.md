# Phase 10B — Admin Case Lifecycle & Readiness

**Phase:** 10B  
**Date (UTC):** 2026-09-26  
**Baseline:** `main` (Phase 10A audit merged)  
**Branch:** `cursor/phase10b-case-readiness-fc9c`  
**PR:** [#248](https://github.com/alhazayed/vpsych/pull/248) — **OPEN / UNMERGED**  
**Feature tip:** `551a765f73f8f59058267094efcea0615a16d089`  
**Verification status:** **CONDITIONAL** (preview + local AAL2 verified; production alias still on Phase 10A)

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

## Production verification (2026-09-26)

**Decision: CONDITIONAL**  
PR #248 is **not merged**. Production alias still runs Phase 10A. Phase 10B behavior was verified on the READY preview + local `next start` of tip `551a765` against production Supabase (same pattern as Phase 9).

### 1. Deployment

| Surface | Deployment ID | Commit | State | `/api/health` |
|---|---|---|---|---|
| **Production** `vpsych.vercel.app` | `dpl_32qLZ6GghiRUrkkrnjS5CvfsdkK7` | `ac17e717b628848a5498dcddc8ea3aaca051ea28` (PR #247 / Phase 10A) | READY | **200** `{ ok: true, service: "vpsych", version: "1.0.0-rc.1", certId: "VPSYCH-1.0-RC1-STAGE12" }` |
| **Preview** (PR #248) | `dpl_CLePz1zJ3fgnX7NJQLxqahbSa9bG` | `551a765f73f8f59058267094efcea0615a16d089` | READY | **200** same payload |
| Local verify host | `127.0.0.1:3010` (`next start`, tip `551a765`) | `551a765` | READY | **200** |

Production does **not** yet serve the Phase 10B merge commit. Logged-out `GET /api/admin/avatars/…/readiness` on production returns **401** via the admin middleware gate (route handler itself lands only after merge).

### 2. Authorization matrix (local tip = Phase 10B binary)

| Identity | `GET …/readiness` | Result |
|---|---|---|
| Logged out | 401 `Unauthorized` | **PASS** |
| Therapist (non-admin) | 403 `Forbidden` | **PASS** |
| Admin AAL1 | 403 `MFA_REQUIRED` | **PASS** |
| Admin AAL2 | 200 + readiness payload | **PASS** |

Readiness is not a client authorization bypass — publish still requires server-side `publishVirtualPatient` gates.

### 3. Readiness API samples (AAL2)

| Lifecycle sample | Summary | Notes |
|---|---|---|
| Draft `casey-park-muifpsih-psnx` | `NOT READY TO PUBLISH` | Blockers include `personality_ar_stub` + voice; statuses ∈ {COMPLETE, WARNING, BLOCKED}; no internal leak |
| Testing `imad` | `NOT READY TO PUBLISH` | Symptoms **BLOCKED** (“At least one symptom is required.”) |
| Published `jordan-hale` | `PUBLISHED` | `readyToPublish: false` |
| Archived | — | **No archived row in corpus at verify time** (unit tests cover ARCHIVED summary) |

### 4. Guided Builder ↔ Detail agreement

Created fictional draft via Guided create API (`phase10b-verify-muiisw4k` / `0f0c46e7-…`):

| Check | Result |
|---|---|
| Create | **200**, lifecycle `draft`, `is_active: false` |
| AR display name | `… (مسودة عربية)` |
| Double `GET /readiness` | **identical** payloads (`readinessAgree: true`) |
| `arabicAuthorship` | `stub` |
| Issue codes | includes `personality_ar_stub` |
| Arabic section | **BLOCKED** — “Arabic authoring is incomplete (draft stub).” |
| `readyToPublish` | `false` |

Same endpoint powers Guided end + Detail — one authoritative result.

### 5. Arabic boundary + publish gate

| Check | Result |
|---|---|
| EN personality present / AR stub | **PASS** (`مسودة عربية`) |
| `personality_ar_stub` on readiness | **PASS** |
| `POST …/publish` with stub | **400** with `personality_ar_stub` (server-side) |
| EN completion auto-completes AR | **not observed** |

### 6. Lifecycle semantics

Draft / testing / published badges and summaries observed as above. Transition graph not altered. No archived corpus row for live badge check; pure lifecycle helpers + readiness unit tests remain green.

### 7. Phase 8 security regression

| Suite | Result |
|---|---|
| `admin-mfa.test.ts` | **PASS** (13) |
| `report-sign.test.ts` (HMAC) | **PASS** (17) |
| `supabase/admin.test.ts` (HMAC helpers) | **PASS** (7) |
| `architecture.test.ts` (incl. Phase 10B readiness route guard) | **PASS** (55) |

MFA / AAL2 / HMAC / RLS / rate-limit / audit paths unchanged by this verification (docs-only commit).

### 8. Automated gates (tip `551a765`)

| Gate | Result |
|---|---|
| `npm test` | **1000 passed / 106 files** |
| `npm run lint` | **0 errors** (13 pre-existing warnings) |
| `npm run typecheck` | **PASS** |
| `npm run build` | **PASS** (includes `/api/admin/avatars/[id]/readiness`) |

Machine evidence: `/opt/cursor/artifacts/phase10b-prod-verify-evidence.json`, `phase10b-guided-followup.json`, `phase10b-prod-verify.log`.

### CLEAR checklist

| Requirement | Status |
|---|---|
| production deployment verified on Phase 10B tip | **NO** — PR #248 unmerged; prod = `ac17e71` |
| health 200 | **YES** (prod + preview + local) |
| authentication matrix passes | **YES** (local tip) |
| readiness API verified | **YES** |
| Guided / detail readiness agree | **YES** |
| Arabic independence preserved | **YES** |
| publish blockers understandable | **YES** |
| publish gate server-authoritative | **YES** |
| lifecycle semantics intact | **YES** (archived live sample absent) |
| Phase 8 security regression passes | **YES** |
| tests / lint / typecheck / build pass | **YES** |

### Why CONDITIONAL (not CLEAR / BLOCKED)

- Feature behavior and security gates are green on the Phase 10B tip.
- **CLEAR is blocked solely by missing production deploy of PR #248.**
- No functional defect found that would warrant **BLOCKED**.

**STOP.** Do not merge automatically. Do not begin Phase 10C.

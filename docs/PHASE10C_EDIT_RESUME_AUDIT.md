# Phase 10C — Edit & Resume Guided Cases (Read-Only Audit)

**Phase:** 10C (read-only)  
**Date (UTC):** 2026-09-26  
**Production commit:** `8ea204e9ea33a34fde6c2cacee76c5c319b8d6c0` (Phase 10B CLEAR, PR #248)  
**Docs tip on `main`:** `68c8771` (Phase 10B production verification CLEAR)  
**Production:** https://vpsych.vercel.app  
**Branch (this audit):** `cursor/phase10c-edit-resume-audit-fc9c`  
**Prior phases:** Phase 8 security **FROZEN** · Phase 9 Guided AI Case Builder **CLEAR** · Phase 10B Case Readiness **CLEAR**  
**Scope:** Forensic read-only inspection of the existing Virtual Patient editing architecture.  
**Final status:** **AUDIT COMPLETE**

**This phase did not:**

- modify application code  
- create migrations or change schema  
- change APIs, MFA, HMAC, RLS, or auth  
- add AI functionality or clinical rules  
- change publish requirements  
- implement Edit/Resume Guided Cases  

---

## 1. Executive summary

There is **no Guided edit/resume workflow** in production today.

| Path | Status |
|---|---|
| Guided create (`/admin/avatars/new`) | Shipped (Phase 9) |
| Advanced create (same page, mode switch) | Shipped |
| Detail inspect + lifecycle + readiness | Shipped (Phase 10B) |
| Guided edit / resume from detail | **Absent** |
| Advanced edit wired from detail | **Absent** (wizard supports `avatarId` load but is never mounted with it) |
| `/admin/avatars/[id]/edit` | **Absent** |

Future objective (not implemented):

```
Existing Case → Open → Edit with Guided Mode → modify selected sections
  → Review Changes → Save Draft → Recalculate Readiness
```

**Highest-risk finding:** Blind reuse of `guidedDraftToWriteInput` → `updateVirtualPatientDraft` on an existing case would **replace Arabic with a stub**, **regenerate human personality**, **replace clinical_core / goals / symptoms**, and **overwrite ideal_guidelines**. That path must never ship without a merge writer.

**Database changes:** Not required for a first safe Edit/Resume slice if merge semantics live in application code and existing `admin_update_virtual_patient` key-presence semantics are respected. Optional later: SQL merge helpers or autosave store.

**Phase 10C go / no-go for implementation planning:** **GO** to design against this audit. **STOP** before wiring Guided update without Arabic/HP preservation. **Do not** touch Phase 8 security controls.

---

## 2. Current edit architecture

### 2.1 Actual administrator flow (as shipped)

```
Library /admin/avatars
  ├─ Create → /admin/avatars/new
  │    └─ CreatePatientModeSwitch
  │         ├─ Guided (default) → GuidedCaseBuilder
  │         │    POST /api/admin/case-builder/create
  │         │    → createVirtualPatientDraft
  │         │    → RPC admin_create_virtual_patient
  │         │    → redirect /admin/avatars/{id}
  │         └─ Advanced → VirtualPatientWizard (no avatarId)
  │              POST /api/admin/avatars
  │              → createVirtualPatientDraft
  │
  └─ Open → /admin/avatars/[id]   (VirtualPatientDetail)
       ├─ Overview + CaseReadinessPanel (SSR assessCaseReadinessFromAvatar)
       ├─ Lifecycle: testing / publish / archive / restore / duplicate
       ├─ Preview / admin test session (lifecycle-gated)
       ├─ Links: Voices, Personality editor, Cases / Templates / Presets
       └─ NO “Edit” / “Continue authoring” / “Resume Guided”
```

### 2.2 Detail page

| Item | Location |
|---|---|
| Route | `src/app/(app)/admin/avatars/[id]/page.tsx` |
| Auth | `requireAdmin()` |
| Readiness | `assessCaseReadinessFromAvatar` → `initialReadiness` prop |
| UI | `VirtualPatientDetail.tsx` — tabs, lifecycle actions, readiness panel |
| Edit CTA | **None** |

Detail is **inspect + lifecycle + readiness**. Authoring continues only by navigating to side surfaces (voices, personality) or by creating a new patient.

### 2.3 Create page / mode switch

| Item | Location |
|---|---|
| Route | `src/app/(app)/admin/avatars/new/page.tsx` |
| Mode switch | `CreatePatientModeSwitch.tsx` |
| Guided | `GuidedCaseBuilder.tsx` — always `emptyGuidedDraft` |
| Advanced | `VirtualPatientWizard` — **no** `avatarId` prop |

Mode switch remounts the opposite tree. Client draft state is dropped with **no confirmation**.

### 2.4 Existing wizard (Advanced)

| Capability | Status |
|---|---|
| Create (`POST /api/admin/avatars`) | Used from `/new` |
| Load by id (`GET /api/admin/avatars/:id` → `applyLoadedAvatar`) | **Implemented**, unused from detail |
| Save draft (`PATCH /api/admin/avatars/:id`) | Implemented when `avatarId` set |
| Publish (`POST …/publish`) | Implemented |
| Preview (`POST …/preview`) | Implemented |

`VirtualPatientWizard` already accepts optional `avatarId` (`VirtualPatientWizard.tsx`). Wiring detail → wizard with that prop is the lowest-risk near-term Advanced edit entry — still subject to overwrite risks in §5.

### 2.5 Guided mode

| Capability | Status |
|---|---|
| Steps | presentation → profile → goals → symptoms → context → framework → interaction → generate → review → **create** |
| Final action | `POST /api/admin/case-builder/create` only |
| Update branch | **None** — post-create “save” still creates another draft |
| Reverse load | **None** — no `avatarToGuidedDraft` |
| `draft.avatarId` after create | Stored in client state; not used for PATCH |

### 2.6 Save / RPC / validation / readiness / preview / lifecycle

| Concern | Mechanism |
|---|---|
| Draft create | `createVirtualPatientDraft` → `admin_create_virtual_patient` |
| Draft update | `updateVirtualPatientDraft` → `admin_update_virtual_patient` |
| Publish | `publishVirtualPatient` → lifecycle write + gates |
| Draft validation | `assessDraftWrite` |
| Publish validation | `assessPublishReadiness` |
| Readiness (10B) | `assessCaseReadiness` / `GET /api/admin/avatars/[id]/readiness` |
| Preview | `POST /api/admin/avatars/[id]/preview` |
| Lifecycle | duplicate / testing / publish / archive / restore RPCs + routes |

PATCH strips client `lifecycle_status` / `is_active` (`[id]/route.ts`). Update RPC never publishes.

---

## 3. Data ownership map

Traced from repository. “Guided knows?” = represented in `GuidedCaseDraft` / `guidedDraftToWriteInput` today.

| Field | Authoritative source | Write path | Frontend | Validation | Guided knows? |
|---|---|---|---|---|---|
| Clinical presentation / disorder | `avatars.clinical_core.disorder` (+ flat `disorder`); catalog link `personas.default_disorder_id` | create/update RPC; Guided `presentationId` | Guided presentation; Wizard clinical; Detail read-only | `validateClinicalCore`, disorder gates | **Yes** (catalogue) |
| Symptoms | `clinical_core.symptom_profile` | RPC | Guided symptoms; Wizard text lines | Publish ≥1 | **Yes** |
| Session goals | `clinical_core.session_goals` (mirrored in `ideal_guidelines`) | RPC | Guided goals; Wizard text | Publish ≥1 | **Yes** |
| Therapeutic approach / framework | `clinical_core.ideal_approach`; Guided also `ideal_guidelines.primary_framework` / `supporting_frameworks` | RPC | Guided framework; Wizard clinical | Approach required for publish | **Partial** |
| Interaction profile | Not a first-class column; stuffed into context bits + `ideal_guidelines.communication_style` / `therapeutic_challenges` | Guided map | Guided interaction | Guided `communication_required` | **Yes** (encoded) |
| Personality EN (`personalities["en-US"]`) | `avatars.personalities` jsonb | RPC full replace when key present | Wizard EN; Guided synthesizes | `hasAuthoredPersonality` | **Yes** (synthesized) |
| Personality AR (`personalities["ar-JO"]`) | Same jsonb | RPC | Wizard AR (`dir=rtl`); Guided **stub only** | Stub + independence gates | **Stub only** |
| Human personality | `avatars.human_personality`; mirror `personas.traits` | RPC; **also** `PUT /api/admin/personality` | Wizard HP; `/admin/personality` | `validateHumanPersonality` | Synthesized on create |
| Case metadata (name, age, gender, city…) | Flat avatar columns projected from core/personalities in RPC | RPC | Guided profile; Wizard identity | Age/gender gates | **Yes** |
| Scenario configuration | Case Engine packages / templates / presets (separate admin surfaces) | Engine APIs | Detail behaviour links | Engine validators | **No** |
| Difficulty | No avatar-level difficulty field | — | Therapeutic challenge catalogue id only | — | **Indirect** |
| Voice | `avatars.voice_profile_id` (+ legacy voice ids) | RPC; **also** `PATCH …/voice` | Wizard voice; Guided default first voice; `/admin/voices` | Voice gate | Default id |
| Hidden / training info | `ideal_guidelines`; generated hidden notes folded into EN prompt/context | Guided map; Wizard **omits** guidelines | Guided generate/review | Risk/disclosure publish gates | **Partial** |
| Rubric | `avatars.rubric` | RPC | Wizard; Guided forces single alliance item | Soft | **Minimal** |
| Lifecycle | `avatars.lifecycle_status` (+ `is_active` projection) | Lifecycle routes only | Detail actions | Transition rules | **No** (create → draft) |

### Classification (ownership)

| Item | Class |
|---|---|
| Core clinical fields Guided already authors | **SAFE TO REUSE** (for create; edit needs merge) |
| Reverse map avatar → GuidedCaseDraft | **REQUIRES NEW API** (lib mapper) |
| Scenario packages as Guided edit targets | **REQUIRES CLINICAL REVIEW** |
| Voice / HP side routes vs lifecycle immutability | **REQUIRES REFACTOR** (gates) |

---

## 4. Guided Builder reuse analysis

### 4.1 Can CREATE and EDIT share the same components?

**Same step UI / catalogues / AI generate UX:** yes, after refactor.  
**Same write path (`guidedDraftToWriteInput` + create):** **no** — unsafe for edit.

### 4.2 Reusable (**SAFE TO REUSE**)

- Step UI, catalogues, contextual help (`GuidedCaseBuilder`, `catalogues.ts`)
- `validateGuidedDraft` (extend with `"update"` mode)
- AI generate route (never persists)
- Symptom suggestion accept-merge (append by id)
- Post-save readiness fetch pattern (`GET …/readiness`)
- Downstream `assessDraftWrite` / `assessCaseReadiness` stack
- Lifecycle model (duplicate published → draft; in-place draft|testing)

### 4.3 Create-only assumptions (**REQUIRES REFACTOR**)

| Assumption | Evidence |
|---|---|
| Mounted only from `/admin/avatars/new` | `CreatePatientModeSwitch` — no `avatarId` |
| Always starts from `emptyGuidedDraft` | `GuidedCaseBuilder.tsx` |
| Final step id `"create"` | `GUIDED_STEPS` in `draft.ts` |
| Only `POST …/case-builder/create` | create route |
| After create, save again creates another draft | No update branch |
| No reverse mapper | No `avatarToGuidedDraft` in repo |

### 4.4 Hard-coded defaults that would overwrite

| Default | Source | Edit risk |
|---|---|---|
| Age 28, severity moderate, empty arrays | `emptyGuidedDraft` | Would blank fields if used as load base without merge |
| AR stub (`مسودة عربية`, Amman/Jordan) | `map-to-write.ts` | **Destroys authored Arabic** |
| Synthesized `human_personality` both locales | `synthesizeHumanPersonalityFromAvatar` | **Wipes trait grid** |
| Minimal `rubric` (alliance only) | `map-to-write.ts` | Drops rich rubric |
| New `ideal_guidelines` subset | `map-to-write.ts` | Drops prior keys |
| `slugifyDisplayName` + time suffix | slug helper | Collision / identity drift |
| First voice profile | Guided init | May reassign voice |

### 4.5 Fields Guided cannot currently edit

- Independently authored Arabic personality / HP  
- Full human personality trait grid  
- Rich rubric beyond alliance  
- Case Engine scenario packages / comorbidity  
- Protective factors / MSE / formulation / case_file on `clinical_core`  
- Lifecycle / publish  
- Partial section-only save (all-or-nothing write input)

### 4.6 Verdict

| Work | Class |
|---|---|
| Reuse Guided step components for edit | **REQUIRES REFACTOR** |
| `avatarToGuidedDraft` | **REQUIRES NEW API** (lib) |
| `PATCH /api/admin/case-builder/[id]` merge writer | **REQUIRES NEW API** |
| Preserve AR / HP / rubric / guidelines | **REQUIRES REFACTOR** + **REQUIRES CLINICAL REVIEW** |
| Wire Advanced wizard from detail with `avatarId` | **SAFE TO REUSE** (path exists) |

---

## 5. Overwrite risks

**Do not fix in 10C.** Documented for implementers.

### 5.1 Highest-risk path (critical)

`updateVirtualPatientDraft(id, guidedDraftToWriteInput(draft))` on an existing case:

| Target | Effect | Severity |
|---|---|---|
| `personalities["ar-JO"]` | Replaced with Guided Arabic **stub** | **Critical** |
| `human_personality` EN+AR | Replaced by synthesis | **Critical** |
| `personalities["en-US"]` | Full regenerate from draft/AI | High |
| `clinical_core` | Full replace; drops optional CI fields absent from map | High |
| Diagnosis / DSM / ICD | Overwritten from presentation | High |
| `session_goals` / `symptom_profile` | Replaced from draft arrays | High |
| `ideal_guidelines` | Replaced with Guided subset | High |
| `rubric` | Forced to single alliance item | Medium |
| `persona.default_disorder_id` | Set from `presentationId` | High |
| Lifecycle / publish via this path | Update does **not** publish; strips lifecycle on PATCH | Safe if gates hold |
| Published / archived via update RPC | Blocked (409 / RPC exception) | Safe if gates hold |

### 5.2 Advanced wizard PATCH risks (existing)

| Path | Effect |
|---|---|
| `buildWriteInput` omits `ideal_guidelines` | `buildRpcPayload` sends `ideal_guidelines: {}` |
| RPC key presence (`p_payload ? 'ideal_guidelines'`) | **Wipes guidelines to empty object** |
| Symptom lines remapped to `sx_N` ids | Can replace authored symptom ids |
| Default rubric when empty | May shrink rubric |

### 5.3 Side-channel overwrites (bypass update RPC immutability)

| Route | Gap |
|---|---|
| `PATCH /api/admin/avatars/[id]/voice` | Direct `avatars.update` — **no** published/archived check |
| `PUT /api/admin/personality` | Updates `human_personality` — **no** lifecycle gate |

Published immutability is **not** absolute while these routes remain ungated.

### 5.4 What does **not** auto-publish

Update RPC comment and implementation: never sets `lifecycle_status='published'`. Publish is a separate endpoint. Client cannot set lifecycle on PATCH.

### Classification

| Item | Class |
|---|---|
| Guided→update merge semantics | **REQUIRES REFACTOR** |
| `buildRpcPayload` omit-null / partial keys | **REQUIRES REFACTOR** (possibly **REQUIRES DB CHANGE** if merge moves to SQL) |
| Voice/personality lifecycle gates | **REQUIRES REFACTOR** |
| Arabic preservation policy | **REQUIRES CLINICAL REVIEW** |

---

## 6. Lifecycle / edit semantics

Observed semantics — **not invented**.

| Status | In-place via `admin_update_virtual_patient`? | How to change content |
|---|---|---|
| **draft** | Yes | PATCH update |
| **testing** | Yes | PATCH update; can return to draft via lifecycle |
| **published** | **No** — immutable; “duplicate to edit” | `admin_duplicate_virtual_patient` → new **draft** |
| **archived** | **No** until restore | Restore → **draft**, then edit |

Additional facts:

- No revision / version history table — updates are **in-place** on the same `avatars.id`.  
- Editing does **not** create a temporary shadow draft or revision row.  
- Duplicate always lands `draft`.  
- Historical sessions / clinical snapshots must not be rewritten by lifecycle (existing invariant).  
- Immediate production (therapist-visible) mutation of **published** content via the main update RPC is blocked; side routes (§5.3) are the exception.

| Item | Class |
|---|---|
| Lifecycle model for Edit/Resume | **SAFE TO REUSE** |
| Resume published = duplicate then edit | **SAFE TO REUSE** (pattern) |
| Revision history | **REQUIRES DB CHANGE** (only if product requires versions — not required for 10C MVP) |

---

## 7. Unsaved-change behavior

| Event | Guided | Advanced wizard |
|---|---|---|
| Browser refresh / tab close | **No** `beforeunload` | **No** `beforeunload` |
| In-app navigation away | No guard | No guard |
| Guided ↔ Advanced mode switch | **Silent drop** of draft | Remount loses form |
| UI language (locale cookie) | Unrelated; draft is client memory | Same |
| Step / section change | No dirty flag | `patchForm` clears `draftSaved` / `publishReady` only |

Unsaved work lives only in React state until create/PATCH succeeds. There is no server autosave for Guided drafts.

| Item | Class |
|---|---|
| Dirty guards + mode-switch confirm | **REQUIRES REFACTOR** |
| Server autosave of Guided drafts | **REQUIRES NEW API** / optional **REQUIRES DB CHANGE** |

---

## 8. Readiness integration

**Invariant (Phase 10B):** one authoritative readiness system — `assessCaseReadiness` consuming `assessPublishReadiness` / `isArabicPersonalityStub`. Soft library completeness is **not** publish authorization.

| After change | Recalculation path |
|---|---|
| Symptom / goal / framework / personality / Arabic / diagnosis persist | Reload avatar → `assessCaseReadinessFromAvatar` or `GET …/readiness` |
| Detail page | SSR `initialReadiness`; `router.refresh()` after lifecycle |
| Guided post-create | Client fetch readiness once |

Edit/Resume must **not** invent a second edit-specific readiness engine. After Save Draft:

1. Persist through validated update (merge writer)  
2. Recompute with existing `assessCaseReadiness`  
3. Refresh UI panel  

| Item | Class |
|---|---|
| Reuse Phase 10B readiness | **SAFE TO REUSE** |
| Wire refresh after Guided save | **REQUIRES REFACTOR** (wiring only) |

---

## 9. AI behavior

Desired future invariant: **AI = suggestion · Administrator = approval · Server = validation**. No silent overwrite of authored content.

| AI kind | Client apply | Persist? | Publish? |
|---|---|---|---|
| Symptoms | Checkbox → **append** by id | Only on create today | No |
| Context | Sets structured context; requires approve | No until create | No |
| Framework | **Immediate replace** of primary/supporting/rationale | No until create | No |
| Case bundle | Replaces `generated`; clears approval | Only if section approved at create | No |

Additional:

- Generate API: `requireApiAdmin`, rate limit, **never writes DB**.  
- Output is English-oriented; **no Arabic AI authoring**.  
- Unapproved generated narrative is omitted at create (`validateGuidedDraft` warning).  

Edit risk if framework/case AI apply is reused without “suggest vs replace” UX: educator-approved values can be replaced in client state before save.

| Item | Class |
|---|---|
| Suggestion pipeline (no persist) | **SAFE TO REUSE** |
| Framework immediate-replace UX for edit | **REQUIRES REFACTOR** |
| Arabic AI fill | **REQUIRES CLINICAL REVIEW** (do not auto-complete AR) |

---

## 10. Arabic / RTL behavior

| Scenario | Current behavior |
|---|---|
| English existing case → Guided “edit” (hypothetical blind map) | EN regenerates; AR **re-stubbed** |
| Arabic independently authored case → blind map | **Destroyed** — replaced by stub |
| Partially authored Arabic / stub case → blind map | Stub rewritten; readiness remains blocked until independent authorship |
| Advanced wizard load | Can edit real AR with `dir=rtl` |
| UI locale cookie | Independent of patient locale authorship |

Shared detector: `isArabicPersonalityStub` (Phase 10B). Publish + readiness block stubs.

**Invariant:** English content must **not** automatically overwrite or complete Arabic content.

| Item | Class |
|---|---|
| Stub detection | **SAFE TO REUSE** |
| Guided edit must omit or preserve AR maps | **REQUIRES REFACTOR** + **REQUIRES CLINICAL REVIEW** |

---

## 11. Security considerations

Phase 8 baseline remains **FROZEN**. Edit/Resume must reuse existing controls — not bypass them.

| Control | Edit-relevant status |
|---|---|
| `requireAdmin` (pages) | Detail / new — AAL2 when MFA enforced |
| `requireApiAdmin` | Avatar + case-builder APIs — role + AAL2 |
| Edge middleware | `/admin` + `/api/admin` role check; AAL2 enforced in API/page helpers |
| RLS | Admin write on `avatars`; therapists read active |
| Update RPC | `SECURITY INVOKER` + `is_admin()`; published/archived blocked |
| Rate limits | Present on create/update/generate/validate/readiness |
| Audit | `logSecurityEvent` on create/update/generate/lifecycle |
| HMAC | Session reports only — N/A to VP authoring |
| Lifecycle strip on PATCH | Client cannot set `lifecycle_status` / `is_active` |

**Bypass / gap risks (document only):**

1. Voice + personality routes can mutate **published** rows without immutability check.  
2. Direct table update from those routes bypasses RPC key-merge discipline.  
3. No evidence of MFA bypass on API when enforcement is on.

| Item | Class |
|---|---|
| Reuse auth / AAL2 / RLS / rate limit / audit for Guided update API | **SAFE TO REUSE** |
| Lifecycle gates on voice + personality | **REQUIRES REFACTOR** (security-adjacent hardening; still no Phase 8 redesign) |
| HMAC for VP authoring | Not applicable — do not invent |

---

## 12. Recommended architecture

Future Edit/Resume (design only — **not implemented**):

```
Detail /admin/avatars/[id]
  ├─ if draft|testing → “Continue authoring”
  │    ├─ Guided mode (default for Guided-origin cases)
  │    │    GET load → avatarToGuidedDraft (preserve AR/HP/guidelines/rubric)
  │    │    section edits + AI suggestions (approve required)
  │    │    Review Changes (diff summary)
  │    │    PATCH merge writer → updateVirtualPatientDraft
  │    │    GET readiness → CaseReadinessPanel refresh
  │    └─ Advanced mode → VirtualPatientWizard avatarId={id}
  │         (fix ideal_guidelines wipe in buildRpcPayload)
  ├─ if published → Duplicate → new draft → Continue authoring
  └─ if archived → Restore → draft → Continue authoring
```

**Merge writer rules (required):**

1. Never call raw `guidedDraftToWriteInput` for update.  
2. Omit keys that Guided did not intentionally change (RPC preserves absent keys).  
3. Never write AR stub over non-stub Arabic.  
4. Never synthesize HP over existing authored HP unless admin explicitly regenerates.  
5. Preserve `ideal_guidelines` keys not owned by Guided.  
6. AI never persists; admin approval required; server validates.  
7. One readiness system: `assessCaseReadiness` after save.

**Near-term safer slice:** wire Advanced edit from detail (`avatarId`) **after** fixing `ideal_guidelines ?? {}` wipe — still not Guided Edit/Resume.

---

## 13. Required implementation phases

Proposed sequence for a future Phase 10C **implementation** program (out of scope for this audit PR):

| Step | Work | Class |
|---|---|---|
| **10C.0** | Fix Advanced `ideal_guidelines` empty wipe in `buildRpcPayload` / wizard omit | **REQUIRES REFACTOR** |
| **10C.1** | Detail “Continue authoring” → Advanced wizard with `avatarId` (draft\|testing only) | **SAFE TO REUSE** + wire |
| **10C.2** | Lifecycle gates on voice + personality routes | **REQUIRES REFACTOR** |
| **10C.3** | `avatarToGuidedDraft` reverse mapper + load API | **REQUIRES NEW API** |
| **10C.4** | Guided merge writer + `PATCH /api/admin/case-builder/[id]` | **REQUIRES NEW API** |
| **10C.5** | Guided edit UX: Review Changes, section approvals, dirty guards | **REQUIRES REFACTOR** |
| **10C.6** | AI suggest-vs-replace UX for edit (framework/case) | **REQUIRES REFACTOR** |
| **10C.7** | Arabic preservation tests + clinical review of stub policy | **REQUIRES CLINICAL REVIEW** |
| **10C.8** | Readiness refresh after Guided save (reuse 10B) | **SAFE TO REUSE** |
| **10C.9** | Optional autosave / revision history | **REQUIRES DB CHANGE** (optional; not MVP) |

**Database changes appear necessary?**  
**No for MVP Edit/Resume** if merge semantics are application-side and RPC key-presence is used correctly. **Yes only if** product requires server-side draft autosave or revision history.

---

## 14. Explicit non-goals

This audit and any subsequent 10C implementation planning must **not**:

- Redesign Phase 8 MFA / AAL2 / HMAC / RLS / audit / rate limits  
- Invent a second readiness or publish-gate engine  
- Auto-translate or auto-complete Arabic from English  
- Allow AI to persist, publish, or silently overwrite authored content  
- Mutate published cases in place (duplicate-then-edit remains the model)  
- Rewrite historical session clinical snapshots  
- Expand DSM / comorbidity clinical catalogue as part of Edit/Resume  
- Ship Guided update that calls raw `guidedDraftToWriteInput`  

---

## Appendix A — Classification legend

| Class | Meaning |
|---|---|
| **SAFE TO REUSE** | Existing code/API can support Edit/Resume with wiring only |
| **REQUIRES REFACTOR** | Existing component/path must change before safe reuse |
| **REQUIRES NEW API** | New route or lib mapper needed |
| **REQUIRES DB CHANGE** | Schema/migration (optional for MVP) |
| **REQUIRES CLINICAL REVIEW** | Educator/clinical policy decision before shipping |

## Appendix B — Key file index

| Area | Path |
|---|---|
| Detail | `src/app/(app)/admin/avatars/[id]/page.tsx`, `VirtualPatientDetail.tsx` |
| Create / modes | `admin/avatars/new/page.tsx`, `CreatePatientModeSwitch.tsx` |
| Guided UI | `GuidedCaseBuilder.tsx` |
| Guided draft / map | `src/lib/admin/case-builder/draft.ts`, `map-to-write.ts` |
| Guided create API | `src/app/api/admin/case-builder/create/route.ts` |
| Advanced wizard | `VirtualPatientWizard.tsx` |
| Persist | `src/lib/admin/virtual-patient/persist.ts` |
| Validation / stub | `validation.ts` (`isArabicPersonalityStub`) |
| Readiness | `readiness.ts`, `GET …/readiness` |
| Update RPC | `supabase/migrations/20260811084442_admin_virtual_patient_lifecycle_rpcs.sql` |
| Voice side write | `src/app/api/admin/avatars/[id]/voice/route.ts` |
| Phase 10B doc | `docs/PHASE10B_CASE_READINESS.md` |

---

**AUDIT COMPLETE**

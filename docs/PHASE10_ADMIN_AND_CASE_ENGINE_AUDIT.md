# Phase 10A — Admin UX + Case Engine Catalogue Audit

**Phase:** 10A (read-only)  
**Date (UTC):** 2026-09-26  
**App baseline:** `main` @ `7fd8202` (PR #245 comorbidity UX)  
**Docs tip on `main`:** `220c17a` (PR #246 verification record)  
**Production:** https://vpsych.vercel.app  
**Branch (this audit):** `cursor/phase10a-audit-fc9c`  
**Scope:** Forensic read-only inspection. **No application code, migrations, clinical content, or AI features changed in 10A.**  
**Final status:** **AUDIT COMPLETE**

---

## 1. Executive summary

Phase 8 security remains frozen and sufficient for Phase 10 work. Phase 9 delivered a usable Guided AI Case Builder (default on `/admin/avatars/new`) and PR #245 closed the Preview Generator comorbidity desync. Educators can create drafts, move to testing, run admin test conversations, and publish.

The largest remaining friction for a **non-technical administrator** is not security — it is **workflow continuity and false readiness**:

1. **Create ≠ Edit.** Guided Builder only authors new drafts. There is no “resume guided draft” or “edit in Guided mode” from Virtual Patient detail. Library Create is a hint shell (“Open workflow shell”), not a direct CTA.
2. **Mode switch loses work.** Guided ↔ Advanced replaces entire UI trees with independent client state; no shared draft persistence / warning.
3. **Lifecycle UX is power-user.** Publish has no confirm and can skip Testing; Duplicate uses `window.prompt`; detail publish errors are opaque (no gate checklist).
4. **Arabic stub vs “Ready”.** Guided create writes a stub AR personality (`مسودة عربية`); soft completeness can still show Ready while publish gates are stricter.
5. **Terminology / preview split.** “Virtual Patients”, “Cases”, “Templates”, “Presets” overlap; preview is fragmented (JSON / summary / `/admin/cases`).
6. **Catalogue drift.** Preview runtime trusts `BUILTIN_COMORBIDITY_RULES`; DB/migrations hold additional authored pairs and disorders not in the builtin packages. Sync is a deliberate authoring project — not an automatic merge.

**Phase 10 go / no-go:** **GO** for UX hardening + controlled catalogue reconciliation process. **STOP** before inventing comorbidity rules or DSM criterion text. **Do not** touch MFA / AAL2 / HMAC / RLS / audit / rate limits.

---

## 2. Admin workflow map

```
Admin (requireAdmin + AAL2 when enforced)
  ├─ /admin                          Overview
  ├─ /admin/content                  Content hub (metrics + library CTAs)
  ├─ /admin/avatars                  Virtual Patient library (search/filter/sort)
  │    ├─ /admin/avatars/new         CreatePatientModeSwitch
  │    │    ├─ Guided (default)      GuidedCaseBuilder
  │    │    │    catalogues  GET  /api/admin/case-builder/catalogues
  │    │    │    AI          POST /api/admin/case-builder/generate
  │    │    │    create      POST /api/admin/case-builder/create  → draft
  │    │    │    → /admin/avatars/{id}
  │    │    └─ Advanced              VirtualPatientWizard
  │    │         POST/PATCH /api/admin/avatars[/{id}] …
  │    └─ /admin/avatars/{id}        Detail + lifecycle + test
  │         lifecycle  POST …/lifecycle | publish | archive | restore | duplicate
  │         test       POST …/test-session  (requires lifecycle=testing)
  │         transcript /admin/test-sessions/{sessionId}
  ├─ /admin/cases                    Disorder list + CaseEnginePanel preview
  │                                  POST /api/admin/cases/preview
  ├─ /admin/voices | templates | presets | personality
  └─ learners / sessions / reports / analytics / …
```

**Happy path (intended educator journey):**

1. Content hub or Virtual Patients → **Create virtual patient**
2. Guided Builder steps: presentation → profile → goals → symptoms → context → framework → interaction → generate → review → create
3. Lands on detail as **draft** (`is_active=false`)
4. **Move to testing** → **Start admin test conversation**
5. **Publish** → therapist-visible (`is_active=true`)

**Deterministic case preview** (diagnosis × comorbidity × difficulty × modality × locale) lives on `/admin/cases`, not inside Guided Builder.

---

## 3. Track A — UX findings

Impact: **H** = blocks or confuses typical educators often · **M** = frequent friction · **L** = polish.

| # | Area | Current behavior | File / component | Impact | Proposed improvement | Change type |
|---|---|---|---|---|---|---|
| A1 | Navigation / create CTA | Library “Create” opens a **hint shell**; secondary link hardcodes “Open workflow shell” → `/admin/avatars/new` (extra hop) | `VirtualPatientLibrary.tsx` | H | Primary button navigates to create; tip under button; i18n the shell copy | Code + i18n |
| A2 | Terminology | “Virtual patient”, “case”, “avatar”, “training simulation”, “Phase 3B” mixed | messages + headers + `createHint` | M | Educator glossary; scrub phase labels from UI | Code + i18n |
| A3 | Guided vs Advanced | Default guided; Advanced remounts `VirtualPatientWizard`; switching **drops** in-progress draft | `CreatePatientModeSwitch.tsx` | H | Confirm before switch; optional import guided→advanced snapshot | Code |
| A4 | New case creation | Guided 10-step flow with catalogues + AI + approvals; step pills allow skip without per-step validation; “Approve all” can mark AI without generate | `GuidedCaseBuilder.tsx` | M | Gate Next with per-step validation; soft-warn Approve-all when AI not run | Code |
| A5 | Existing case editing | Detail is inspect + lifecycle; **no Guided re-entry**; wizard supports load-by-id but is unused from detail | `VirtualPatientDetail.tsx`, `VirtualPatientWizard.tsx` | H | “Continue authoring” for draft/testing → wizard or guided resume | Code (+ maybe API) |
| A6 | Resume incomplete draft | Client-only Guided state; refresh loses work; library drafts open detail not builder | `GuidedCaseBuilder.tsx`, library | H | Autosave / resume CTA; dirty guard | Code (+ optional DB) |
| A7 | Duplicate / similar | `window.prompt` for kebab slug; inaccessible | `VirtualPatientLifecycleActions.tsx` | M | Accessible modal with suggested slug + validation | Code |
| A8 | Completeness vs publish | Library “Ready” uses soft checks (EN/AR personality *presence*, voice, clinical). Stub AR + empty personality object can look complete. Publish gates (`assessPublishReadiness`) are stricter | `virtual-patient-completeness.ts`, `validation.ts`, detail/library | H | Split “draft completeness” vs “publish ready”; show gate checklist on detail | Code + i18n |
| A9 | Validation / publish errors | Guided create shows issues; detail Publish shows opaque `data.error` only (no gate list). Wizard has `ValidationPanel`; detail does not | `VirtualPatientLifecycleActions.tsx`, `persist.ts` | H | Return + render `issues`/`gates` on publish failure with step deep-links | Code |
| A10 | Preview | Guided generate shows raw JSON; detail “Preview” is static summary; live resolveAvatar preview only in Advanced; Case Engine mint preview on `/admin/cases` | `GuidedCaseBuilder.tsx`, detail, `CaseEnginePanel.tsx` | H | Unified patient preview on detail; hide JSON behind Advanced; deep-link Cases with avatar | Code |
| A11 | Testing optional | Lifecycle allows `draft` → `published` without testing; test button only in `testing` | `virtual-patient-lifecycle.ts`, lifecycle actions | H | Soft-block or strongly nudge: Testing → ≥1 admin test → Publish | Code (+ optional server policy) |
| A12 | Publishing | One-click Publish from draft/testing; **no confirm**; archive confirms | `VirtualPatientLifecycleActions.tsx` | H | Confirm + publish-ready checklist | Code |
| A13 | Search / filter | Client search + lifecycle + incomplete + sort; no pagination; content hub badges use raw `lifecycle_status` | library, `content/page.tsx` | L | i18n status; deep-link `?status=draft`; filter by presentation | Code + i18n |
| A14 | Difficulty | Case Engine panel has difficulty (raw enum tokens); Guided does not surface difficulty | `CaseEnginePanel.tsx`, Guided | M | Localized option labels; optional difficulty on Guided create | Code + i18n (+ data if persisted) |
| A15 | Scenario / session type | `caseType` fixed `training_simulation`; templates/presets separate | Guided + templates | M | Clarify Templates/Presets as instructor tools, not create path | i18n / IA |
| A16 | Contextual help | On Guided steps + Cases comorbidity; missing on lifecycle/publish; hardcoded “Close” / “Help:” | `ContextualHelp.tsx` | M | i18n Close; help on lifecycle + publish gates; focus trap | Code + i18n |
| A17 | Keyboard a11y | Step buttons OK; detail tabs lack arrow-key / `aria-controls`; no focus move on step change | Guided, detail, wizard | M | WAI-ARIA tabs; focus step heading on change | Code |
| A18 | Arabic authorship stub | Guided `map-to-write` writes AR personality as stub (`(مسودة عربية)` + finish-independently prompt). Completeness can still pass. Detail has no bilingual clinical editor | `map-to-write.ts`, Guided `createHint`, detail | H | Explicit “Complete Arabic” post-create checklist; block “publish ready” until natively authored AR | Code + validation |
| A19 | Arabic / RTL chrome | Message trees largely key-complete; many hardcodes remain (Filter/Sort, “Open workflow shell”, detail tabs, completeness reasons) | library, detail, completeness | M | Move all educator strings to `messages/{en,ar}.json` | Code + i18n |
| A20 | Empty states | Library/test empties OK; Guided catalogue fail OK | AdminUi / builder | L | Empty “no presentations” CTA | Code |
| A21 | Error states | MFA_REQUIRED mapped; guided validation messages are English API strings | `case-builder/validation.ts` | M | Issue codes → client `t()` | Code + i18n |
| A22 | Loading states | `busy` on generate/create; weak catalogue skeleton | Guided | L | Skeleton for catalogue load | Code |
| A23 | Unsaved changes | **No** `beforeunload` / dirty guard; Cancel is bare library link; “Save draft” creates DB row (easy to misread as in-place save) | Guided / Wizard | H | Dirty flag; rename Save draft vs Create; autosave after first persist | Code |
| A24 | Destructive actions | Archive: `window.confirm`; Publish/Restore/Testing: none | lifecycle actions | M | Consistent confirm dialogs; explain therapist visibility | Code |
| A25 | Accidental config loss | Mode switch / refresh / back lose Guided draft | Mode switch + no persist | H | Same as A3/A6/A23 | Code |

### Track A — strengths (keep)

- Lifecycle graph is clear: `draft → testing | published | archived` with therapist visibility only when published (`virtual-patient-lifecycle.ts`).
- Library search/filter/incomplete sorting is already educator-friendly.
- Guided catalogues avoid free-text DSM dumps; fictional banner + approvals exist.
- Admin test conversation is correctly gated to `testing` and isolated via snapshot marker.
- Cases comorbidity UX (PR #245) prevents silent invalid previews.
- EN/AR key trees for `admin.caseBuilder` / `admin.avatars` / `admin.cases` are structurally in sync (hardcodes are the gap).
- `ContextualHelp` is click/focus/Escape (not hover-only).

### Track A — supplemental deep-dive

Additional forensic detail from the [Admin educator UX audit](bc-c52b94a0-59cd-5a16-b299-4a6e8b91d9d7) pass (incorporated above; no code changes).

---

## 4. Track B — Case Engine catalogue findings

### 4.1 Sources of truth (do not fork)

| Concern | Preview / Guided runtime | DB / migrations |
|---|---|---|
| Disorder packages for generation | `BUILTIN_DISORDERS` (`catalog.ts`) | `public.disorders` |
| Comorbidity rules for generation | `BUILTIN_COMORBIDITY_RULES` | `public.comorbidity_rules` |
| Preview API | `getBuiltinCatalog()` only | not loaded |
| UI comorbidity options | `listCompatibleComorbiditySlugs()` over builtin | — |
| Guided presentations | builtin active packages via catalogues | — |

**Invariant:** Preview Generator and Case Engine generation must not invent a second matrix. Reconciliation means aligning builtin ↔ migration intentionally.

### 4.2 Builtin matrix (runtime SUPPORTED surface)

17 rules in `BUILTIN_COMORBIDITY_RULES` (11 active disorder packages).

| Primary | Comorbid | Tier | Runtime |
|---|---|---|---|
| mdd-recurrent-moderate | gad-with-panic | compatible | SUPPORTED |
| gad-with-panic | mdd-recurrent-moderate | compatible | SUPPORTED |
| ptsd | mdd-recurrent-moderate | compatible | SUPPORTED |
| mdd-recurrent-moderate | ptsd | compatible | SUPPORTED |
| adult-adhd | gad-with-panic | compatible | SUPPORTED |
| gad-with-panic | adult-adhd | compatible | SUPPORTED |
| ptsd | alcohol-use-disorder | compatible | SUPPORTED |
| mdd-recurrent-moderate | alcohol-use-disorder | possible | SUPPORTED |
| gad-with-panic | alcohol-use-disorder | possible | SUPPORTED |
| alcohol-use-disorder | gad-with-panic | possible | SUPPORTED |
| mdd-recurrent-moderate | panic-disorder | compatible | SUPPORTED |
| mdd-recurrent-moderate | bpd | possible | SUPPORTED |
| mdd-recurrent-moderate | bipolar-mania | impossible | UNSUPPORTED (explicit) |
| schizophrenia | gad-with-panic | compatible | SUPPORTED |
| schizophrenia | delirium | impossible | UNSUPPORTED (explicit) |
| bpd | mdd-recurrent-moderate | compatible | SUPPORTED |
| adult-adhd | ptsd | impossible | UNSUPPORTED (explicit) |

UI exposes rules with `compatible === true` and `tier !== "impossible"` (compatible **and** possible). API rejects unlisted / impossible / unknown.

**Counts:** builtin disorders 11 · migration disorders 17 · builtin rules 17 · migration rules (effective) 28 · exact both 14 · tier drift 1 · migration-only 13 · builtin-only 2 · orphan `DISORDER_IDS` 6 · duplicate keys 0 · UI-previewable comorbidity pairs 14 · **OBSOLETE:** none.

### 4.3 Shared pairs with tier drift

| Primary | Comorbid | Migration (effective) | Builtin | Classification |
|---|---|---|---|---|
| mdd-recurrent-moderate | alcohol-use-disorder | compatible=true, tier=**compatible** | compatible=true, tier=**possible** | **REQUIRES REVIEW** |

### 4.4 Migration-only pairs (in SQL seeds, not in builtin)

Both disorders already in `BUILTIN_DISORDERS` — Preview today → `comorbidity_unlisted`. Promoting into builtin requires a deliberate simulation authoring pass (do not auto-sync):

| Primary | Comorbid | Migration tier | Classification |
|---|---|---|---|
| complex-ptsd | mdd-recurrent-moderate | compatible | **NEEDS AUTHORING** |
| complex-ptsd | alcohol-use-disorder | possible | **NEEDS AUTHORING** |
| ptsd | bpd | possible | **NEEDS AUTHORING** |
| bpd | ptsd | possible | **NEEDS AUTHORING** |
| bpd | alcohol-use-disorder | possible | **NEEDS AUTHORING** |
| schizophrenia | mdd-recurrent-moderate | possible | **NEEDS AUTHORING** |
| adult-adhd | mdd-recurrent-moderate | compatible | **NEEDS AUTHORING** |
| bipolar-mania | mdd-recurrent-moderate | impossible | **REQUIRES REVIEW** (mirror explicit reject into builtin) |

Touches migration-only / orphan disorder packages:

| Primary | Comorbid | Migration tier | Classification |
|---|---|---|---|
| mdd-recurrent-moderate | social-anxiety | compatible | **NEEDS AUTHORING** |
| mdd-recurrent-moderate | ocd | possible | **NEEDS AUTHORING** |
| adult-adhd | social-anxiety | possible | **NEEDS AUTHORING** |
| eating-disorders | mdd-recurrent-moderate | compatible | **NEEDS AUTHORING** |
| eating-disorders | gad-with-panic | possible | **NEEDS AUTHORING** |

No rule in either catalogue: **`bipolar-mania` + `complex-ptsd`** → **NEEDS AUTHORING**.

### 4.5 Builtin-only pairs (Preview SUPPORTED; DB lag)

| Primary | Comorbid | Classification |
|---|---|---|
| gad-with-panic | alcohol-use-disorder | **SUPPORTED** (Preview) + **REQUIRES REVIEW** (DB parity) |
| alcohol-use-disorder | gad-with-panic | **SUPPORTED** (Preview) + **REQUIRES REVIEW** (DB parity) |

### 4.6 Orphan `DISORDER_IDS` / migration-only packages

| ID key | Migration slug | Mig comorbidity rules? | Classification |
|---|---|---|---|
| pdd | pdd | no | **NEEDS AUTHORING** |
| socialAnxiety | social-anxiety | yes (comorbid) | **NEEDS AUTHORING** |
| ocd | ocd | yes (comorbid) | **NEEDS AUTHORING** |
| asd | asd | no | **NEEDS AUTHORING** |
| schizoaffective | schizoaffective | no | **NEEDS AUTHORING** |
| eating | eating-disorders | yes (primary) | **NEEDS AUTHORING** (+ key↔slug **REQUIRES REVIEW**) |

All 11 builtin disorders are migration-seeded (no builtin-only disorders).

### 4.7 Code / label mismatches (REQUIRES REVIEW)

| Slug | Field | Migration | Builtin |
|---|---|---|---|
| complex-ptsd | dsm5_code | `309.81` | `null` (ICD-11-only intent) |
| complex-ptsd | icd10_code | `F43.1` | `null` |
| complex-ptsd | severity_default | severe | moderate |
| bpd | icd11_code | `6D10.0` | `6D10.1/6D11.5` |
| bipolar-mania | icd11_code | `6A60.1` | `6A60.2` |
| eating | ID key vs slug | slug `eating-disorders` | key `eating` |

Duplicates: **0** in builtin and migration effective unique keys. Orphan rule IDs in builtin: **0**.

### 4.8 Exposure surfaces

| Surface | Combinations |
|---|---|
| UI comorbidity dropdown | Per-primary allow-list from `listCompatibleComorbiditySlugs` (e.g. MDD → AUD, BPD, GAD, panic, PTSD; bipolar/complex-ptsd/panic/delirium → empty) |
| Preview API | Builtin only; unknown slug → `unknown_disorder`; unlisted → `comorbidity_unlisted`; explicit block → `comorbidity_incompatible` |
| Runtime generation | Same validator inside `generateCaseInstance` |
| DB disorders list on `/admin/cases` | May list up to 17 DB actives; Preview primary select is builtin-filtered (11) |

### 4.9 Supplemental deep-dive

Full pair-by-pair tables from the [Case Engine catalogue reconciliation](bc-d7fd34eb-f74f-5a29-8161-07b4f02c8240) pass (incorporated above; no code or clinical inventing).

---

## 5. Security constraints

Phase 10 **must not** modify:

| Control | Status | Evidence |
|---|---|---|
| MFA / AAL2 | Frozen | `admin-mfa.ts`, `requireApiAdmin` on case-builder + cases preview |
| HMAC message signing | Frozen | Phase 8.2 migrations + `report-sign` tests |
| RLS | Frozen | Virtual Patient RPCs SECURITY DEFINER; no Phase 10 schema plan |
| Authorization | Frozen | Admin role in `profiles.role` |
| Rate limiting | Frozen | Present on case-builder + preview routes |
| Audit logging | Frozen | `logSecurityEvent` on generate/create |
| Secrets handling | Frozen | No client exposure of provider/DB detail |

**Phase 10 requirement check:** No Track A/B item requires weakening these controls. UX persistence and catalogue sync stay within existing admin auth envelopes.

---

## 6. Recommended Phase 10 workstreams

| ID | Workstream | Goal |
|---|---|---|
| **10B** | Guided draft continuity | Direct create CTA; autosave / resume / edit-from-detail; dirty guards; mode-switch confirm; rename Save draft vs Create |
| **10C** | Lifecycle + publish readiness | Publish confirm; surface publish gates on detail; soft-require testing; duplicate modal; split completeness vs publish-ready |
| **10D** | Bilingual finish path | Explicit Arabic completion after Guided stub; block false “Ready”; i18n hardcodes |
| **10E** | Educator IA & preview | Nav/terminology; unified patient preview; Cases deep-link; difficulty labels |
| **10F** | Catalogue reconciliation process | Board: **REQUIRES REVIEW** (tier/code/DB parity, bipolar×MDD impossible mirror) vs **NEEDS AUTHORING** (migration-only simulation pairs + orphan packages); never auto-sync |
| **10G** | Accessibility & AR polish | Keyboard tabs/step focus; ContextualHelp i18n; RTL QA |

Suggested sequencing: **10B → 10C → 10D → 10E** (UX), then **10F** (catalogue governance), then **10G**.

---

## 7. Dependencies

- Phase 8 security baseline remains deployed and enforced in production.
- Phase 9 Guided Builder APIs (`catalogues` / `generate` / `create`) remain the create path.
- PR #245 comorbidity helpers remain the Preview UI compatibility source.
- Clinical authoring capacity required before promoting any **NEEDS AUTHORING** pair/package (especially `bipolar-mania` + `complex-ptsd`).
- i18n: every new educator string needs EN + AR.

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| Auto-syncing migration rules into builtin without package fidelity | Keep **REQUIRES REVIEW** human gate; never invent |
| Autosave writing incomplete drafts that look “ready” | Completeness badges + publish confirm |
| Blurring Guided vs Case Engine preview | Explicit labels; optional deep-link with query prefs |
| Expanding disorder catalogue without speech/therapy cues | Package checklist (symptoms, disclosure, therapy-process) before activation |
| Accidental Phase 8 edits during UX work | Architecture tests + no changes to MFA/HMAC/RLS modules |

---

## 9. Items explicitly NOT to implement in Phase 10A / early 10

- Invent comorbidity rules from general clinical knowledge
- Automatic “accept all migration pairs”
- New DSM/ICD criterion text corpora
- New AI generation products beyond existing case-builder generate
- MFA / AAL2 / HMAC / RLS / audit / rate-limit changes
- Therapist-facing report exposure
- Schema migrations solely for convenience without UX design
- Silent comorbidity selection changes

---

## 10. Suggested implementation order

1. **10B — Continuity (highest educator ROI)**  
   Direct create CTA; dirty guard; mode-switch confirm; resume/edit from detail; clarify Save draft vs Create.
2. **10C — Lifecycle + publish readiness**  
   Publish confirm + gate checklist on detail; soft-require testing; duplicate modal; split completeness vs publish-ready.
3. **10D — Bilingual finish**  
   Post-create Arabic completion path; stop stub AR counting as ready.
4. **10E — IA + preview**  
   Terminology/nav; unified preview; Cases deep-link; localized difficulty/modality labels.
5. **10F — Catalogue board**  
   For each **REQUIRES REVIEW** row: accept sync / defer / mark obsolete. For **NEEDS AUTHORING**: clinical tickets only (no inventing).
6. **10G — A11y / AR chrome**  
   Keyboard tabs/step focus; i18n remaining hardcodes; help coverage.

---

## Appendix — Security invariant confirmation

Phase 10A audit confirms **no Phase 10 requirement needs changes** to MFA, AAL2, HMAC, RLS, authorization, rate limiting, audit logging, or secrets handling.

---

**AUDIT COMPLETE**

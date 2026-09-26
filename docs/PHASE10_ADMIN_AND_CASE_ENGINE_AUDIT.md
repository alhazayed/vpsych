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

The largest remaining friction for a **non-technical administrator** is not security — it is **workflow continuity**:

1. **Create ≠ Edit.** Guided Builder only authors new drafts. There is no “resume guided draft” or “edit in Guided mode” from Virtual Patient detail.
2. **Mode switch loses work.** Guided ↔ Advanced replaces entire UI trees with independent client state; no shared draft persistence / warning.
3. **Lifecycle UX is power-user.** Publish has no confirm; Duplicate uses `window.prompt`; completeness strings are English-hardcoded.
4. **Terminology split.** “Virtual Patients”, “Cases”, “Templates”, “Presets”, “Content” overlap without a single educator mental model.
5. **Catalogue drift.** Preview runtime trusts `BUILTIN_COMORBIDITY_RULES`; DB/migrations hold additional authored pairs and disorders not in the builtin packages. Sync is a deliberate authoring project — not an automatic merge.

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
| A1 | Navigation | “Virtual Patients”, “Content”, “Cases”, “Templates”, “Presets” are peer nav items; create lives under avatars | `admin-nav.ts`, `content/page.tsx` | M | Single “Training cases” IA: Library / Create / Preview tools; demote engine pages | Code + i18n |
| A2 | Terminology | “Virtual patient”, “case”, “avatar”, “training simulation”, “disorder” mixed | messages + headers | M | Educator glossary in UI (patient = training persona; case = clinical presentation package) | Code + i18n |
| A3 | Guided vs Advanced | Default guided; Advanced swaps to full `VirtualPatientWizard`; switching drops in-progress draft | `CreatePatientModeSwitch.tsx` | H | Confirm before switch; optional import guided→advanced snapshot | Code |
| A4 | New case creation | Guided 10-step flow with catalogues + AI + approvals; works | `GuidedCaseBuilder.tsx` | L | Keep; add progress persistence (below) | — |
| A5 | Existing case editing | Detail is inspect + lifecycle; **no Guided re-entry**; personality via separate `/admin/personality` | `VirtualPatientDetail.tsx` | H | “Continue in Guided Builder” / Advanced edit for draft & testing | Code (+ maybe API load draft) |
| A6 | Resume incomplete draft | Client-only Guided state; refresh loses work; library shows drafts but opens detail not builder | `GuidedCaseBuilder.tsx`, library | H | Autosave draft to API or `sessionStorage` + Resume CTA on library cards | Code (+ optional DB fields) |
| A7 | Duplicate / similar | `window.prompt` for slug; no “create similar” from guided | `VirtualPatientLifecycleActions.tsx` | M | Modal with name/slug; optional “Duplicate into Guided” | Code |
| A8 | Completeness | Library/detail badges; reasons hardcoded English (“Missing Arabic personality”) | `virtual-patient-completeness.ts` | M | i18n keys; map reasons to Guided steps | Code + i18n |
| A9 | Validation feedback | Guided: issue list on create fail; Advanced: validate step; publish errors inline | builder + lifecycle | M | Humanize API `issues[]` with step deep-links | Code |
| A10 | Preview | Guided “generate” shows raw JSON; Case Engine preview is a separate `/admin/cases` page | `GuidedCaseBuilder.tsx`, `CaseEnginePanel.tsx` | M | Inline clinical summary (reuse `ClinicalPreviewSummary`); link “Open Case Engine preview” with prefilled primary | Code |
| A11 | Testing | Test button only when `lifecycle=testing`; empty state OK | `StartAdminTestConversationButton.tsx` | L | Soft prompt on Publish if never tested | Code |
| A12 | Publishing | One-click Publish from draft/testing; **no confirm**; archive confirms | `VirtualPatientLifecycleActions.tsx` | H | Confirm dialog + completeness checklist gate messaging | Code |
| A13 | Search / filter | Library: search + lifecycle + incomplete + sort | `VirtualPatientLibrary.tsx` | L | Add filter by presentation/disorder slug | Code |
| A14 | Difficulty | Case Engine panel has difficulty; **Guided Builder does not surface difficulty** | `CaseEnginePanel` vs Guided | M | Optional difficulty on Guided create (maps to clinical snapshot / session defaults) | Code (+ data if persisted) |
| A15 | Scenario / session type | `caseType` fixed `training_simulation`; templates/presets separate | Guided draft + templates | M | Clarify in UI that Templates/Presets are instructor tools, not the create path | i18n / IA |
| A16 | Contextual help | Phase 9 `ContextualHelp` on Guided steps + Cases comorbidity | `ContextualHelp.tsx`, builder, cases | L | Extend to lifecycle actions + library empty states | Code + i18n |
| A17 | Keyboard a11y | Step nav buttons; limited roving tabindex; selects OK | Guided builder | M | Ensure step nav arrow keys; focus management on step change; dialogs for confirms | Code |
| A18 | Arabic | `admin.caseBuilder` + avatars lifecycle keys exist; completeness strings EN-only | `messages/{en,ar}.json`, completeness | M | Translate completeness + detail chrome still in English in places | i18n |
| A19 | RTL | App locale cookie drives direction; Guided has no extra RTL bugs spotted; `ps-5` used in lists | layout / detail | L | Spot-check Guided dense multi-select in `ar` | Manual QA |
| A20 | Empty states | Library/test sessions have empties; Guided catalogue fail shows error | AdminUi / builder | L | Empty “no presentations” with CTA | Code |
| A21 | Error states | MFA_REQUIRED mapped; network errors generic | builder APIs | L | Keep; ensure no raw JSON dumps on create (mostly OK) | Code |
| A22 | Loading states | `busy` flags on generate/create; catalogues load spinner weak | Guided | L | Skeleton for catalogue load | Code |
| A23 | Unsaved changes | **No** `beforeunload` / dirty guard on Guided or Wizard | Guided / Wizard | H | Dirty flag + confirm on navigate / mode switch | Code |
| A24 | Destructive actions | Archive confirms; Publish/Restore/Testing do not | lifecycle actions | M | Confirm publish & restore | Code |
| A25 | Accidental config loss | Mode switch / refresh / browser back lose Guided draft | Mode switch + no persist | H | Same as A3/A6/A23 | Code |

### Track A — strengths (keep)

- Lifecycle graph is clear: `draft → testing | published | archived` with therapist visibility only when published (`virtual-patient-lifecycle.ts`).
- Library search/filter/incomplete sorting is already educator-friendly.
- Guided catalogues avoid free-text DSM dumps; fictional banner + approvals exist.
- Admin test conversation is correctly gated to `testing`.
- Cases comorbidity UX (PR #245) prevents silent invalid previews.

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

UI exposes only compatible/possible rows. API rejects unlisted / impossible / unknown.

### 4.3 Migration-only pairs (in SQL seeds, not in builtin)

| Primary | Comorbid | Migration tier | Classification | Notes |
|---|---|---|---|---|
| complex-ptsd | mdd-recurrent-moderate | compatible | **REQUIRES REVIEW** | Both packages in builtin; rule missing from builtin |
| complex-ptsd | alcohol-use-disorder | possible | **REQUIRES REVIEW** | Same |
| bipolar-mania | mdd-recurrent-moderate | impossible | **REQUIRES REVIEW** | Explicit reject in SQL; builtin treats as unlisted |
| ptsd | bpd | possible | **REQUIRES REVIEW** | |
| bpd | ptsd | possible | **REQUIRES REVIEW** | |
| bpd | alcohol-use-disorder | possible | **REQUIRES REVIEW** | |
| schizophrenia | mdd-recurrent-moderate | possible | **REQUIRES REVIEW** | |
| adult-adhd | mdd-recurrent-moderate | compatible | **REQUIRES REVIEW** | |
| mdd-recurrent-moderate | social-anxiety | compatible | **NEEDS AUTHORING** | `social-anxiety` not in `BUILTIN_DISORDERS` |
| mdd-recurrent-moderate | ocd | possible | **NEEDS AUTHORING** | OCD package not in builtin |
| adult-adhd | social-anxiety | possible | **NEEDS AUTHORING** | |
| eating-disorders | mdd-recurrent-moderate | compatible | **NEEDS AUTHORING** | eating package not in builtin |
| eating-disorders | gad-with-panic | possible | **NEEDS AUTHORING** | |

### 4.4 Builtin-only pairs (runtime SUPPORTED; weaker DB mirror)

| Primary | Comorbid | Classification |
|---|---|---|
| gad-with-panic | alcohol-use-disorder | **REQUIRES REVIEW** (DB parity) |
| alcohol-use-disorder | gad-with-panic | **REQUIRES REVIEW** (DB parity) |

### 4.5 Orphan / unavailable disorders

| ID key / slug | In DISORDER_IDS | In BUILTIN_DISORDERS | In DB seed | Classification |
|---|---|---|---|---|
| pdd | yes | no | yes | **NEEDS AUTHORING** (package) or **OBSOLETE** if unused |
| socialAnxiety / social-anxiety | yes | no | yes | **NEEDS AUTHORING** |
| ocd | yes | no | yes | **NEEDS AUTHORING** |
| asd | yes | no | yes | **NEEDS AUTHORING** |
| schizoaffective | yes | no | yes | **NEEDS AUTHORING** |
| eating / eating-disorders | yes | no | yes | **NEEDS AUTHORING** |
| bipolar-mania + complex-ptsd | n/a | both packages yes | **no rule** | **NEEDS AUTHORING** (ordered pair + joint cues) |

### 4.6 Duplicates / slug mismatches

- Builtin: **0** duplicate `(primary, comorbid)` keys; **0** orphan rule IDs.
- Slugs for shared disorders are consistent (`bipolar-mania`, `complex-ptsd`, …).
- Complex PTSD is ICD-11-only (`6B41`) — intentional, not a bug.

### 4.7 Exposure surfaces

| Surface | Combinations |
|---|---|
| UI comorbidity dropdown | Compatible/possible from builtin for selected primary only |
| Preview API | Accepts only pairs that pass `validateComorbidities` on builtin; unknown slugs → `unknown_disorder` |
| Runtime generation | Same validator inside `generateCaseInstance` |
| DB disorders list on `/admin/cases` | May list DB-only actives; Preview primary filter now restricts to builtin-known |

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
| **10B** | Guided draft continuity | Autosave / resume / edit-from-detail; dirty navigation guards; mode-switch confirm |
| **10C** | Lifecycle UX polish | Publish confirm + checklist; duplicate modal; i18n completeness; soft “test before publish” |
| **10D** | Educator IA & terminology | Nav/content hub rename pass; glossary; link Cases preview from Guided |
| **10E** | Catalogue reconciliation process | Human-reviewed sync of **REQUIRES REVIEW** pairs only; packages for **NEEDS AUTHORING** disorders stay separate clinical authoring |
| **10F** | Accessibility & AR pass | Keyboard step nav; RTL/AR completeness; help on lifecycle |

Suggested sequencing: **10B → 10C → 10D** (UX), then **10E** (clinical data governance), then **10F**.

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
   Dirty guard, mode-switch confirm, resume draft from library/detail, optional `sessionStorage` or draft PATCH.
2. **10C — Lifecycle safety**  
   Publish confirm + completeness summary; duplicate modal; i18n incomplete reasons.
3. **10D — IA clarity**  
   Nav/copy; Guided ↔ Cases preview handoff; difficulty optional field.
4. **10E — Catalogue board**  
   For each **REQUIRES REVIEW** row: accept sync / defer / mark obsolete. For **NEEDS AUTHORING**: clinical authoring tickets (no code invent).
5. **10F — A11y / AR**  
   Keyboard + RTL QA + help coverage.

---

## Appendix — Security invariant confirmation

Phase 10A audit confirms **no Phase 10 requirement needs changes** to MFA, AAL2, HMAC, RLS, authorization, rate limiting, audit logging, or secrets handling.

---

**AUDIT COMPLETE**

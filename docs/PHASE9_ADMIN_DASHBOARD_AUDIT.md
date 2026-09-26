# Phase 9 — Admin Dashboard & Guided AI Case Builder Audit

**Phase:** 9A (read-only)  
**Date (UTC):** 2026-09-26  
**Baseline `main`:** `b6e5e32b8674e7b4b11b6772bb01671c721e9dc3`  
**Phase 8.9 feature baseline:** `db7c16b0333485cc6f3ebe5904bbef7cdcce2f90`  
**Production:** https://vpsych.vercel.app  
**Branch (this audit):** `cursor/admin-phase9-guided-case-builder-fc9c`  
**Scope:** Forensic read-only inspection. No application code changes in 9A.  
**Verdict:** Architecture **can be extended** for Guided AI Case Builder without weakening Phase 8, if implementation reuses Virtual Patient + Case Engine catalogs and routes all AI through existing server-side provider infrastructure.

---

## 0. Executive findings

| Area | Status | Summary |
|------|--------|---------|
| Admin shell / IA | Present | Sectioned nav, command palette, overview metrics |
| Create Virtual Patient | Present (Phase 3B) | 10-step `VirtualPatientWizard` → draft/publish RPCs |
| Guided AI authoring | **Missing** | No LLM case/avatar generator; free-text clinical fields |
| Diagnosis taxonomy | **Partial** | 11 authored disorder packages + codes; no full DSM/ICD catalogue |
| Symptom / goal libraries | **Partial** | Per-package arrays in Case Engine; wizard uses newline text |
| Therapeutic frameworks | Present (engine) | Controlled `TherapyModality` enum; wizard mislabels “therapy” step |
| Hidden information | **Partial** | `disclosure_rules` + symptom `salience`; UI exposes one rule |
| AI infrastructure | Present | OpenAI / AI Gateway via `lib/ai/provider.ts` (patient + assessment only) |
| Phase 8 security | **CLEAR / FROZEN** | MFA AAL2, HMAC, RLS, audit, rate limits intact |
| Localization | Present | `admin.avatars.wizard` EN/AR; gaps on detail chrome |
| Shared form/help kit | **Missing** | No `components/ui`, no contextual help tooltips |
| Component tests | **Missing** | Lib/architecture tests only; zero React tests for wizard |

**Phase 9 go / no-go:** **GO** — extend existing Virtual Patient lifecycle and Case Engine catalogs. **STOP** before importing or inventing proprietary DSM-5-TR criterion text. Use platform-authored educational catalogues only.

---

## 1. Existing admin dashboard structure

### 1.1 Shell

- Authenticated layout: `src/app/(app)/layout.tsx` → `AppShell`
- Admin chrome when `profile.role === "admin"` and path starts with `/admin`
- Nav IA: `src/lib/admin/admin-nav.ts` → `AdminSidebarNav`, `AdminMobilePrimaryNav`, `AdminCommandPalette`
- Page chrome: `AdminPageHeader`, `AdminUi` (`MetricCard`, `EmptyState`, `ErrorState`, `AlertPanel`, `QuickActions`)
- No dedicated `admin/layout.tsx`

### 1.2 Routes (`src/app/(app)/admin/`)

| Route | Purpose |
|-------|---------|
| `/admin` | Overview metrics, alerts, quick actions (incl. create patient) |
| `/admin/learners`, `/admin/learners/[id]` | Learner directory / detail |
| `/admin/sessions`, `/admin/sessions/[id]` | Session ops |
| `/admin/reports`, `/admin/reports/[sessionId]` | Report library (admin-only reads) |
| `/admin/content` | Content hub CTA → create patient |
| `/admin/avatars` | Virtual Patient library |
| `/admin/avatars/new` | **Create wizard** |
| `/admin/avatars/[id]` | Detail + lifecycle (not wizard edit) |
| `/admin/voices` | Voice profiles |
| `/admin/cases` | Disorder list + deterministic case preview |
| `/admin/templates` | Scenario templates |
| `/admin/presets` | Instructor presets |
| `/admin/personality` | Human Personality Engine panel |
| `/admin/curriculum`, `/admin/graph` | ACE / CGE |
| `/admin/analytics`, `/admin/enterprise`, `/admin/feedback`, `/admin/research` | Ops / research |
| `/admin/cidp`, `/admin/diagnostics`, `/admin/supervisor` | System |
| `/admin/test-sessions/[sessionId]` | Admin-test transcript |

Every page uses `requireAdmin()` (role + AAL2 when enforced).

### 1.3 Authoring components (`src/components/admin/`)

Primary: `VirtualPatientWizard.tsx` (~1878 LOC), `VirtualPatientLibrary.tsx`, `VirtualPatientDetail.tsx`, `VirtualPatientLifecycleActions.tsx`, engine panels (`CaseEnginePanel`, `TemplateEnginePanel`, `InstructorPresetPanel`, `PersonalityEnginePanel`, `VoiceManagementPanel`).

---

## 2. Existing create-patient workflow

```
/admin → /admin/content | /admin/avatars → /admin/avatars/new
  → VirtualPatientWizard (client state)
  → POST   /api/admin/avatars                 createVirtualPatientDraft
  → PATCH  /api/admin/avatars/[id]            updateVirtualPatientDraft
  → POST   /api/admin/avatars/validate        assessDraftWrite / publish readiness
  → POST   /api/admin/avatars/[id]/preview   Case Engine preview
  → POST   /api/admin/avatars/[id]/publish   publishVirtualPatient
  → lifecycle / archive / restore / duplicate / test-session
```

**Persistence:** `src/lib/admin/virtual-patient/persist.ts` → SECURITY DEFINER RPCs (`admin_create_virtual_patient`, …) in `20260811084442_admin_virtual_patient_lifecycle_rpcs.sql`.

**Lifecycle:** `draft → testing | published | archived` (`src/lib/admin/virtual-patient-lifecycle.ts`). Published patients are therapist-visible (`is_active` projection). Published clinical content is immutable except archive.

**Wizard steps today:**

`identity → clinical → personality → english → arabic → voice → therapy → preview → validation → save`

**Critical gaps vs Phase 9 intent:**

1. Clinical presentation is a **free-text** `disorder` label (plus optional `default_disorder_id` on “therapy” step).
2. Symptoms / session goals are **newline textareas**.
3. Ideal therapeutic approach is free text; Case Engine modalities live elsewhere.
4. Only **one** disclosure rule in UI; `ClinicalCore.disclosure_rules[]` supports many.
5. Wizard accepts `avatarId` for reload, but **no edit route** mounts it from `/admin/avatars/[id]`.
6. **No AI assist** anywhere in authoring.
7. Hardcoded publish rubric: `[{ id: "alliance", … }]`.

Contract docs (some narrative lag): `docs/VPsych_VIRTUAL_PATIENT_CREATION_CONTRACT.md`, Phase 3B lifecycle docs.

---

## 3. Existing database model

### 3.1 Tables most relevant to case authoring

| Table | Role |
|-------|------|
| `avatars` | Virtual patient document (`clinical_core`, `personalities`, `human_personality`, lifecycle) |
| `personas` | Identity module; optional `default_disorder_id` — **does not own diagnosis** |
| `disorders` | Authored disorder packages (jsonb) + codes |
| `case_instances` | Immutable minted case per session |
| `sessions` / `session_messages` / `session_reports` | Runtime (Phase 8 HMAC/RLS apply) |
| `clinical_templates` + junctions | Scenario Template Engine |
| `instructor_presets` | Instructor Preset Engine |
| `voice_profiles` | TTS / clinical voice |
| `security_audit_events` | Admin access + mutation audit |

**Absent as first-class tables:** global `symptoms`, `diagnoses` taxonomy, or `session_goals` ontology. Those live inside jsonb packages / `clinical_core`.

### 3.2 Domain types (`src/lib/types.ts`)

`ClinicalCore` already models Phase 9 concepts:

- Presentation: `disorder`, optional `dsm5_code` / `icd11_code`
- Profile: `age`, `gender`, `severity`, `onset_duration`
- `symptom_profile[]` with `domain` + `salience` (`presenting` | `elicited` | `hidden`)
- `disclosure_rules[]` (volunteered / direct / empathic / safety / never)
- `session_goals[]` — **trainee teaching targets** (CI-C02: not a patient-goals ontology)
- `ideal_approach`, `risk_profile`, optional CI (`mse`, `formulation`, `protective_factors`, `case_file`)

**Invariant (must preserve):** A persona/avatar never permanently owns session diagnosis. Session diagnosis is minted onto `case_instances` / `sessions.clinical_snapshot` by `createCaseForSession()`.

---

## 4. Existing APIs / server actions

**Server Actions:** none (`"use server"` not used). Mutations are Route Handlers.

**Avatar / clinical admin APIs** (`src/app/api/admin/`):

- `avatars/` create, validate, `[id]` get/patch, publish, archive, restore, deactivate, lifecycle, duplicate, preview, voice, test-session
- `disorders/` GET catalog
- `cases/preview`, `templates/`, `templates/preview`, `presets/`, `presets/preview`
- `personality/`, `voice-profiles/`, validation / quality / analytics / ops

**Pattern (mandatory for new routes):**

1. `requireApiAdmin(request, { action, resourceType })`
2. `rateLimit(...)`
3. Validate body
4. Work under RLS / RPC
5. `clientSafeError` / `sanitizeDbError`
6. `logSecurityEvent` on sensitive mutations

---

## 5. Existing AI generation mechanisms

| Capability | Path | LLM? |
|------------|------|------|
| Patient session replies | `lib/ai/patient-agent.ts` + `prompt-engine.ts` | Yes |
| Post-session assessment | `lib/ai/assessment.ts` | Yes |
| Provider selection | `lib/ai/provider.ts` (OpenAI SDK or Vercel AI Gateway) | — |
| Case / template / preset “preview” | Case Engine / scenario / presets | **No — deterministic** |
| Avatar preview | Case Engine for avatar defaults | **No** |
| Personality prompt preview | `personality-engine` formatting | **No** |
| Admin Guided AI Case Builder | — | **Does not exist** |

**No Gemini** in tree. Do not add a second AI stack. Phase 9 generation must call the existing provider from **server-only** admin routes with rate limits + audit.

---

## 6. Existing diagnosis data

**Authoritative runtime catalogue:** `src/lib/case-engine/catalog.ts` → `BUILTIN_DISORDERS` (11 packages), mirrored in `public.disorders`.

| Slug | Codes present |
|------|---------------|
| `mdd-recurrent-moderate` | DSM-5 / ICD-10 / ICD-11 |
| `gad-with-panic` | yes |
| `ptsd` | yes |
| `adult-adhd` | yes |
| `alcohol-use-disorder` | yes |
| `panic-disorder` | yes |
| `bpd` | yes |
| `complex-ptsd` | ICD-11; DSM optional/null |
| `schizophrenia` | yes |
| `bipolar-mania` | yes |
| `delirium` | yes |

Reserved UUID slots without packages: PDD, social anxiety, OCD, ASD, schizoaffective, eating — **not selectable until packages exist**.

**Docs:** `docs/clinical/DSM_MAPPING.md`, `docs/clinical/ICD_MAPPING.md`.

**Hard stop for Phase 9:** There is **no** full DSM-5-TR / ICD-11 taxonomy file. Do **not** scrape or reproduce proprietary APA/WHO criterion text. Persona files (`personas/*.case.json`) contain human-authored criterion trees for exam assets — **do not AI-regenerate or expand them into a taxonomy**.

**Phase 9 diagnosis selector must:**

- Search/group the **existing 11 packages** (+ inactive reserved only if product decides to show “coming soon”)
- Store disorder **id/slug**, display label, taxonomy version from package metadata, optional ICD-11 already on row
- Label UI as **“Clinical presentation / training diagnosis”** (fictional educational)

---

## 7. Existing symptom data

- Per-disorder `symptom_profile` inside Case Engine packages (patient-language descriptions + domain/salience).
- Wizard flattens to newline strings and rebuilds minimal `{ id, description }` items (drops domain/salience richness).
- Type domains already include: mood, anxiety, sleep, appetite, cognition, somatic, social, behavioral, psychotic, trauma.

**Phase 9:** Build a searchable symptom library by **aggregating platform-authored package symptoms** + allow custom items marked `custom`. Map UI categories (Emotional / Cognitive / …) onto existing `domain` values. AI suggestions must propose from / constrained to this library where possible, never auto-apply.

---

## 8. Existing therapeutic approach data

Controlled enum `TherapyModality` in `src/lib/case-engine/types.ts` with builtin profiles:

`cbt`, `dbt`, `act`, `psychodynamic`, `supportive`, `motivational_interviewing`, `family_therapy`, `crisis_intervention`, `exposure_therapy`

Used by Case Engine generation / session mint. Wizard “therapy” step currently only binds `default_disorder_id`; `ideal_approach` is free text under Clinical.

**Phase 9:** Structured framework selector **must use this enum** (plus educational labels/help). AI may recommend primary/supporting modalities with “why suggested” text; admin approves. Do not invent unlisted modalities.

---

## 9. Existing localization

- Locales: `en`, `ar` via `locale` cookie; RTL via `localeDirection()` (`src/i18n/config.ts`).
- Strings: `messages/en.json`, `messages/ar.json` — mirror key trees.
- Wizard keys: `admin.avatars.wizard.*` (~127).
- Gaps: detail tab labels hardcoded EN; some enum options raw snake_case; stale Phase 2 keys (`persistenceDisabled*`); `admin.nav.learners` EN-only reported.
- Arabic patient personalities must remain **natively authored**, never machine-translated (product invariant).

**Phase 9:** All new UI + help copy in both locale files; logical CSS (`text-start`, `ms-`/`ps-`); dir-aware popovers.

---

## 10. Existing reusable UI components

| Present | Missing |
|---------|---------|
| `.btn-primary` / `.btn-secondary`, `.clinical-card` | Shared `Input` / `Select` / `Checkbox` |
| `AdminPageHeader`, `AdvancedDetails` | Tooltip / Popover help (`ⓘ`) |
| `StatusBadge`, empty/error/metric cards | Accessible dialog (only command palette) |
| Native inputs inside wizard | Combobox / multi-select / stepper a11y |

**No `src/components/ui/`.** Phase 9 should introduce a **small admin help + form primitive kit** (tooltip/popover, multi-select, searchable select) under `src/components/admin/` or a thin `src/components/ui/` — matching existing tokens, not a new visual language.

---

## 11. Existing accessibility

**Present:** `aria-current` on nav, `aria-expanded` toggles, tablist patterns on some detail views, `role="alert"` errors, command palette dialog/listbox, focus-visible rings, `sr-only` collapsed labels.

**Gaps:** Wizard step buttons lack `aria-current`; Field/`htmlFor` inconsistent; native `window.prompt` / `confirm` for duplicate/archive; no keyboard-accessible help tooltips; detail tabs missing `aria-controls`; success toasts inconsistent live regions.

---

## 12. Existing validation

| Layer | Module |
|-------|--------|
| Virtual Patient write/publish gates | `src/lib/admin/virtual-patient/validation.ts` |
| Soft completeness | `virtual-patient-completeness` |
| Case generation | `src/lib/case-engine/validation.ts` |
| HPE | `personality-engine/validation.ts` + `schemas/human-personality.v1.json` |
| Avatar schema | `schemas/avatar.v2.json` (thin) |

Zod is used sparingly (`assessment-parse`); engines use hand validators — **match local style** for Phase 9 AI output schemas.

---

## 13. Existing security boundaries (Phase 8 — FROZEN)

| Control | Location | Phase 9 rule |
|---------|----------|--------------|
| Admin role in `profiles.role` | `auth.ts` / `api-auth.ts` | Never trust client role |
| AAL2 when MFA enforced | `admin-mfa.ts` | Do not bypass; bootstrap only via `/auth/mfa*` |
| MFA deny → `/auth/mfa?next=` | Phase 8.9 | Preserve |
| API deny → `403 MFA_REQUIRED` | `requireApiAdmin` | Preserve |
| Message HMAC CQG-011 | `report-sign.ts`, `prepareMessageRpc`, migration `20260925120000_*` | Do not touch |
| Report HMAC | `create_session_report` | Do not touch |
| RLS avatars/sessions/messages/reports | migrations | New tables need explicit policies — never `USING (true)` |
| Rate limits on all admin APIs | `rate-limit.ts` | Required on new AI routes |
| Audit events | `security-audit.ts` | Log generate/accept/reject/create |
| Error sanitization | `api-errors.ts`, `safe-client-error.ts` | No raw provider/DB leakage |
| Secrets | server env only | Never browser OpenAI/Gemini/service-role/REPORT_WRITE_KEY |

**Do-not-modify (unless absolutely required):**  
`auth.ts`, `api-auth.ts`, `admin-mfa.ts`, MFA pages, `middleware` / `supabase/middleware.ts`, `report-sign.ts`, `supabase/admin.ts` (HMAC helpers), applied HMAC migrations, `architecture.test.ts` assertions (extend, don’t loosen).

---

## 14. Existing tests

Relevant suites:

- `src/lib/admin/virtual-patient/*.test.ts`, lifecycle / completeness / admin-test architecture
- `src/lib/admin/admin-nav.test.ts`
- `src/lib/api-auth.test.ts`, `admin-mfa.test.ts`
- `src/lib/architecture.test.ts` (MFA redirect, HMAC migration, admin route gates)
- Case engine / scenario / personality validation tests

**Gaps for Phase 9:** no component tests; no AI case-generation tests; no guided-builder draft persistence tests; security regression for new AI endpoints not yet asserted.

---

## 15. Recommended Phase 9 architecture

### 15.1 Product shape

Introduce **Guided Mode** (default) as a parallel or evolved entry from `/admin/avatars/new`:

`Clinical presentation → Patient profile → Session goals → Symptoms → Clinical context → Therapeutic framework → Interaction / behaviour → AI generation → Educator review → Create`

Keep **Advanced Mode** exposing today’s full bilingual personality / JSON-adjacent controls (or deep-link into existing wizard steps).

Do **not** replace Case Engine session minting. The builder authors an `avatars` draft (+ optional persona linkage); sessions still mint `case_instances`.

### 15.2 Catalogues (educational, platform-authored)

| Catalogue | Source |
|-----------|--------|
| Presentations | Existing `disorders` / `BUILTIN_DISORDERS` |
| Goals | New curated educational list derived from package `session_goals` + CI teaching categories; allow custom |
| Symptoms | Aggregate package symptoms + custom; preserve domain/salience |
| Frameworks | Existing `TherapyModality` |
| Interaction / challenges | Prefer existing HPE / therapy-process cues; add small controlled enums if missing — avoid duplicates |

### 15.3 AI

New admin-only routes, e.g.:

- `POST /api/admin/case-builder/generate-symptoms`
- `POST /api/admin/case-builder/structure-context`
- `POST /api/admin/case-builder/recommend-framework`
- `POST /api/admin/case-builder/generate-case`

All: `requireApiAdmin` → rate limit (tight, e.g. 20–30/hr) → structured prompt → `provider.ts` → schema validate → return **suggestions only**. Client never auto-persists AI output. Persist only after explicit Approve via existing avatar draft APIs.

**Manual path must work when AI is down.**

### 15.4 Persistence

Prefer **no new privileged write surface** beyond existing avatar RPCs. Optional: `clinical_core` extension fields or a draft jsonb column via **new migration** with admin-only RLS if draft wizard state needs server save — otherwise client draft + existing PATCH is enough for v1.

Metadata: set/display `case_type = "training_simulation"` (or equivalent flag in clinical_core / rubric metadata) and UI banner: “Fictional training case — not a real patient.”

### 15.5 Hidden information

Map Phase 9 layers onto existing primitives:

| Phase 9 concept | Existing field |
|-----------------|----------------|
| Available initially | symptoms `salience: presenting` + `disclosure_rules` volunteered |
| Revealed if explored | `salience: elicited` + `on_direct_question` / empathic |
| Requires clinical questioning | disclosure conditions |
| Requires risk assessment | `on_safety_assessment` + `risk_profile` |

UI must make these authorable (multi-rule), not a single topic field.

---

## 16. Files that need modification / addition

**Likely add:**

- `docs/PHASE9_*.md` (audit, spec, AI, security, production)
- `src/components/admin/help/*` (ContextualHelp)
- `src/components/admin/case-builder/*` (guided shell, selectors, review)
- `src/lib/admin/case-builder/*` (catalogues, validation, AI schemas)
- `src/app/api/admin/case-builder/*/route.ts`
- `messages/en.json` + `messages/ar.json` keys
- Tests colocated under `src/lib/admin/case-builder/*.test.ts` + architecture extensions
- Optional migration if draft persistence / metadata columns required

**Likely modify:**

- `src/app/(app)/admin/avatars/new/page.tsx` — entry to Guided Mode
- `src/components/admin/VirtualPatientWizard.tsx` — integrate or share types; avoid full rewrite
- `src/lib/admin/admin-nav.ts` / content hub CTAs — copy only
- `src/lib/architecture.test.ts` — **add** gates for new routes

---

## 17. Files that should NOT be modified

- Phase 8 MFA/HMAC/auth stack listed in §13
- Applied Supabase migrations (add new only)
- `lib/ai/assessment.ts` weighted scoring formula
- Patient message / end session signing call sites (unless carefully extending `prepareMessageRpc` usage)
- RLS policies that open therapist write to reports/avatars
- Persona criterion trees as generative seeds

---

## 18. Problem register

### UX problems

| ID | Issue | Severity |
|----|-------|----------|
| UX-01 | Free-text disorder / symptoms / goals | High |
| UX-02 | “Therapy” step ≠ therapeutic framework | High |
| UX-03 | No edit-wizard entry from detail | High |
| UX-04 | No contextual help; jargon unexplained | Medium |
| UX-05 | 10-step free navigation skips gates until publish | Medium |
| UX-06 | Bilingual authoring burden without AI assist | High |
| UX-07 | Hardcoded EN on detail tabs | Medium |
| UX-08 | Native prompt/confirm for lifecycle | Low |

### Technical debt

| ID | Issue |
|----|-------|
| TD-01 | Monolithic wizard (~1.8k LOC) |
| TD-02 | No shared form primitives |
| TD-03 | Wizard drops symptom domain/salience |
| TD-04 | Stale i18n keys from Phase 2 |
| TD-05 | Creation contract doc still describes pre-RPC world in places |

### Duplicate / fragmented functionality

| ID | Issue |
|----|-------|
| DUP-01 | Clinical authoring split: wizard vs `/admin/cases` Case Engine panel vs templates/presets |
| DUP-02 | Disorder selected twice (free-text name + default_disorder_id) |

### Missing functionality (Phase 9 scope)

| ID | Issue |
|----|-------|
| MISS-01 | Guided Mode + progress + Save Draft semantics |
| MISS-02 | Searchable presentation taxonomy UI |
| MISS-03 | Goal / symptom multi-select libraries |
| MISS-04 | AI symptom / context / case generation with review |
| MISS-05 | Multi disclosure / hidden-info authoring |
| MISS-06 | Section regenerate + Approve All review screen |
| MISS-07 | AI unavailable manual fallback UX |

### Security-sensitive areas

| ID | Area | Risk if mishandled |
|----|------|--------------------|
| SEC-01 | New AI admin routes | Missing MFA / rate limit / audit |
| SEC-02 | Client calling providers | Secret exposure |
| SEC-03 | Auto-persist AI output | Unauthorized clinical content |
| SEC-04 | Loosening HMAC/MFA “for convenience” | Phase 8 regression |
| SEC-05 | Broad RLS for drafts | Cross-tenant leakage |

### Clinical-content risks

| ID | Risk | Mitigation |
|----|------|------------|
| CLIN-01 | Proprietary DSM text import | Reuse 11 packages only; no criterion dumps |
| CLIN-02 | AI invents medications/diagnoses as fact | Schema allowlists + educator approval |
| CLIN-03 | Real-patient identifiers | Block in validation; fictional banner |
| CLIN-04 | AI as real treatment advice | Copy: educational simulation only |
| CLIN-05 | Risk info never assessable | Keep `on_safety_assessment` disclosure path |

---

## 19. Internal architecture review (9A gate)

| Question | Answer |
|----------|--------|
| Can we extend without weakening Phase 8? | **Yes** |
| Is diagnosis catalogue adequate for v1? | **Yes for 11 presentations**; document reserved gaps; do not invent DSM |
| Must we STOP for missing taxonomy? | **No** — authoritative internal packages exist; full DSM import forbidden |
| New AI stack required? | **No** — extend `lib/ai/provider.ts` |
| New DB required for MVP? | **Optional**; prefer avatar draft RPCs + richer `clinical_core` |
| Primary integration surface | Guided builder → existing Virtual Patient validate/create/publish |

**Decision:** Proceed to Phase 9B+ implementation on branch `cursor/admin-phase9-guided-case-builder-fc9c`.

---

## 20. Implementation sequence (locked)

1. **9A** Audit (this document)  
2. **9B** Reusable help / UX primitives  
3. **9C** Guided Case Builder shell (draft state, steps, progress)  
4. **9D** Structured diagnosis selector (catalog-backed)  
5. **9E** Structured goals  
6. **9F** Structured symptom builder  
7. **9G** Clinical context builder  
8. **9H** Therapeutic framework selector (`TherapyModality`)  
9. **9I** Interaction profile  
10. **9J** AI section generation APIs  
11. **9K** Full AI case generator  
12. **9L** Review / approval  
13. **9M** Persistence via existing avatar RPCs  
14. **9N** Security / RLS / architecture tests  
15. **9O** Automated + manual regression  
16. **9P** Production deploy + verification docs  

---

## 21. Residual risks entering implementation

1. Scope size vs single PR — prefer stacked logical commits; may ship Guided Mode MVP with Advanced = existing wizard.  
2. Arabic clinical terminology quality — reuse existing message keys / package labels; avoid awkward machine translation.  
3. AI non-determinism — strict schema validation; reject invalid output; never fabricate on provider failure.  
4. Edit-path gap — Guided builder should support resume-by-id early to avoid another dead-end.  
5. Cron / HMAC / MFA not in feature path — still mandatory regression gate before CLEAR.

---

## 22. References

- `docs/VPsych_VIRTUAL_PATIENT_CREATION_CONTRACT.md`
- `docs/DYNAMIC_CLINICAL_CASE_ENGINE.md`
- `docs/clinical/CLINICAL_DATA_MODEL.md`
- `docs/clinical/DSM_MAPPING.md` / `ICD_MAPPING.md`
- `docs/PHASE8_9_PRODUCTION_RELEASE.md`
- `docs/PRODUCTION_SECURITY_CERTIFICATION.md`
- `src/lib/case-engine/catalog.ts`
- `src/lib/admin/virtual-patient/*`
- `src/components/admin/VirtualPatientWizard.tsx`
- `src/lib/ai/provider.ts`
- `src/lib/architecture.test.ts`

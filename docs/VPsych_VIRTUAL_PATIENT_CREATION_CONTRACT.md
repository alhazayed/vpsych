# VPsych — Virtual Patient Creation Contract & Lifecycle Audit

**Phase:** 3A (read-only forensic assessment) + lifecycle reconciliation  
**Date:** 2026-08-09  
**Amended:** 2026-08-10 — HP / runtime amendment (`docs/VPsych_PHASE3A_CONTRACT_AMENDMENT.md`)  
**Amended:** 2026-08-11 — **Lifecycle Option B** (`docs/VPsych_PHASE3B_LIFECYCLE_RECONCILIATION.md`)  
**Branch (lifecycle amendment):** `cursor/phase3b-lifecycle-reconciliation-b432`  
**Baselines:** system inventory, Admin UX assessment, Phase 2 Admin UX, production `lifecycle_status` schema, PR #188 transition graph  

**Scope:** Determine exactly what must happen when an administrator clicks **Create Virtual Patient → Save**.  
**Non-scope (this document):** No production writes. Implementation remains separately authorized.

Evidence sources: `supabase/migrations/*`, production schema (`rrzudbkxigeavfdnidnm`), `src/lib/types.ts`, schemas, case/personality/voice modules, admin routes, PR #188 lifecycle migration + transitions.

---

## 1. Executive Summary

There is **no in-app avatar create path today**. The only production creation mechanism found is **SQL seed migrations** (Maya Chen, Jordan Hale). Application code never calls `avatars.insert`. Phase 2 ships a wizard shell with **Save disabled**.

A future Save must treat the Virtual Patient as a **single-row `public.avatars` document** (schema_version = 2) plus optional related rows:

| Concern | Mandatory for DB insert? | Mandatory for production training use? |
|---|---|---|
| Flat NOT NULL columns (`name`, `disorder`, `persona_prompt`) | **Yes** (Postgres) | Yes |
| `clinical_core` + `personalities` (v2) | No (nullable) | **Yes** for bilingual clinical fidelity |
| Both `en-US` and `ar-JO` personalities | No at DB; **yes** in `avatar.v2.json` authoring schema | **Yes** for product bilingual contract |
| `human_personality` map | Defaults `{}` | **Authored quality** strongly recommended for publish (both locales). Runtime always has Module 2b via snapshot → DB → builtins (known slugs) → `synthesizeHumanPersonalityFromAvatar()` |
| `voice_profile_id` | No (nullable FK) | Recommended; TTS falls back to env defaults |
| `personas` row | No | Recommended for Case Engine default disorder linkage |
| Case / template / preset / competencies | No at avatar create | Optional at **session** start |
| `lifecycle_status` | Production NOT NULL; default `draft` | **Canonical** admin lifecycle (`draft` \| `testing` \| `published` \| `archived`) |
| `is_active` | Projection (synced) | Therapist SELECT gate; **`true` iff `published`** |

**Canonical lifecycle (Option B — authoritative):**

| State | `lifecycle_status` | `is_active` | Therapist visible? |
|---|---|---|---|
| DRAFT | `draft` | `false` | No |
| TESTING | `testing` | `false` | No |
| PUBLISHED | `published` | `true` | **Yes** |
| ARCHIVED | `archived` | `false` | No |

`lifecycle_status` is canonical. `is_active` is the compatibility / RLS projection. There is **no** separate “deactivate” state — withdrawing a published patient is **ARCHIVE**.

**Critical architectural invariant (must not be broken):** A persona never permanently owns a disorder. Session diagnosis lives on `sessions.clinical_snapshot` / `case_instances`, minted by `createCaseForSession()`. Avatar `clinical_core.disorder` is an authored **default presentation**, not session ownership.

**Atomicity risk:** Avatar creation is currently a single-table insert in seeds. Production-ready creation involves multiple logical documents on one row (`clinical_core`, `personalities`, `human_personality`, voice FKs) plus an optional `personas` row. Therapist visibility is gated by **`is_active`** (RLS), which production syncs from **`lifecycle_status`**. Create must insert **`lifecycle_status='draft'`** (`is_active=false`) until explicit publish.

---

## 2. Avatar Database Contract

### 2.1 Column inventory (migrations as source of truth)

Compiled from:

- `20260730132727_vpsych_initial_schema.sql`
- `20260731102805_multilingual_support.sql`
- `20260731180158_avatar_schema_v2.sql`
- `20260731181632_avatar_voice_ids.sql`
- `20260731191943_avatar_voice_casting_and_available_locales.sql`
- `20260731205101_voice_profiles_registry.sql`
- `20260807093000_human_personality_engine.sql`
- Production (applied): `avatar_lifecycle_status` — git PR #188 file `20260808171439_…`; production row version `20260808172816` (version drift — see reconciliation doc)

| Column | Type | Nullable | Default | Constraints / notes | Classification |
|---|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | PK | SYSTEM-GENERATED |
| `name` | `text` | NOT NULL | — | Required on INSERT | REQUIRED FOR CREATION (DB) · DERIVED from `personalities[default].identity.display_name` when v2 sync runs |
| `disorder` | `text` | NOT NULL | — | Required on INSERT | REQUIRED FOR CREATION (DB) · DERIVED from `clinical_core.disorder` on v2 sync |
| `age` | `integer` | NULL | — | | OPTIONAL · DERIVED from `clinical_core.age` on sync |
| `gender` | `text` | NULL | — | | OPTIONAL · DERIVED from `clinical_core.gender` on sync |
| `portrait_url` | `text` | NULL | — | | OPTIONAL · DERIVED from personality identity |
| `persona_prompt` | `text` | NOT NULL | — | Required on INSERT | REQUIRED FOR CREATION (DB) · DERIVED from default personality `persona_prompt` on sync |
| `ideal_guidelines` | `jsonb` | NOT NULL | `'{}'` | | OPTIONAL (has default) · DERIVED from clinical_core goals/approach on sync |
| `rubric` | `jsonb` | NOT NULL | `'[]'` | | OPTIONAL (has default) |
| `is_active` | `boolean` | NOT NULL | `true` (column default) | Therapist SELECT gate; **projected** from `lifecycle_status` in production | REQUIRED FOR CREATION semantics via lifecycle · DERIVED projection |
| `lifecycle_status` | `text` | NOT NULL | `'draft'` | CHECK ∈ {`draft`,`testing`,`published`,`archived`}; **canonical** admin lifecycle (production) | REQUIRED FOR CREATION · set **`draft`** on create |
| `created_at` | `timestamptz` | NOT NULL | `now()` | | SYSTEM-GENERATED |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | **Not** bumped on every UPDATE. `sync_avatar_flat_from_v2` sets `NEW.updated_at := now()` only after a **successful v2 flat projection** (`schema_version = 2` and both `clinical_core` + `personalities` present with a resolvable personality). Early returns (v1, missing JSONB, empty personalities) leave `updated_at` unchanged. No avatar-wide `updated_at` trigger exists. | SYSTEM-GENERATED (INSERT default; conditional on sync path) |
| `language` | `text` | NULL | — | Flat projection | OPTIONAL · DERIVED from personality |
| `dialect` | `text` | NULL | — | Flat projection | OPTIONAL · DERIVED from personality |
| `voice_id` | `text` | NULL | — | Legacy EN/primary TTS id | OPTIONAL · may be DERIVED from personality voice or voice assign |
| `voice_id_ar` | `text` | NULL | — | Legacy AR TTS id | OPTIONAL · DERIVED from AR personality voice / assign |
| `schema_version` | `integer` | NOT NULL | `1` | Comment: 1=flat; 2=clinical_core+personalities | REQUIRED for v2 product path → set **2** |
| `slug` | `text` | NULL | — | Unique partial index where NOT NULL | OPTIONAL but strongly recommended · REQUIRED for builtin personality catalog lookup |
| `default_locale` | `text` | NOT NULL | `'en-US'` | | REQUIRED FOR CREATION (has default) |
| `clinical_core` | `jsonb` | NULL | — | Module 1 | OPTIONAL at DB · REQUIRED for clinically usable v2 |
| `personalities` | `jsonb` | NULL | — | Module 2 locale map | OPTIONAL at DB · REQUIRED for clinically usable v2 |
| `available_locales` | `text[]` | NOT NULL | `'{}'` | Maintained by sync trigger from personalities keys | SYSTEM-GENERATED / DERIVED |
| `voice_profile_id` | `uuid` | NULL | — | FK → `voice_profiles(id)` ON DELETE SET NULL | OPTIONAL |
| `human_personality` | `jsonb` | NOT NULL | `'{}'` | Locale → HumanPersonalityProfile | OPTIONAL content (empty default) |

CHECK constraints on `avatars` include production `avatars_lifecycle_status_check`. No Postgres GENERATED columns. **`lifecycle_status` is present in production** (four-state text CHECK). Do not invent parallel `draft_status` / `published_at` / `archived_at` columns.

### 2.2 Indexes

| Index | Definition | Evidence |
|---|---|---|
| PK | `avatars_pkey` on `id` | initial schema |
| `avatars_slug_key` | UNIQUE on `slug` WHERE `slug IS NOT NULL` | `avatar_schema_v2` |
| `avatars_voice_profile_id_idx` | on `voice_profile_id` | voice registry migration |

### 2.3 Foreign keys

| Column | References | On delete |
|---|---|---|
| `voice_profile_id` | `voice_profiles(id)` | `SET NULL` |

Tables that **reference** `avatars(id)` (creation side-effects / lifecycle, not required at insert): `sessions`, `personas`, `case_instances`, long-term patient memory, therapy-room VMHC, etc. Session FK is `ON DELETE RESTRICT` — hard-delete of an avatar with sessions will fail.

### 2.4 Triggers

| Trigger | Timing | Function | Behavior |
|---|---|---|---|
| `trg_sync_avatar_flat_from_v2` | BEFORE INSERT OR UPDATE OF `schema_version`, `clinical_core`, `personalities`, `default_locale`, `rubric` | `sync_avatar_flat_from_v2()` | Always refreshes `available_locales` from personalities keys (or default_locale/language). If `schema_version = 2` and both JSONB present, projects flat `name`, `disorder`, `age`, `gender`, `portrait_url`, `persona_prompt`, `language`, `dialect`, `voice_id`, `voice_id_ar`, `ideal_guidelines`, `updated_at`. |
| `avatars_lifecycle_is_active_sync` | BEFORE INSERT OR UPDATE OF `lifecycle_status` | `sync_avatar_is_active_from_lifecycle()` | **`is_active := (lifecycle_status = 'published')`** — forward projection |
| `avatars_is_active_lifecycle_sync` | BEFORE UPDATE OF `is_active` | `sync_avatar_lifecycle_from_is_active()` | If `is_active` flips while status unchanged: `true → published`; `false` **only when old status was `published` → `archived`** |

Implication for Save: if the API inserts v2 with `clinical_core` + `personalities` **and** supplies valid flat NOT NULL columns (or relies on trigger to overwrite them), the flat sync trigger will keep flats coherent. **If `clinical_core` or `personalities` is NULL, the flat sync does not overwrite flats** — INSERT must still satisfy NOT NULL flats.

Implication for lifecycle: authoring code should write **`lifecycle_status`** and let triggers project `is_active`. Writing only `is_active=false` on a published row will **archive** it via the reverse sync — do not treat that as a distinct “deactivate” state.

### 2.5 RLS policies (current)

From `optimize_rls_initplan_and_fk_index` (initplan form):

| Policy | Command | Rule |
|---|---|---|
| Authenticated can read active avatars | SELECT | `is_active = true OR is_admin()` |
| Admins can insert avatars | INSERT | `is_admin()` |
| Admins can update avatars | UPDATE | `is_admin()` |
| Admins can delete avatars | DELETE | `is_admin()` |

**Evidence:** only `lifecycle_status='published'` yields `is_active=true`, so therapists see published patients only; admins see all statuses.

### 2.6 Schema version requirements

| Version | Meaning | Product expectation |
|---|---|---|
| `1` | Flat columns only | Legacy; `resolveAvatar` synthesizes prompts from flats |
| `2` | `clinical_core` + `personalities` | **Required target for new Virtual Patients** |

`schemas/avatar.v2.json` additionally requires document fields `id`, `clinical_core`, `personalities`, `rubric`, `default_locale`, `is_active`, and **`personalities.en-US` + `personalities.ar-JO`**. This JSON Schema file is an **authoring contract**; it is **not wired as a runtime Ajv gate** in Route Handlers today (grep evidence: no Ajv/`avatar.v2` runtime validate on APIs).

### 2.7 JSONB field shapes (TypeScript / schema evidence)

- **`clinical_core`:** `ClinicalCore` in `src/lib/types.ts` — disorder, age, gender, symptom_profile, disclosure_rules, session_goals, ideal_approach, risk_profile; optional DSM/ICD/severity/onset; optional Stage 6 protectives/MSE/formulation.
- **`personalities`:** map BCP-47 → `AvatarPersonality` (identity, persona_prompt, speech, cultural_context, language_module, safety_module, voice, …).
- **`human_personality`:** map locale → `HumanPersonalityProfile` (`human-personality.v1.json` / `validateHumanPersonality`).
- **`rubric`:** `RubricItem[]` (`id`, `label`, `weight`, `max`).
- **`ideal_guidelines`:** `{ session_goals?, ideal_approach? }`.

---

## 3. Creation Dependencies

### 3.1 Dependency graph (actual)

```text
Avatar (public.avatars)                          [identity + authored clinical default]
 ├── clinical_core (JSONB on row)                 [language-neutral Module 1]
 ├── personalities (JSONB on row)                 [en-US / ar-JO authored Module 2]
 │    ├── identity / persona_prompt / speech / culture / safety / voice stubs
 │    └── available_locales (DERIVED by trigger)
 ├── human_personality (JSONB on row)             [Personality Engine traits; independent of GPT]
 ├── Flat projections (name, disorder, persona_prompt, …)  [REQUIRED for INSERT; synced from v2]
 ├── voice_profile_id → voice_profiles            [OPTIONAL FK; TTS preferred path]
 ├── voice_id / voice_id_ar                       [OPTIONAL legacy cache]
 ├── rubric / ideal_guidelines                    [OPTIONAL defaults]
 └── lifecycle_status                            [canonical admin lifecycle]
 └── is_active                                   [therapist visibility projection]

Optional companion (recommended, not FK-required for INSERT):
personas (avatar_id UNIQUE)                      [Case Engine identity; default_disorder_id]
 └── default_disorder_id → disorders             [OPTIONAL; session mint uses this]

Session-time only (NOT required at avatar create):
sessions → createCaseForSession()
 ├── case_instances + clinical_snapshot           [session diagnosis ownership]
 ├── case_memory
 ├── clinical_templates / instructor_presets      [optional request params]
 ├── disorders catalog (DB + builtins)
 └── competencies / ACE / CGE                    [post-assessment; not avatar create]

Offline authored assets (NOT auto-ingested):
personas/*.case.json                             [therapy cues / harvest source for builtins]
schemas/avatar.v2.json                           [authoring schema; not API-enforced]
```

### 3.2 What is **not** a hard FK dependency of avatar INSERT

- No FK to `disorders`, `clinical_templates`, `instructor_presets`, `cge_*`, ACE tables, memory tables, emotion engines.
- `personas.avatar_id` is optional uniqueness; `createCaseForSession` synthesizes a persona via `personaFromAvatar()` when the DB row is missing.
- Competencies attach to templates/presets/learner graphs — not to avatar create.

---

## 4. Existing Creation Paths

| # | Method | File | Inputs | Outputs | Tables | Functions | Validation | Side effects | Production use |
|---|---|---|---|---|---|---|---|---|---|
| 1 | SQL seed INSERT | `supabase/migrations/20260730133755_seed_preset_avatars.sql` | Flat columns for Maya + Jordan | 2 avatar rows | `avatars` | none | none beyond NOT NULL | Seeds library | **Yes** (historical seed) |
| 2 | SQL UPDATE to v2 | `20260731181033_avatar_v2_seed_personalities.sql` | Full `clinical_core` + `personalities` JSON | Upgraded rows `schema_version=2` | `avatars` | sync trigger | none | Populates dual locales | **Yes** |
| 3 | Voice casting UPDATE | `20260731191943_…`, `20260801160000_…`, `20260803181537_…` | personality voice_ids / profile assigns | Updated voice fields | `avatars`, `voice_profiles` | sync | none | TTS casting | **Yes** |
| 4 | Case Engine persona migrate | `20260802180922_dynamic_clinical_case_engine.sql` | Existing avatars | `personas` rows + default disorders | `personas`, `disorders` | — | — | Links Maya/Jordan defaults | **Yes** |
| 5 | Human personality backfill | `20260807093000_human_personality_engine.sql` | Built-in trait maps | `human_personality` | `avatars` | — | — | Trait engine seed | **Yes** |
| 6 | Offline case JSON | `personas/maya-chen.case.json`, `jordan-hale.case.json` | Authored case files | Used by tests / `authored-therapy-cues` / personality harvest | **not** `avatars` insert | catalog helpers | — | Cue enrichment for known slugs | Authoring artifact; **not** runtime ingest |
| 7 | Admin voice assign | `PATCH /api/admin/avatars/[id]/voice` | `{ voice_profile_id }` | Updated avatar | `avatars` | `requireApiAdmin`, rateLimit, audit | Active voice must exist | Legacy column sync | **Yes** (edit only) |
| 8 | Admin personality save | `PUT /api/admin/personality` | `{ avatarId, locale, profile }` | Updated `human_personality` | `avatars`, optional `personas.traits` | `validateHumanPersonality`, `saveHumanPersonalityProfile` | Full HP schema | Best-effort persona mirror | **Yes** (edit only) |
| 9 | App create API | — | — | — | — | — | — | — | **DOES NOT EXIST** |
| 10 | Test fixtures / realtime | `createAvatarController` in realtime | Numeric seed | In-memory controller | none | — | — | Unrelated to DB avatars | Dev/realtime only |
| 11 | Phase 2 wizard shell | `src/app/(app)/admin/avatars/new/page.tsx` at `/admin/avatars/new` | UI shell only (inline page; **no** separate `VirtualPatientWizard` component) | None | none | — | Save disabled | None | UX shell only |

**Conclusion:** Production Virtual Patients are provisioned by **migrations/ops SQL**, then tuned via personality + voice admin APIs. There is no application INSERT path to reuse; Phase 3 must add one.

**Wizard naming note:** Phase 2 implements an **inline create shell** under `/admin/avatars/new`. Library/Detail use `VirtualPatientLibrary` / `VirtualPatientDetail`. Do **not** invent a `VirtualPatientWizard` component merely to satisfy naming — Phase 3B may wire persistence into the existing page (or extract a component later as an implementation detail).

---

## 5. Validation Contract

| Validator | Input | Output | Required fields / rules | Failure conditions | Caller today | Reuse for POST `/api/admin/avatars`? |
|---|---|---|---|---|---|---|
| Postgres NOT NULL / defaults | Row | Insert error | `name`, `disorder`, `persona_prompt` | Missing required columns | Any insert | **Yes** (last line of defense) |
| `sync_avatar_flat_from_v2` | Row BEFORE write | Mutated NEW | — | Silent no-op if not v2 or missing JSONB | Trigger | Implicit |
| `schemas/avatar.v2.json` | Full avatar document | Schema validity | Requires `en-US`+`ar-JO` under personalities | Missing locales / required keys | **Not wired to API** | **Yes — should be enforced in API** (new wiring) |
| `validateHumanPersonality` | Profile object | `{ ok, profile, issues }` | version=1, locale, traits 1–5, enums, arrays | Any required missing/invalid | `PUT/POST /api/admin/personality`, persist | **Yes** per locale |
| `schemas/human-personality.v1.json` | Same | Schema doc | Mirrors TS validator | — | Docs / offline | Prefer TS validator (already used) |
| `assessVirtualPatientCompleteness` | Soft UI checks | reasons / isComplete | EN+AR personality presence, voice, clinical | Soft only | Admin library/home | **Yes as checklist UX**; not hard gate alone |
| `isActiveVoiceProfile` / assign route checks | Voice profile | boolean / 404/409 | active + non-empty voice_id | Inactive / missing | Voice PATCH | **Yes** when assigning |
| Case engine `validation.ts` (`icd11_missing`, `dsm5_missing`, etc.) | Disorder packages / catalog rows | issues | Flags missing ICD-11; also flags when **both** DSM-5 and ICD-11 absent | Missing clinical codes | Disorder catalog tests / generation | **Session/generation**, not avatar row insert — but Phase 3B publish must link only catalog disorders that satisfy existing clinical-code rules |
| Postgres `disorders_require_clinical_code` | `disorders` row | CHECK | At least one of `dsm5_code` or `icd11_code` non-empty (`20260803050605`) | Insert/update disorder without clinical code | DB | **Do not invent a new disorder schema** — reuse catalog + this CHECK when linking `personas.default_disorder_id` |
| Template/preset generate validators | Template/preset + persona | issues | Engine-specific | Generation fail | Preview + session start | Optional at create; required if wizard binds defaults |
| Rubric shape | Informal TS | — | No dedicated avatar rubric validator found | — | Assessment uses session rubric | Soft / future |
| ClinicalCore completeness | Type-level only | — | No dedicated `validateClinicalCore` found | — | — | **Gap:** recommend typed validator before publish |

**Safely reusable now:** `validateHumanPersonality`, voice assign checks, completeness assessor (soft), Postgres constraints.  
**Must add for create:** server-side avatar v2 document validation (wire `avatar.v2.json` or equivalent hand validator), clinical_core structural checks, slug uniqueness, dual-locale authorship rules.

---

## 6. Bilingual Contract

### 6.1 Representation

| Layer | EN | AR | Evidence |
|---|---|---|---|
| Personality locales | `en-US` | `ar-JO` | `AvatarLocale`, seeds, `normalizeAvatarLocale` aliases |
| UI / session language | `en` | `ar` | `PreferredLanguage`; cookie + profile |
| Normalization | `en`→`en-US` | `ar`/`ar-sa`/…→`ar-JO` | `resolve.ts` `LOCALE_ALIASES` |
| Authoring schema | required key | required key | `avatar.v2.json` `"required": ["en-US","ar-JO"]` |
| Voice profiles language check | `'en'` | `'ar'` | `voice_profiles_language_check` |
| Flat columns | single `language`/`dialect` | AR voice in `voice_id_ar` | Projection of default locale |

### 6.2 Are both languages mandatory?

| Gate | Both EN+AR mandatory? | Evidence |
|---|---|---|
| Postgres INSERT | **No** | `personalities` nullable; no CHECK for keys |
| `avatar.v2.json` authoring | **Yes** | required properties on personalities object |
| Runtime `resolveAvatar` / `pickPersonality` | **No** — falls back to any available / default locale / flat v1 | `pickPersonality` fallbacks |
| Session start | **No** — uses requested/profile/default locale | `POST /api/sessions` |
| Phase 2 completeness UX | Treats missing AR as incomplete | `assessVirtualPatientCompleteness` |
| Product bilingual policy (docs / CLAUDE.md) | Native dual authorship; never machine-translate | Workspace rules |

**Contract recommendation:** Treat dual `en-US` + `ar-JO` **natively authored** personalities as **mandatory for Publish**; allow draft Save with one locale only if product approves (today UX marks incomplete). Do not invent translation pipelines.

### 6.3 Fallback behavior

**AvatarPersonality (Module 2) locale pick:**

1. Requested locale personality if active.  
2. Same language family.  
3. `default_locale`.  
4. First active personality.  
5. If no personalities / schema_version &lt; 2: flat-column synthesis path in `resolveAvatar`.

**Human personality (Module 2b) — authoritative runtime order** (`src/lib/personality-engine/resolve.ts`):

1. Frozen session snapshot (when present).  
2. Persisted `avatars.human_personality` map (locale / language-family / any-valid pick).  
3. Builtin catalog by **slug** (`maya-chen`, `jordan-hale` only).  
4. **`synthesizeHumanPersonalityFromAvatar()`** — deterministic, never calls GPT; **always returns a valid `HumanPersonalityProfile`**.

Therefore:

- `human_personality` is an **authored-quality** configuration input.  
- Missing authored `human_personality` on a new/unknown slug does **not** produce soft-absent Module 2b.  
- `resolveAvatar()` always attaches Module 2b via this resolver (snapshot → DB → builtin → synthesis).  
- Do **not** describe missing authored HP as “empty Module 2b”, “empty soul”, “missing Module 2b”, or a runtime Module 2b failure.

**Runtime safety vs authored training quality:**

| Concern | Rule |
|---|---|
| **Runtime safety** | Missing authored `human_personality` does **not** break Module 2b; synthesis keeps a valid profile available. |
| **Authored training quality** | Active / published Virtual Patients should carry deliberately authored, clinically coherent human personality (both locales when publish requires it). Prefer authored over synthesis. |

Draft may rely on synthesis. Publish gates that require authored HP do so for **deliberate characterization quality**, not because Module 2b would otherwise be absent.

---

## 7. Voice Contract

### 7.1 What must exist

| Element | Required? | Notes |
|---|---|---|
| `voice_profiles` row | Only if assigning registry voice | Core identity: provider, voice_name, voice_id, language ∈ {en,ar}, is_active |
| Clinical Voice Profile columns (existing) | Optional / defaulted on registry row | From `20260807120000_clinical_voice_profiles.sql`: `speech_rate`, `pitch`, `energy`, `prosody`, `breathing`, `hesitation_frequency`, `speaker_boost`, `emotion_modulation`, `pronunciation_ar`, `pronunciation_en`, plus `updated_at` (voice_profiles-only trigger). **Documentation inventory only — do not invent new voice columns in Phase 3B.** |
| `avatars.voice_profile_id` | Optional | Preferred resolution when language matches session locale |
| `voice_id` / `voice_id_ar` | Optional | Legacy; synced by assign API / sync trigger |
| Personality `voice` object | Part of AvatarPersonality type | `stt_lang`, `tts_lang` expected in authored docs; `voice_id` optional |
| ElevenLabs API key / env default | Runtime TTS | `resolveAvatarSpeechVoice` → env_default source |

Phase 3B must **reuse** the existing `voice_profiles` architecture (assign active profile via `voice_profile_id` / legacy columns). Creating or altering clinical voice columns is out of scope for avatar create.

### 7.2 Can an avatar exist without a voice?

**Yes.** DB allows null voice fields. Session create does not require voice. Text sessions skip TTS. Voice TTS uses registry → legacy columns → **env default**. Soft incompleteness in admin UX only.

### 7.3 Existing assignment API

`PATCH /api/admin/avatars/[id]/voice` — admin auth, rate limit 60/hour, validates profile exists + active, syncs legacy columns, `logSecurityEvent(admin.avatar.voice.assign)`.

**Production-ready recommendation:** assign at least one active profile matching primary locale before Publish; ideally EN+AR coverage via profile language match **or** legacy `voice_id` + `voice_id_ar` (single `voice_profile_id` is one profile — bilingual TTS often relies on legacy dual columns or locale-matched profile + fallback).

---

## 8. Clinical Contract

### 8.1 Avatar-level vs session-level

| Concern | Avatar-level | Session-level |
|---|---|---|
| Authored default syndrome text | `avatars.disorder`, `clinical_core.*` | Overridden by case mint |
| Diagnosis ownership | **Must not** be permanent | `clinical_snapshot.primary_diagnosis` |
| Demographics | `clinical_core.age/gender` (preferred) | Snapshot may merge age/gender from avatar core |
| Risk / symptoms / goals | Authored in `clinical_core` | Copied/generated into snapshot at case create |
| Human personality freeze | Row map | May freeze onto snapshot |

### 8.2 Field classification (avatar `clinical_core`)

| Field | Classification |
|---|---|
| `disorder` | REQUIRED for clinically usable; also feeds flat NOT NULL via sync |
| `age`, `gender` | REQUIRED for clinically usable (TypeScript ClinicalCore) |
| `symptom_profile`, `disclosure_rules`, `session_goals`, `ideal_approach`, `risk_profile` | REQUIRED in TypeScript shape for rich Module 1; DB does not enforce |
| `dsm5_code`, `icd11_code` | OPTIONAL on avatar; catalog disorders are constrained separately (see §8.4) |
| `severity`, `onset_duration` | OPTIONAL |
| `protective_factors`, `mse`, `formulation` | OPTIONAL Stage 6 extensions |
| Medications / full history | Often in personality `case_file` / disorder packages / offline JSON — **not a dedicated avatars column** |
| Suicide / violence | Inside `risk_profile` (`suicidal_ideation`, `harm_to_others`, …) — authored defaults; session snapshot is source of truth during session |

### 8.3 Session mint fallback (`createCaseForSession`)

Resolution order for primary diagnosis:

1. Explicit `disorderSlug` / preset / template path.  
2. Hardcoded slug map for `maya-chen` / `jordan-hale` when no persona default.  
3. `personas.default_disorder_id`.  
4. **Synthesize legacy disorder from `avatar.clinical_core` / `avatar.disorder`.**

Therefore a new avatar **can** start sessions without a `disorders` row, but clinical richness and ICD validation suffer. **Minimum clinically usable** should link a `personas.default_disorder_id` to an active catalog disorder **or** pass disorder at session start.

### 8.4 Disorder catalog clinical-code requirement (existing)

**Do not invent a new disorder schema.** Phase 3B must use the existing `disorders` catalog and validators.

| Layer | Requirement | Evidence |
|---|---|---|
| Postgres CHECK `disorders_require_clinical_code` | At least one of `dsm5_code` **or** `icd11_code` non-empty (trimmed) | `20260803050605_data_integrity_certification.sql` |
| Case engine `validation.ts` | Emits `icd11_missing` when ICD-11 is absent; also emits `dsm5_missing` when **both** codes are absent | `src/lib/case-engine/validation.ts` |
| Avatar `clinical_core` codes | Still optional on the avatar row | Soft authoring aids; not a substitute for catalog linkage |

**Phase 3B implication:** when create/publish links `default_disorder_slug` / `default_disorder_id`, select only active catalog rows that already satisfy the existing clinical-code constraint. Prefer catalog disorders with ICD-11 present so case-engine package validation does not fail on mint/preview. Do **not** add migrations or alter the disorder catalog for avatar authoring.

---

## 9. Personality Contract

Two distinct systems share the word “personality”:

### 9.1 AvatarPersonality (Module 2 — `avatars.personalities`)

Locale document: identity, `persona_prompt`, speech, cultural_context, language_module, safety_module, voice, flags `authored_natively: true`, `never_translate: true`.  
**DB:** free-form JSONB. **Authoring:** `avatar.v2.json` requires both locales.  
**Runtime pick:** needs `identity` + `persona_prompt` (`isPersonality` guard).

### 9.2 Human Personality Engine (`avatars.human_personality`)

Validated by `validateHumanPersonality` / `human-personality.v1.json`:

- `version: 1`, `locale`
- Strings: temperament, attachment_notes, education, occupation, culture, religion, coping_notes, humor_notes, trust_notes, emotional_regulation_notes, speech_style, treatment_expectations
- Enums: attachment_style, coping_style, humor, emotional_regulation
- Scales 1–5: resilience, openness, agreeableness, conscientiousness, neuroticism, trust_level
- Nested: intelligence {band, strengths, style}, vocabulary, preferred/avoidant topics, memory_of_therapist

**Persistence:** `saveHumanPersonalityProfile` updates avatar map; best-effort mirrors into `personas.traits`.  
**DB default:** empty `{}` allowed.  
**Builtins:** authored catalogs only for known slugs (`maya-chen`, `jordan-hale`).  
**Runtime fallback:** if snapshot, DB map, and builtin all miss, `synthesizeHumanPersonalityFromAvatar()` returns a **valid** `HumanPersonalityProfile`. Module 2b remains available; this is **runtime safety**, not authored training quality.

`human_personality` is therefore an **authored-quality** input. It is **not** optional for product-quality published patients merely because synthesis exists — prefer deliberately authored profiles over the synthesizer for ACTIVE / PUBLISHED Virtual Patients.

**UI mapping:** Phase 1 wizard Step 3 should map human-readable controls → **existing** profile fields (no new schema). Attachment/coping/humor/regulation → enum selects; Big-Five-like scales → 1–5; free-text notes → `*_notes` fields.

**Publish validation messaging (when HP authoring is required):** use wording equivalent to:

> Authored human personality is required for publication to ensure deliberate and consistent patient characterization.

Do **not** say that HP is required “because otherwise Module 2b is absent.”

---

## 10. Case / Template / Preset Contract

| Object | Required at avatar create? | Evidence |
|---|---|---|
| `case_instances` | **No** | Created per session |
| Scenario template | **No** | Optional `templateId`/`templateSlug` on session start |
| Instructor preset | **No** | Optional `presetId`/`presetSlug` |
| Rubric on avatar | **No** (defaults `[]`) | Used in assessment; empty weakens scoring narrative |
| Competency mapping | **No** | On templates/presets/CGE — session/curriculum scope |
| `personas` + default disorder | **No** for INSERT; **recommended** for predictable mint | `personaFromAvatar` fallback exists |

Wizard Step 6 (Therapy configuration) should **link optional defaults** for later session start / preview — not block DB create unless product mandates a bound preset.

---

## 11. Runtime Contract

Trace:

```text
Admin Save (future)
  → INSERT avatars (RLS admin)
  → optional INSERT personas
  → optional voice assign / human_personality update

Therapist library
  → SELECT avatars WHERE is_active (RLS)

POST /api/sessions
  → require active avatar (404 if missing/inactive)
  → createCaseForSession (persona/disorder/template/preset)
  → INSERT sessions + clinical_snapshot

POST .../message
  → resolveAvatar(avatar, language, { caseSnapshot })
  → human personality resolve + prompt engine
  → patient agent (or persona_fallback)
  → TTS optional via voice resolution
```

### 11.1 Hard runtime failures (even if INSERT succeeded)

| Condition | Failure |
|---|---|
| `is_active = false` | Session start 404 “Avatar not found” |
| Avatar deleted / wrong id | 404 |
| Case generation returns `ok: false` | 400/404/500 from session create |
| Unknown comorbidity slug | 400 |
| Report write keys missing at end | Session end 500 (unrelated to avatar create, but ops) |

### 11.2 Soft degradations (session still runs)

| Condition | Behavior |
|---|---|
| Missing AR personality | Falls back to EN/default |
| Empty `human_personality` + unknown slug | **Runtime safety:** `synthesizeHumanPersonalityFromAvatar()` supplies a valid Module 2b profile (not soft-absent). **Training quality:** characterization may be generic / less distinctive than deliberately authored HP — treat as authored-quality gap for publish, not Module 2b absence |
| No voice assigned | Env default TTS / text mode |
| Missing `clinical_core` | Flat synthesis / legacy disorder package |
| No AI keys | `persona_fallback` replies (must surface `aiSource`) |
| No `personas` row | `personaFromAvatar` synthetic persona |

### 11.3 Authored slug special-cases

Hardcoded disorder defaults and therapy cue harvests exist for **`maya-chen`** and **`jordan-hale`**. New slugs **do not** inherit those shortcuts — they need `clinical_core`, disorder linkage, and preferably **authored** stored `human_personality` for training quality (runtime Module 2b still synthesizes if authored HP is missing).

---

## 12. Update Contract

| Field / concern | Classification | Notes |
|---|---|---|
| `name` / identity display / portrait | SAFE TO EDIT (with validation) | Prefer edit via personalities + sync |
| `slug` | SHOULD NEVER CHANGE AFTER PUBLICATION | Builtin catalogs / URLs / uniqueness; changing breaks builtins |
| `schema_version` | SHOULD NEVER CHANGE after set to 2 | |
| `clinical_core` content | REQUIRES VALIDATION | Affects future sessions’ fallbacks; **does not** mutate past `clinical_snapshot` |
| Flat `disorder` | REQUIRES VALIDATION / prefer via clinical_core | Authored default only |
| `personalities` locale docs | REQUIRES VALIDATION | Dual authorship rules |
| `human_personality` | REQUIRES VALIDATION | Existing PUT API |
| `voice_profile_id` / legacy voice ids | SAFE TO EDIT via assign API | |
| `rubric` / `ideal_guidelines` | REQUIRES VALIDATION | Teaching targets |
| `is_active` | SAFE TO EDIT via lifecycle transitions only | Prefer writing `lifecycle_status`; projection follows |
| `lifecycle_status` | SAFE TO EDIT with state-machine rules | Create=`draft`; publish/archive/restore via explicit ops |
| `id`, `created_at` | SHOULD NEVER CHANGE | |
| Past session `clinical_snapshot` | SESSION-IMMUTABLE | Never rewrite from avatar edits |
| Diagnosis on past reports | SESSION-IMMUTABLE | |
| Competency / learner rows | DO NOT mutate via avatar edit | |

**Publication semantics:** Editing a **published** avatar immediately affects new sessions. Published records are **immutable** through normal PATCH. Correct flow: **Duplicate → Draft → edit → validate → testing → publish**. Withdraw with **Archive** (`published → archived`). Do not PATCH published → draft.

---

## 13. Duplication Contract

No duplicate API exists. Proposed semantics from architecture:

| Object | Action |
|---|---|
| New `avatars.id` | REGENERATE |
| `slug` | RESET (new unique slug; never copy) |
| Identity / `personalities` / `clinical_core` / `rubric` / `ideal_guidelines` | COPY then modify |
| `human_personality` | COPY |
| `voice_profile_id` | RELINK (same FK; do not clone voice_profiles row) |
| `voice_id` / `voice_id_ar` | COPY or re-derive from assign |
| `is_active` | RESET via `lifecycle_status='draft'` projection (`false`) |
| `lifecycle_status` | RESET to **`draft`** |
| `created_at` / `updated_at` | REGENERATE |
| `personas` row | COPY identity fields; REGENERATE ids; RELINK `avatar_id`; optionally RELINK `default_disorder_id` |
| `sessions`, messages, reports | DO NOT COPY |
| `case_instances`, `clinical_snapshot`, `case_memory` | DO NOT COPY |
| Learner / ACE / CGE data | DO NOT COPY |
| Security audit history | DO NOT COPY |
| Offline `personas/*.json` | DO NOT COPY automatically |

---

## 14. Activation / Lifecycle Contract

### 14.1 Canonical model (Option B)

| Field | Authority |
|---|---|
| `lifecycle_status` | **Canonical** admin lifecycle |
| `is_active` | **Projection** for therapist RLS and session-start visibility |

Production mapping:

| `lifecycle_status` | `is_active` | Therapist visible |
|---|---|---|
| `draft` | `false` | No |
| `testing` | `false` | No |
| `published` | `true` | Yes |
| `archived` | `false` | No |

### 14.2 What `is_active` means

- **RLS:** therapists SELECT only when `is_active = true` (admins see all).  
- **Session start:** inactive → 404 for therapists.  
- **Must equal** `(lifecycle_status = 'published')` under production sync.  
- Column default remains `true` historically — **create paths must set `lifecycle_status='draft'`** so projection yields inactive.

### 14.3 Who can change lifecycle

Admins only (`requireApiAdmin` / RLS `is_admin()`). Transitions must follow the state machine (§14.6). Clients must not set `is_active` / `lifecycle_status` arbitrarily on create/update payloads.

### 14.4 Publish / archive / restore (corrected Phase 3B)

1. **Create** → `lifecycle_status='draft'` (`is_active=false`).  
2. Optional **Testing** → `testing` (`is_active=false`); admin preview / future admin-test session.  
3. **Publish** (gated) → `published` (`is_active=true`) + audit.  
4. **Archive** (withdraw published, or unused draft/testing) → `archived` (`is_active=false`) + audit.  
5. **Restore** → `archived → draft` (explicit).  

**DEACTIVATE is not a state.** For published patients, deactivate **means archive**. Temporary non-public work stays in draft or testing.

### 14.5 Draft / Testing / Publish — runtime safety vs authored quality

| State | Representation | Human personality | Other incompleteness |
|---|---|---|---|
| **DRAFT** | `lifecycle_status='draft'` | May be incomplete; runtime may synthesize Module 2b | Allowed under admin-only visibility |
| **TESTING** | `lifecycle_status='testing'` | Prefer authored; may still be incomplete pending gates | Admin-visible only; therapist-invisible |
| **PUBLISH** | `lifecycle_status='published'` | Must satisfy authored-quality publish gates | Dual native personalities, clinical_core, voice/disorder policy |
| **ARCHIVED** | `lifecycle_status='archived'` | Frozen content retained | Not therapist-visible; history intact |

Publish validation messages for missing authored HP must be equivalent to:

> Authored human personality is required for publication to ensure deliberate and consistent patient characterization.

They must **not** claim Module 2b would be absent without authored HP.

### 14.6 State machine (from PR #188; authoritative)

Allowed transitions:

```text
draft     → testing | published | archived
testing   → draft | published | archived
published → archived
archived  → draft
```

Forbidden: `published → draft|testing` (use **Duplicate** instead).  
`draft|testing → published` requires the publish validation gate.

### 14.7 Published immutability

Published Virtual Patients **cannot** be destructively edited via PATCH.

Correct flow:

```text
Published → Duplicate → New Draft → Edit → Validate → Testing → Publish
```

Do not allow PATCH to silently convert published → draft.

### 14.8 Audit logging

Publish / archive / restore / create / duplicate must `logSecurityEvent`. Prefer actions such as `admin.avatar.publish`, `admin.avatar.archive`, `admin.avatar.lifecycle` (exact names at implementation time).

---

## 15. Archive Contract

**IMPLEMENTED IN PRODUCTION** via `lifecycle_status='archived'` (not a separate `archived_at` column).

- Canonical withdrawal: **`published → archived`**.  
- Archived rows remain in the database and remain admin-visible.  
- Archived rows are **not** therapist-visible (`is_active=false`).  
- Archive does **not** mutate historical sessions, clinical snapshots, reports, ACE/CGE, or learner data.  
- Restore: **`archived → draft`** via explicit admin workflow.  
- Hard DELETE remains RLS-allowed for admins but blocked when sessions reference the avatar (`ON DELETE RESTRICT`) — prefer archive over delete.  
- Do **not** introduce a fifth “deactivate” state; UI uses **Archive**.
---

## 16. Security Contract (future `POST /api/admin/avatars`)

Design only — mirror existing admin routes (`voice`, `personality`):

| Requirement | Spec |
|---|---|
| Authentication | Session user via `requireApiAdmin` |
| Authorization | `profiles.role = 'admin'` only; deny writes `security_audit_events` on requireApiAdmin failure |
| Rate limit | e.g. `rateLimit(\`admin-avatar-create:${user.id}\`, 20, 1h)` before work; 429 + Retry-After |
| Validation | Body schema → avatar v2 + HP validators → voice id checks; never trust client `id` |
| Client errors | `clientSafeError` / sanitized messages; no raw Postgres/provider dumps |
| Audit | `logSecurityEvent({ action: 'admin.avatar.create', outcome, resourceType: 'avatar', resourceId })` |
| Logging | No persona prompts / clinical narratives in logs at info level; ids + slug only |
| RLS | Prefer **authenticated admin server Supabase client** (`createClient` / `requireApiAdmin`’s supabase) so RLS INSERT policies apply |
| Service role | **Not required** for avatar INSERT (admin RLS suffices). Avoid service role unless a multi-table RPC cannot be done under user JWT |
| RPC / transaction | Strongly recommended if writing `avatars` + `personas` together (see §17) |
| Idempotency | Optional `Idempotency-Key` or unique `slug` conflict → 409 |

---

## 17. Atomicity

### 17.1 Multi-table?

| Write | Same transaction needed? |
|---|---|
| Single `avatars` row with all JSONB + voice FK | One statement — atomic |
| `avatars` + `personas` | **Yes — multi-table** |
| `avatars` + `human_personality` locales | Same row — atomic if one UPDATE/INSERT |
| Voice profile creation | Separate catalog concern; usually RELINK existing |

### 17.2 Failure modes to prevent

| Failure | Risk | Mitigation |
|---|---|---|
| Avatar inserted as published / active, personalities incomplete | Therapists see broken patient | Insert `lifecycle_status='draft'`; publish gate |
| Avatar without clinical_core | Weak sessions / legacy synthesize | Validate before publish |
| Avatar without voice | Soft TTS fallback | Completeness warn; optional hard gate |
| Avatar without personas row | Session still works via fallback | Recommended companion insert in same txn |
| Partial human_personality (one locale) | Soft | Completeness / publish policy |

**Recommendation:** Use a **SECURITY INVOKER RPC** (with `is_admin()`) or Route Handler transaction for create that inserts avatar (`lifecycle_status='draft'`) + optional persona. Do not expose multi-step client writes without draft invisibility.

---

## 18. Error / Rollback

| Failure | Expected behavior |
|---|---|
| Personality (HP) validation fails | **400**; no row written (if create is one transaction) |
| Avatar v2 / clinical validation fails | **400**; no row |
| Voice assignment fails | Prefer create without voice + warn, **or** fail whole txn if publish-complete requested; do not leave active incomplete patient |
| Persona insert fails after avatar insert | **Rollback avatar** (transaction) — do not leave orphan without documented fallback |
| Case/template/competency config fails | These are **not** part of avatar INSERT; fail only if wizard insists on binding; otherwise save avatar and surface warning |
| Unique slug conflict | **409**; no write |
| Partial records | Allowed **only** as `draft`/`testing`/`archived` under admin-only SELECT; never as `published` therapist-visible rows |

---

## 19. Wizard Field Mapping

Phase 2 UI is an **inline wizard shell** at `src/app/(app)/admin/avatars/new/page.tsx` (`/admin/avatars/new`). It currently exposes **step labels only** (no bound inputs). There is **no** separate `VirtualPatientWizard` React component today — do not create one solely for naming. Mapping uses Phase 1 proposed fields + step names → backend.

| Wizard field (Phase 1/2) | Database field | API (today / future) | Validator | Required? | Notes |
|---|---|---|---|---|---|
| Display name | `personalities[*].identity.display_name` → sync `name` | future POST | v2 / NOT NULL name | Yes | Dual locale names may differ (Maya vs ليان) |
| Given/family name | `personalities[*].identity.*` | future POST | soft | Optional | |
| Age | `clinical_core.age` → sync `age` | future POST | ClinicalCore | Yes (usable) | |
| Gender | `clinical_core.gender` → sync `gender` | future POST | enum | Yes (usable) | |
| Portrait | `personalities[*].identity.portrait_url` → `portrait_url` | future POST | URL soft | Optional | |
| Slug | `slug` | future POST | unique partial index | Strongly yes | |
| Default locale | `default_locale` | future POST | default en-US | Yes | |
| Locales available | `personalities` keys → `available_locales` | trigger | v2 requires en-US+ar-JO | Publish: yes | |
| Primary diagnosis label | `clinical_core.disorder` / flat `disorder` | future POST | NOT NULL | Yes | Not session ownership |
| DSM / ICD | `clinical_core.dsm5_code` / `icd11_code` | future POST | soft on avatar; catalog CHECK + case validators for linked disorder | Optional on avatar | Prefer `personas.default_disorder_id` → active `disorders` row satisfying `disorders_require_clinical_code` (DSM-5 and/or ICD-11) |
| Severity | `clinical_core.severity` | future POST | enum | Optional | |
| Comorbidities | **Not stored on avatar** | session/template | case validators | Session | |
| Risk / suicide / violence | `clinical_core.risk_profile` | future POST | structure | Usable: yes | |
| Symptoms / disclosure / goals / approach | `clinical_core.*` | future POST | structure | Usable: yes | |
| Meds / history localization | `personalities[*].case_file` / disorder packages | future POST | soft | Optional | |
| Human traits (scales/enums/notes) | `human_personality[locale]` | `PUT /api/admin/personality` or create POST | `validateHumanPersonality` | Publish: authored yes both locales (quality gate — not “Module 2b absent”) | Draft may omit and rely on synthesis at runtime |
| Authored persona prompt / speech / culture / safety | `personalities[locale].*` | future POST | v2 / isPersonality | Publish: yes | |
| Behaviour (disclosure, resistance, difficulty) | Map to existing clinical_core disclosure_rules, speech fields, optional preset difficulty — **no new engine** | future + session | existing | Mostly session/preset | |
| Voice picker | `voice_profile_id` (+ legacy sync) | `PATCH .../voice` | active profile | Completeness: yes | |
| Dialect / STT/TTS langs | personality.voice + flat dialect | future POST | soft | Recommended | |
| Therapy modality / template / preset / competencies | **Not avatar columns** | session start / preview APIs | engine validators | Optional binds | Store as admin metadata only if approved — **no column today** |
| Rubric items | `rubric` | future POST | soft | Optional | |
| Preview | resolve + formatters | read APIs | — | — | |
| Validate checklist | completeness + validators | future | composite | Publish gate | |
| Save draft | INSERT `lifecycle_status='draft'` | future POST | partial policy | — | |
| Move to testing | UPDATE `lifecycle_status='testing'` | future | optional gate | — | |
| Publish | UPDATE `lifecycle_status='published'` | future | full gate + audit | — | |
| Archive | UPDATE `lifecycle_status='archived'` | future | audit | — | |
| Archive | **N/A** | — | — | — | NOT IMPLEMENTED |

---

## 20. Minimum Valid Avatar

### 20.1 MINIMUM DATABASE VALID

Satisfies Postgres INSERT only:

```text
name: "Test Patient"
disorder: "Unspecified"
persona_prompt: "You are a patient in a therapy training session."
-- all other columns use defaults (is_active=true unless lifecycle set, schema_version=1, human_personality={}, …)
```

**Not acceptable for product.** Would appear to therapists immediately unless `lifecycle_status='draft'` is set (projection → `is_active=false`).

### 20.2 MINIMUM CLINICALLY USABLE

```text
schema_version: 2
lifecycle_status: draft
is_active: false (projected)
slug: unique
default_locale: "en-US"
name / disorder / persona_prompt: present (or fully supplied via v2 sync sources)
clinical_core: disorder, age, gender, symptom_profile[], disclosure_rules[], session_goals[], ideal_approach, risk_profile
personalities:
  en-US: identity + persona_prompt + speech + cultural_context + language_module + safety_module + voice{stt_lang,tts_lang}
  ar-JO: independently authored equivalent (not translated)
human_personality: en-US + ar-JO **authored** profiles passing validateHumanPersonality (publish quality; runtime can synthesize if draft omits)
personas row: recommended with default_disorder_id → active disorders.slug that satisfies disorders_require_clinical_code
voice_profile_id: optional but recommended (reuse existing voice_profiles incl. clinical delivery columns)
case/template/preset/competencies: not required
```

### 20.3 MINIMUM PRODUCTION READY

Clinically usable **plus**:

- Publish validation gates green (dual locale, **authored** HP both locales for characterization quality, clinical_core richness, voice assigned or explicit waiver, default disorder clinical-code compliant when linked).  
- `lifecycle_status='published'` (`is_active=true`) only after gates.  
- Rubric non-empty for assessment quality.  
- Security audit on create + publish.  
- No reliance on Maya/Jordan hardcoded slug shortcuts.  
- Documented default session path (disorder slug or persona default) verified via case preview.  
- HP publish messaging cites authored characterization quality — **not** Module 2b runtime absence.

---

## 21. Proposed API Contract

### 21.1 `POST /api/admin/avatars`

**Auth:** `requireApiAdmin` · **Rate limit:** 20/hour/user · **Client:** admin SSR Supabase (RLS).

**Request (illustrative; fields must exist on schema):**

```json
{
  "slug": "new-patient",
  "default_locale": "en-US",
  "lifecycle_status": "draft",
  "schema_version": 2,
  "clinical_core": { "...": "ClinicalCore" },
  "personalities": {
    "en-US": { "...": "AvatarPersonality" },
    "ar-JO": { "...": "AvatarPersonality" }
  },
  "human_personality": {
    "en-US": { "...": "HumanPersonalityProfile" },
    "ar-JO": { "...": "HumanPersonalityProfile" }
  },
  "rubric": [],
  "voice_profile_id": null,
  "persona": {
    "create": true,
    "default_disorder_slug": "mdd-recurrent-moderate"
  }
}
```

Flat `name` / `disorder` / `persona_prompt` may be omitted **only if** the server derives them before INSERT (or depends on trigger after supplying both JSONB **and** temporary placeholders). Safest: server computes flats from v2 document, then INSERT.

**Success 201:**

```json
{
  "avatar": {
    "id": "uuid",
    "slug": "new-patient",
    "lifecycle_status": "draft",
    "is_active": false,
    "schema_version": 2,
    "available_locales": ["ar-JO", "en-US"]
  },
  "persona_id": "uuid-or-null",
  "completeness": {
    "isComplete": false,
    "incompleteReasons": ["Voice not assigned"]
  }
}
```

**Errors:**

| Status | When |
|---|---|
| 401/403 | Auth / admin |
| 400 | Validation issues (`issues: [...]`) |
| 409 | Slug conflict / inactive voice assign |
| 429 | Rate limit |
| 500 | Sanitized persistence failure |

**Audit:** `admin.avatar.create` success/failure.  
**Transaction:** avatar (+ optional persona) atomic; on failure no therapist-visible row.  
**Idempotency:** unique slug; optional Idempotency-Key header.

### 21.2 Related future endpoints (corrected Phase 3B — design only)

- `PATCH /api/admin/avatars/[id]` — validated update; **refuses published**  
- `POST /api/admin/avatars/[id]/publish` — sets `lifecycle_status='published'` after gates + audit  
- `POST /api/admin/avatars/[id]/archive` — sets `lifecycle_status='archived'` + audit  
- Optional compatibility: `POST …/deactivate` **alias for archive** only (prefer Archive in UI)  
- Optional: `POST …/lifecycle` for testing / restore transitions  
- Reuse existing voice + personality routes for incremental edits on draft/testing  
- Duplicate: `POST /api/admin/avatars/[id]/duplicate` → new `draft` following §13  
- Preview: `POST /api/admin/avatars/[id]/preview` via `resolveAvatar` (no Phase 3C sandbox chat)
---

## 22. Risks

1. **Default `is_active=true` / naive INSERT without `lifecycle_status='draft'`** makes rows therapist-visible if projection is bypassed.  
2. **No runtime enforcement of `avatar.v2.json`** — incomplete bilingual patients can be stored as drafts.  
3. **New slugs lack builtin HP catalogs and therapy-cue harvests** — runtime still synthesizes Module 2b; publish should require authored HP (quality gate).  
4. **Diagnosis semantics drift** if UI treats avatar disorder as permanent ownership.  
5. **Single `voice_profile_id`** poorly models dual-locale TTS without legacy columns.  
6. **Multi-table create without transaction** → orphan personas or missing personas inconsistency.  
7. **Hard DELETE** vs session RESTRICT — ops confusion; prefer **archive**.  
8. **Wizard therapy binds** tempting to store template/preset on avatar without columns — scope creep.  
9. **Partial AR authorship** conflicts with product bilingual policy.  
10. **Service-role misuse** could bypass RLS and recreate past outage classes.  
11. **Boolean-only Phase 3B drafts** (pre-reconciliation) silently archive published rows via reverse sync — must write `lifecycle_status`.  
12. **Git vs production lifecycle migration version drift** (`71439` vs `72816`) — do not re-apply or auto-rename.

---

## 23. Items requiring explicit approval

1. **Lifecycle policy:** Confirmed Option B — `lifecycle_status` canonical (this amendment).  
2. **Publish hard gates:** Dual locales? Both HP profiles? Voice required? Non-empty rubric?  
3. **Persona row:** Mandatory companion insert on create?  
4. **Default disorder:** Require catalog linkage vs clinical_core-only?  
5. **Atomic RPC vs Route Handler:** approve approach before coding.  
6. **Slug immutability** after publish.  
7. **Archive / restore UX** copy and confirmation.  
8. **Wizard therapy binds:** session-only vs new avatar metadata (schema approval).  
9. **Whether Save may persist incomplete drafts** (allowed under draft).  
10. **Duplication product behavior** and naming (`slug` suffix rules).  
11. **Whether `/deactivate` alias** is retained temporarily.  
12. **Admin test-session** integration timing (post-reconciliation Phase 3B vs Phase 3C).

---

## AUDIT STATUS

| Area | Status |
|---|---|
| Database contract | **COMPLETE** (incl. production lifecycle) |
| Creation path | **COMPLETE** (none in app on `main`; seeds + prod lifecycle present) |
| Validation | **COMPLETE** (reuse + gaps identified) |
| Voice contract | **COMPLETE** |
| Personality contract | **COMPLETE** |
| Clinical contract | **COMPLETE** |
| Runtime contract | **COMPLETE** |
| Lifecycle contract | **COMPLETE** (Option B) |
| Security contract | **COMPLETE** (design-only) |
| API contract | **COMPLETE** (proposal-only; not implemented on this branch) |

### Remaining unknowns

1. Exact preferred bilingual voice model (one profile + legacy dual ids vs two profile FKs).  
2. Whether Phase 3B implementation lands as amended PR #190 or a new branch after this reconciliation.  
3. Full Ajv wiring details for `avatar.v2.json`.  
4. Enterprise/tenant scoping of avatars (`avatars` has no `tenant_id` in reviewed migrations).  
5. Careful git↔production reconciliation of lifecycle migration version strings.

---

### Amendment record (2026-08-10)

Docs-only correction after Phase 3B pre-flight FAIL. Corrected human-personality runtime, voice_profiles clinical inventory, disorder clinical-code constraint, `updated_at` sync behavior, and Phase 2 wizard shell naming. See `docs/VPsych_PHASE3A_CONTRACT_AMENDMENT.md`.

### Amendment record (2026-08-11) — Lifecycle Option B

Docs + contract-level tests only. Replaced `is_active`-only lifecycle assumptions with production **`lifecycle_status`** canonical model; archive/testing/publish/restore semantics; state machine from PR #188; API `/archive` (deactivate alias); migration strategy (do not recreate column; do not apply prior `is_active`-only RPC migration as-is). **No production writes. No migration applied. No authoring API implementation.** See `docs/VPsych_PHASE3B_LIFECYCLE_RECONCILIATION.md`.

---

*End of Phase 3A contract (as amended for lifecycle Option B). Do not implement or deploy Phase 3B until this document is approved and implementation is explicitly authorized.*

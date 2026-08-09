# VPsych — Virtual Patient Creation Contract & Lifecycle Audit

**Phase:** 3A (read-only forensic assessment)  
**Date:** 2026-08-09  
**Branch:** `cursor/vp-creation-contract-b432`  
**Baselines:** `VPsych_SYSTEM_INVENTORY_AND_FUNCTION_CATALOG.md`, `VPsych_ADMIN_UX_ASSESSMENT.md`, `docs/VPsych_ADMIN_UX_PHASE2_IMPLEMENTATION.md`  

**Scope:** Determine exactly what must happen when an administrator clicks **Create Virtual Patient → Save**.  
**Non-scope:** No code, migrations, APIs, schema, RLS, prompts, engines, or production data changes.

Evidence sources: `supabase/migrations/*`, `src/lib/types.ts`, `schemas/avatar.v2.json`, `schemas/human-personality.v1.json`, case/personality/voice modules, admin routes, Phase 2 wizard shell.

---

## 1. Executive Summary

There is **no in-app avatar create path today**. The only production creation mechanism found is **SQL seed migrations** (Maya Chen, Jordan Hale). Application code never calls `avatars.insert`. Phase 2 ships a wizard shell with **Save disabled**.

A future Save must treat the Virtual Patient as a **single-row `public.avatars` document** (schema_version = 2) plus optional related rows:

| Concern | Mandatory for DB insert? | Mandatory for production training use? |
|---|---|---|
| Flat NOT NULL columns (`name`, `disorder`, `persona_prompt`) | **Yes** (Postgres) | Yes |
| `clinical_core` + `personalities` (v2) | No (nullable) | **Yes** for bilingual clinical fidelity |
| Both `en-US` and `ar-JO` personalities | No at DB; **yes** in `avatar.v2.json` authoring schema | **Yes** for product bilingual contract |
| `human_personality` map | Defaults `{}` | Strongly recommended; builtins only for known slugs |
| `voice_profile_id` | No (nullable FK) | Recommended; TTS falls back to env defaults |
| `personas` row | No | Recommended for Case Engine default disorder linkage |
| Case / template / preset / competencies | No at avatar create | Optional at **session** start |
| `is_active = true` | Default true | Publish gate for therapist library |

**Critical architectural invariant (must not be broken):** A persona never permanently owns a disorder. Session diagnosis lives on `sessions.clinical_snapshot` / `case_instances`, minted by `createCaseForSession()`. Avatar `clinical_core.disorder` is an authored **default presentation**, not session ownership.

**Atomicity risk:** Avatar creation is currently a single-table insert in seeds. Production-ready creation involves multiple logical documents on one row (`clinical_core`, `personalities`, `human_personality`, voice FKs) plus an optional `personas` row. Partial visibility to therapists is controlled by **`is_active`** (RLS: therapists see only `is_active = true`). Draft-safe create should insert with **`is_active = false`** until validation + publish.

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
| `is_active` | `boolean` | NOT NULL | `true` | Therapist SELECT gate | REQUIRED FOR CREATION semantics (choose value) · SYSTEM default true |
| `created_at` | `timestamptz` | NOT NULL | `now()` | | SYSTEM-GENERATED |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | Set by sync trigger | SYSTEM-GENERATED |
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

No CHECK constraints on `avatars` beyond PK/FK/index uniqueness for slug and voice FK. No generated columns (Postgres GENERATED). No archive / draft / published enum columns on `avatars`.

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

Implication for Save: if the API inserts v2 with `clinical_core` + `personalities` **and** supplies valid flat NOT NULL columns (or relies on trigger to overwrite them), the trigger will keep flats coherent. **If `clinical_core` or `personalities` is NULL, the trigger does not overwrite flats** — INSERT must still satisfy NOT NULL flats.

### 2.5 RLS policies (current)

From `optimize_rls_initplan_and_fk_index` (initplan form):

| Policy | Command | Rule |
|---|---|---|
| Authenticated can read active avatars | SELECT | `is_active = true OR is_admin()` |
| Admins can insert avatars | INSERT | `is_admin()` |
| Admins can update avatars | UPDATE | `is_admin()` |
| Admins can delete avatars | DELETE | `is_admin()` |

**Evidence:** inserting with `is_active = false` hides the row from therapists immediately; admins still see it.

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
 └── is_active                                   [publish visibility]

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
| 11 | Phase 2 wizard | `/admin/avatars/new` | UI shell only | None | none | — | Save disabled | None | UX shell only |

**Conclusion:** Production Virtual Patients are provisioned by **migrations/ops SQL**, then tuned via personality + voice admin APIs. There is no application INSERT path to reuse; Phase 3 must add one.

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
| Case engine `validation.ts` (`icd11_missing`, etc.) | Disorder packages | issues | ICD-11 for catalog disorders | Missing codes | Disorder catalog tests / generation | **Session/generation**, not avatar row insert |
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

1. Requested locale personality if active.  
2. Same language family.  
3. `default_locale`.  
4. First active personality.  
5. If no personalities / schema_version &lt; 2: flat-column synthesis path in `resolveAvatar`.

Human personality: DB map → else builtin by **slug** (`maya-chen`, `jordan-hale` only) → else soft absence / formatting fallbacks. **New avatars without `human_personality` and without builtin slug get no structured Module 2b traits.**

---

## 7. Voice Contract

### 7.1 What must exist

| Element | Required? | Notes |
|---|---|---|
| `voice_profiles` row | Only if assigning registry voice | provider, voice_name, voice_id, language ∈ {en,ar}, is_active |
| `avatars.voice_profile_id` | Optional | Preferred resolution when language matches session locale |
| `voice_id` / `voice_id_ar` | Optional | Legacy; synced by assign API / sync trigger |
| Personality `voice` object | Part of AvatarPersonality type | `stt_lang`, `tts_lang` expected in authored docs; `voice_id` optional |
| ElevenLabs API key / env default | Runtime TTS | `resolveAvatarSpeechVoice` → env_default source |

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
| `dsm5_code`, `icd11_code` | OPTIONAL on avatar; **ICD-11 required on disorder catalog packages** for case validation |
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
**Defaults:** empty `{}` allowed at DB; builtins only for known slugs.  
**UI mapping:** Phase 1 wizard Step 3 should map human-readable controls → **existing** profile fields (no new schema). Attachment/coping/humor/regulation → enum selects; Big-Five-like scales → 1–5; free-text notes → `*_notes` fields.

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
| Empty `human_personality` + unknown slug | Weak/absent Module 2b traits |
| No voice assigned | Env default TTS / text mode |
| Missing `clinical_core` | Flat synthesis / legacy disorder package |
| No AI keys | `persona_fallback` replies (must surface `aiSource`) |
| No `personas` row | `personaFromAvatar` synthetic persona |

### 11.3 Authored slug special-cases

Hardcoded disorder defaults and therapy cue harvests exist for **`maya-chen`** and **`jordan-hale`**. New slugs **do not** inherit those shortcuts — they need `clinical_core`, disorder linkage, and preferably stored `human_personality`.

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
| `is_active` | SAFE TO EDIT (publish/deactivate) | No API yet — must add |
| `id`, `created_at` | SHOULD NEVER CHANGE | |
| Past session `clinical_snapshot` | SESSION-IMMUTABLE | Never rewrite from avatar edits |
| Diagnosis on past reports | SESSION-IMMUTABLE | |
| Competency / learner rows | DO NOT mutate via avatar edit | |

**Publication semantics:** Editing an active avatar immediately affects new sessions. Prefer deactivate → edit → re-validate → activate for major clinical changes (product policy; not currently enforced).

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
| `is_active` | RESET to `false` (draft) |
| `created_at` / `updated_at` | REGENERATE |
| `personas` row | COPY identity fields; REGENERATE ids; RELINK `avatar_id`; optionally RELINK `default_disorder_id` |
| `sessions`, messages, reports | DO NOT COPY |
| `case_instances`, `clinical_snapshot`, `case_memory` | DO NOT COPY |
| Learner / ACE / CGE data | DO NOT COPY |
| Security audit history | DO NOT COPY |
| Offline `personas/*.json` | DO NOT COPY automatically |

---

## 14. Activation Contract

### 14.1 What `is_active` means today

- **RLS:** therapists SELECT only when `is_active = true` (admins see all).  
- **Session start:** inactive → 404.  
- **Admin UI:** display/filter only (`StatusBadge`); **no toggle API**.  
- **Default on INSERT:** `true` — seeds appear immediately in therapist library.

### 14.2 Who can change it

Admins via UPDATE RLS. No dedicated route; would be a future admin PATCH/Publish action.

### 14.3 Audit logging

Voice assign logs `admin.avatar.voice.assign`. No avatar activate/deactivate audit today — **Publish should add** `logSecurityEvent`.

### 14.4 Future Publish using existing model

Do **not** invent a new publish enum. Recommended:

1. Create/Save draft → `is_active = false`.  
2. Validate gates (v2 locales, clinical, personality, voice policy).  
3. Explicit Publish → `is_active = true` + audit.  
4. Unpublish/Deactivate → `is_active = false` (hides from therapists; existing sessions RESTRICT keep history).

---

## 15. Archive Contract

**NOT CURRENTLY IMPLEMENTED** for avatars.

- No `archived_at`, archive status, or soft-delete column on `avatars`.  
- Presets have archive actions elsewhere — **not** transferable to avatars without new schema.  
- `is_active = false` is sufficient for **temporary deactivation / draft**, and **must not** be labeled “Archived” in UI as if a true archive existed.  
- Hard DELETE is allowed for admins by RLS but blocked if sessions reference the avatar (`ON DELETE RESTRICT`).

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
| Avatar inserted active, personalities incomplete | Therapists see broken patient | Insert `is_active=false`; publish gate |
| Avatar without clinical_core | Weak sessions / legacy synthesize | Validate before publish |
| Avatar without voice | Soft TTS fallback | Completeness warn; optional hard gate |
| Avatar without personas row | Session still works via fallback | Recommended companion insert in same txn |
| Partial human_personality (one locale) | Soft | Completeness / publish policy |

**Recommendation:** Use a **SECURITY DEFINER RPC or server-side transactional function** for create that inserts avatar (inactive) + optional persona, **or** a Route Handler using a single Postgres transaction via RPC. Do not expose multi-step client writes without draft invisibility.

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
| Partial records | Allowed **only** as `is_active=false` drafts under admin-only SELECT; never as active therapist-visible rows |

---

## 19. Wizard Field Mapping

Phase 2 UI currently exposes **step labels only** (no bound inputs). Mapping uses Phase 1 proposed fields + step names → backend.

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
| DSM / ICD | `clinical_core.dsm5_code` / `icd11_code` | future POST | soft; catalog harder | Optional on avatar | Prefer disorders table link via personas |
| Severity | `clinical_core.severity` | future POST | enum | Optional | |
| Comorbidities | **Not stored on avatar** | session/template | case validators | Session | |
| Risk / suicide / violence | `clinical_core.risk_profile` | future POST | structure | Usable: yes | |
| Symptoms / disclosure / goals / approach | `clinical_core.*` | future POST | structure | Usable: yes | |
| Meds / history localization | `personalities[*].case_file` / disorder packages | future POST | soft | Optional | |
| Human traits (scales/enums/notes) | `human_personality[locale]` | `PUT /api/admin/personality` or create POST | `validateHumanPersonality` | Publish: yes both locales | |
| Authored persona prompt / speech / culture / safety | `personalities[locale].*` | future POST | v2 / isPersonality | Publish: yes | |
| Behaviour (disclosure, resistance, difficulty) | Map to existing clinical_core disclosure_rules, speech fields, optional preset difficulty — **no new engine** | future + session | existing | Mostly session/preset | |
| Voice picker | `voice_profile_id` (+ legacy sync) | `PATCH .../voice` | active profile | Completeness: yes | |
| Dialect / STT/TTS langs | personality.voice + flat dialect | future POST | soft | Recommended | |
| Therapy modality / template / preset / competencies | **Not avatar columns** | session start / preview APIs | engine validators | Optional binds | Store as admin metadata only if approved — **no column today** |
| Rubric items | `rubric` | future POST | soft | Optional | |
| Preview | resolve + formatters | read APIs | — | — | |
| Validate checklist | completeness + validators | future | composite | Publish gate | |
| Save draft | INSERT `is_active=false` | future POST | partial policy | — | |
| Publish | UPDATE `is_active=true` | future | full gate + audit | — | |
| Archive | **N/A** | — | — | — | NOT IMPLEMENTED |

---

## 20. Minimum Valid Avatar

### 20.1 MINIMUM DATABASE VALID

Satisfies Postgres INSERT only:

```text
name: "Test Patient"
disorder: "Unspecified"
persona_prompt: "You are a patient in a therapy training session."
-- all other columns use defaults (is_active=true, schema_version=1, human_personality={}, …)
```

**Not acceptable for product.** Would appear to therapists immediately (`is_active` default true).

### 20.2 MINIMUM CLINICALLY USABLE

```text
schema_version: 2
is_active: false until publish
slug: unique
default_locale: "en-US"
name / disorder / persona_prompt: present (or fully supplied via v2 sync sources)
clinical_core: disorder, age, gender, symptom_profile[], disclosure_rules[], session_goals[], ideal_approach, risk_profile
personalities:
  en-US: identity + persona_prompt + speech + cultural_context + language_module + safety_module + voice{stt_lang,tts_lang}
  ar-JO: independently authored equivalent (not translated)
human_personality: en-US + ar-JO profiles passing validateHumanPersonality
personas row: recommended with default_disorder_id → active disorders.slug
voice_profile_id: optional but recommended
case/template/preset/competencies: not required
```

### 20.3 MINIMUM PRODUCTION READY

Clinically usable **plus**:

- Publish validation gates green (dual locale, HP both locales, clinical_core richness, voice assigned or explicit waiver).  
- `is_active=true` only after gates.  
- Rubric non-empty for assessment quality.  
- Security audit on create + publish.  
- No reliance on Maya/Jordan hardcoded slug shortcuts.  
- Documented default session path (disorder slug or persona default) verified via case preview.

---

## 21. Proposed API Contract

### 21.1 `POST /api/admin/avatars`

**Auth:** `requireApiAdmin` · **Rate limit:** 20/hour/user · **Client:** admin SSR Supabase (RLS).

**Request (illustrative; fields must exist on schema):**

```json
{
  "slug": "new-patient",
  "default_locale": "en-US",
  "is_active": false,
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

### 21.2 Related future endpoints (not implementing now)

- `PATCH /api/admin/avatars/[id]` — validated update  
- `POST /api/admin/avatars/[id]/publish` — sets `is_active=true` after gates + audit  
- `POST /api/admin/avatars/[id]/deactivate` — `is_active=false`  
- Reuse existing voice + personality routes for incremental edits  
- Duplicate: `POST /api/admin/avatars/[id]/duplicate` following §13  

---

## 22. Risks

1. **Default `is_active=true`** makes naive INSERT instantly therapist-visible.  
2. **No runtime enforcement of `avatar.v2.json`** — incomplete bilingual patients can be stored.  
3. **New slugs lack builtin HP / therapy cues** — easy to ship “empty soul” patients.  
4. **Diagnosis semantics drift** if UI treats avatar disorder as permanent ownership.  
5. **Single `voice_profile_id`** poorly models dual-locale TTS without legacy columns.  
6. **Multi-table create without transaction** → orphan personas or missing personas inconsistency.  
7. **Hard DELETE** vs session RESTRICT — ops confusion; prefer deactivate.  
8. **Wizard Step 6** tempting to store template/preset on avatar without columns — scope creep / schema change pressure.  
9. **Partial AR authorship** conflicts with product bilingual policy.  
10. **Service-role misuse** could bypass RLS and recreate past outage classes.

---

## 23. Items requiring explicit approval

1. **Draft policy:** Is `is_active=false` the official draft mechanism until a dedicated draft column is approved?  
2. **Publish hard gates:** Dual locales? Both HP profiles? Voice required? Non-empty rubric?  
3. **Persona row:** Mandatory companion insert on create?  
4. **Default disorder:** Require `default_disorder_slug` from catalog vs allow clinical_core-only legacy synthesize?  
5. **Atomic RPC vs Route Handler multi-statement:** approve approach before Phase 3 coding.  
6. **Slug immutability** after publish.  
7. **Archive:** remain unimplemented vs propose migration (out of Phase 3A).  
8. **Wizard therapy binds:** session-only vs new avatar metadata columns (would need schema approval).  
9. **Whether Save may persist incomplete drafts** or only fully validated inactive rows.  
10. **Duplication product behavior** and naming (`slug` suffix rules).

---

## AUDIT STATUS

| Area | Status |
|---|---|
| Database contract | **COMPLETE** |
| Creation path | **COMPLETE** (none in app; seeds only) |
| Validation | **COMPLETE** (reuse + gaps identified) |
| Voice contract | **COMPLETE** |
| Personality contract | **COMPLETE** |
| Clinical contract | **COMPLETE** |
| Runtime contract | **COMPLETE** |
| Security contract | **COMPLETE** (design-only) |
| API contract | **COMPLETE** (proposal-only; not implemented) |

### Remaining unknowns

1. Exact production `information_schema` drift vs migrations — migrations are the repo source of truth; remote parity not re-queried in this audit (`SUPABASE_DB_URL` optional).  
2. Whether product will require a **new** draft column despite recommendation to reuse `is_active`.  
3. Preferred bilingual voice model (one profile + legacy dual ids vs two profile FKs) — only one FK exists today.  
4. Whether Phase 3 will implement create as RPC or Route Handler transaction (needs approval §23.5).  
5. Full Ajv wiring details for `avatar.v2.json` (file is slim relative to TypeScript `AvatarPersonality` richness — hand validator may be needed for nested required fields).  
6. Enterprise/tenant scoping of avatars (institution columns exist on sessions/enterprise tables; **avatars table has no tenant_id** in migrations reviewed) — multi-tenant authoring ownership unclear if required later.

---

*End of Phase 3A read-only contract. Do not implement create/publish APIs until this document is approved.*

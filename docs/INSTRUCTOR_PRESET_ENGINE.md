# VPsych Instructor Preset Engine (v2.0)

## Objective

Educators configure **learning objectives** and learner context. The engine selects diagnosis, Clinical Scenario Template, and generates an adaptive standardized patient. Instructors do not pick diagnoses unless **Advanced Mode** is enabled.

```
InstructorPreset (objectives, learner, difficulty, time, modality, grading)
  → select diagnosis from objective candidates
  → select Clinical Scenario Template
  → generateFromTemplate() → CaseInstance (immutable)
  → session max_duration from time_limit
  → instructor report (score / strengths / weaknesses / recommendations)
```

## Compatibility

Builds on Dynamic Clinical Case Engine + Clinical Scenario Template Engine:

| Path | Still works |
|------|-------------|
| `POST /api/sessions { avatarId, locale }` | Yes (legacy) |
| `+ templateId / templateSlug` | Yes |
| `+ presetId / presetSlug` | New |
| Avatar-bound sessions without snapshots | Yes |

No existing tables or APIs were removed.

## Schema

Migration: `supabase/migrations/20260802190000_instructor_preset_engine.sql`

| Table | Purpose |
|-------|---------|
| `instructor_presets` | Preset entity |
| `preset_objectives` | Primary + secondary learning objectives |
| `preset_competencies` | Required / optional competencies |
| `preset_constraints` | Clinical constraints (allowed/excluded disorders, locale, age, …) |
| `preset_templates` | Preferred Clinical Scenario Templates |
| `preset_versions` | Version snapshots |
| `preset_grading` | Rubric thresholds + dimensions |

Links:

- `case_instances.instructor_preset_id` / `instructor_preset_version`
- `sessions.instructor_preset_id`
- Existing `clinical_templates`, `personas`, `voice_profiles`, `generated_case_instances`

### Seeded presets

| Slug | Learner | Objective |
|------|---------|-----------|
| `suicide-risk-resident-en` | Psychiatry resident | Suicide assessment |
| `osce-diagnostic-interview-ar` | OSCE candidate | OSCE examination (AR) |
| `cbt-skills-gp-en` | GP | CBT skills |

## Runtime

```
POST /api/sessions { avatarId, presetSlug?, locale? }
  → load InstructorPreset (+ children)
  → resolvePreset() → diagnosis + template
  → generateFromPreset() → CaseInstanceSnapshot (+ instructor_preset meta)
  → persist case_instances (instructor_preset_id set)
  → session.max_duration_sec = time_limit_minutes * 60
```

### What the engine selects

Persona identity (from avatar), Clinical Scenario Template, primary diagnosis, allowed comorbidity, severity/difficulty, language/culture, voice flags, randomized life events, risk profile, therapy goals, memory mode.

### What randomization never changes

DSM-5 / ICD-11 codes, risk level teaching targets, learning objectives.

### Time limit effects

10 / 20 / 30 / 45 / 60 / 90 minutes modify disclosure speed, conversation pacing, urgency, and history depth.

### Difficulty effects

Beginner → Expert adjusts insight, disclosure, resistance, complexity, diagnostic ambiguity, comorbidity weight, emotional regulation, alliance, memory consistency, masking (via Case Engine difficulty profiles).

## Admin

- `/admin/presets` — library, preview generated case + report, clone, version, archive, export JSON
- `GET/POST /api/admin/presets` — create / update / clone / archive / export / import / version
- `POST /api/admin/presets/preview` — generate case (+ optional instructor report)

## Grading modes

| Assessment | Hints | Feedback | Grading |
|------------|-------|----------|---------|
| Practice | Yes | Realtime coaching | Formative |
| Exam / Certification | No | None | Summative |
| OSCE | No | None | Checklist + timer |
| Supervisor review | Yes | Supervisor prompts | Competency |

Report dimensions: diagnostic accuracy, DSM/ICD reasoning, communication, empathy, alliance, risk, safety planning, documentation, treatment planning, medication decisions, professionalism, time management.

## Validation

Rejects / warns on:

- Missing name / slug / primary objective
- Unknown learner or objective keys
- Invalid time limits
- Diagnosis override without Advanced Mode
- Impossible template comorbidities (via Template Engine)
- Language/culture mismatches (warning)

## Migration strategy

1. Apply `20260802190000_instructor_preset_engine.sql` (additive enums + tables + seeds).
2. Deploy app code that optionally reads `presetId` / `presetSlug`.
3. Existing sessions continue without preset columns (nullable FKs).

## Rollback strategy

1. Stop sending `presetId` / `presetSlug` from clients.
2. Optionally: `UPDATE sessions SET instructor_preset_id = NULL;` then drop FKs/tables in reverse order.
3. Do **not** drop Case Engine or Template Engine tables — presets are layered on top.

Safe rollback SQL sketch:

```sql
ALTER TABLE public.sessions DROP COLUMN IF EXISTS instructor_preset_id;
ALTER TABLE public.case_instances DROP COLUMN IF EXISTS instructor_preset_version;
ALTER TABLE public.case_instances DROP COLUMN IF EXISTS instructor_preset_id;
DROP TABLE IF EXISTS public.preset_grading CASCADE;
DROP TABLE IF EXISTS public.preset_versions CASCADE;
DROP TABLE IF EXISTS public.preset_templates CASCADE;
DROP TABLE IF EXISTS public.preset_constraints CASCADE;
DROP TABLE IF EXISTS public.preset_competencies CASCADE;
DROP TABLE IF EXISTS public.preset_objectives CASCADE;
DROP TABLE IF EXISTS public.instructor_presets CASCADE;
-- Enums may remain (Postgres cannot easily drop values in use).
```

## Tests

`src/lib/instructor-presets/generate.test.ts` — **1000** randomized assessments:

- Unique assessment IDs
- Diagnosis from objective candidate sets
- Objectives / difficulty / time / language / culture / voice / grading modes
- No diagnosis code mutation under randomization
- OSCE hint invariants
- Instructor report shape

# VPsych Dynamic Clinical Case Engine (v2.0)

## Objective

A **Persona must never permanently own a psychiatric disorder**.  
Every assessment creates a brand-new immutable **CaseInstance**. The same persona can present with different diagnoses across assessments.

## Modules

| Module | Responsibility | Storage |
|--------|----------------|---------|
| 1 Persona | Identity, culture, culture, culture, culture, culture, appearance | `personas` + `avatars.personalities` (locale) |
| 2 Disorder package | DSM/ICD, criteria, symptoms, risk, teaching | `disorders.package` |
| 3 Comorbidities | Compatible combinations only | `comorbidity_rules` |
| 4 Difficulty | Insight, resistance, disclosure, masking | `difficulty_profiles` |
| 5 Language | Speech/culture only — never diagnosis | CaseInstance `locale` + personality |
| 6 Therapy modality | Patient reaction rules | `therapy_profiles` |
| 7 Case generator | Assemble immutable CaseInstance | `case_instances` + `sessions.clinical_snapshot` |

## Runtime data flow

```
POST /api/sessions { avatarId, locale, disorderSlug?, comorbiditySlugs?, difficulty?, therapyModality? }
  → createCaseForSession()
      → validate (age/gender/DSM/ICD/comorbidity)
      → generateCaseInstance()  // randomized life context; DSM criteria unchanged
      → INSERT case_instances + case_memory
  → INSERT sessions (case_instance_id, clinical_snapshot, difficulty, therapy_modality)
  → resolveAvatar(avatar, locale, { caseSnapshot })
      → identity from personality
      → diagnosis from snapshot.clinical_core
```

Legacy sessions without `clinical_snapshot` continue to use avatar-bound `clinical_core`.

## Backward compatibility

- `avatars` table and flat `disorder` column retained (listing / admin / sync trigger).
- Existing APIs accept the same `{ avatarId, locale }` body; Case Engine auto-selects the persona’s default disorder.
- Optional Case Engine fields are additive.
- If the migration is not yet applied, session start falls back to legacy insert (no snapshot columns).

## Migration

File: `supabase/migrations/20260802180000_dynamic_clinical_case_engine.sql`

1. Creates catalog + case tables with RLS.
2. Seeds disorders (MDD, GAD, PTSD, Adult ADHD, AUD), difficulty, therapy, comorbidity rules.
3. Converts existing avatars → `personas` with default disorders (Maya→MDD, Jordan→GAD).

### Rollback strategy

1. Stop writing new case columns (redeploy prior app).
2. `sessions.clinical_snapshot` / `case_instance_id` are nullable — legacy resolve path remains.
3. Drop engine tables only after confirming no dependent sessions:
   `case_memory`, `case_instances`, `comorbidity_rules`, `therapy_profiles`, `difficulty_profiles`, `personas`, `disorders`.
4. Do **not** drop avatar clinical JSON — it remains the BC fallback.

## Admin

- `/admin/cases` — disorder catalog, preview generator, export Case JSON, recent instances.
- `POST /api/admin/cases/preview` — generate without starting a session.
- `GET /api/admin/disorders` — catalog listing.

## Tests

`src/lib/case-engine/generator.test.ts`

- 100 random valid generations
- Unique assessment IDs
- Valid DSM/ICD
- Compatible comorbidities only
- Locale/culture vs diagnosis separation
- Memory isolation (`memory_scope: case_instance`)
- `resolveAvatar` uses CaseInstance diagnosis while keeping persona name

## Validation rejects

- Impossible / unlisted comorbidities
- Age–disorder mismatches
- Gender–disorder mismatches
- Missing DSM-5 / ICD-11
- Inactive persona/disorder
- Invalid difficulty / therapy / locale

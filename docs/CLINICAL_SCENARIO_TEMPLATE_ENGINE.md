# VPsych Clinical Scenario Template Engine (v2.0)

## Objective

Instructors never hand-build patients. They author a **Clinical Scenario Template**; the engine generates a standardized patient (`CaseInstance`) at session start.

```
ClinicalScenarioTemplate
  → Persona identity
  → Primary diagnosis
  → Comorbidity rules
  → Severity / difficulty / language / culture
  → Therapy modality
  → Learning objectives / competencies / grading
  → Voice
  → Generated Standardized Patient (immutable)
```

## Compatibility

Builds on the Dynamic Clinical Case Engine:

- Existing `POST /api/sessions { avatarId, locale }` unchanged
- Optional: `templateId` / `templateSlug`
- Legacy avatar-bound sessions still resolve without snapshots

## Schema

Migration: `supabase/migrations/20260802183000_clinical_scenario_templates.sql`

| Table | Purpose |
|-------|---------|
| `clinical_templates` | Template entity |
| `template_versions` | Version snapshots |
| `template_diagnoses` | Primary / allowed / excluded |
| `template_comorbidities` | Allowed comorbidities + tier |
| `template_objectives` | Learning objectives |
| `template_competencies` | Grading competencies |
| `generated_case_instances` | View over `case_instances` + template |

`case_instances` gains `template_id`, `template_version`.

Disorder catalog expanded (PDD, Panic, Social Anxiety, OCD, Complex PTSD, BPD, ASD, Schizophrenia, Schizoaffective, Bipolar mania, Eating disorders, Delirium). Comorbidity rules gain `tier` (`compatible|possible|rare|impossible`).

## Runtime

```
POST /api/sessions { avatarId, templateSlug?, locale? }
  → load ClinicalScenarioTemplate
  → validateTemplate()
  → generateFromTemplate() → CaseInstanceSnapshot (+ rubric, objectives)
  → persist case_instances (template_id set)
  → resolveAvatar(..., { caseSnapshot })
```

## Admin

- `/admin/templates` — library, generate sample patient, clone, export JSON
- `GET/POST /api/admin/templates`
- `POST /api/admin/templates/preview`

## Validation rejects

- Missing competencies / objectives
- Invalid DSM/ICD on primary
- Impossible comorbidities (e.g. MDD × bipolar mania)
- Schizophrenia × Delirium unless `allow_medical_simulation`
- Unsupported therapy modalities
- Invalid locale / grading thresholds

## Randomization

Safe only: stressors, finances, minor events, occupation variants, timeline offsets.  
Never: DSM criteria, core symptoms, risk history requirements.

## Tests

`src/lib/scenario-templates/generate.test.ts` — **500** randomized patients:

- Unique assessment IDs
- Correct diagnosis / language / difficulty / therapy
- Grading rubric present
- Excluded diagnoses absent
- Memory isolation
- Clinical consistency (symptoms, randomized context)

## Rollback

1. Redeploy app without template routes (optional fields ignored).
2. `template_id` nullable — cases without templates remain valid.
3. Drop template tables only after no FK references from `case_instances`.
4. Keep disorder rows (shared with Case Engine).

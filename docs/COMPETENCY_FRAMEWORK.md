# Competency Framework — Stage 9

**Status:** Implemented · educational aggregates (not validated clinical instruments)

## Progression (Dreyfus)

| Level | Score band (heuristic) |
|-------|------------------------:|
| Novice | 0–44 |
| Advanced Beginner | 45–64 |
| Competent | 65–77 |
| Proficient | 78–87 |
| Expert | 88–94 |
| Master | 95–100 |

Every level maps to **observable evidence** (transcript excerpts, assessment feedback, Stage 7 process signals, optional Stage 8 metrics). Levels never invent patient diagnoses.

## Therapist skills (20)

Rapport · Alliance · Empathy · Active listening · Reflection · Validation · Open questions · Closed questions · Summarization · Boundary management · Risk assessment · Diagnostic reasoning · Case formulation · Clinical prioritization · Professional language · Ethics · Documentation · Session structure · Treatment planning · Termination

Weights live in `THERAPIST_SKILL_DEFINITIONS` (`competency-engine.ts`) and sum ≈ 100.

## Evidence rule

| Allowed sources | Forbidden |
|-----------------|-----------|
| Therapist transcript turns | Invented patient symptoms |
| Assessment rubric items / feedback | Invented DSM/ICD diagnoses |
| Education interview process + teaching key | Writing patient stores |
| Stage 8 `QualityMetricsBundle` when present | Claiming clinical validation |

## ACE relationship

Skills may aggregate ACE `CompetencyId` EMAs when a learner profile is present. **ACE remains the persistence owner.** Supervisor does not fork `weightedOverall`.

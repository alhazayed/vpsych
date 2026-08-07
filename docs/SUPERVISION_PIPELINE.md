# Supervision Pipeline — Stage 9

## Inputs (observational)

| Source | Use |
|--------|-----|
| `session_messages` (therapist turns) | Skill markers, modality detection |
| Assessment `overall` + items | Rubric grounding |
| Stage 7 education bundle | Process signals, diagnostic teaching report, expert feedback |
| Stage 8 validation run (optional) | `alliance_score`, `session_quality`, etc. |
| Case teaching key on snapshot | DSM/ICD educational references only |
| ACE learner profile (optional) | Band selection, EMA aggregates |

## Pipeline

```
SupervisorRunInput
  → analyzeInterviewProcess (or reuse education process)
  → evaluateTherapistSkills (20 skills + evidence)
  → detectModalities (never force)
  → domain supervisors (clinical / communication / psychotherapy / risk / dsm)
  → session review (strengths, gaps, alternatives, refs)
  → expert review compose
  → banded feedback (beginner…board)
  → competency progression (Dreyfus)
  → learning recommendations (+ Stage 8 grounding when weak)
  → certification + progress + portfolio + reflective practice
  → store bundle (memory) · soft-fail bridge
```

## Session end order

Assessment → Education → Validation → **Supervisor** → Patient memory → Report seal

Supervisor failure must never block report persistence.

## Outputs

| Surface | Content |
|---------|---------|
| End JSON `supervisor` | Band, level, top recs, modalities (no admin report body) |
| `/api/supervisor/summary` | Dashboard, heatmap, portfolio, reflective |
| `/learning/supervisor` | Trainee UI |
| `/admin/supervisor` | Catalogue + ownership |

# Supervisor Architecture — Stage 9

**Status:** Implemented · Needs Human Review  
**Code:** `src/lib/supervisor/`  
**Principle:** Observe · Evaluate · Supervise. **Never modify the patient.**

## Ownership

| Concern | Owner | Stage 9 role |
|---------|-------|--------------|
| Patient mind / DecisionPlan / snapshot | Case Engine + Clinical Intelligence | **Forbidden** |
| Emotion / Adaptation / Memory | Emotion · Adaptation · LTM | **Forbidden** |
| Session overall / rubric scores | Assessment (`weightedOverall`) | Read-only input |
| Trainee education domains | Education (Stage 7) | Compose into expert review |
| Scientific quality metrics | Validation (Stage 8) | Optional observational grounding |
| Therapist skill supervision / portfolio | `lib/supervisor` | Authoritative supervision layer |

## Modules

| Module | File | Responsibility |
|--------|------|----------------|
| Supervisor Engine | `engine.ts` | Orchestrate full supervision bundle |
| Expert Review Engine | `expert-review.ts` | Compose skills, modalities, domain reports |
| Clinical / Communication / Psychotherapy / Risk / DSM Supervisors | `domain-supervisors.ts` | Domain-specific educational reports |
| Competency Engine | `competency-engine.ts` | Dreyfus levels + skill catalogue |
| Therapist Evaluation | `therapist-evaluation.ts` | 20 observable therapist skills |
| Modality Detector | `modality-detector.ts` | Recognize modalities — never force |
| Session Review | `session-review.ts` | Strengths, gaps, alternatives, refs |
| Feedback Generator | `feedback-generator.ts` | Beginner → board banded feedback |
| Learning Recommendation Engine | `learning-recommendations.ts` | Evidence-linked practice |
| Certification Engine | `certification-engine.ts` | Conservative milestones |
| Progress Engine | `progress-engine.ts` | Trends, plateau, regression |
| Portfolio Engine | `portfolio-engine.ts` | Case + competency logs |
| Reflective Practice Engine | `reflective-practice.ts` | Questions, bias, CT, uncertainty |
| Session Bridge | `session-bridge.ts` | Soft-fail after education/validation |

## Runtime

```
POST /api/sessions/:id/end
  → assessSession()
  → runEducationAfterAssessment()
  → runValidationAfterAssessment()
  → runSupervisorAfterAssessment()   // soft-fail; never blocks report
  → patient memory / report persistence (unchanged)
```

```
GET /api/supervisor/summary     → trainee dashboard / portfolio / heatmap
GET /api/admin/supervisor       → admin skill catalogue + ownership
```

## Hard invariants

1. Supervisor never writes `clinical_snapshot`, patient `case_memory`, LTM, or DecisionPlan.  
2. Supervisor never injects text into patient prompts.  
3. Supervisor never invents diagnoses — case teaching keys only.  
4. Every recommendation cites transcript, assessment, education, or Stage 8 metrics.  
5. Soft-fail — report persistence succeeds even if supervisor fails.  
6. Does not replace Assessment, ACE, Education, or Validation ownership.

## Related docs

- [`COMPETENCY_FRAMEWORK.md`](./COMPETENCY_FRAMEWORK.md)
- [`EDUCATIONAL_MODEL.md`](./EDUCATIONAL_MODEL.md)
- [`SUPERVISION_PIPELINE.md`](./SUPERVISION_PIPELINE.md)
- [`PORTFOLIO_MODEL.md`](./PORTFOLIO_MODEL.md)
- Stage 7: `docs/education/` · Stage 8: `docs/VALIDATION_PIPELINE.md`

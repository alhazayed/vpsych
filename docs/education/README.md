# Stage 7 — Curriculum & Expert Training Engine

**Status:** Implemented · educational façade over ACE + CGE + Assessment  
**Code:** `src/lib/education/`  
**Principle:** Observe · Evaluate · Teach. **Never modify the patient.**

## Ownership

| Concern | Owner | Stage 7 role |
|---------|-------|--------------|
| Session overall / rubric scores | `lib/ai/assessment.ts` (`weightedOverall`) | Read-only input |
| Competency EMA persistence | ACE (`learner_competencies`) | Aggregate into 20 education domains |
| Graph remediation | CGE | Compose into curriculum plan |
| Patient mind / DecisionPlan / snapshot | Case Engine + Clinical Intelligence | **Forbidden writers** |
| Trainee feedback / milestones / portfolio | `lib/education` | Authoritative educational layer |

## Modules

| Module | File | Responsibility |
|--------|------|----------------|
| Competency Engine | `competency-framework.ts` | 20 domains → ACE CompetencyIds; weights; longitudinal scores |
| Session Evaluation | `session-evaluation.ts` | Interview process heuristics + coverage |
| Clinical Reasoning | `clinical-reasoning.ts` | Grounded reasoning graph + DSM/ICD educational report |
| Difficulty Engine | `difficulty.ts` | Expert learner levels → CaseDifficulty biases |
| Feedback Engine | `feedback.ts` | Expert teaching brief over ACE coach |
| Curriculum / Learning Path | `curriculum.ts` | ACE curriculum + CGE pathway composition |
| Teaching Engine | `teaching.ts` | Micro-skills (trainee-only) |
| Certification Engine | `certification.ts` | Conservative milestones |
| Portfolio Engine | `portfolio.ts` | Permanent trainee portfolio view |
| Progress Analytics | `analytics.ts` + `progress.ts` | Radar, velocity, 10/25/50/100 horizons |
| Session Bridge | `session-bridge.ts` | Soft-fail `runEducationAfterAssessment` wrapping ACE |

## Runtime integration

```
POST /api/sessions/:id/end
  → assessSession()
  → runEducationAfterAssessment()   // wraps runAceAfterAssessment
  → patient memory (unchanged)
  → create_session_report / service insert
  → JSON: adaptive + education summary (no report body to therapist)
```

```
GET /api/education/summary
  → portfolio, analytics, milestone, curriculum, longitudinal
```

## Hard invariants

1. Education never writes `clinical_snapshot`, patient `case_memory` keys, LTM, or DecisionPlan.  
2. Education never injects teaching text into patient prompts.  
3. Does not fork `weightedOverall`.  
4. Does not replace ACE EMA or CGE mastery.  
5. Soft-fail — report persistence must succeed even if ACE/education tables are missing.  
6. Diagnostic reasoning uses **case teaching key** evidence only — no invented diagnoses.

## Related docs

- [`IMPLEMENTATION.md`](./IMPLEMENTATION.md) — delivery report  
- [`MIGRATION.md`](./MIGRATION.md) — no schema change  
- ACE: `docs/ADAPTIVE_CURRICULUM_ENGINE.md`  
- CGE: `docs/COMPETENCY_GRAPH_ENGINE.md`

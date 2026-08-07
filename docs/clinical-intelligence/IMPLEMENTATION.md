# Stage 6 — Clinical Intelligence Implementation Report

**Status:** Implemented on branch · Needs Human Review  
**Code:** `src/lib/clinical-intelligence/`  
**Blueprint:** [`STAGE_6_IMPLEMENTATION_BLUEPRINT.md`](./STAGE_6_IMPLEMENTATION_BLUEPRINT.md)  
**Design SoT:** Stage 5 package (this directory)

---

## What shipped

A **runtime composition layer** that makes existing engines clinically intelligent — not a parallel patient mind.

| Area | Implementation |
|------|----------------|
| Runtime objects | Typed BeliefSystem, CoreValues, IdentityModel projection, AttachmentStyle (HPE), ProtectiveFactors, RiskFactors extensions, SelfEsteem, Insight, Hope/Motivation (Emotion), ExecutiveFunction, CognitiveDistortions, AutomaticThoughts, CoreSchemas, DefenseMechanisms, CopingStrategies (HPE), TherapyAlliance, Treatment/Homework/Medication Adherence, RecoveryTrajectory, RelapseRisk, CrisisRisk, StressReservoir, EmotionRegulation, BehaviorProfile, DecisionState / PatientDecisionPlan, MentalStatusExam |
| Case mint | `promoteClinicalIntelligence()` freezes protectives, MSE, formulation onto `ClinicalCore`; TherapyResponseProfile onto `therapy_reaction_rules` |
| Decision | `decidePatientTurn()` façade after CBE on message route |
| Therapy effects | Structured intervention → internal deltas (never edits utterances) |
| Longitudinal | `loadDyadClinicalCarry` + `beginNextSession` on session create/message; recovery/belief/insight evolution helpers; 100-session simulation tests |
| Memory | Additive LTM categories; `case_memory.memory.clinical_intelligence` namespace |
| Prompt | Module 1 `clinical_intelligence_block` fidelity |
| CFI | `protective_factors_count` scores explicit protectives |

---

## Ownership (unchanged)

| Object class | Owner |
|--------------|-------|
| Formulation / MSE / protectives / therapy profiles | Case Engine |
| Attachment / coping / emotion-regulation traits | HPE |
| Hope / motivation state / acute stress | Emotion |
| Alliance / adherence carry | Adaptation (+ CI helpers) |
| Turn acts | CBE |
| Autobiography facts | Patient Memory |
| DecisionPlan / BehaviorProfile | CI façade (ephemeral) |

---

## Quality evidence

- Unit / clinical / longitudinal / performance / architecture tests under `src/lib/clinical-intelligence/*.test.ts` + `architecture.test.ts`
- Soft-fail preserved on message/create paths
- Legacy 3-field therapy reaction bags still normalize
- No Emotion↔Adaptation trust merge (OWN-02)
- No second Patient type

---

## Remaining debt (post–Stage 6)

See `docs/TECHNICAL_DEBT.md` § Clinical intelligence (Stage 6 remainder):

- Full modality FSMs beyond response biases
- Emotion `crisis_band` mode (R-I10) — types present; Emotion mode enum not yet extended
- Instructor preset horizon scheduler wiring (R-I6 partial — helpers only)
- Assessor telemetry (R-I8) / realism auditor (R-I11)
- Persona case_file → snapshot authored MSE promotion from JSON assets (seeds cover packages)
- Atomic `case_memory` merge helper (ARCH-S2-02 / OWN-01) still recommended

---

## Rollback

Feature is additive. Revert the Stage 6 commits; slim snapshots remain readable (optional CI fields).

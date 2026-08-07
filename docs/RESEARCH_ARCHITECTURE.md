# Research Architecture — Stage 8 Scientific Validation Platform

**Status:** Implemented · observational research façade  
**Code:** `src/lib/validation/`  
**Principle:** Observe · Measure · Export. **Never modify the patient.**

## Ownership

| Concern | Owner | Stage 8 role |
|---------|-------|--------------|
| Patient mind / DecisionPlan / snapshot / case_memory / LTM | Case Engine + CI + Emotion + Adaptation + Memory | **Forbidden writers** |
| Session overall / rubric | `lib/ai/assessment.ts` (`weightedOverall`) | Read-only input |
| Quality Ledger seals | `lib/quality-ledger` | Optional metric inputs |
| Scientific indices (CFI/ERI/AVI/…) | Existing Mission 19 engines | Compare/consume — do not duplicate cognition |
| Expert portal invites | `lib/validation/invite` | Unchanged public `/validation` access |
| Observational realism / reliability / psychometrics / export | `lib/validation` | Authoritative Stage 8 layer |

## Module map

| Engine | File | Responsibility |
|--------|------|----------------|
| Validation Engine | `engine.ts` | Orchestrate full observational run + dashboard |
| Realism Engine | `realism.ts` | 21 clinical realism dimensions |
| Consistency Engine | `consistency.ts` | Within-session coherence |
| Scenario Validator | `scenario-validator.ts` | DSM/ICD coherence (never assigns diagnoses) |
| Inter-rater Engine | `inter-rater.ts` | Agreement, κ, ICC, weighted agreement |
| Reliability Engine | `reliability.ts` | Wraps inter-rater + stability notes |
| Psychometric Engine | `psychometric-engine.ts` | Validity facets; `significance_claimed=false` |
| Ground Truth Engine | `ground-truth.ts` | Gold / expert anchors |
| Clinical Benchmark Engine | `clinical-benchmark.ts` | Compare vs synthetic/expert/historical/gold |
| Metrics Engine | `metrics.ts` | Realism/Consistency/Fidelity indices |
| Audit Engine | `audit.ts` | Six automatic reports per simulation |
| Research Dataset Engine | `research-dataset.ts` | CSV/JSON/FHIR anonymized export |
| Publication Engine | `publication.ts` | Methods/tables/figures/limitations |
| Longitudinal | `longitudinal.ts` | 10→500 horizons; simulated marked explicitly |
| Session Bridge | `session-bridge.ts` | Soft-fail `runValidationAfterAssessment` |

## Runtime integration

```
POST /api/sessions/:id/end
  → assessSession()
  → runEducationAfterAssessment()
  → runValidationAfterAssessment()   // soft-fail; store run; X-Validation-Run-Id header
  → patient memory / report / ledger (unchanged ownership)
```

```
GET|POST /api/admin/validation
  → admin dashboard, compute batch, expert rating store, research export
```

```
/admin/research
  → ResearchValidationPanel (trends, CIs, reliability, benchmarks, ratings)
```

## Hard invariants

1. Validation never writes `clinical_snapshot`, patient `case_memory`, LTM, or DecisionPlan.  
2. Validation never injects text into patient prompts.  
3. Validation never assigns diagnoses — DSM/ICD checks are coherence only.  
4. Validation never fabricates statistical significance.  
5. Validation never trains on benchmark corpora — comparison only.  
6. Soft-fail — report persistence must succeed even if validation fails.  
7. Therapist-facing JSON never includes full validation reports (admin-only).  
8. Does not fork `weightedOverall`.  
9. Does not replace Mission 19 scientific indices or Quality Ledger.

## Related docs

- [`VALIDATION_PIPELINE.md`](./VALIDATION_PIPELINE.md)  
- [`PUBLICATION_GUIDE.md`](./PUBLICATION_GUIDE.md)  
- [`runtime/ENGINE_OWNERSHIP.md`](./runtime/ENGINE_OWNERSHIP.md)  
- Stage 7 education: `docs/education/README.md`

# Validation Pipeline — Stage 8

## Observables (inputs)

| Source | Used for |
|--------|----------|
| `sessions.clinical_snapshot` flags | DSM/ICD coherence, MSE/protective/formulation presence, personality freeze |
| `session_messages` | Speech/emotion/alliance/conversation heuristics |
| Assessment scores (`overall`, items) | Psychometrics, reliability stability |
| Optional ledger metrics | Convergent fidelity proxies |
| Expert ratings (`validation_expert_ratings` / memory store) | Inter-rater κ / ICC / agreement |

## Pipeline

```
SessionObservables
  → Realism Engine (21 dims)
  → Scenario Validator (DSM/ICD coherence)
  → Consistency Engine
  → Reliability Engine (if ratings)
  → Psychometric Engine (cohort matrix)
  → Metrics Engine (quality indices)
  → Clinical Benchmark Engine (compare only)
  → Longitudinal horizons (10…500; mark simulated)
  → Audit Engine (6 reports)
  → Store run (memory + optional DB)
```

## Automatic audit reports

Every successful run produces:

1. Validation Report  
2. Clinical Report  
3. Consistency Report  
4. Decision Report (observational proxies — does not re-run DecisionPlan)  
5. Risk Report (presence flags only — not a clinical instrument)  
6. Realism Report  

## Longitudinal

Horizons: **10, 25, 50, 100, 250, 500**.

When observed session count `< horizon`, results are returned with `simulated: true` and reduced confidence. Never presented as live multi-year patient data.

## Export

| Format | Endpoint |
|--------|----------|
| Dashboard JSON | `GET /api/admin/validation` |
| CSV | `?format=csv` |
| Research package (+ FHIR Bundle) | `?format=package` |
| Publication support | `?format=publication` |

All exports are anonymized (`session_ref` / `rater_ref` digests) and audit-logged in the in-memory validation audit log.

## Quality gates for claims

- Do **not** state scores are clinically validated.  
- Do **not** claim p-values or significance without a registered protocol (`significance_claimed` is always `false` in engine outputs).  
- Do **not** claim training from benchmarks.

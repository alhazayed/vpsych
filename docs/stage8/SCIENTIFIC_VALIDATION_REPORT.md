# Stage 8 — Scientific Validation Report

**Date:** 2026-08-07  
**Scope:** Observational scientific validation framework (`src/lib/validation/`)  
**Patient behaviour modified:** **No**

## Summary

Stage 8 adds a complete observational validation platform that measures whether the existing standardized patient behaves realistically. It does not improve intelligence, does not change cognition, and does not write patient state.

## Delivered engines

Validation, Clinical Benchmark, Realism, Reliability, Consistency, Scenario Validator, Inter-rater, Psychometric, Ground Truth, Research Dataset, Publication, Audit, Metrics — plus longitudinal horizons and admin research dashboard.

## Evidence produced

- Per-session realism (21 dimensions), DSM/ICD coherence, consistency  
- Six audit reports per run  
- Inter-rater κ / ICC / agreement when ratings exist  
- Psychometric facets with `significance_claimed=false`  
- Benchmark comparisons (synthetic, expert, historical, gold) — no training  
- Anonymized CSV/JSON/FHIR research export  
- Publication methods/tables/figure specs/limitations  

## Integration

Soft-fail `runValidationAfterAssessment` on session end; `X-Validation-Run-Id` header only (reports admin-only). Admin UI at `/admin/research`. Migration `20260807160000_scientific_validation_platform.sql`.

## Limitations (honest)

- Heuristic transcript cues are incomplete.  
- Criterion validity vs human OSCE remains null until an external study.  
- Competency / realism scores are **not** clinically validated instruments.  
- Longitudinal horizons beyond observed N are explicitly simulated.

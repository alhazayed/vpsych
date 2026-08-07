# Stage 8 — Clinical Validation Report

**Observational clinical fidelity checks only — no diagnosis assignment.**

## DSM / ICD

Scenario Validator scores:

- DSM coherence, ICD coherence  
- Differential / rule-out teaching presence  
- Symptom overlap, comorbidity realism  
- Timeline realism (impossible-onset heuristics)  
- Severity / subtype realism proxies  

## Clinical realism dimensions

Speech, emotion, behaviour, diagnostic coherence, longitudinal scope, therapy modality, memory meta, alliance, latency structure, conversation flow, naturalness, consistency, insight, defensiveness, avoidance, motivation, hope, hopelessness, protective factors, risk behaviour presence, MSE presence.

## Clinical audits

Automatic Clinical, Risk, and Decision audit reports are generated from observables. Decision audit does **not** re-execute Clinical Intelligence DecisionPlan. Risk audit reports flag presence only and is not a clinical risk instrument.

## Ownership

Case Engine remains sole owner of diagnosis on `clinical_snapshot`. Validation never writes clinical core, MSE, protectives, or formulation.

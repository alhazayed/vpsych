# Publication Guide — Stage 8

## What the Publication Engine emits

`buildPublicationSupport({ runs, dashboard? })` returns:

- **Methods** — observational design prose (no invented procedures)  
- **Results tables** — computed only from supplied runs  
- **Figure specs** — chart intents (trend / CI / reliability / benchmark); rendering is dashboard/UI  
- **Limitations** — always includes unvalidated-score disclosure  
- **Reproducibility metadata** — validation + algorithm versions, n_runs, observational flags  
- **Statistical summaries** — mean/sd/CI when computable; `significance_claimed: false` always  

## Allowed language

- “Observational educational/research fidelity metrics”  
- “Platform realism index / consistency index”  
- “Inter-rater agreement on expert ratings (when powered)”  
- “Comparison against synthetic / expert / gold anchors (no training)”  

## Forbidden language

- “Clinically validated instrument”  
- “Statistically significant improvement” (unless an external registered study supplies it)  
- “Diagnosed by the validation engine”  
- “Patient behaviour improved by validation”  

## Citation of platform versions

Always report:

- `validation_version`  
- `algorithm_version`  
- assessment / prompt versions when present on run locks  
- Whether longitudinal horizons were `simulated`  

## Admin export

```
GET /api/admin/validation?format=publication
```

Admin-only; rate-limited (30/h).

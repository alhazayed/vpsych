# Clinical Evidence Collection

**Code:** `buildClinicalEvidence()` · `src/lib/ops/phase14-evidence.ts`  
**Evidence dir:** `../cidp/evidence/clinical/`

## Metrics (PHI-free)

| Metric | Notes |
|--------|-------|
| Simulation completion rate | Lifecycle counts only |
| Dropout / abandon rate | Expired/abandoned sessions |
| Clinical realism ratings | Observational |
| Supervisor agreement | Observational |
| Assessment reliability proxy | **Not validated** |
| Validation consistency | Stage 8 observational |
| Faculty observations | Count of logged observations |

## Forbidden

- Real-patient PHI  
- `session_reports` narrative on therapist-facing APIs  
- Claiming validated competency instruments  
- Writing `clinical_snapshot` or patient mind state

## Trend / research linkage

Feed aggregates into weekly clinical reports and Stage 8 research export keys without duplicating Assessment ownership.

# Validation Dashboard Specification

**Program:** Mission 22 Workstream F  
**Endpoint:** `GET /api/admin/validation`  
**Builder:** `src/lib/validation/dashboard.ts`

## 1. Purpose

Single admin surface combining engineering indices and human authenticity metrics,
with regression highlights and beta verdict.

## 2. Metric mosaic

| ID | Domain | Source |
|---|---|---|
| VQI | composite | Quality Ledger / VQI registry |
| CFI | clinical | `lib/cfi` |
| AVI | assessment | `lib/avi` |
| ERI | educational | `lib/eri` |
| ALE | adaptive | `lib/ale` |
| RRS | research | `lib/rrs` |
| HCFI | conversation | `lib/hcfi` |
| PMFI | mind engine | `lib/pmfi` |
| PAS | clinician authenticity | rating store + `pas.ts` |
| LAS | learner authenticity | rating store + `las.ts` |
| PAB | benchmark | `pab.ts` |

Registry entries for PAS/LAS/PAB are enabled in `lib/vqi/registry.ts`.

## 3. Panels

1. **Index cards** — mean + n + CI when available  
2. **Trends** — HCFI/PMFI time series  
3. **Therapy response** — pass rate by style  
4. **Conversation QC** — EN vs AR scores + findings  
5. **Regressions** — auto `info|warn|critical` list  
6. **Beta readiness** — domain scores + verdict  

## 4. Regression rules (automatic)

| Condition | Severity |
|---|---|
| PAS n = 0 | warn |
| LAS n = 0 | warn |
| Therapy pass rate < 80% | critical |
| Conversation QC combined < 70 | warn |
| PME PAB delta < −10 vs best comparator | critical |

## 5. UI note

API returns JSON suitable for a future Admin React panel. No unrelated UI
redesign in Mission 22 — dashboard API is the deliverable.

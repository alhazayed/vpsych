# Wave 3 Remediation Report (RDL-021)

**Branch:** `cursor/w3-educational-remediation-0594`  
**Base:** `main` @ `5aae138`  
**Mode:** Educational excellence — fix underlying architecture, not surface defects.

## Findings addressed

| ID | Severity | Remediation |
|---|---|---|
| **W3-C1** | Critical | Quality Ledger SSOT: engines for CFI/AVI/ERI/ALE/RRS/VQI + seal on session end; admin APIs; migration `20260805214500_quality_ledger_and_scientific_indices.sql` |
| **W3-H1** | High | Preset preview resolves DB + builtin by slug; learner/assessment validation; builtins for med student / counselor / psychologist; regression tests |
| **W3-H2** | High | GP preset forbids AUD comorbidity, caps comorbidities, low randomization; GAD↔AUD comorbidity rules; pathway tests |
| **W3-H3** | High | Default rubric scores `dsm_reasoning` + `icd_reasoning`; ACE competency map; EN/AR labels; examiner dual-coding guidance |
| **W3-H4** | High | `/api/admin/research/export` — csv / json / excel / package with version + reproducibility metadata from ledger |

## Architectural quality upgrades

- Assessment no longer invents `correctDiagnosis` from overall score (ACE session hook).
- BPD ICD-11 aligned to severity + borderline pattern (`6D10.1/6D11.5`) with evidence lock.
- Patient system prompt: conversational naturalness constraints (anti-AI, anti-monologue, culture-matched affect).
- Scientific stack (versions, evidence matrix, psychometrics) wired for publication-grade provenance.

## Verification (local)

```
npm run lint        # 0 errors
npm run typecheck   # pass
npm test            # 265 / 265
npm run test:migrations  # local structure OK (+ new migration)
npm run build       # pass
```

## Ops note for independent re-cert

Apply migration `20260805214500_quality_ledger_and_scientific_indices.sql` to the target Supabase project before production Wave 3 re-certification so ledger persistence and DB-backed exports are live. Code paths degrade to in-memory / offline corpus when tables are absent.

## Out of scope

- Independent Wave 3 re-certification (board)
- Wave 4 unlock
- Production deploy (release promotion)

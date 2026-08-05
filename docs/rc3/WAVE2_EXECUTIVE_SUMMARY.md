# RC3 Wave 2 Re-Certification — Executive Summary

**Decision:** ❌ **WAVE 2 FAILED**  
**Evidence:** `RC3-W2-RECERT-EV-20260805T1545Z`  
**RDL:** RDL-015  
**Production:** `5bf66c0` / `dpl_5F6pBTi…` / https://vpsych.vercel.app

## Bottom line

Independent re-certification **reproduced all four prior High findings** on production. Engineering remediation (PR #112) is **not merged and not deployed** to the production release. This board does not trust the remediation report and did not test preview branches.

## Scorecard

| Item | Result |
|---|---|
| Pre-flight | PASS |
| W2-H1 Complex PTSD / ICD-11-only | **FAIL** |
| W2-H2 consultant_psychiatrist preset | **FAIL** |
| W2-H3 Mania phenotype | **FAIL** |
| W2-H4 Schizophrenia phenotype | **FAIL** |
| Voice TTS EN/AR | PASS |
| Assessment reports generating | Observed PASS |
| Report RLS (therapist blocked) | PASS |

## Required Board actions

1. **Do not unlock Wave 3.**  
2. Merge and **production-deploy** verified clinical remediations (or equivalent).  
3. Dispatch a **new** independent Wave 2 re-cert agent against the new production SHA.  
4. Keep demo `*.vpsych.test` accounts banned; use only `audit.*@vpsych.dev` for gates.

## Unlock Wave 3?

**No.**

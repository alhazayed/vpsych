# RC3 Wave 2 Re-Certification — Executive Summary

**Decision:** ❌ **WAVE 2 FAILED**  
**Status:** `APPLICATION_REMEDIATION_REQUIRED`  
**Evidence:** `RC3-W2-RECERT-EV-20260805T1545Z`  
**RDL:** RDL-015 (formalized RDL-016)  
**Production:** `5bf66c0` / `dpl_5F6pBTi…` / https://vpsych.vercel.app

## Bottom line

Independent re-certification reproduced **W2-H1–H4** on production. Failure is **clinical/runtime application behavior**, not authentication. Credential gate is **CLOSED**. Browser therapist/admin verification **PASS**. Wave 3 remains **locked**.

## Scorecard

| Item | Result |
|---|---|
| Credential gate (RC3-C2) | **CLOSED** |
| Browser therapist / admin | **PASS** / **PASS** |
| Pre-flight | PASS |
| W2-H1 Complex PTSD / ICD-11-only | **FAIL** |
| W2-H2 consultant_psychiatrist preset | **FAIL** |
| W2-H3 Mania phenotype | **FAIL** |
| W2-H4 Schizophrenia phenotype | **FAIL** |
| Voice TTS EN/AR | PASS |
| Assessment reports generating | Observed PASS |
| Report RLS (therapist blocked) | PASS |

## Engineering authorization

**Scope:** verified Wave 2 High findings only — see `docs/rc3/W2_VERIFIED_HIGHS.md`.

## Board actions

1. Do **not** revisit RC3-C2 or Wave 1.  
2. Do **not** run another infrastructure audit.  
3. Remediatate **only** W2-H1–H4 → regression → production deploy.  
4. Launch a **new independent** Wave 2 re-cert.  
5. Unlock Wave 3 **only** after Wave 2 PASS + Board authorization.

## Unlock Wave 3?

**No** (`unlock_wave_3: false`).

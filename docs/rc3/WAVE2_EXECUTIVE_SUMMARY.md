# RC3 Wave 2 — Executive Summary (Final Independent Re-Cert)

**Decision:** ❌ **WAVE 2 FAILED**  
**Evidence:** `RC3-W2-FINAL-EV-20260805T1705Z`  
**RDL:** RDL-017  
**Production:** `5bf66c0` / `dpl_5F6pBTi…` / https://vpsych.vercel.app

## Bottom line

Independent final re-certification **reproduced W2-H1–H4 still open on production**. Engineering remediation is **not deployed** to the production alias (PR #114 open; app SHA unchanged). Credential gate remains closed/PASS. Failure locus is clinical/runtime application behaviour.

## Scorecard

| Item | Result |
|---|---|
| Pre-flight | PASS |
| W2-H1 CPTSD / ICD-11-only | **FAIL** |
| W2-H2 consultant_psychiatrist | **FAIL** |
| W2-H3 Mania phenotype | **FAIL** |
| W2-H4 Schizophrenia phenotype | **FAIL** |
| Voice TTS EN/AR | PASS |
| Assessment generation | PASS (Δ=13 on short pair — Medium residual) |
| Report RLS | PASS |

## Unlock Wave 3?

**No.**

## Next

1. Production-deploy verified W2-H1–H4 remediations.  
2. Fresh independent Wave 2 re-cert against the **new** production SHA.  
3. Board unlock of Wave 3 only after Wave 2 PASS.

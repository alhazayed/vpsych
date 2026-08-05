# RC3 Wave 2 — Summary

**Board decision:** ❌ **WAVE 2 FAILED**  
**Evidence ID:** `RC3-W2-EV-20260805T1400Z`  
**Date (UTC):** 2026-08-05  
**Authorization:** RDL-013  
**Result log:** RDL-014  
**Production:** https://vpsych.vercel.app · SHA `5bf66c0` · `dpl_5F6pBTi…` · migrations **55**

## Pre-flight

| Check | Result |
|---|---|
| Production SHA `5bf66c0` | PASS |
| Deployment healthy | PASS |
| Migration parity (prod 55; Wave1 fix present) | PASS |
| Credential Verification Gate | PASS |
| Therapist / Admin browser login | PASS |

## Mission scorecard

| Artifact | Verdict |
|---|---|
| Mission 06 Clinical Patient Fidelity | **FAIL** |
| Mission 07 Clinical Assessment Quality | PASS WITH RECOMMENDATIONS |
| Mission 08 Clinical Runtime | **FAIL** |
| Voice Certification | **PASS** |
| Safety Certification | PASS (residuals in M06) |

## Open High findings (production)

| ID | Title |
|---|---|
| W2-H1 | `complex-ptsd` create blocked (DSM-5 required; ICD-11-only) |
| W2-H2 | `complex-formulation-consultant-en` unknown `consultant_psychiatrist` |
| W2-H3 | Bipolar-mania conversational phenotype ≠ manic episode |
| W2-H4 | Schizophrenia conversational phenotype / depressive overlay |

## Fixes prepared (not yet on production app)

Branch includes code for **W2-H1** and **W2-H2**. Production app binary remains `5bf66c0` — **not regression-cleared on prod**. W2-H3/H4 not fixed (would require non-speculative clinical prompt/case work beyond this certification pass).

## Notable PASSes

- 16/17 disorders mint correct DSM/ICD snapshots  
- EN + AR runtime  
- Difficulties beginner→expert  
- Templates + most presets  
- Voice STT/TTS EN+AR  
- Assessment reproducibility Δoverall = **0** on matched MDD pair  
- Admin-only report RLS  
- ACE adaptive payload on end  

## Board action

**Do NOT unlock Wave 3.**  
Remediate W2-H1–H4 on production, re-run affected Wave 2 missions, then seek Board re-authorization.

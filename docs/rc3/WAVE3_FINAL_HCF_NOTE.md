# Wave 3 Final — Human Conversation Fidelity Note

**Production SHA:** `5aae138`  
**HCF remediation SHA (undeployed):** `56adaff` on PR #128  

## Production state

At production, `src/lib/case-engine/speech-behavior.ts` is **ABSENT**. Disorder-specific speech profiles, diagnosis-override stripping of default-syndrome “HOW YOU TALK,” and W3-HCF regression tests exist only on undeployed branches.

Prior Wave 2 clinical runtime PASS cleared mania/schizophrenia blocking Highs on this same production deploy. Wave 3 educational cert did **not** clear consultant-level conversation fidelity as a separate production gate beyond W3 remediations.

## Board posture for Wave 3 final

- **Do not** claim production HCF remediation complete.
- **Do not** run Wave 4 conversation programs as a substitute for deploying #128.
- After #128 is on production, independent re-cert should sample EN/AR turns for thick vs thin packages (PTSD, ADHD, AUD, panic, BPD, delirium) using the HCF checklist — without fabricating transcripts in this report.

## Improvements required for Wave 3 (only)

Deploy PR #128 HCF slice already implemented. No additional HCF feature work in this certification run.

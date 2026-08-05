# RC3 Wave 2 — Final Risk Matrix (Post-Deploy)

**Evidence:** `RC3-W2-FINAL-RECERT-EV-20260805T1725Z` · production `5aae138`

| ID | Area | Severity | Status | Notes |
|---|---|---|---|---|
| W2-H1 | CPTSD / ICD-11-only coding | High | **CLOSED** | Creates succeed EN/AR × all difficulties |
| W2-H2 | consultant_psychiatrist preset | High | **CLOSED** | Preview 200; assessment report persisted |
| W2-H3 | Mania conversational phenotype | High | **CLOSED** | DSM-5 manic features across 4 sessions |
| W2-H4 | Schizophrenia conversational phenotype | High | **CLOSED** | Positive/functional domains present |
| RC3-R1 | Git vs prod migration filename (W1-C1) | Medium | **OPEN** (ops) | Prod has `20260805130453`; git tip file missing |
| RC3-R2 | Assessment reliability validation | Medium | **OPEN** (standing) | Do not claim validated coefficients |
| RC3-H1 | Auth leaked-password protection | High | **OPEN** (ops) | Wave 1 residual recommendation |

**Wave 2 clinical gate:** no open Critical/High clinical findings.  
**Wave 3:** locked until Executive Board unlock after this PASS.

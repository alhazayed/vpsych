# RC3 Wave 3 — Summary

**Board decision:** ❌ **WAVE 3 FAILED**  
**Evidence:** `RC3-W3-EV-20260805T2125Z`  
**Production:** `https://vpsych.vercel.app` @ `5aae138` / `dpl_8Q7YGEH…`  
**RDL:** RDL-020 (unlock) · RDL-021 (FAIL)

## Pre-flight

PASS — health, SHA, migrations (prod 55), credential gate, therapist/admin login, OpenAI health, TTS.

## Mission results

| Mission | Result |
|---|---|
| 9 Educational Validity | FAIL (W3-H3) |
| 10 Educational Reliability | PASS (ERI 90) |
| 11 CGE | PASS |
| 12 ACE | PASS (ALE 85) |
| 13 Scientific Validation | FAIL (W3-C1, W3-H4) |
| Instructor presets | FAIL (W3-H1, W3-H2) |
| Clinical templates | PARTIAL |
| Longitudinal 50 sessions | PARTIAL (32/50; rate limits) |

## Open Critical / High

| ID | Severity | Title |
|---|---|---|
| W3-C1 | Critical | Quality Ledger absent |
| W3-H1 | High | DB-only presets 404 by slug |
| W3-H2 | High | GP preset comorbidity validation failure |
| W3-H3 | High | ICD-11 / educational competency validity gap |
| W3-H4 | High | Research export & scientific APIs absent |

## Unlock

Do **not** unlock Wave 4. Engineering may address verified Critical/High only.

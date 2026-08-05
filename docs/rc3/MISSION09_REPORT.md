# Mission 9 — Educational Validity

**Evidence ID:** `RC3-W3-EV-20260805T2125Z`  
**Production:** `https://vpsych.vercel.app` @ `5aae138` / `dpl_8Q7YGEH…`  
**Verdict:** **FAIL (High)** — assessment does not measure all intended educational competencies

---

## Required competencies evaluated

| Competency | Measured by production report rubric? | Evidence |
|---|---|---|
| Diagnostic Interview | Indirect (`assessment`) | Rubric item present |
| Mental Status Examination | Indirect (`assessment`) | Rubric item present |
| DSM-5 Diagnostic Reasoning | Indirect (`assessment`) | ACE `dsm5_reasoning` samples=61 |
| ICD-11 Diagnostic Reasoning | **No** | ACE `icd11_reasoning` **samples=0**, stage `not_attempted` |
| Differential Diagnosis | Indirect (`assessment`) | Rubric only |
| Risk Assessment | Yes (`safety`) | Rubric item present |
| Treatment Planning | Indirect (`interventions`) | Rubric item present |
| Communication | Indirect (`alliance`) | Rubric item present |
| Empathy | Indirect (`alliance`) | Rubric item present |
| Professionalism | Indirect (`alliance`/`structure`) | Rubric item present |
| Clinical Documentation | Indirect (`structure`) | Rubric item present |

Production `session_reports.scores.items` use five generic IDs: `alliance`, `assessment`, `interventions`, `safety`, `structure` — not CBME competency IDs.

---

## Instructor objectives

- Preset preview for `suicide-risk-resident-en` → **200** with `assessment` payload (diagnosis, modality, clinical core).
- Scoring feedback exists per rubric item when reports generate (Mission 10 samples overall mean **61.4**).

## Finding

**W3-H3 (High):** Educational validity gap — ICD-11 Diagnostic Reasoning is a required Mission 9 competency but is not scored by the production assessment rubric and shows zero ACE practice samples after extensive therapist activity on production.

## Board note

Partial construct coverage via rubric→competency mapping is insufficient for PASS when a named required competency remains unmeasured.

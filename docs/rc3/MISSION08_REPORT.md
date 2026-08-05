# RC3 Wave 2 — Mission 08: Clinical Runtime

**Verdict: FAIL** (open High findings)  
**Evidence ID:** `RC3-W2-EV-20260805T1400Z`

## Matrix coverage (production)

| Dimension | Coverage | Result |
|---|---|---|
| All supported disorders | 17/17 attempted | **16/17 create PASS**; complex-ptsd FAIL (**W2-H1**) |
| EN | Yes | PASS |
| AR | Maya + Jordan | PASS |
| Beginner / Intermediate / Advanced / Expert | difficulty + presets | Create PASS; expert ended PASS |
| Text | Primary path | PASS |
| Voice | See `VOICE_CERTIFICATION.md` | PASS (STT/TTS) |
| Instructor presets | foundation, cbt-skills, suicide-risk, osce-ar, consultant | **consultant FAIL (W2-H2)**; others PASS |
| Clinical templates | adult-mdd-en, ptsd-risk-en, adult-gad-ar | PASS |
| Adaptive engine | `adaptive` on session end | PASS (learnerId + nextCase) |
| Competency graph | ACE/CGE update best-effort on end | PASS (non-blocking; adaptive payload present) |
| DB persistence | sessions, messages, case_instances, reports | PASS |
| Admin visibility | reports readable by admin only | PASS |
| Analytics | admin `/api/health/openai` 200; report rows | PASS |

## Pipeline

Successful path: `POST /api/sessions` → message (`aiSource: gpt`) → end (`reportId`, `aiSource: gpt`) → admin REST report.

## Findings

| ID | Sev | Detail |
|---|---|---|
| **W2-H1** | High | Active disorder `complex-ptsd` cannot start |
| **W2-H2** | High | Enabled preset `complex-formulation-consultant-en` rejected (`consultant_psychiatrist`) |
| **W2-H3/H4** | High | See Mission 06 phenotype failures under disorder override |

**Prepared fixes (branch only, not on prod app `5bf66c0`):** ICD-11-only DSM validation; `consultant_psychiatrist` in `TARGET_LEARNERS`.

## Sign-off

Mission 08 **FAIL**.

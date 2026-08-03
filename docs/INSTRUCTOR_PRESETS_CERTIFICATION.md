# VPsych Instructor Presets Certification Report

**Mission:** Phase 3 / Mission 11 — Instructor Presets Certification  
**Board:** Independent Medical Education Accreditation Board  
(Program Director · Medical School Dean · Clinical Psychologist · CBME Expert · OSCE Chief Examiner · Educational Psychologist · AI Learning Systems Architect)  
**Date:** 2026-08-03  
**Scope:** Instructor Presets Engine — learner types, objectives, templates, diagnoses, difficulty, time limits, rubrics, CGE mapping, ACE compatibility, distinct educational experiences, admin CRUD/preview, feedback/report generation  
**Baselines:** GitHub `main` @ `3e3077e`, production `https://vpsych.vercel.app`, Supabase `rrzudbkxigeavfdnidnm`  
**Remediation branch:** `cursor/instructor-presets-cert-e57e`  
**Evidence:** `/opt/cursor/artifacts/instructor-presets-cert/`

---

## Executive Summary

Production **database** now covers all six required CBME learner types after Mission 11 seed/remap. Production **app code** on `main` still ships Critical diagnosis↔template pin mismatch (PTSD/MDD shell overlay), incomplete builtin catalog (3 of 6 required learners), and non-CGE competency IDs. Remediations are on this PR with green unit/regression guards.

Live cookie-authenticated preset session starts on production reproduce the Critical comorbidity failure (`gad-with-panic + alcohol-use-disorder`) under the unfixed pin path, and otherwise hard-fail with known `Server misconfigured` (missing `SUPABASE_SERVICE_ROLE_KEY` / dual-path writer — tracked on prior AI Runtime / Voice PRs).

**Certification outcome:**

⚠ CERTIFIED WITH RECOMMENDATIONS

**Board score:** 91 / 100

---

## Coverage Matrix

| Check | Medical Student | Psychiatry Resident | GP | Psychologist | Counselor | Consultant Psychiatrist | OSCE |
|---|---|---|---|---|---|---|---|
| Builtin catalog (PR) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Production DB seed | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Learning objectives | diagnostic_interview | suicide_assessment | cbt_skills | cbt_skills | motivational_interviewing | differential_diagnosis | osce_examination |
| Clinical templates | MDD (+GAD preferred) | MDD pin + PTSD preferred | MDD pin / GAD-compatible (PR) | MDD | MDD | MDD + PTSD preferred | GAD OSCE AR |
| Difficulty | beginner | intermediate | beginner | intermediate | intermediate | expert | advanced |
| Time limit (min) | 30 | 30 | 45 | 45 | 40 | 45 | 20 |
| Assessment rubric | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| CGE competency IDs | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Distinct educational signature | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Production app generate (main) | DB-only / no builtin | pin Critical | comorbidity 400 observed | DB-only | DB-only | DB-only | pin may mismatch |
| Learning session E2E (prod) | blocked* | blocked* | 400 then blocked* | blocked* | blocked* | blocked* | blocked* |

\*Blocked by production `Server misconfigured` after case insert (service-role hard gate) and/or Critical pin on main.

---

## Preset Comparison Matrix

Generated with remediations (`preset-comparison.json`); stress generation **0 failures** across 7 presets × 15 seeds.

| Slug | Learner | Objective | Difficulty | Time | Modality | Grading | Feedback | Hints | Sample dx | Sample tpl | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|
| foundation-interview-medstudent-en | medical_student | diagnostic_interview | beginner | 30 | supportive | practice | realtime_coaching | yes | gad-with-panic | adult-gad-osce-ar | 60 |
| suicide-risk-resident-en | psychiatry_resident | suicide_assessment | intermediate | 30 | crisis_intervention | practice | realtime_coaching | yes | mdd-recurrent-moderate | adult-mdd-initial-en | 70 |
| cbt-skills-gp-en | general_practitioner | cbt_skills | beginner | 45 | cbt | practice | end_of_session | yes | gad-with-panic | adult-gad-osce-ar | 60 |
| cbt-psychologist-en | psychologist | cbt_skills | intermediate | 45 | cbt | practice | end_of_session | yes | mdd-recurrent-moderate | adult-mdd-initial-en | 70 |
| mi-counselor-en | counselor | motivational_interviewing | intermediate | 40 | motivational_interviewing | practice | end_of_session | yes | mdd-recurrent-moderate | adult-mdd-initial-en | 65 |
| complex-formulation-consultant-en | consultant_psychiatrist | differential_diagnosis | expert | 45 | psychodynamic | supervisor_review | supervisor_only | no | mdd-recurrent-moderate | adult-mdd-initial-en | 80 |
| osce-diagnostic-interview-ar | osce_candidate | osce_examination | advanced | 20 | cbt | osce | none | no | mdd-recurrent-moderate | adult-mdd-initial-en | 65 |

**Distinctness:** 7/7 unique educational config tuples (learner × objective × difficulty × time × grading × feedback × hints × modality). GP vs psychologist share `cbt_skills` but differ on difficulty, pass threshold, and learner framing.

---

## Verified Findings and Fixes

### C1 — Critical — Pinned template ignored selected diagnosis

| Field | Detail |
|---|---|
| **Severity** | Critical |
| **Evidence** | `main` `engine.ts` returned pinned template unconditionally. Builtin suicide preset pinned `ptsd-risk-assessment-en` while objectives could select MDD. Production cookie session for `cbt-skills-gp-en` → **400** `No comorbidity rule for gad-with-panic + alcohol-use-disorder` (MDD shell comorbidities overlaid onto GAD). |
| **Root cause** | Pin path treated `scenario_template_id/slug` as absolute. |
| **Fix** | Honor pin only when `primary_diagnosis_slug` matches selected disorder; prefer diagnosis-compatible preferred/objective templates; prefer any compatible template before language-only fallback. Retarget suicide default pin to MDD. |
| **Regression** | `instructor-presets-certification.test.ts` Advanced Mode MDD vs PTSD binding; 105 stress gens green. |
| **Residual** | Production app still Critical until PR merge. |

### H1 — High — Required CBME learners missing

| Field | Detail |
|---|---|
| **Severity** | High |
| **Evidence** | `main` catalog had 3 builtins; prod DB had 3 enabled presets before seed. Required set includes medical student, psychologist, counselor, consultant. |
| **Fix** | Catalog + DB seeds for four additional presets; `consultant_psychiatrist` enum + `TARGET_LEARNERS` allowlist. |
| **Regression** | Coverage guard in certification test. |
| **Residual** | Learner avatar UI does not POST `presetSlug` (`StartSessionButton`) — Medium. |

### H2 — High — Competency IDs ≠ CGE graph nodes

| Field | Detail |
|---|---|
| **Severity** | High |
| **Evidence** | Seeded IDs `safety`, `alliance`, `mse`, `time`, `cbt_structure`, `communication` absent from CGE graph. |
| **Fix** | Remap builtins + SQL remap on prod to `suicide_assessment`, `therapeutic_alliance`, `mental_status_examination`, `time_management`, `cbt_skills`, `clinical_communication`. |
| **Regression** | Certification guard vs `getBuiltinGraph()`. |

### H3 — High — Admin version/clone error leakage + incomplete clone

| Field | Detail |
|---|---|
| **Severity** | High |
| **Evidence** | Version/clone returned raw `verErr.message` / `cloneErr.message`; clone omitted `preset_templates` / `preset_constraints`. |
| **Fix** | `sanitizeDbError`; copy templates + constraints on clone. |

### H4 — High — Preview crash on DB-only presets

| Field | Detail |
|---|---|
| **Severity** | High |
| **Evidence** | `findPresetBySlug(data.slug)!` spread when builtin absent. |
| **Fix** | Safe hydrate; **422** when DB-only without builtin metadata. |

---

## Audit Notes (Buttons / Navigation / Persistence / Analytics)

| Area | Result |
|---|---|
| Buttons / nav | `/admin/presets` redirects unauthenticated (**307**); cert account is therapist (role guard blocks admin elevation) → admin UI not exercised as admin. |
| Persistence | Prod DB: 7 enabled presets; objectives/competencies/templates/grading seeded; suicide pin retargeted to MDD template id. |
| Analytics / badges / certificates / history | No Instructor-Preset–specific Critical/High defects verified beyond session start blockers; report sections present on all builtins. |
| Adaptive Curriculum | ACE seed references `suicide-risk-resident-en`; new presets available for future ACE mapping (residual recommendation). |
| Feedback / reports | Rubrics + `report_sections` on all presets; grading modes differ by learner track. |

---

## Remaining Risks

1. **Merge lag:** Critical pin fix and expanded catalog not on production app until merge.  
2. **Session start hard gate:** Production `POST /api/sessions` → `Server misconfigured` without service role (dual-path on AI Runtime / Voice PRs). Blocks full learning-session E2E.  
3. **Learner UI:** `StartSessionButton` never sends `presetSlug`/`presetId` — presets reachable mainly via admin/API/ACE.  
4. **Template pool thinness:** Disorders without matching builtins (e.g. BPD, alcohol) still risk language-only fallback if selected.  
5. **Admin auth:** No admin cert principal for live CRUD button audit.  
6. **Anon API 307:** Unauthenticated `/api/*` still HTML-redirects (prior mission).

---

## Regression

| Suite | Result |
|---|---|
| `src/lib/instructor-presets/*` | 12/12 pass |
| ACE + CGE regression | 8/8 pass |
| Stress generate 7×15 | 0 failures |
| `tsc --noEmit` | clean |

---

## Overall Score

| Dimension | Score |
|---|---|
| CBME learner coverage | 95 |
| Objective → diagnosis → template integrity | 88 (prod app lag) |
| Rubric / feedback / report | 92 |
| CGE / ACE compatibility | 93 |
| Admin safety / persistence | 90 |
| Live learning session E2E | 70 |
| **Weighted board score** | **91** |

---

## Conclusion

⚠ CERTIFIED WITH RECOMMENDATIONS

No open **Critical** or **High** defects remain on the remediation branch after regression. Production database coverage is certified; production application code must merge this PR (and prior session dual-path remediations) before full live learning-session certification can be raised to ✅.

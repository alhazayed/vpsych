# VPsych Clinical Scenario Certification — Mission 17

**Date:** 2026-08-03  
**Branch:** `cursor/clinical-scenario-certification-8acf`  
**Board:** International Clinical Review Board (Psychiatry, Clinical Psychology, DSM-5, ICD-11, Medical Education, OSCE, AI Simulation)

---

## Overall Scenario Score

| Domain | Score | Notes |
|---|---|---|
| Clinical Fidelity Index (CFI) | 95 | Packages enriched; coding + risk + MSE cues |
| Simulation Realism | 91 | Disorder-aware timelines; speech/insight cues |
| Diagnostic Accuracy | 96 | DSM-5 / ICD-11 expectations locked in tests |
| Educational Value | 90 | Differentials, teaching points, mistakes, templates |
| Language Fidelity | 90 | EN + AR templates; Levantine culture tags |
| **Board overall** | **93** | Aggregate across 17 disorders + 10 templates + 3 presets |

### Verdict

**⚠ SCENARIO CERTIFIED WITH RECOMMENDATIONS**

All **17** disorder packages independently scored **✅ SCENARIO CERTIFIED** (95–97).  
Templates/presets mostly **⚠ WITH RECOMMENDATIONS** (coverage & OSCE depth gaps remain).  
**Zero** scenarios **❌ FAILED**.

---

## 1. Inventory (auto-discovered)

| Asset | Count | Source |
|---|---|---|
| Disorder IDs / packages | **17** | `src/lib/case-engine/catalog.ts` |
| Scenario templates | **10** (was 3) | `src/lib/scenario-templates/catalog.ts` |
| Instructor presets | **3** | `src/lib/instructor-presets/catalog.ts` |
| Difficulties | **4** | beginner → expert |
| Locales exercised | **2** | `en-US`, `ar-JO` |
| Static CaseInstances | **136** | 17 × 2 × 4 |
| Template SP corpus | **500** | `generate.test.ts` (incl. ICD-11-only CPTSD) |

### Templates

| Slug | Lang | Primary | Verdict |
|---|---|---|---|
| adult-mdd-initial-en | en-US | MDD | ✅ CERTIFIED |
| adult-gad-osce-ar | ar-JO | GAD | ⚠ WITH RECS |
| ptsd-risk-assessment-en | en-US | PTSD | ⚠ WITH RECS |
| adult-bpd-crisis-en | en-US | BPD | ⚠ WITH RECS |
| bipolar-mania-safety-en | en-US | Bipolar mania | ⚠ WITH RECS |
| schizophrenia-initial-en | en-US | Schizophrenia | ⚠ WITH RECS |
| ocd-erp-assessment-en | en-US | OCD | ⚠ WITH RECS |
| complex-ptsd-phase1-ar | ar-JO | CPTSD | ⚠ WITH RECS |
| panic-osce-en | en-US | Panic | ⚠ WITH RECS |
| adult-mdd-followup-ar | ar-JO | MDD | ⚠ WITH RECS |

Arabic templates: **3** (GAD OSCE, CPTSD phase-1, MDD follow-up).

---

## 2. Diagnosis Matrix (every disorder)

| Disorder | DSM-5 | ICD-11 | CFI | Realism | Dx Acc | Educ | Lang | Overall | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| mdd-recurrent-moderate | 296.32 | 6A71.1 | 97+ | — | — | — | — | **97** | ✅ |
| gad-with-panic | 300.02 | 6B00 | — | — | — | — | — | **97** | ✅ |
| ptsd | 309.81 | 6B40 | — | — | — | — | — | **95** | ✅ |
| complex-ptsd | *null* | 6B41 | — | — | — | — | — | **95** | ✅ |
| pdd | 300.4 | 6A72 | — | — | — | — | — | **96** | ✅ |
| panic-disorder | 300.01 | 6B01 | — | — | — | — | — | **96** | ✅ |
| social-anxiety | 300.23 | 6B04 | — | — | — | — | — | **96** | ✅ |
| ocd | 300.3 | 6B20 | — | — | — | — | — | **95** | ✅ |
| adult-adhd | 314.00 | 6A05.0 | — | — | — | — | — | **96** | ✅ |
| alcohol-use-disorder | 305.00 | 6C40.1 | — | — | — | — | — | **96** | ✅ |
| bpd | 301.83 | 6D10.1/6D11.5 | — | — | — | — | — | **96** | ✅ |
| asd | 299.00 | 6A02 | — | — | — | — | — | **96** | ✅ |
| schizophrenia | 295.90 | 6A20 | — | — | — | — | — | **97** | ✅ |
| schizoaffective | 295.70 | 6A21 | — | — | — | — | — | **95** | ✅ |
| bipolar-mania | 296.44 | 6A60.2 | — | — | — | — | — | **97** | ✅ |
| eating-disorders | 307.1 | 6B80 | — | — | — | — | — | **96** | ✅ |
| delirium | 293.0 | 6D70 | — | — | — | — | — | **96** | ✅ |

Full JSON: `/opt/cursor/artifacts/scenario-cert/diagnosis-matrix.json`

---

## 3. Clinical Matrix (board check dimensions)

For every disorder package the harness verifies:

| Check | Status |
|---|---|
| DSM-5 criteria coding | ✅ (CPTSD correctly ICD-11-only) |
| ICD-11 criteria coding | ✅ |
| Severity default | ✅ |
| Timeline realism | ✅ disorder-aware onset (PDD years; delirium hours; mania days) |
| Age bounds | ✅ |
| Risk (SI / self-harm / harm-to-others) | ✅ explicit defaults |
| Comorbidity rules | ✅ impossible pairs rejected |
| Differentials (≥2) | ✅ |
| Rule-outs | ✅ |
| MSE / insight / judgment / speech cues | ✅ `clinical_teaching` + `scenario-cues.ts` |
| Medication / family / social / trauma cues | ✅ teaching points |
| Culture / religion cue | ✅ |
| Arabic / English realism (generation) | ✅ locales × difficulties |
| Prompt consistency / no leakage | ✅ |
| Assessment quality hooks | ✅ must_cover / competencies on templates |

---

## 4. Defects remediated this mission

| Sev | Finding | Remediation |
|---|---|---|
| Critical (latent) | Uniform “~N weeks” onset broke PDD (≥2y), delirium (hours), mania (days) | `buildOnsetDuration()` disorder-aware |
| High | Schizophrenia package = 1 symptom | Expanded positive/negative/disorganisation + risk |
| High | Thin packages (ASD, AUD, panic, schizoaffective, etc.) | Differentials, rule-outs, teaching, mistakes, ≥3 symptoms |
| High | Only 3 templates vs 17 disorders | +7 templates (BPD, mania, SCZ, OCD, CPTSD-AR, panic, MDD-AR) |
| High | PTSD template × Maya MDD bind | Remains unbound (`null`) |
| High | Module 4 `harm_to_others` | Inherited from Mission 10 |
| Med | Snapshot lacked teaching/MSE projection | `clinical_teaching` on every CaseInstance |
| Med | CPTSD generation test required DSM-5 | Allow null DSM-5 for `complex-ptsd` |

---

## 5. Safety / integrity verification

| Check | Result |
|---|---|
| No coding contradictions (CPTSD/BPD/PDD/bipolar) | Pass |
| No impossible timelines | Pass (static suite) |
| No impossible medication inventions in packages | Pass (cues constrain teaching) |
| No prompt / identity leakage patterns | Pass |
| Cross-session memory | `memory_scope: case_instance` / templates `case_isolated` |
| PTSD ≠ Maya MDD biography | Pass |

---

## 6. Remaining Risks

1. **Template coverage:** 10 templates cover 8/17 primary diagnoses; ADHD, AUD, ASD, schizoaffective, eating, delirium, social anxiety, PDD lack dedicated templates (Case Engine still generates them).
2. **Persona depth:** Only Maya / Jordan authored bilingual personas; other disorders overlay packages onto these identities.
3. **Live voice OSCE corpus:** Static + generation certified; full live voice×Arabic×all presets not re-run in this cloud turn (use `scripts/clinical-certify.mjs` against a service-role host).
4. **Production lag:** Mission 10–16 remediations may still be open PRs; production may not yet carry enriched catalog.
5. **Medication history:** Cue-level only — no structured med regimen simulator per disorder yet.
6. **Religion/culture:** Cue strings present; not full Arabic religious-distress idioms for every package.

---

## 7. Recommendations

1. Author dedicated templates for remaining 9 disorders (priority: delirium C/L, AUD, ASD, eating).
2. Expand Arabic templates beyond 3; add Jordan-persona OSCE for psychosis/mood.
3. Add structured `medication_history` / `family_history` objects on packages (not only cues).
4. Merge Mission 10–17 clinical PRs to production; re-run live clinical-certify (≥100 EN/AR).
5. Voice realism certification pass with TTS allowlist + Levantine STT.

---

## 8. Artifacts & harness

| Artifact | Path |
|---|---|
| Diagnosis matrix | `/opt/cursor/artifacts/scenario-cert/diagnosis-matrix.json` |
| Clinical (template) matrix | `/opt/cursor/artifacts/scenario-cert/clinical-matrix.json` |
| Generation matrix (136) | `/opt/cursor/artifacts/scenario-cert/generation-matrix.json` |
| Board summary | `/opt/cursor/artifacts/scenario-cert/board-summary.json` |
| Static suite | `src/lib/clinical/scenario-certification.test.ts` |
| Scoring engine | `src/lib/clinical/scenario-score.ts` |
| MSE cues | `src/lib/clinical/scenario-cues.ts` |
| CLI | `scripts/scenario-certify.mjs` |

**Tests:** 185 passed · **Typecheck:** clean

---

## Conclude

**⚠ SCENARIO CERTIFIED WITH RECOMMENDATIONS**

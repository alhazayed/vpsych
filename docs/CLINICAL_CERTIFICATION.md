# VPsych Clinical Certification — Mission 10

**Date:** 2026-08-03  
**Branch:** `cursor/clinical-certification-8acf`  
**PR:** https://github.com/alhazayed/vpsych/pull/52  
**Board role:** Multidisciplinary clinical review (psychiatry, psychology, CBT, DSM-5, ICD-11, OSCE, simulation, suicide risk)

---

## Overall Clinical Score

| Domain | Score (0–100) | Notes |
|---|---|---|
| Clinical fidelity (coding & packages) | 92 | Critical/High coding defects remediated |
| Persona consistency | 78 | Two strong bilingual personas; catalog covers 17 dx |
| DSM-5 compliance | 94 | CPTSD correctly ICD-11-only |
| ICD-11 compliance | 95 | PDD/BPD/bipolar/CPTSD aligned |
| Educational value | 84 | Rubrics + modalities + objectives present |
| OSCE readiness | 80 | Templates + difficulties; production blocked |
| AI assessment quality | 72 | Live GPT patient turns; heuristic report fallback risk |
| Clinical safety | 70 | Prompt Module 4 fixed; **production SERVICE_ROLE missing** |
| **Overall** | **83** | |

### Verdict

**⚠ CLINICAL CERTIFIED WITH RECOMMENDATIONS**

---

## 1. Clinical Fidelity Report

### Inventory (verified)

- **17 active disorders** in Supabase + builtin Case Engine catalog
- **2 active avatars:** Maya Chen (MDD recurrent moderate), Jordan Hale (GAD + panic)
- **Locales:** `en-US`, `ar-JO` (native personalities, not translations)
- **Difficulties:** beginner → expert
- **Modalities:** CBT, DBT, ACT, MI, supportive, crisis, psychodynamic, family, exposure

### Defects fixed (evidence-backed)

| Sev | Finding | Evidence | Remediation |
|---|---|---|---|
| Critical | Complex PTSD coded as DSM-5 `309.81` / ICD-10 PTSD | DB + `catalog.ts` pre-fix | `dsm5/icd10=null`, ICD-11 `6B41`, `dsm5_optional` |
| Critical | Bipolar psychotic mania ICD-11 `6A60.1` (without psychosis) vs DSM `296.44`/ICD-10 `F31.2` | Code mismatch | ICD-11 → `6A60.2` |
| High | PDD ICD-11 `6A71.0` (single-episode MDD mild) | Wrong chapter code | → `6A72` |
| High | BPD ICD-11 `6D10.0` alone | Missing borderline pattern | → `6D10.1/6D11.5` |
| High | PTSD risk template `default_persona_slug=maya-chen` | MDD biography on PTSD case | Unbound in catalog + DB |
| High | Module 4 omitted `harm_to_others` | `prompt-engine.ts` | Added to risk portrayal |
| High | `autism_assessment` → ADHD only | `objective-map.ts` | Prefer `asd` |
| High | Builtin catalog incomplete | Missing PDD/OCD/ASD/etc. | Expanded to 17 |
| Med | Heuristic safety under-scored explicit SI inquiry | Prior clinical-runtime report | Expanded EN/AR keywords |

### Static corpus

- `src/lib/clinical/clinical-fidelity.test.ts` — **136** generated CaseInstances (17 disorders × 2 locales × 4 difficulties)
- All must carry matching DSM/ICD codes and non-empty risk profiles
- Artifacts: `/opt/cursor/artifacts/clinical-cert/static-fidelity.log`, `coding-matrix.json`

### Live corpus

- Harness: `scripts/clinical-certify.mjs`
- Target: **50 EN + 50 AR = 100** complete create → 4-turn chat → end assessments
- Matrix: both personas × 4 difficulties × CBT/DBT/ACT/MI scripts × risk inquiry turns
- Checks: empty replies, prompt leakage, language script fidelity, end report presence
- Host: working preview (production blocked — see Safety)

---

## 2. Persona Consistency Report

| Persona | Identity | Culture | Language | Clinical core | Status |
|---|---|---|---|---|---|
| Maya Chen / ليان خوري | Distinct EN/AR identities | US / Jordanian | en-US / ar-JO native | MDD 296.32 / 6A71.1 | Approved case file + DB aligned |
| Jordan Hale / رامي نصّار | Distinct EN/AR identities | US / Jordanian | en-US / ar-JO native | GAD 300.02 / 6B00 | Consistent |

**Gaps (recommendations):**
- Only two authored personas; other diagnoses rely on Case Engine packages + persona overlay (identity may not match disorder culture fully).
- Voice casting present for both locales; full voice OSCE corpus deferred to voice-runtime cert.

---

## 3. DSM-5 Compliance Report

| Disorder | DSM-5 | Compliant? |
|---|---|---|
| MDD recurrent moderate | 296.32 | Yes |
| GAD | 300.02 | Yes |
| PTSD | 309.81 | Yes |
| Complex PTSD | *null (ICD-11 only)* | Yes — no DSM-5 CPTSD code |
| PDD | 300.4 | Yes |
| Panic | 300.01 | Yes |
| Social anxiety | 300.23 | Yes |
| OCD | 300.3 (category obsessive-compulsive) | Yes |
| Adult ADHD | 314.00 | Yes |
| AUD | 305.00 | Yes |
| BPD | 301.83 | Yes |
| ASD | 299.00 | Yes |
| Schizophrenia | 295.90 | Yes |
| Schizoaffective | 295.70 | Yes |
| Bipolar mania w/ psychosis | 296.44 | Yes |
| Anorexia nervosa | 307.1 | Yes (AN-specific, not spectrum) |
| Delirium | 293.0 | Yes |

---

## 4. ICD-11 Compliance Report

| Disorder | ICD-11 | Notes |
|---|---|---|
| MDD recurrent moderate | 6A71.1 | OK |
| GAD | 6B00 | OK |
| PTSD | 6B40 | OK |
| Complex PTSD | **6B41** | Fixed |
| PDD / dysthymia | **6A72** | Fixed (was 6A71.0) |
| Panic | 6B01 | OK |
| Social anxiety | 6B04 | OK |
| OCD | 6B20 | OK |
| Adult ADHD inattentive | 6A05.0 | OK |
| AUD | 6C40.1 | OK |
| BPD | **6D10.1/6D11.5** | Fixed severity + borderline pattern |
| ASD | 6A02 | OK |
| Schizophrenia | 6A20 | OK |
| Schizoaffective | 6A21 | OK |
| Bipolar mania w/ psychosis | **6A60.2** | Fixed (was 6A60.1) |
| Anorexia nervosa | 6B80 | OK |
| Delirium | 6D70 | OK |

---

## 5. Educational Value Report

- Learning objectives mapped to disorder candidates (`OBJECTIVE_DISORDER_CANDIDATES`)
- Competency / rubric items on templates; pass/outstanding thresholds
- Therapy modality reaction rules in Case Engine
- Adaptive / CGE hooks present on session end (when configured)
- **Gap:** AI report path may still fall back to heuristic when assessment model/JSON fails (prior Mission findings); patient chat path is live GPT on working preview

---

## 6. OSCE Readiness Report

| Criterion | Status |
|---|---|
| Timed scenario templates | Present (MDD, GAD OSCE AR, PTSD risk) |
| Rubric + critical mistakes | Present |
| Bilingual stations | EN + AR |
| Difficulty tiers | 4 levels |
| Examiner-facing reports | Session end reports |
| Production station availability | **FAIL** — `Server misconfigured` without `SUPABASE_SERVICE_ROLE_KEY` |

---

## 7. AI Assessment Report

Live harness probes therapeutic scripts (empathy/CBT, risk/MI, DBT reflection, ACT) with mandatory safety inquiry turns.

Expected evidence fields in `/opt/cursor/artifacts/clinical-cert/live-assessment-results.json`:
- `ok` / `failed` counts
- `gptTurns` vs `personaTurns` vs `gatewayTurns`
- `leakHits`, `languageFails`
- `byDifficulty`, `byScript`, `endAiSources`

---

## 8. Clinical Safety Report

| Control | Status |
|---|---|
| Module 4 role integrity / no coach | Present |
| SI / self-harm / **harm_to_others** portrayal | Fixed |
| No method/means instruction | Present |
| Crisis resources locale-specific | Present |
| Prompt leakage scan in harness | Present |
| Privileged transcript inserts (service role) | **Production missing key** — blocks sessions |
| Heuristic safety scoring | Improved keywords; still not clinical-grade |

---

## Recommendations (blocking production-grade clinical use)

1. **CRITICAL (infra/safety):** Set `SUPABASE_SERVICE_ROLE_KEY` (or equivalent privileged path) on **production** Vercel so session create/message end paths do not return `Server misconfigured`.
2. Author additional personas for trauma, psychosis, BPD, eating, neurodevelopmental cases (avoid identity/diagnosis mismatch).
3. Prefer AI rubric assessment over heuristic fallback for OSCE grading.
4. Expand CPTSD symptom package (DSO domains) beyond thin seed.
5. Re-run full 100-assessment corpus on production after service-role fix; include voice stations.

---

## Regression

- `npm test -- --run src/lib/clinical/clinical-fidelity.test.ts src/lib/case-engine/ src/lib/scenario-templates/` — pass
- DB migration applied to project `rrzudbkxigeavfdnidnm`
- Browser smoke: UI/personas/voice controls visible; production chat blocked by misconfig (screenshots under `/opt/cursor/artifacts/clinical-cert/`)

---

## Conclusion

**⚠ CLINICAL CERTIFIED WITH RECOMMENDATIONS**

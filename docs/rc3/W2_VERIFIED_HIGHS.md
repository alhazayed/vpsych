# Wave 2 — Verified High Findings (Engineering Permit)

**Source:** Independent Wave 2 re-certification `RC3-W2-RECERT-EV-20260805T1545Z`  
**Governance:** RDL-015 / RDL-016  
**Production baseline:** `5bf66c0` / `dpl_5F6pBTi…` / https://vpsych.vercel.app  
**Status:** `APPLICATION_REMEDIATION_REQUIRED`

Engineering is authorized **only** for the findings below.  
Do not redesign VPsych. Do not change voice, auth, DB/RLS, UI, SEO/AEO, analytics, CGE, ACE, or release governance unless a verified High requires it (none of those are in scope here).

---

## W2-H1 — Complex PTSD / ICD-11-only

**Observed on production:**  
`POST /api/sessions` with `disorderSlug=complex-ptsd` → `400 Missing DSM-5 code for complex-ptsd` (EN × all difficulties; AR same in independent sweep). DB row active with `icd11_code=6B41`, `dsm5_code=null`.

**Required outcome:**

- CPTSD templates/cases instantiate correctly  
- ICD-11-only disorders fully supported  
- DSM-only validation no longer blocks ICD-11 cases  
- Existing PTSD behaviour unchanged  

**Regression required.**

---

## W2-H2 — Instructor preset `consultant_psychiatrist`

**Observed on production:**  
DB preset `complex-formulation-consultant-en` has `target_learner=consultant_psychiatrist`; `POST /api/admin/presets/preview` → `400 invalid_preset` / unknown target learner.

**Required outcome:**

- Preset loads successfully  
- Competency targets preserved  
- Permissions preserved  
- Adaptive curriculum compatibility preserved  

**Regression required.**

---

## W2-H3 — Mania phenotype

**Observed on production:**  
Mania sessions (EN/AR) present depressive hypersomnia/fog (e.g. sleep 10–11h), not DSM-5 manic decreased need for sleep / elevated energy presentation. Admin packages thin.

**Required outcome:** Authentic DSM-5 manic presentation where scenario-appropriate (mood, sleep need ↓, energy, speech, flight of ideas, grandiosity, judgement, resistance, severity). Maintain scenario variability — do not clone one manic script.

**Regression required.**

---

## W2-H4 — Schizophrenia phenotype

**Observed on production:**  
SZ sessions depression-dominated; psychosis probes denied; thin packages.

**Required outcome:** Primary expression of schizophrenia-spectrum features (positive, negative, thought disorder, functional decline, appropriate affect, psychosis behaviour). Depressive features only when clinically justified. Preserve differential-diagnosis teaching value.

**Regression required.**

---

## After remediation

1. Unit + regression + production-compatible scenario tests  
2. Production deploy (not preview-only)  
3. **New independent** Wave 2 re-certification agent  
4. Wave 3 unlock only after PASS + Executive Board authorization  

**Do not certify your own remediation.**

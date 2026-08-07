# DSM Mapping

**Owner:** Case Engine (`disorders.dsm5_code`, packages, validation)  
**Evidence:** `src/lib/case-engine/catalog.ts`, `types.ts`, `validation.ts`, assessment rubric `dsm_reasoning`.

---

## Purpose

Map each builtin disorder package to a **DSM-5** code when one exists, for educational fidelity and assessment of trainee diagnostic reasoning.

---

## Implementation rules

| Rule | Evidence |
|------|----------|
| DSM-5 is stored on `DisorderRow.dsm5_code` | catalog + DB `disorders` |
| Copied onto `CaseInstanceSnapshot.primary_diagnosis` / comorbidities | generator |
| Optional on `ClinicalCore.dsm5_code` | types.ts |
| **DSM-5 may be null** when `package.dsm5_optional === true` | Complex PTSD (ICD-11-only construct) |
| Patient must not recite DSM criteria | Module 1 syndrome / naturalness rules |
| No DSM multiaxial (Axis I–V) model | Absent by design (DSM-5 era) |

---

## Builtin disorder → DSM-5

| Slug | Name | DSM-5 | Notes |
|------|------|-------|-------|
| `mdd-recurrent-moderate` | MDD recurrent moderate | 296.32 | |
| `gad-with-panic` | GAD with panic attacks | 300.02 | |
| `ptsd` | PTSD | 309.81 | |
| `adult-adhd` | ADHD inattentive adult | 314.00 | |
| `alcohol-use-disorder` | AUD | 305.00 | |
| `panic-disorder` | Panic Disorder | 300.01 | |
| `bpd` | BPD | 301.83 | |
| `complex-ptsd` | Complex PTSD | **null** | `dsm5_optional`; ICD-11 `6B41` |
| `schizophrenia` | Schizophrenia | 295.90 | |
| `bipolar-mania` | Bipolar I manic | 296.44 | |
| `delirium` | Delirium | 293.0 | |

Reserved UUID slots without packages: `pdd`, `socialAnxiety`, `ocd`, `asd`, `schizoaffective`, `eating` — **no DSM mapping until packages exist**.

---

## Authored-only DSM content

`personas/*.case.json` may contain criterion-by-criterion `dsm5` trees (A–E, differentials, rule-outs). These are **authoring/examination assets**, not runtime ClinicalCore fields, and are **not** injected into the patient system prompt.

---

## Prompt / assessment representation

| Surface | Use of DSM |
|---------|------------|
| Patient Module 1 | Condition **name** + severity; codes not recited |
| Trainee assessment | Rubric item `dsm_reasoning` (weight 11) |
| CFI | `dsm5_diagnostic_accuracy` dimension |

---

## Relationships

DSM codes ↔ ICD-10/11 on same `DisorderRow` · symptoms from package · risk defaults from package.

---

## Gaps / extension

- Specifiers as structured fields: authored only → roadmap.  
- New disorders must ship DSM (or explicit `dsm5_optional`) + ICD-11 together.  
- Do not invent codes in engines outside the disorder catalog.

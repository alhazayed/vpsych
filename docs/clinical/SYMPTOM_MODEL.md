# Symptom Model

**Owner:** Case Engine → `ClinicalCore.symptom_profile`  
**Types:** `SymptomProfileItem` in `src/lib/types.ts`  
**Sources:** `DisorderPackage.symptom_profile`, comorbidity merges, legacy avatar clinical_core.

---

## Purpose

Represent the **current-session** symptom presentation for Module 1, including how readily each symptom is disclosed (salience).

---

## Runtime shape

| Field | Values / type | Role |
|-------|---------------|------|
| `id` | string | Stable symptom key within package |
| `description` | string | Patient-facing presentation language |
| `domain?` | mood \| anxiety \| sleep \| appetite \| cognition \| somatic \| social \| behavioral \| psychotic \| trauma | Grouping |
| `salience?` | presenting \| elicited \| hidden | Disclosure pacing in prompt |

---

## Prompt representation

Module 1 lists symptoms with salience tags (`[{{salience}}]`). Syndrome authority: Module 1 symptoms override conflicting Module 2 “current state” colouring.

---

## Lifecycle

1. Authored on disorder package (and optionally avatar clinical_core).  
2. Merged at case mint (`mergeClinicalCore`), including comorbid symptoms.  
3. Frozen on snapshot.  
4. Read-only during session.  
5. Not rewritten by Emotion/CBE (those change *expression*, not the symptom list).

---

## Relationships

| Related | Relationship |
|---------|--------------|
| Diagnosis | Symptoms belong to disorder package(s) |
| Disclosure rules | Separate list; governs *topics*, not each symptom id necessarily |
| Emotion | Affect modulates how symptoms are voiced |
| Clinical localization | Module 2 may re-express symptom ids culturally |
| Instruments (PHQ-9 etc.) | Authored narrative only — **not** this model |

---

## What this model is not

- Not a longitudinal symptom timeline (past vs current structured).  
- Not an instrument score object.  
- Not MSE thought-content items (those are authored MSE).  
- Not protective factors.

---

## Validation / security

- Descriptions must remain fictional educational content.  
- Hidden salience must still be clinically consistent if elicited.  
- No engine should append arbitrary symptoms mid-session without a Case Engine contract (none exists today).

---

## Extension points

- Past-symptom timeline → new ClinicalCore field or history package (roadmap).  
- Link symptom ids to instrument items formally.  
- Keep domain enum extension explicit in `types.ts` + ontology.

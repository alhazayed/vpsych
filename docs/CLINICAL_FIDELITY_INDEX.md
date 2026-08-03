# Clinical Fidelity Index (CFI) v1.0

**Board:** International clinical review board (senior psychiatry, clinical psychology, DSM-5-TR, ICD-11, medical education, AI clinical simulation)  
**Score range:** 0–100 (weighted scientific model — not arbitrary heuristics)  
**Implementation:** `src/lib/cfi/` · Dashboard: `/admin/cfi` · API: `/api/admin/cfi`

---

## Model

\[
\text{CFI} = \sum_{i=1}^{20} w_i \cdot s_i
\]

where \(w_i\) are fixed weights (\(\sum w_i = 1\)) and \(s_i \in [0,100]\) are dimension scores with per-dimension confidence.

**95% confidence interval** uses weighted dimension uncertainty (`weighted_dimension_uncertainty`): overall ± margin derived from \((1 - \text{confidence}/100)\) across dimensions.

Each assessment returns:

| Field | Description |
|---|---|
| `overall` | Weighted CFI 0–100 |
| `subscores` | 20 dimensions with score, weight, contribution, confidence, evidence, reasoning, recommendations |
| `confidence_interval` | `{ lower, upper, method, level: 0.95 }` |
| `evidence` | Disorder/locale/codes + per-dimension evidence keys |
| `clinical_reasoning` | Board-style narrative summary |
| `recommendations` | Remediation for low dimensions |
| `versions` | CFI, prompt, model, persona, template, assessment schema, package |
| `weight_matrix_version` | Locked to `CFI_VERSION` |

---

## Weight matrix (CFI 1.0.0)

| Dimension | Weight | Rationale |
|---|---:|---|
| DSM-5 diagnostic accuracy | 0.12 | Primary nosological anchor |
| ICD-11 consistency | 0.10 | International coding fidelity |
| Symptom fidelity | 0.10 | Criteria domain coverage |
| Severity fidelity | 0.05 | Package/template severity match |
| Timeline consistency | 0.05 | Clinically possible onset/course |
| Comorbidity consistency | 0.04 | Compatibility rules |
| Differential consistency | 0.05 | Differentials + rule-outs |
| MSE realism | 0.08 | Insight / judgment / speech cues |
| Medication history | 0.03 | No impossible regimens |
| Risk assessment | 0.08 | SI / self-harm / harm-to-others |
| Protective factors | 0.02 | Contextual supports |
| Speech realism | 0.03 | Non-caricature speech |
| Behavior realism | 0.03 | Behavioural anchors |
| Emotional realism | 0.03 | Affect vs severity |
| Cultural realism | 0.03 | Culture ≠ rewrite codes |
| Language realism | 0.03 | Locale consistency |
| Voice realism | 0.02 | Voice binding when spoken |
| Memory consistency | 0.03 | Case-isolated memory |
| Disclosure consistency | 0.04 | Difficulty-aligned disclosure |
| Prompt consistency | 0.04 | Version lock + no leakage |

Changing any weight **requires** bumping `CFI_VERSION`.

---

## Generation & storage

1. `generateCaseInstance` projects `clinical_teaching` MSE/meds/culture cues and computes CFI via `cfiInputFromSnapshot` → `computeClinicalFidelityIndex`.
2. Result is embedded on `CaseInstanceSnapshot.clinical_fidelity`.
3. Optional persistence: table `clinical_fidelity_scores` (`supabase/migrations/20260803200000_clinical_fidelity_index.sql`) stores overall, CI, versions, subscores/evidence JSONB, weight matrix version. RLS: admin-only.

---

## Dashboard & API

- **UI:** `/admin/cfi` — mean CFI, trend graph, per-disorder comparison, per-language comparison, low-CFI recommendations, weight matrix.
- **GET `/api/admin/cfi`** — dashboard from DB or offline corpus (builtins × `en-US` / `ar-JO`).
- **POST `/api/admin/cfi`** — recompute corpus; `{ "persist": true }` writes rows when migration is applied.

---

## Known scientific penalties

- Bipolar mania ICD-11 `6A60.1` without psychosis → ICD dimension penalty (prefer `6A60.2`).
- BPD ICD-11 `6D10.0` alone → penalty (prefer `6D10.1` / `6D11.5` pattern).
- Impossible timelines (e.g. PDD in weeks, delirium in months, mania lasting years without days).
- Culture rewriting DSM/ICD codes → cultural dimension collapse.

---

## Tests

`src/lib/cfi/cfi.test.ts` — weight sum, timeline heuristics, full compute on generated cases, dashboard aggregates, missing-DSM penalty.

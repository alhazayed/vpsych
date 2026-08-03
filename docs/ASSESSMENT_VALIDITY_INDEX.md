# Assessment Validity Index (AVI) v1.0

**Board:** Psychometrician · medical education professor · assessment scientist · AI evaluation researcher  
**Score range:** 0–100 (weighted scientific model)  
**Implementation:** `src/lib/avi/` · Dashboard: `/admin/avi` · API: `/api/admin/avi`

---

## Model

\[
\text{AVI} = \sum_{i=1}^{14} w_i \cdot s_i
\]

where \(w_i\) are fixed weights (\(\sum w_i = 1\)) and \(s_i \in [0,100]\).

**95% CI** uses weighted dimension uncertainty.  
**Variance** is the sample variance of repeated overall scores for the same case.

Each assessment returns: overall AVI, variance, subscores, confidence interval, evidence, validity report, recommendations, and version locks (assessment schema, prompt, model, rubric).

---

## Weight matrix (AVI 1.0.0)

| Dimension | Weight | Rationale |
|---|---:|---|
| Content validity | 0.10 | Rubric covers claimed competency domains |
| Construct validity | 0.10 | α + discrimination behave as intended construct |
| Face validity | 0.06 | Looks like a credible clinical skills exam |
| Criterion validity | 0.10 | External criterion — or disclosed absence |
| Internal consistency | 0.08 | Cronbach α |
| Reliability | 0.08 | Test–retest / adjacent-repeat stability |
| Competency alignment | 0.08 | Rubric → ACE/CGE mapping |
| Clinical relevance | 0.07 | Safety / assessment / alliance present |
| Educational relevance | 0.07 | Feedback + narrative support learning |
| Bias | 0.06 | Fairness / language parity controls |
| Difficulty discrimination | 0.05 | Separates beginner vs advanced |
| Competency discrimination | 0.05 | Item–total discrimination |
| Repeatability | 0.05 | Low variance under repeated assessment |
| Explainability | 0.05 | Feedback, narrative, provenance |

Changing any weight **requires** bumping `AVI_VERSION`.

---

## Repeated assessments & stability

`buildAviOfflineCorpus()` runs **5 repeats** per case under controlled noise, then:

- Computes **variance** / SD for repeatability
- Aggregates adjacent-repeat correlation as a reliability proxy
- Surfaces **scoring stability trend** on the dashboard

Criterion validity is **never invented** — absence of a human OSCE co-validation study is disclosed and scored as a known limitation (~45).

---

## Generation & storage

1. `assessSession` embeds `scores.assessment_validity` (AVI v1.0) on every report.
2. Persistence: `assessment_validity_scores` (`supabase/migrations/20260803220000_assessment_validity_index.sql`) stores overall, variance, CI, versions, evidence JSONB. RLS: admin-only.

Stored version locks:
- `avi_version`
- `assessment_schema_version`
- `prompt_version`
- `model_version`
- `rubric_version`

---

## Dashboard & API

- **UI:** `/admin/avi` — mean AVI, mean variance, stability trend, validity report summary, per-mode & per-language comparison, recommendations, weight matrix.
- **GET `/api/admin/avi`** — dashboard from DB or offline corpus.
- **POST `/api/admin/avi`** — recompute; `{ "persist": true }` writes rows when migration is applied.

---

## Scientific board integration

`runScientificValidation()` uses the **mean AVI from `buildAviOfflineCorpus()`** (not an arbitrary additive stub).

---

## Tests

`src/lib/avi/avi.test.ts` — weight sum, repeat variance, full compute, offline corpus/dashboard, assessment embedding.

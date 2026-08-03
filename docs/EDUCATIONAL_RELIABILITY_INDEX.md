# Educational Reliability Index (ERI) v1.0

**Board:** CBME specialist · psychometrician · OSCE examiner · educational psychologist · residency program director  
**Score range:** 0–100 (weighted scientific model)  
**Implementation:** `src/lib/eri/` · Dashboard: `/admin/eri` · API: `/api/admin/eri`

---

## Model

\[
\text{ERI} = \sum_{i=1}^{15} w_i \cdot s_i
\]

where \(w_i\) are fixed weights (\(\sum w_i = 1\)) and \(s_i \in [0,100]\).

**95% CI** uses weighted dimension uncertainty (`weighted_dimension_uncertainty`).

Each assessment returns: overall ERI, subscores, confidence interval, evidence, educational reasoning, improvement suggestions, and version locks.

---

## Weight matrix (ERI 1.0.0)

| Dimension | Weight | Rationale |
|---|---:|---|
| Competency scoring consistency | 0.12 | Rubric completeness + Cronbach α |
| Feedback usefulness | 0.08 | Coverage and depth of item feedback |
| Feedback specificity | 0.07 | Concrete, excerpt-grounded comments |
| Actionability | 0.07 | Goals, remediation, next cases |
| Supervisor comments | 0.06 | Supervisor-style coaching narrative |
| Reflection quality | 0.05 | Reflective prompts for deliberate practice |
| Learning objective alignment | 0.08 | Objectives ↔ competencies mapping |
| Clinical reasoning quality | 0.08 | Examiner narrative depth |
| Remediation quality | 0.07 | Missed opportunities + plan |
| Difficulty calibration | 0.06 | Difficulty vs learner match |
| Inter-session consistency | 0.06 | Adjacent-session correlation |
| Inter-rater agreement | 0.06 | Simulated dual-rater r / % agree |
| Longitudinal stability | 0.05 | Test–retest stability |
| Assessment fairness | 0.05 | Fairness control audit |
| Language parity | 0.04 | EN/AR educational parity |

Changing any weight **requires** bumping `ERI_VERSION`.

---

## Generation & storage

1. `assessSession` embeds `scores.educational_reliability` (ERI v1.0) on every report.
2. Optional ACE coach fields enrich actionability / remediation / reflection when present.
3. Persistence: `educational_reliability_scores` (`supabase/migrations/20260803210000_educational_reliability_index.sql`) stores overall, CI, versions (assessment, rubric, CGE, ACE), subscores/evidence JSONB. RLS: admin-only.

Stored version locks:
- `eri_version`
- `assessment_version` (`ASSESSMENT_SCHEMA_VERSION`)
- `rubric_version` (`RUBRIC_SCHEMA_VERSION`)
- `competency_graph_version` (`CGE_ENGINE_VERSION`)
- `adaptive_curriculum_version` (`ACE_ENGINE_VERSION`)

---

## Dashboard & API

- **UI:** `/admin/eri` — mean ERI, learner reliability trend, instructor reliability report, per-difficulty & per-language comparison, low-ERI recommendations, weight matrix.
- **GET `/api/admin/eri`** — dashboard from DB or offline corpus (6 archetypes × 6 sessions).
- **POST `/api/admin/eri`** — recompute; `{ "persist": true }` writes rows when migration is applied.

---

## Scientific board integration

`runScientificValidation()` uses the **mean ERI from `buildEriOfflineCorpus()`** (not an arbitrary additive stub).

---

## Disclosures

- Simulated inter-rater agreement is **not** human OSCE Cohen’s κ / ICC.
- Heuristic (`persona_fallback`) assessments are capped on competency consistency and disclosed as non-validated instruments.

---

## Tests

`src/lib/eri/eri.test.ts` — weight sum, inter-rater simulation, full compute, offline corpus/dashboard, assessment embedding.

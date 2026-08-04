# VPsych Quality Index (VQI) v1.0

**Board:** Chief Scientific Officer · Medical Education · Psychometrics · Clinical Simulation · Healthcare Data Science  
**Score range:** 0–100 (hierarchical weighted composite)  
**Implementation:** `src/lib/vqi/` · Dashboard: `/admin/vqi` · API: `/api/admin/vqi`

The VQI is the **master** quality metric of VPsych. It is **not** a simple average of domain indices.

---

## Model

\[
\text{VQI} = \sum_{i \in P} w'_i \cdot s_i \cdot \bigl(1 - 0.5 \cdot m_{\text{req}}\bigr)
\]

where:

- \(s_i \in [0,100]\) are sub-indices (CFI, ERI, AVI, ALE, RRS, …)
- \(w_i\) come from a **versioned weight set** (Admin Dashboard editable)
- \(P\) is the set of present metrics; \(w'_i = w_i / \sum_{j \in P} w_j\) (missing-data renormalization)
- \(m_{\text{req}}\) is the total weight of **missing required** metrics (confidence/completeness penalty)

Each calculation returns: overall VQI, sub-index contributions, 95% CI, multi-domain confidence, maturity band, strengths/weaknesses, recommendations, and full provenance.

---

## Default weight set (editable, versioned)

| Metric | Weight | Required |
|---|---:|:---:|
| Clinical Fidelity Index (CFI) | 30% | yes |
| Educational Reliability Index (ERI) | 25% | yes |
| Assessment Validity Index (AVI) | 20% | yes |
| Adaptive Learning Effectiveness (ALE) | 15% | no |
| Research Readiness Score (RRS) | 10% | no |

Weights are **not** hardcoded in the engine. Changing weights creates a new `weight_version`. Frozen sets are immutable; restore by activating a prior version.

Future metrics register in `src/lib/vqi/registry.ts` without schema redesign.

---

## Entity levels

Assessment · Learner · Instructor · Institution · Clinical Template · Disorder · Language · Persona · Release · AI Model · Platform

Offline corpus (`buildVqiOfflineCorpus`) composes peer metric corpora into hierarchical VQI records for each level.

---

## Maturity / Quality Certificate

| VQI | Classification |
|---|---|
| &lt; 60 | Experimental |
| 60–74 | Development |
| 75–84 | Pilot Ready |
| 85–94 | Production Ready |
| 95–100 | World-Class Educational Platform |

Certificate includes scientific / clinical / educational / technical / institutional / research confidence scores plus platform, institution, and research readiness statements.

---

## Provenance (every score)

Stored with every calculation:

- VQI version · algorithm version · weight set id/version · metric versions
- Prompt · AI model · clinical template · persona · competency graph · adaptive curriculum · instructor preset · assessment schema · platform release
- Timestamp

No quality score is issued without this lineage.

---

## Storage

Migration `supabase/migrations/20260803250000_vpsych_quality_index.sql`:

- `quality_metric_definitions` / versions
- `quality_weight_sets` (versioned, freezable)
- `vpsych_quality_scores` (entity scores + provenance JSONB)
- `vqi_benchmarks`, `vqi_trends`, `vqi_certificates`
- Admin RLS

---

## Automatic recalculation

Triggers (see `src/lib/vqi/hooks.ts`):

- Assessment completed
- Competency / Adaptive Curriculum / Clinical Template / Instructor Preset updated
- Metric algorithm or weight set updated
- Platform release changed

Admin **POST `/api/admin/vqi`** recomputes the corpus; `{ "persist": true }` writes when migration is applied.

---

## Dashboard & API

- **UI:** `/admin/vqi` — Executive, Scientific, Certificate, Weights, Entities, Trends
- **GET `/api/admin/vqi`** — dashboard (DB or offline corpus)
- **GET `?format=csv|json|excel|pdf|research`** — exports
- **POST** — `compute` / `create_weights` / `freeze`

---

## Scientific validation of VQI

`validateVqiScience` reports internal consistency (α), repeatability, inter-language/model gaps, variance, and explainability. Scientific board overall (`runScientificValidation`) uses VQI composite of CFI/ERI/AVI/ALE/RRS — not an unweighted 9-metric mean.

---

## Reproducibility

- Unit tests: `src/lib/vqi/vqi.test.ts`
- Offline corpus is deterministic given peer corpora + builtins
- Weight and algorithm versions are locked on every score

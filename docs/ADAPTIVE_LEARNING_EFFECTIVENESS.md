# Adaptive Learning Effectiveness (ALE) v1.0

**Board:** Learning analytics scientist · adaptive learning engineer · AI curriculum specialist · educational data scientist  
**Score range:** 0–100 (weighted scientific model)  
**Implementation:** `src/lib/ale/` · Dashboard: `/admin/ale` · API: `/api/admin/ale`

---

## Model

\[
\text{ALE} = \sum_{i=1}^{12} w_i \cdot s_i
\]

where \(w_i\) are fixed weights (\(\sum w_i = 1\)) and \(s_i \in [0,100]\).

Each longitudinal learner run returns: overall ALE, subscores, 95% CI, evidence, curriculum quality report, recommendations, **learning curve**, **difficulty curve**, and version locks (adaptive / curriculum / competency graph).

---

## Weight matrix (ALE 1.0.0)

| Dimension | Weight | Rationale |
|---|---:|---|
| Difficulty progression | 0.10 | Difficulty rises with mastery, not blindly |
| Case sequencing | 0.09 | Fingerprint diversity + deficit targeting |
| Competency remediation | 0.12 | Weak competencies get focused cases |
| Learning efficiency | 0.09 | Gain per session under adaptive decisions |
| Knowledge retention | 0.08 | Late sessions retain mid-trajectory gains |
| Reduction of repeated mistakes | 0.09 | Miss flags decline over time |
| Improvement speed | 0.09 | Linear slope of overall scores |
| Case diversity | 0.07 | Disorder/difficulty diversity |
| Instructor objective alignment | 0.07 | Focus matches preset objectives |
| Adaptive accuracy | 0.08 | Focus matches weakest assessed competency |
| Competency graph utilization | 0.06 | CGE root-cause / pathway used |
| Learning pathway quality | 0.06 | Non-empty coherent pathway |

Changing any weight **requires** bumping `ALE_VERSION`.

---

## Learner simulations

`buildAleOfflineCorpus()` runs longitudinal ACE+CGE trajectories for:

| Archetype | Start | Sessions |
|---|---:|---:|
| weak | ~42 | 10 |
| average | ~58 | 10 |
| excellent | ~76 | 10 |

Each session: generate adaptive (or graph-aware) next case → score → ingest into ACE → track focus accuracy, miss decline, difficulty sequence.

---

## Storage

Table `adaptive_learning_effectiveness_scores` (`supabase/migrations/20260803230000_adaptive_learning_effectiveness.sql`):

- `overall`, CI, subscores/evidence JSONB
- `learning_curve`, `difficulty_curve`
- `ale_version`, `adaptive_version`, `curriculum_version`, `competency_graph_version`
- Admin RLS

---

## Dashboard & API

- **UI:** `/admin/ale` — mean ALE, learning curves, difficulty curves, per-archetype comparison, curriculum quality report, recommendations, weight matrix
- **GET `/api/admin/ale`** — DB or offline corpus
- **POST `/api/admin/ale`** — recompute; `{ "persist": true }` when migration applied

---

## Scientific board integration

`runScientificValidation()` uses the **mean ALE from `buildAleOfflineCorpus()`** (not an arbitrary additive stub).

---

## Tests

`src/lib/ale/ale.test.ts` — weight sum, compute, poor-remediation penalty, offline corpus/dashboard.

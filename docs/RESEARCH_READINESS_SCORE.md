# Research Readiness Score (RRS) v1.0

**Board:** Clinical researcher · IRB reviewer · journal reviewer · biostatistician · medical informatics · research methodology  
**Score range:** 0–100 (weighted scientific model)  
**Implementation:** `src/lib/rrs/` · Dashboard: `/admin/rrs` · API: `/api/admin/rrs`

---

## Model

\[
\text{RRS} = \sum_{i=1}^{17} w_i \cdot s_i
\]

where \(w_i\) are fixed weights (\(\sum w_i = 1\)) and \(s_i \in [0,100]\).

Each snapshot returns: overall RRS, subscores, 95% CI, evidence, **publication readiness report**, **dataset quality report**, recommendations, **version matrix**, **reproducibility matrix**, and version locks (dataset, schema, prompt, model, export).

---

## Weight matrix (RRS 1.0.0)

| Dimension | Weight | Rationale |
|---|---:|---|
| Version control | 0.07 | Scientific engine locks coherent |
| Data completeness | 0.06 | Research-critical fields populated |
| Data integrity | 0.06 | Evidence locks + schema + disclosure |
| Auditability | 0.06 | Security/admin audit trail |
| Reproducibility | 0.08 | Seeded sims + offline corpora |
| Assessment reproducibility | 0.07 | Schema + provenance for re-scoring |
| Prompt versioning | 0.06 | Prompt engine version locked |
| Persona versioning | 0.04 | Persona stamped on cases |
| Clinical template versioning | 0.05 | Template/preset versions stamped |
| AI model versioning | 0.06 | Model id or heuristic disclosed |
| Dataset consistency | 0.06 | Peer metric corpora + evidence matrix |
| Longitudinal consistency | 0.05 | Session order / learner linkage |
| Export quality | 0.05 | Research export packaging (honest if absent) |
| Metadata completeness | 0.06 | scientific_meta / provenance complete |
| Anonymization readiness | 0.05 | De-identification pipeline readiness |
| GDPR compliance | 0.06 | DSAR documented and/or productized |
| Institutional research readiness | 0.06 | Supervised research deployment readiness |

Changing any weight **requires** bumping `RRS_VERSION`.

---

## Honest gap disclosure

Missing research export / anonymization / GDPR productization receive **partial scores with explicit disclosure** — they are never awarded full credit. The offline corpus includes:

| Snapshot | Purpose |
|---|---|
| `vpsych-platform` | Current honest platform readiness |
| `vpsych-heuristic-degraded` | Heuristic assessment path (disclosed) |
| `vpsych-research-export-target` | Gap-analysis target with export+GDPR productized |

Scientific board RRS uses the **platform** snapshot mean only.

---

## Storage

Table `research_readiness_scores` (`supabase/migrations/20260803240000_research_readiness_score.sql`):

- overall, CI, subscores/evidence JSONB
- publication + dataset quality reports
- version_matrix, reproducibility_matrix
- `rrs_version`, `dataset_version`, `schema_version`, `prompt_version`, `model_version`, `export_version`
- Admin RLS

---

## Dashboard & API

- **UI:** `/admin/rrs` — mean RRS, publication readiness, dataset quality, version matrix, reproducibility matrix, recommendations
- **GET `/api/admin/rrs`** — DB or offline corpus
- **POST `/api/admin/rrs`** — recompute; `{ "persist": true }` when migration applied

---

## Scientific board integration

`runScientificValidation()` uses RRS from `buildRrsOfflineCorpus()` filtered to `vpsych-platform`.

---

## Tests

`src/lib/rrs/rrs.test.ts` — weight sum, compute, no invented export credit, corpus/dashboard.

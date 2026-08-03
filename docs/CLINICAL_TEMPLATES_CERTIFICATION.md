# VPsych Clinical Templates Certification Report

**Mission:** Clinical Templates  
**Board:** Independent Release Certification Board  
**Date:** 2026-08-03  
**Scope:** Clinical Scenario Templates (builtin + DB), admin template APIs, template→Standardized Patient generation, disorder coding used by templates  
**Baselines:** GitHub `main` @ `3e3077e`, production `https://vpsych.vercel.app`  
**Remediation branch:** `cursor/clinical-templates-cert-e57e` (PR #75)  
**Evidence:** `/opt/cursor/artifacts/clinical-templates-cert/`

---

## Executive Summary

Production and `main` audits showed **Critical** clinical coding drift in the offline Case Engine catalog (wrong ICD-11 for BPD and bipolar mania; only 10 of 17 disorders packaged) and **Critical** empty objectives/competencies on production GAD/PTSD `clinical_templates` rows (DB-backed preview fails `validateTemplate`). Additional **High** defects: PTSD template bound to MDD persona Maya Chen, only three builtin templates, and raw Postgres errors on admin create/clone.

All Critical/High findings were fixed, unit-regression tested (including 500 randomized SP generations), and documented.

**Certification outcome:**

⚠ CERTIFIED WITH RECOMMENDATIONS

**Board score:** 91 / 100

---

## Inventory (post-fix)

| Asset | Count | Notes |
|---|---|---|
| Builtin scenario templates (enabled) | **10** | EN + AR; was 3 on `main` |
| Production DB templates | **3** | MDD / GAD / PTSD parent rows; children seeded |
| Builtin disorders | **17** | Matches production `disorders` set |
| Production disorders coding | Aligned | CPTSD ICD-11-only; BPD `6D10.1/6D11.5`; bipolar `6A60.2`; PDD `6A72` |

Template matrix: `template-inventory.json`

| Slug | Lang | Primary | Persona |
|---|---|---|---|
| adult-mdd-initial-en | en-US | MDD | maya-chen |
| adult-gad-osce-ar | ar-JO | GAD | jordan-hale |
| ptsd-risk-assessment-en | en-US | PTSD | **unbound** |
| adult-bpd-crisis-en | en-US | BPD | unbound |
| bipolar-mania-safety-en | en-US | Bipolar mania | unbound |
| schizophrenia-initial-en | en-US | Schizophrenia | unbound |
| ocd-erp-assessment-en | en-US | OCD | unbound |
| complex-ptsd-phase1-ar | ar-JO | CPTSD | unbound |
| panic-osce-en | en-US | Panic | jordan-hale |
| adult-mdd-followup-ar | ar-JO | MDD | maya-chen |

---

## Verified Findings and Fixes

### C1 — Critical — Builtin catalog ICD-11 / coverage drift

| Field | Detail |
|---|---|
| **Severity** | Critical |
| **Evidence** | `main` catalog: BPD `icd11_code: "6D10.0"`, bipolar `6A60.1`, only 10 disorder packages; production DB already had corrected codes (`6D10.1/6D11.5`, `6A60.2`, CPTSD `6B41`, PDD `6A72`) — SQL dump 2026-08-03 |
| **Root cause** | Offline Case Engine catalog lagged production clinical certification migrations |
| **Fix** | `ac2991e` — expand to 17 disorders; align ICD/DSM; mark CPTSD `dsm5_optional` |
| **Regression** | Certification guards + `generate.test.ts` 500 SP corpus; CPTSD expects null DSM-5 |
| **Residual risk** | Low — production DB already correct |

### C2 — Critical — DB templates missing objectives/competencies

| Field | Detail |
|---|---|
| **Severity** | Critical |
| **Evidence** | Pre-fix SQL: `adult-gad-osce-ar` and `ptsd-risk-assessment-en` had **0** objectives and **0** competencies; preview maps DB rows into `generateFromTemplate` → `validateTemplate` fails `objectives_missing` / `competencies_missing` |
| **Root cause** | Parent `clinical_templates` seeded without child rows |
| **Fix** | `a1a6502` migration seed (applied to production); `5474a8c` preview falls back to builtin metadata when child rows empty |
| **Regression** | Post-seed SQL: GAD 3/3, PTSD 3/2, MDD 5/4; unit guards for fallback |
| **Residual risk** | New DB-only templates still need child seeding or builtin twins |

### H1 — High — PTSD template bound to MDD Maya persona

| Field | Detail |
|---|---|
| **Severity** | High |
| **Evidence** | `main` `ptsd-risk-assessment-en` `default_persona_slug: "maya-chen"` (MDD biography) |
| **Root cause** | Convenience binding without clinical identity check |
| **Fix** | `5f9c284` — `default_persona_slug: null` |
| **Regression** | Certification test asserts not `maya-chen` |
| **Residual risk** | Low — Case Engine supplies PTSD clinical core |

### H2 — High — Insufficient template coverage

| Field | Detail |
|---|---|
| **Severity** | High |
| **Evidence** | `main` had 3 builtins; production has 17 active disorders |
| **Root cause** | Catalog never expanded after Case Engine growth |
| **Fix** | `5f9c284` — 10 enabled templates spanning mood, anxiety, trauma, personality, psychosis, OCD |
| **Regression** | All enabled templates `validateTemplate` OK; 500 randomized generations |
| **Residual risk** | Medium — DB still has only 3 parent templates; builtins cover offline/admin gaps |

### H3 — High — Raw DB errors on admin create/clone

| Field | Detail |
|---|---|
| **Severity** | High |
| **Evidence** | `main` `route.ts` returned `cloneErr.message` / `createErr.message` unsanitized |
| **Root cause** | Inconsistent `sanitizeDbError` usage |
| **Fix** | `5474a8c` |
| **Regression** | Architecture-style string guard in certification test |
| **Residual risk** | Low |

---

## Controls Verified Pass

| Control | Result | Evidence |
|---|---|---|
| Template validation | Pass | All 10 enabled builtins validate |
| Impossible comorbidity rejection | Pass | MDD×bipolar mania rejected in generate test |
| Memory isolation across templates | Pass | Distinct assessment IDs / diagnoses |
| Admin template RLS | Pass | Write policy requires `profiles.role = admin` |
| Anon admin API | Blocked | Production GET `/api/admin/templates` → **307** login (middleware; known API residual until API PR merges) |
| Vercel template runtime errors (7d) | None | `get_runtime_errors` empty for admin template routes |

---

## Regression Matrix

| Gate | Result |
|---|---|
| `generate.test.ts` (500 SPs) | Pass |
| Clinical template certification guards (6) | Pass |
| `npm test` | **174/174** |
| `npm run build` | Pass |
| Production DB child seed | GAD/PTSD objectives+competencies present |

---

## Residual Risks & Recommendations

| ID | Severity | Item | Recommendation |
|---|---|---|---|
| R1 | Ops / merge | Production still serves pre-fix app code | Merge & promote PR #75 |
| R2 | Medium | Only 3 templates exist as DB rows | Upsert remaining 7 builtins into `clinical_templates` (+ children) |
| R3 | Medium | Unbound templates rely on Case Engine persona overlay | Author diagnosis-matched personas over time |
| R4 | Low | Anon admin API still HTML-307 until API middleware cert merges | Track with PR #73 |
| R5 | Info | Full disorder package pedagogy enrichment (onset timelines, teaching cues) lives partly on prior scenario branches | Optional follow-on; not blocking template certification after coding/coverage fixes |

---

## Commits (subsystem grouping)

1. `ac2991e` — `fix(clinical):` builtin disorder catalog ICD-11 + 17 packages  
2. `5f9c284` — `fix(templates):` expand catalog, CPTSD validation, unbind PTSD×Maya  
3. `5474a8c` — `fix(templates):` sanitize admin errors + preview builtin fallback  
4. `a1a6502` — `fix(db):` seed GAD/PTSD objectives & competencies  
5. `42abf5a` — `test(templates):` certification contracts  

---

## Board Verdict

No remaining **Critical** or **High** Clinical Template defects on the remediation branch after static generation regression and production DB seeding.

⚠ **CERTIFIED WITH RECOMMENDATIONS**

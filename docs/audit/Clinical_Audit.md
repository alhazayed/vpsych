# Clinical Audit — Section A (CEI)

**Audit:** VEA-2026-08-05 · Production SHA `5aae138` · Observational only

## Scope

DSM-5 / ICD-11 fidelity · MSE realism · differentials · comorbidity · risk (suicide / violence) · medication · therapeutic realism · longitudinal consistency · PME behaviour · therapy-response realism · cultural appropriateness.

**Production clinical AI surface:** Case Engine + prompt engine **v2** + authored personas.  
**Not on production:** Patient Mind Engine, Therapy Response Engine, HCFI speech profiles (draft PRs only).

---

## Evidence base

| Source | Role |
|---|---|
| Live prod `https://vpsych.vercel.app` | Deploy SHA verification |
| `origin/main` prompt-engine v2 | What patients actually express from |
| `src/lib/case-engine/catalog.ts` (main) | Builtin disorders, comorbidity rules |
| `personas/*.case.json` | Deep authored cases (Maya, Jordan) |
| `docs/DYNAMIC_CLINICAL_CASE_ENGINE.md` | Design invariants |
| Mission 21–22 / TRE docs | Roadmap only (not prod) |
| CLAUDE.md | Explicit: competency scores not validated |

---

## Subscore table (0–100)

| Dimension | Score | Evidence | Gap / root cause |
|---|---:|---|---|
| DSM-5 fidelity | 72 | Catalog DSM-5 codes on most builtins; rich MDD/GAD/SZ/mania packages; CPTSD ICD-11-only with W2 fix on main | Thin packages (AUD/panic/BPD/delirium) under-specify criteria |
| ICD-11 fidelity | 76 | ICD-11 codes on builtins; CPTSD `6B41`; bipolar mania coding alignment in W2 | Breadth > depth on several categories |
| MSE realism | 58 | Prompt Module 1 behavioral fidelity; deep MSE in 2 personas | Most packages lack projected insight/speech/judgment depth; no live PME emotion machine |
| Differential diagnosis | 55 | Strong differentials on MDD/GAD/PTSD/SZ/mania | AUD/panic/BPD/delirium packages historically thin / empty differentials |
| Comorbidity realism | 68 | Explicit compatible/impossible rules in catalog; generator rejection | Sparse matrix; some hard blocks may over-constrain teaching |
| Risk / suicide assessment | 64 | SI defaults + safety module in prompt; Maya C-SSRS-quality case | Few active-plan/intent training envelopes; assessment safety partly heuristic |
| Violence assessment | 40 | `harm_to_others` defaults false; little active violence pedagogy | Root: risk envelope too narrow for residency training |
| Medication discussions | 58 | Strong in authored personas; adherence cues | No systematic psychopharmacology packages on catalog disorders |
| Therapeutic realism | 52 | Alliance cues in prompts; therapist effect limited without PME/TRE live | Production lacks computational therapy-response dynamics |
| Longitudinal clinical consistency | 50 | Case memory / sessions exist; multi-session life events largely draft TRE/PME | Human multi-session study not run; TRE not deployed |
| Patient Mind Engine behaviour | 20 | **Not on production** | Draft PR #122 only |
| Therapy Response realism | 18 | **Not on production** | Draft PR #124 only |
| Cultural appropriateness | 74 | Native en-US / ar-JO cultural_context fields; never_translate invariant | Single dialect; dialect-mismatch risk outside Jordanian Arabic |

---

## Clinical Excellence Index (CEI)

**Formula (audit):**  
`0.18·DSM5 + 0.15·ICD11 + 0.12·MSE + 0.10·Diff + 0.08·Comorbid + 0.12·RiskSuicide + 0.05·Violence + 0.06·Meds + 0.07·Therapeutic + 0.07·Longitudinal`

PME/TRE excluded from CEI numerator for production (scored separately as deployment gaps).

**CEI = 62 / 100**

### Interpretation

Adequate **structural** clinical case engineering for a training prototype. Insufficient for claims of psychiatrist-indistinguishable patients or evidence-informed longitudinal therapeutic change **on production**.

---

## Critical / High clinical findings

| ID | Sev | Finding | Root cause | Edu impact | Priority |
|---|---|---|---|---|---|
| CL-C1 | Critical | PME/TRE marketed in recent missions but absent from production | Draft stack not merged/deployed | Experts cannot evaluate claimed architecture | P0 |
| CL-C2 | Critical | No human clinical authenticity data (PAS n=0) | Studies not executed | Cannot claim realism | P0 |
| CL-H1 | High | Violence / active high-risk SI cases under-represented | Narrow risk defaults | Weak high-stakes interview training | P1 |
| CL-H2 | High | Disorder package depth uneven | Catalog expanded faster than clinical authorship | Uneven learner difficulty | P1 |
| CL-H3 | High | Assessment scores unvalidated | LLM examiner + heuristics; reliability corpus missing | Mis-educates if treated as OSCE | P1 |
| CL-M1 | Medium | Medication fidelity uneven | Persona-deep, catalog-shallow | Incomplete psychopharm teaching | P2 |

---

## Recommendations (no implementation in this audit)

| Rec | Impact | Priority |
|---|---|---|
| Deploy or stop referencing PME/TRE until live | Prevents false expert evaluation | P0 |
| Run blinded PAS (n≥8 consultants) | Unlocks authenticity claims | P0 |
| Expand high-risk / violence teaching cases with safety pedagogy | High residency value | P1 |
| Deepen thin packages (AUD, panic, BPD, delirium) | Raises CEI floor | P1 |
| Keep CPTSD ICD-11 path regression-locked | Protects W2 fix | P1 |

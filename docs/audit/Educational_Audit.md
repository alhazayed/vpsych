# Educational Audit — Section C (EEI)

**Audit:** VEA-2026-08-05 · Production SHA `5aae138` · Observational only

## Production educational stack (verified on main)

| Engine | On production? | Paths / docs |
|---|---|---|
| Dynamic Clinical Case Engine | Yes | `src/lib/case-engine/`, `docs/DYNAMIC_CLINICAL_CASE_ENGINE.md` |
| Scenario Template Engine | Yes | `src/lib/scenario-templates/` |
| Instructor Preset Engine | Yes | `src/lib/instructor-presets/` |
| ACE | Yes | `src/lib/ace/`, `/learning` |
| CGE | Yes | `src/lib/cge/`, `/learning/graph` |
| Assessment → admin report | Yes | end route + signed report RPC |
| Mission 22 LAS/PAS tooling | No | Draft PR #123 |

---

## Dimension scores

| Dimension | Score | Evidence | Gap |
|---|---:|---|---|
| Learning objectives | 78 | Templates require objectives; presets map objectives → cases | Coverage uneven across disorders |
| Competency mapping | 80 | ACE 26 domains; CGE DAG; template competencies | Graph completeness varies |
| Assessment validity | 42 | LLM examiner + heuristics; AVI/docs say not criterion-validated | **No OSCE co-validation** |
| Feedback usefulness | 68 | Admin ReportView narrative/scores/excerpts | Therapist sees limited post-session coach, not full report |
| Adaptive curriculum | 76 | ACE next-case + soft-fail if tables missing | Depends on learner data quality |
| Competency graph | 74 | CGE mastery/RCA/remediation | Instructor UX admin-gated |
| Case progression | 72 | Difficulty profiles + ACE sequencing | Longitudinal therapy progression not live (TRE draft) |
| Instructor presets | 75 | Seeded presets; W2 consultant_psychiatrist fix on main | Enterprise instructor role ≠ app role |
| Reports | 70 | Admin-only; HMAC insert-once | Learner reflection journal thin |
| Reflection quality | 60 | ACE coach reflective questions | No durable learner journal product |
| Clinical reasoning teaching | 68 | Differentials/teaching points in rich packages | Thin packages weaken reasoning scaffolds |

---

## Educational Excellence Index (EEI)

**EEI = 74 / 100**

Strongest production pillar. Architecture is unusually deep for a training simulator at this maturity. Validity of scored assessment remains the ceiling constraint.

---

## Findings

| ID | Sev | Finding | Root cause | Edu impact | Priority |
|---|---|---|---|---|---|
| ED-C1 | Critical | Scores can be mistaken for validated OSCE measures | Product emits numbers without published coefficients | High mis-education risk | P0 |
| ED-H1 | High | Full reports admin-only — therapists get incomplete feedback loop | Security/privacy design choice | Limits self-directed improvement | P1 |
| ED-H2 | High | LAS not collected | Mission 22 unexecuted / not deployed | Unknown learner authenticity | P1 |
| ED-M1 | Medium | App role binary (therapist/admin) vs enterprise faculty roles | Schema ahead of app RBAC | Instructor workflows awkward | P2 |

---

## Recommendations

| Rec | Impact | Priority |
|---|---|---|
| UI + docs banner: “scores not psychometrically validated” | Prevents misuse | P0 |
| Run LAS n≥20 supervised | Educational authenticity signal | P1 |
| Criterion study vs human OSCE raters | Publication path | P1 |
| Optional supervised learner feedback views | Improves deliberate practice | P2 |

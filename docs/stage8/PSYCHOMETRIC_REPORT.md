# Stage 8 — Psychometric Report

Facets evaluated by `evaluatePsychometrics`:

| Facet | Behaviour |
|-------|-----------|
| Internal consistency | Cronbach α when item matrix powered |
| Face validity | Rubric coverage heuristic |
| Content validity | Clinical core coverage proxy |
| Construct validity | Exploratory \|r(overall, turns)\| |
| Criterion validity | **Always null** until external OSCE corpus |
| Convergent validity | Ledger fidelity vs overall when pairs ≥3 |
| Discriminant validity | Locale mean-spread heuristic |
| Known-groups | Difficulty band spread proxy |

**Every result sets `significance_claimed: false`.**

Reuses `lib/scientific/psychometrics` helpers one-way (validation → scientific). Does not deepen ACE↔scientific import cycles into the patient path.

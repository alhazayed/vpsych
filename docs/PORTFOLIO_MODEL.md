# Portfolio Model — Stage 9

## Contents

| Log | Description |
|-----|-------------|
| Case log | Session id, diagnosis slug (case key), modalities observed, overall, strengths/weaknesses |
| Competency log | Per-skill Dreyfus level, score, evidence, next-level criteria |
| Strength evolution | Skills ≥ 70 with score series |
| Weakness evolution | Skills < 60 with score series |
| Milestones | Certification milestones met + current band |
| Certification progress | Band, %, board-ready flag (educational thresholds only) |

## Persistence

v1 stores supervisor bundles **in-process memory** (same pattern as Stage 8 validation store). ACE remains the durable learner trajectory owner. Optional durable supervisor ledger is tracked as technical debt (`SUP-01`).

## Longitudinal

Progress engine computes velocity, plateau, and regression from skill deltas. Dashboard progress graphs plot overall EMA across stored reviews.

## Privacy

Portfolio APIs never return admin-only `session_reports` narrative/scores bodies. Therapist-facing summary is formative coaching only.

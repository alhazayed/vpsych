# Stage 8 — Benchmark Report

## Corpora

| Source | Role |
|--------|------|
| Synthetic baseline | Low-fidelity floor |
| Expert-authored cases | Anchor vignettes |
| Historical simulations | Cohort mean anchors |
| Gold-standard scenarios | Expert MDD/GAD/PTSD targets |

## Rule

**Never train. Only compare.**

`compareAgainstBenchmarks` emits per-metric VPsych vs baseline deltas with notes `never_trains` / `comparison_only`.

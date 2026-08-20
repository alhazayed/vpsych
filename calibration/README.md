# calibration/

**SYNTHETIC DATA ONLY. Nothing here is real learner data, and nothing here is evidence.**

`synthetic-corpus.json` is a deterministic fixture (seed 20260820, 60 subjects) generated from a
single latent-ability model with one deliberately noisy dimension (`structure`). It exists so the
assessment reliability harness can be exercised end-to-end in CI **without touching the production
corpus**.

The harness is expected to recover `structure` as the weakest item — that is a test of the
harness, not a finding about VPsych.

Running the harness against production data is **Program F2** and requires **OD-21** (psychometric
authority) and **OD-25** (corpus analysis authorization). See `docs/ASSESSMENT_RELIABILITY.md`.

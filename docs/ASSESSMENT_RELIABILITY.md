# Assessment reliability

## The problem this addresses

`assessSession()` produces a weighted 0–100 score and per-rubric feedback that a
training programme is expected to act on. Every certification in `docs/` so far
covers architecture, security, or functional correctness — that the score is
*computed and stored correctly*. None of them establish that the score is
*reproducible* or that it *tracks expert judgement*.

Those are different claims, and only the second one makes the number an
assessment rather than a model output. No residency programme, accreditation
body, or psychometrician will accept a competency score without it.

This module supplies the measurement machinery. It does not supply the evidence
— that requires clinicians scoring transcripts (see "What is still missing").

## Layout

| File | Role |
|---|---|
| `src/lib/ai/reliability.ts` | Agreement statistics. Pure functions, no I/O. |
| `src/lib/ai/calibration.ts` | Corpus types, validator, consensus derivation. |
| `src/lib/ai/calibration-load.ts` | Filesystem loader (kept separate from the pure module). |
| `src/lib/ai/reliability-report.ts` | Aggregation across a run + text rendering. |
| `src/lib/ai/reliability.eval.ts` | The harness — the only file that calls a provider. |
| `calibration/` | The corpus itself. See `calibration/README.md`. |

`weightedOverallScore()` in `reliability.ts` is the canonical scoring formula;
`assessment.ts` delegates to it, so a reliability measurement can never drift
from the score the platform actually reports.

## Running it

```bash
npm run test:reliability
```

Excluded from `npm test` — it calls a real provider, takes minutes, and costs
money. It skips cleanly with a logged reason when no API key or no corpus is
present, so it is safe to run anywhere.

| Variable | Effect |
|---|---|
| `OPENAI_API_KEY` / `AI_GATEWAY_API_KEY` | Required; without one the scoring test skips. |
| `VPSYCH_RELIABILITY_RUNS` | Repeats per case (default 3). |
| `VPSYCH_RELIABILITY_INCLUDE_FIXTURES` | `1` to include synthetic fixtures. Never for a real result. |
| `VPSYCH_RELIABILITY_MIN_ICC` | Fail below this expert-agreement ICC. |
| `VPSYCH_RELIABILITY_MAX_SWING` | Fail above this run-to-run 0–100 swing. |

Thresholds are opt-in so the harness can be adopted before the corpus is large
enough to gate CI on. Once a real corpus exists, set both and add the step to
`.github/workflows/ci.yml` after `test`.

## What it measures, in order

**1. Self-consistency.** The same transcript is scored `VPSYCH_RELIABILITY_RUNS`
times and the spread is reported per rubric item and on the 0–100 scale.

This runs first because it bounds everything else. `assessSession()` calls the
model at `temperature: 0.3` — non-zero, so identical input can produce different
scores. A grader that cannot reproduce its own score is not agreeing with an
expert except by luck, and no amount of expert agreement measured on a single
run would be trustworthy. `worstOverallRange` is the number to watch: it is the
largest swing in the score a trainee would have seen for unchanged work.

**2. Inter-rater reliability among the humans.** ICC(2,1) across the expert
raters, pooled over every (case, rubric item) pair.

Report this next to any AI-vs-expert figure. If the experts do not agree with
each other, "the AI disagrees with the expert" is a finding about the rubric,
not about the AI — and the fix is to anchor the rubric, not to retune the
prompt. Per-case ICC over a five-line rubric is too small to trust, which is
why `corpusInterRaterReliability()` pools across the corpus.

**3. Agreement with expert consensus.** ICC(2,1), quadratic-weighted kappa,
mean absolute error, exact agreement, and adjacent (within-one-point)
agreement, comparing the mean of the model's runs against the mean of the
experts'.

Quadratic weighting is the default for kappa because rubric scores are ordinal:
a 4-vs-5 disagreement should not be penalised like a 1-vs-5.

Conventional reading for ICC and kappa: `<0.5` poor, `0.5–0.75` moderate,
`0.75–0.9` good, `>0.9` excellent — `reliabilityBand()` applies these.

## Deliberate design choices

- **Undefined is not zero.** `pearson()` and `intraclassCorrelation()` return
  `null` rather than `0` when a coefficient is not computable (constant vector,
  degenerate design, zero denominator). Reporting `0` would read as "no
  relationship" when the truth is "not measurable from this data".
- **Fixtures are segregated.** `loadCalibrationCases()` returns
  `fixture: true` cases in a separate array so a format demonstration can never
  silently enter a reported figure.
- **Heuristic runs are counted, not hidden.** If a run falls back to
  `persona_fallback`, the report says so in a warning line. A heuristic score is
  not a model result and must not be averaged into one.
- **Two raters minimum, enforced by the validator.** A single rater cannot
  establish reliability, so a one-rater case is a validation error, not a
  warning.

## What is still missing

The machinery is here; the evidence is not. To produce a defensible claim:

1. Collect 30–50 real session transcripts spanning weak, borderline, and strong
   performances, in both `en` and `ar`.
2. Have at least two qualified clinicians score each one **independently and
   blind** to each other and to the AI.
3. Commit them under `calibration/` in the documented format.
4. Run the harness and publish the coefficients.

Until step 4, no reliability claim should appear in any certification document,
sales material, or user-facing copy. The harness reporting a number on a corpus
of one synthetic fixture is not a result — the fixture exists only to exercise
the format.

If the resulting agreement is poor, the likely order of causes is: the rubric is
under-anchored (no behavioural descriptors per score point), then the examiner
prompt, then the model. Rubric anchoring is the cheapest and usually the
largest win.

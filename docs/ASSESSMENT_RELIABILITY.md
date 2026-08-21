# Assessment Reliability Harness

**Status:** shipped (Phase 4 milestone **F1**, closing the harness half of **CI-S05**)
**Code:** `src/lib/assessment-reliability/` · **Fixture:** `calibration/synthetic-corpus.json`
**Run:** `npm run test:reliability` (also covered by `npm test`)

> **This harness does not validate anything.** It measures internal structure and
> reproducibility of scores that already exist. Internal consistency is not validity.
> VPsych competency scores remain **not validated**, and nothing this harness prints may be
> described as validating them.

---

## 1. What it does, and what it refuses to do

| Does | Does not |
|---|---|
| Cronbach's α over the item matrix | Score a session or call any model |
| Corrected item–total correlation, per item | Read `narrative`, `excerpts`, or any free text |
| α-if-item-dropped | Write to the database |
| Item mean / SD / ceiling / floor rates | Recompute the overall score |
| Sample configuration homogeneity | Establish validity, criterion or construct |
| Explicit blocking and limitation reasons | Report a number it cannot justify |

The overall score is **read from the stored report, never recomputed**. `weightedOverall()` in
`lib/ai/assessment.ts` remains the single owner of that formula and must not be forked.

## 2. Four deliberate design decisions

**2.1 Corrected item–total correlation, per item.** Each item is correlated against the sum of the
*other* items, not against a total that contains it. The shared
`itemTotalDiscrimination()` in `lib/scientific/psychometrics.ts` previously correlated per-subject
means against per-subject totals and returned exactly 1 for any input; **that was fixed under
F-FIND-2** and now uses the same corrected rest-score form, returning the mean across items. This
harness keeps its own per-item breakdown because a reliability report needs to name *which* item is
weak, not just the average.

**2.2 `inter_rater_r` is never read.** Inter-rater values are no longer simulated
(**fixed under F-FIND-1** — `eri/from-assessment.ts` now passes through a real rater's value or
null, and a guardrail test asserts the simulator cannot re-enter that path). **Reports written
before that fix still carry the simulated value**, so excluding the field when reading stored
reports is permanent, not transitional. Asserted by test.

**2.3 Missing dimensions are excluded, not zero-filled.** A dimension absent from any subject is
dropped from the whole analysis. Zero-filling silently deflates both that item and α.

**2.4 Heuristic-fallback scores are not the same instrument** (**fixed under F-FIND-3**). When no AI
key is configured, or the examiner call fails, assessment degrades to keyword scoring —
`buildAssessmentProvenance` labels that path *"not a validated OSCE instrument"*. Pooling those rows
with examiner rows measures the mixture, not either one.

The harness previously could not see them. `uniqueDefined()` dropped the fallback row's **null**
`ai_model` before the distinctness check, so `distinct_models` stayed length 1 and
`configuration_homogeneous` reported **true**; and `subjects_missing_provenance` required *both*
model and prompt version to be absent, while a fallback row carries a prompt version. A sample of
examiner scores plus keyword scores was therefore reported as one clean configuration with **no
warning at all**.

Now: `configuration_homogeneous` also requires a single `assessment_mode` and that no subject is
missing provenance; `subjects_missing_provenance` counts incomplete records, not only wholly absent
ones; `distinct_assessment_modes` and `subjects_heuristic_fallback` are reported; and a named
limitation fires. Use `excludeHeuristicFallback()` before quoting any statistic.

## 3. Output contract

`computeReliabilityReport(subjects)` returns a `ReliabilityReport` carrying `cronbach_alpha`,
per-item `ItemStatistics`, sample `provenance` (including `distinct_assessment_modes` and
`subjects_heuristic_fallback`), and two string arrays:

- **`blocking`** — the report is not interpretable (fewer than 2 subjects, or fewer than 2 common
  dimensions). α is `null`, not a number.
- **`limitations`** — non-fatal conditions that bound interpretation. **Always non-empty.**
  Three are unconditional: non-deterministic scoring, absent behavioural anchors, and the excluded
  simulated inter-rater value. A fourth fires whenever the sample contains heuristic-fallback
  subjects (§2.4).

A statistic from this harness should never be quoted without its `limitations`.

## 4. Known constraints on the instrument itself

Established by milestone **F0**:

| ID | Constraint |
|---|---|
| **F0-1** | The examiner model receives only `id — label` per dimension. **No behavioural anchors** define what a 0, 3, or 5 means. |
| **F0-2** | Scoring uses `temperature: 0.3` — **non-deterministic**. Test–retest requires deliberate re-runs; it cannot be inferred from stored data. |
| **F0-3** | Of 480 production reports, **46 (9.6%)** carry complete model + prompt provenance, starting 2026-08-06. The other 434 record none. |

F0-3 is why `filterToConfiguration()` and `withCompleteProvenance()` exist: a defensible estimate
needs a configuration-controlled sub-sample, because mixing model or prompt versions confounds the
instrument with the configuration that produced the scores.

## 5. Running it against real data — not yet authorized

`npm run test:reliability` runs against **synthetic data only**
(`calibration/synthetic-corpus.json`, deterministic seed, 60 subjects, one deliberately noisy
dimension the harness is expected to recover).

Pointing it at the production corpus is **Program F2** and requires **both**:

- **OD-21** — a psychometric authority appointed to design and interpret the analysis;
- **OD-25** — authorization to analyse production learner data, under aggregate-only, PHI-free,
  admin-boundary handling.

Neither exists. The extraction layer is built to respect that boundary regardless: it reads only
numeric structure and provenance, so no narrative or transcript can leave the admin boundary
through this path.

## 6. Interpreting α honestly

α rises with item count and with redundancy between items. With 11 items a high α is unsurprising
and is **not** evidence that the instrument measures therapist competence. It is evidence that the
items move together — which is equally consistent with the model applying one global impression
across all eleven dimensions. Distinguishing those requires a psychometrician, not this harness.

The calibration run reports α ≈ 0.95 on synthetic data built from a single latent ability, which
illustrates the point exactly: that α reflects how the fixture was generated, not instrument
quality.

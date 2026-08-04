# Calibration corpus

Expert-scored session transcripts. This is the evidence base for the claim that
a vpsych report score means something.

## Why this directory exists

`assessSession()` produces a 0–100 score and per-rubric feedback that a training
programme is expected to act on. Nothing measures whether that score is
reproducible, or whether it tracks the judgement of a qualified human. Until it
does, the number is a model output, not an assessment.

A calibration case is a frozen transcript plus the scores two or more qualified
raters gave it **independently and blind to each other**. The harness
(`npm run test:reliability`) runs the AI examiner over the same transcript and
reports:

1. **Self-consistency** — spread across repeated AI runs of the same transcript.
   A grader that cannot reproduce its own score cannot be agreeing with an
   expert except by luck, so this is checked first.
2. **Inter-rater reliability** — how well the humans agree with each other.
   If they don't, "the AI disagrees with the expert" is a finding about the
   rubric, not about the AI.
3. **AI-vs-consensus agreement** — ICC, quadratic-weighted kappa, mean absolute
   error, exact and adjacent agreement.

## File format

One case per file, named `*.case.json`. Files that do not match that suffix are
ignored.

```jsonc
{
  "caseId": "VPSY-CAL-001",
  "language": "en",
  "durationSec": 1680,
  "avatar": {
    "name": "…",
    "disorder": "…",
    "ideal_guidelines": {
      "session_goals": ["…"],
      "ideal_approach": "…"
    },
    "rubric": [
      { "id": "alliance", "label": "Therapeutic alliance", "weight": 25, "max": 5 }
    ]
  },
  "transcript": [
    { "role": "user", "content": "…" },      // therapist
    { "role": "assistant", "content": "…" }  // standardized patient
  ],
  "expertRatings": [
    {
      "raterId": "R1",
      "credential": "consultant psychiatrist",
      "ratedAt": "2026-08-04",
      "items": { "alliance": 4, "assessment": 3, "…": 0 },
      "notes": "optional free text"
    }
  ]
}
```

Rules the validator enforces:

- Every rating must cover **every** rubric item, within that item's `0..max`.
- At least **two** raters per case — one rater cannot establish reliability.
- `raterId` values are pseudonymous codes. Do not put a rater's full name here.
- The transcript must contain at least one therapist (`user`) turn.

## Authoring a real corpus

The statistics are only as good as the study design:

- **Blind the raters.** Each expert scores the transcript without seeing the
  other's scores or the AI's.
- **Use the same rater set across cases.** Corpus-level ICC needs a consistent
  design; `corpusInterRaterReliability` returns `null` if raters vary by case.
- **30–50 cases** is the usual floor for a defensible coefficient. Five will
  produce a number, and that number will not survive review.
- **Span the range.** A corpus of only competent sessions cannot show that the
  grader discriminates. Include weak, borderline, and strong performances.
- **Cover both locales.** `en` and `ar` personalities are independently
  authored, so reliability established on one does not transfer to the other.
- Transcripts must come from consenting trainees or be authored for the purpose.
  These are simulated patients, but the *therapist* side is a real person's
  performance.

## Fixtures

`*.case.json` files with `"fixture": true` exist only to exercise the loader and
the report shape. Their ratings are invented. The loader returns them separately
from real cases and the harness excludes them from every reported figure — see
`example-synthetic.case.json`.

**Do not cite a fixture as a calibration result.**

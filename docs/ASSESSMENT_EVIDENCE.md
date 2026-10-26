# Assessment evidence: anchors, turn-cited quotes, "cannot score"

Assessment schema `1.3.0` (`lib/scientific/versions.ts`). Code:
`lib/ai/assessment.ts`, `lib/ai/rubric-anchors.ts`,
`lib/ai/assessment-evidence.ts`, `lib/ai/report-locale.ts` (examiner prompts).

## What the examiner gets

- **Anchors.** Every rubric item comes with six behavioural anchors (0–5)
  describing what the trainee did, never what the patient has. English and
  Arabic are written separately; ids stay in English. The live rubric
  (`alliance, assessment, interventions, safety, structure`, used by all
  active patients as of 2026-10-26) and the 11-item code default all have
  their own anchors; any other id gets a generic scale.
- **Numbered turns.** The transcript is fenced as
  `<turn n="3" speaker="therapist">…</turn>`. The number and speaker are set
  by the platform; trainee text cannot forge either (`prompt-fence.ts`).

## What the examiner returns per item

```json
{ "id": "safety", "status": "scored", "score": 3, "feedback": "…",
  "evidence": [{ "turn": 7, "quote": "Have you had thoughts of ending your life?" }],
  "reason": null }
```

- `evidence`: one to three word-for-word quotes. `verifyEvidence()` keeps a
  quote only if it is in a therapist or patient turn (case, punctuation,
  Arabic diacritics and hamza forms ignored; ellipses allowed between parts in
  order; whole words only). A real quote cited under the wrong turn is
  re-pointed; an invented or translated one is dropped. Stored as
  `items[].evidence: [{turn, speaker, quote}]`.
- `status: "cannot_score"` with `score: null` and a one-sentence `reason`,
  only when the transcript gives no fair basis (session ended too early, too
  few turns). A missed chance is not "cannot score": it scores low. A null
  score without `cannot_score` still fails the attempt over to the next model.

## Storage and the overall

- Cannot-score items go to `scores.unscored_items` (`{id,label,max,weight,reason}`)
  and are **never** put in `scores.items`, so no consumer (ACE, CGE, ERI, AVI,
  CSV, supervisor views) reads them as a 0.
- `weightedOverall()` leaves them out while the scored items carry at least
  half the rubric weight. Below that they count as zero, so a session too thin
  to judge cannot pass the ladder (> 55) on one or two items. If nothing can be
  scored, the overall is 0.
- Old reports and examiner replies without the new fields score exactly as
  before (`assessment-evidence-regression.test.ts`).
- The heuristic fallback is unchanged: no quotes, no cannot-score.

## Who sees it

Quotes and cannot-score items appear on the admin report and the supervisor
report (`ReportView`), and the admin session page names unscored items. They
are never shown to the trainee: `my_session_feedback()` still returns only
`trainee_feedback`. Scores are not validated; quotes show what a score rests
on, not that it is right.

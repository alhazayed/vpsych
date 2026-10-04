# Session Practice Engine

`src/lib/session-practice/` — Phase 1 of the agreed therapy best-practice plan
("Therapy Best Practices for VPsych", 2026-10-04).

It adds three things, all additive and best-effort:

| Part | File | What it does |
|---|---|---|
| Practice checklist | `checklist.ts`, `patterns.ts` | Finds observable practices in the therapist's turns: intake, consent and confidentiality limits (APA Ethics Code 4.02, 10.01), session structure (Beck: mood check, bridge, agenda, homework review, homework, summary, feedback), Stanley-Brown safety-plan components, and PHQ-9 / GAD-7 use. English and Arabic (Levantine and MSA) cues. |
| Indicative CTS-R | `cts-r.ts` | Maps the default assessment rubric plus the checklist onto the 12 Revised Cognitive Therapy Scale items, 0 to 6 each. |
| In-character self-report | `self-report.ts` | Derives deterministic PHQ-9 / GAD-7 item frequencies from the frozen case (severity, symptom domains, risk) and injects them as the `self_report_block` patient fidelity hint, so the patient answers a questionnaire consistently when the trainee administers one. |

## Rules

- **Not validated.** Every output carries `limitations`. The CTS-R view is not a
  rating by a trained rater and must never be quoted as a CTS-R score.
- **Observes the therapist only**, except the self-report block. That block sits
  before Module 4, which still governs risk disclosure; PHQ-9 item 9 follows the
  case's `risk_profile`, and the patient never volunteers a questionnaire, total,
  or severity label.
- **Applicability:** intake and consent are expected in a first or standalone
  session; bridge and homework review only when `sessionNumber > 1`; safety
  planning only when the case carries suicidal ideation or self-harm; measures
  are reported for reference and never expected.
- **Where it shows:** the admin report page (`/admin/reports/[sessionId]`)
  computes it on read from `session_messages` and `clinical_snapshot`. Nothing
  is persisted and the signed report payload is unchanged.

## Next

Once therapy courses land, pass the course session number into
`evaluateSessionPractice` so bridge and homework review are expected from
session 2, and key per-session PHQ-9 / GAD-7 targets on the course so scores can
move with the quality of therapy (Phase 2).

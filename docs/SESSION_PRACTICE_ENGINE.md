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

## Therapy courses (Phase 2)

`course.ts` hands each course session to the next. At session start
(`POST /api/sessions`) the route loads the previous course session and freezes
two fields onto `clinical_snapshot.therapy_course`:

- `previous_homework`: the therapist's last homework turn in the closing third
  of the previous session. The course prompt block tells the patient what was
  suggested and lets them decide, in character, how much they did. They do
  not bring it up first unless it matters to them.
- `self_report`: unrounded PHQ-9 / GAD-7 item levels. Session 1 is the
  case-derived baseline. Each later session multiplies the previous levels by
  a fixed factor (`COURSE_CHANGE`). Before a treatment plan, a well-structured
  session gives 0.97 and anything else 1. With a plan, structure coverage of
  0.6 or more gives 0.85, 0.3 to 0.6 gives 0.93, 0.15 to 0.3 gives 1, and below
  0.15 gives 1.05. Agreed homework multiplies an improving factor by 0.97.
  Levels never rise more than half a step above baseline, and PHQ-9 item 9
  stays tied to the case risk profile. The self-report prompt block uses these
  levels and tells the patient whether things have eased, stayed the same or
  worsened.

The admin report passes the course session number into the checklist, so
bridge and homework review are expected from session 2. It also lists the
questionnaire targets for every session of the course. This is a simulation
rule, not a validated model of treatment response, and the page says so.

Loading is best-effort: if the previous session cannot be read, the session
starts at baseline with no homework.

## Next

Phase 3: a patient-reported alliance rating, a 5 Ps formulation graded against
the case, in-session crisis escalation, and feedback the trainee can see.

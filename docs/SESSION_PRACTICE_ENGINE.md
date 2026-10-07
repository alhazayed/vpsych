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

## Evidence labels on scores (Phase 3)

`evidence.ts` labels each rubric score on the admin report and the supervisor
results page as limited, some or strong evidence, with the reason:

- A heuristic fallback report is always limited (keyword estimate).
- Fewer than 3 therapist turns is always limited.
- `assessment` (intake, measures), `structure`, `safety` and
  `risk_formulation` (safety plan) are checked against the practice
  checklist. None of the matching practices seen means limited. Seen at least
  2, with 8 or more therapist turns, means strong. Otherwise some.
- Every other item (alliance, diagnostic reasoning, formulation,
  interventions, …) has no transcript check. It is "some" at 8 or more turns,
  else limited, and never strong.

A label describes how much of the transcript backs a score, not whether the
score is right, and the report says so. Computed on read; nothing persisted.

## Patient-felt session rating (Phase 3)

`alliance-rating.ts` reads the Patient Adaptation Engine's per-turn trace
(`case_memory.memory.patient_adaptation.turn_traces`) for the session's time
window and shows, on the admin report, how the session felt to the patient in
four areas modelled on the Session Rating Scale (0 to 10 each):

- felt heard and respected: rapport at the last turn;
- talked about what mattered: mean disclosure readiness across the session;
- approach fit them: trust at the last turn;
- overall: the mean of those three, minus 0.5 per unrepaired rupture.

A rupture is a trust drop of 5 or more points in one turn with a judgmental,
confrontational, curt or interrupting cue (or 10 or more with none). It is
repaired if trust returns to its earlier level later in the session. The
report lists each rupture and whether it was repaired.

It only reads state the existing engine already writes, so it adds no second
clinical brain and changes no patient behaviour. It is simulated, it is not
the SRS, and it is not validated; the panel says so. Sessions with no trace
show "no rating". Computed on read; nothing persisted.

## Crisis handling (Phase 3)

`crisis.ts` finds the first patient turn that discloses suicidal thoughts
(specific phrases in English and Arabic; a denial just before the phrase, such
as "I'd never kill myself", does not count) and then reads the therapist turns
after it for the WHO mhGAP steps for imminent risk:

- asked directly about suicide;
- assessed immediacy (plan, intent, timing, access);
- stayed with the person (at least 3 therapist turns after the disclosure);
- made the means safe;
- involved family or other supports;
- involved crisis or specialist services;
- arranged follow-up.

Means safety, supports and specialist help reuse the safety-plan patterns,
plus a few crisis phrases. The panel shows the disclosure, how many turns the
trainee took to respond, and each step with the turn that showed it. It
appears on the admin report and the supervisor test page when the patient
disclosed or the case carries risk. Phrase matching only, computed on read,
not validated.

## Crisis escalation (Phase 3)

`crisis-escalation.ts` gives the existing Patient Agent one prompt block,
injected in the shared clinical turn (`lib/sessions/clinical-turn.ts`), so
text, voice and streaming behave the same. It applies only when the case's
own risk profile has active suicidal ideation:

- on the patient's 6th reply, the patient lets the therapist know the risk has
  become urgent today: with a plan, "not sure I can keep myself safe
  tonight"; without one, the thoughts are stronger and frightening, still no
  plan. Method detail stays forbidden;
- on later replies (or from the reply after an earlier disclosure), the
  patient reacts to how the therapist handles it, without retracting or
  escalating further.

Cases with no or passive ideation never escalate and their prompts are
byte-identical to before. The Crisis handling panel then shows what the
trainee did.

## Trainee practice checklist (Phase 3)

The session complete page (`/sessions/[id]/complete`) shows the trainee a
"Practice checklist": the practices expected in that session, each marked done
or not seen, grouped as on the admin panel. `buildTraineeChecklist`
(`trainee-checklist.ts`) reduces the `evaluateSessionPractice` result to
`{ group, items: [{ id, done }] }` and drops checks that are not applicable
(measures, follow-up checks in a first session, safety planning without risk).

It carries no score, count, coverage, excerpt or narrative; the performance
report stays admin-only. Skill test sessions never reach it (the complete page
returns early for them), so exam cases stay sealed.

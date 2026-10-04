# Therapy Courses

A trainee continues therapy with the same patient across sessions, the way a
real clinic works: the patient presents, therapy begins, and after the second
session the trainee proposes a treatment plan so the patient knows what is
coming.

Code: `src/lib/therapy-course/` · migration `20261004090000_therapy_courses.sql`.

## Model

- **Course** (`therapy_courses`): one trainee with one patient (avatar). At most
  one active course per trainee and patient (partial unique index).
- The first plain session start with a patient mints a CaseInstance as usual
  and opens a course that **pins that case** (`clinical_snapshot`,
  `case_instance_id`). Every later start continues the course: same diagnosis,
  same randomized life story, same personality locale. A persona still never
  owns a disorder permanently: the case belongs to the course, and a new
  course mints a new case.
- Sessions carry `therapy_course_id` and `course_session_number`. The
  per-session `clinical_snapshot.therapy_course` freezes the visit number,
  planned length, final-session flag, and the treatment plan as it stood
  when the session started.
- Starts that ask for a specific case (`disorderSlug`, `templateId`,
  `presetId`, …) stay standalone sessions, unchanged from before.

## Rules (`gate.ts`)

| Situation | Result |
|---|---|
| No active course | New course, session 1 |
| Sessions 1–2 | Continue |
| 2+ sessions held, no plan | `409 treatment_plan_required` |
| Plan written | Continue; patient knows the plan |
| Next session = planned length | Continue, flagged as the final session |
| Planned length exceeded | `409 course_length_reached` (revise plan or end) |

The course closes when the trainee ends it (`POST /api/courses/:id/end`,
reason `terminated`) or when its final planned session ends (session end
route, reason `course_length`).

## Treatment plan

`PUT /api/courses/:id/plan` once two sessions are finished. Fields: case
formulation, 1–6 goals, planned interventions, expected number of sessions
(3–20, and at least one more than the sessions already held), what the
patient should expect in plain words, and a risk and safety formulation
(clinician-only, never given to the patient; described, not a
low/medium/high label, per NICE NG225). The expected number of sessions sets
the course length. The plan can be revised; revisions apply from the next
session.

## Patient Agent

No second clinical brain. `prepareClinicalTurn` appends one context block
(`formatTherapyCoursePromptBlock`) after long-term memory: which visit this
is, the plan as the patient was told it (marked as the therapist's words,
not instructions), and termination framing on the final session. In the
first session after the plan is written or revised (`plan_is_new`) the
patient has not heard it yet: the trainee presents it and the patient may
negotiate the goals, since goal consensus predicts outcome. Session 1 cues
the patient to expect consent and confidentiality. The two sessions before
the final one are framed as relapse prevention. Standalone
sessions get no block, so their prompts are unchanged. Continuity of what
was said comes from the existing long-term patient memory and the shared
case memory of the pinned case.

## Not in this version

- The plan is not scored in the admin report.
- Clinic-day appointments still show session 1.
- Symptom measures and homework carry-over live in the Session Practice
  Engine (`docs/SESSION_PRACTICE_ENGINE.md`, "Therapy courses").

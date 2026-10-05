# Skill Tests and Practice Scenarios

Trainees see patients in two ways:

| Mode | Where | Who picks the case | Who sees results |
|---|---|---|---|
| Practice | Patient library (`/avatars`): therapy courses with a patient, or a practice scenario by disorder | The trainee | Reports stay admin-only, as before |
| Skill test | `/tests` | A supervisor | The assigning supervisor and the superadmin only |

Code: `src/lib/skill-tests/` · migration `20261005110000_supervisor_skill_tests.sql`
· RLS harness `scripts/test-skill-test-rls.sh`.

## Roles

- **Superadmin**: the existing `profiles.role = 'admin'`. Grants and revokes the
  supervisor role at `/admin/supervisors`.
- **Supervisor**: a row in `public.supervisors` (written by admins only). A
  supervisor keeps the trainee menu and also gets **Supervise** (`/supervise`).
  Revoking the role removes access to the results of their old assignments.

## Supervisor-designed patient (`skill_test_assignments`)

A supervisor sets the trainee, patient persona, language (`en-US` or `ar-JO`),
disorder, up to two comorbidities the Case Engine supports with it, difficulty,
optional severity, required sessions (1–12), optional instructions for the
trainee, and an optional due date. Status runs `assigned → in_progress →
completed`, or `cancelled` by the supervisor.

- The first test session mints a case through the Case Engine from the spec. A
  database trigger pins it (`sealed_case`) on the assignment; every later
  session must carry the same case.
- Visit awareness reuses the therapy course prompt block
  (`clinical_snapshot.therapy_course`, `course_id` = assignment id, no
  treatment plan). No new Patient Agent behaviour.
- The assignment completes when its required sessions have all ended
  (`completed` or `expired`).

## The exam is blind

Practice scenarios name the disorder: the trainee picks what to train on. A
skill test is an exam: the trainee sees the patient's name, portrait, title,
instructions and session count, and has to find out the rest. This holds in the
database, not just the UI (`src/lib/skill-tests/exam.ts`, `seal.ts`):

- Trainees cannot select from `skill_test_assignments`. They read their tests
  through `my_skill_tests()`, which leaves out disorder, comorbidities,
  difficulty and severity.
- The spec (`sealed_spec`, written by the create route) and the pinned case
  (`sealed_case`) reach the trainee only as AES-256-GCM ciphertext. The key is
  derived from `REPORT_WRITE_KEY`, or `SUPABASE_SERVICE_ROLE_KEY` when that is
  unset, so the browser never holds it. Each blob is bound to its assignment and
  kind. Without either secret, creating or starting a test returns 503.
- A test session row stores the case only in `sealed_case`. Its
  `clinical_snapshot` holds just the visit context and locale; `difficulty`,
  `therapy_modality`, `instructor_preset_id` and `case_instance_id` stay null,
  and no `case_instances` row is written. The insert trigger rejects anything
  else.
- The server opens the case for the Patient Agent turn, the emotion engine, the
  assessment, the supervisor's results page and the admin pages
  (`withSkillTestCase`). The trainee's session screen gets a patient with no
  prompts, rubric, clinical core or disorder, plus the voice's pace and energy
  (`traineeSafeAvatar`, `examSpeechHint`). The start response and the trainee
  coaching endpoint return nothing about the case.
- Trade-offs: the nonverbal engine in the browser uses its generic baseline in
  a test (the patient's emotions still drive it turn by turn), and test sessions
  have no `case_memory` (adaptation carries over through the existing dyad
  carry, and long-term patient memory is unchanged).
- Rotating or removing the secret a test was sealed with makes its open
  sessions unreadable; finish open tests first.

## Database rules (enforced by RLS and triggers, not the UI)

- Assignments: readable by the assigning supervisor (while still a supervisor)
  and admins; the trainee uses `my_skill_tests()`. Insert by supervisors/admins in their own name. No
  update or delete policy; lifecycle changes go through triggers and
  `cancel_skill_test()`.
- Sessions, reports, the trainee's profile name: readable by the assigning
  supervisor through added SELECT policies.
- Transcripts (`session_messages`): the trainee can read a test transcript while
  the session runs and until its report exists (the end route needs it to
  assess the session); after that only the assigning supervisor and admins.
  Practice transcripts are unchanged.
- A test session must belong to the trainee's open assignment, use its patient,
  keep the case sealed (then carry the pinned case), respect the session count, and wait for an open session to finish. The link cannot be added,
  moved or removed later by a non-admin.
- Skill test sessions skip the Education/ACE and Supervisor AI hooks, so their
  results never reach trainee-facing learning, and the end response carries no
  scores.

## Not in this version

- Long-term patient memory is keyed by trainee and persona, so practice and test
  sessions with the same persona share it.
- No treatment plan gate inside a test; the supervisor sets the session count.
- Scores are not validated.

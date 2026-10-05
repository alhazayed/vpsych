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

- The first test session mints a CaseInstance through the Case Engine from the
  spec. A database trigger pins it (`clinical_snapshot`, `case_instance_id`) on
  the assignment; every later session must reuse it.
- Visit awareness reuses the therapy course prompt block
  (`clinical_snapshot.therapy_course`, `course_id` = assignment id, no
  treatment plan). No new Patient Agent behaviour.
- The assignment completes when its required sessions have all ended
  (`completed` or `expired`).

Trainees see the patient, the diagnosis, comorbidities, difficulty and
severity on the Skill tests page (decided by Alhazayed, 2026-10-05).

## Database rules (enforced by RLS and triggers, not the UI)

- Assignments: readable by the trainee, the assigning supervisor (while still a
  supervisor) and admins. Insert by supervisors/admins in their own name. No
  update or delete policy; lifecycle changes go through triggers and
  `cancel_skill_test()`.
- Sessions, reports, the trainee's profile name: readable by the assigning
  supervisor through added SELECT policies.
- Transcripts (`session_messages`): the trainee can read a test transcript while
  the session runs and until its report exists (the end route needs it to
  assess the session); after that only the assigning supervisor and admins.
  Practice transcripts are unchanged.
- A test session must belong to the trainee's open assignment, use its patient,
  match its disorder and difficulty (then its pinned case), respect the session
  count, and wait for an open session to finish. The link cannot be added,
  moved or removed later by a non-admin.
- Skill test sessions skip the Education/ACE and Supervisor AI hooks, so their
  results never reach trainee-facing learning, and the end response carries no
  scores.

## Not in this version

- Long-term patient memory is keyed by trainee and persona, so practice and test
  sessions with the same persona share it.
- No treatment plan gate inside a test; the supervisor sets the session count.
- Scores are not validated.

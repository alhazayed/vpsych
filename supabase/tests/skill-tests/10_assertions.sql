-- RLS and trigger assertions for 20261005110000_supervisor_skill_tests.sql.
-- Run by scripts/test-skill-test-rls.sh after 00_stub_schema.sql and the
-- migration. Any failed expectation raises and stops the run (ON_ERROR_STOP).

\set ON_ERROR_STOP on

-- Fixtures (as postgres) ------------------------------------------------------
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'admin@example.org'),
  ('00000000-0000-0000-0000-0000000000b1', 'sup@example.org'),
  ('00000000-0000-0000-0000-0000000000b2', 'sup2@example.org'),
  ('00000000-0000-0000-0000-0000000000c1', 'trainee@example.org'),
  ('00000000-0000-0000-0000-0000000000c2', 'trainee2@example.org');
INSERT INTO public.profiles (id, display_name, role) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'Admin', 'admin'),
  ('00000000-0000-0000-0000-0000000000b1', 'Supervisor One', 'therapist'),
  ('00000000-0000-0000-0000-0000000000b2', 'Supervisor Two', 'therapist'),
  ('00000000-0000-0000-0000-0000000000c1', 'Trainee One', 'therapist'),
  ('00000000-0000-0000-0000-0000000000c2', 'Trainee Two', 'therapist');
INSERT INTO public.avatars (id, name) VALUES
  ('00000000-0000-0000-0000-00000000aa01', 'Maya'),
  ('00000000-0000-0000-0000-00000000aa02', 'Jordan');
INSERT INTO public.case_instances (id, created_by) VALUES
  ('00000000-0000-0000-0000-00000000cc01', '00000000-0000-0000-0000-0000000000c1');

CREATE FUNCTION pg_temp.act_as(p uuid) RETURNS void LANGUAGE sql AS $$
  select set_config('request.jwt.claim.sub', p::text, false);
$$;

-- 1. Only the superadmin grants the supervisor role ---------------------------
SET ROLE authenticated;
SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
DO $$ BEGIN
  INSERT INTO public.supervisors (user_id) VALUES ('00000000-0000-0000-0000-0000000000b1');
  RAISE EXCEPTION 'FAIL: non-admin granted themselves supervisor';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;

SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
INSERT INTO public.supervisors (user_id, granted_by) VALUES
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1');

-- 2. Only supervisors design tests, only for themselves ------------------------
SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
DO $$ BEGIN
  INSERT INTO public.skill_test_assignments (supervisor_id, trainee_id, avatar_id, title, language,
    disorder_slug, difficulty, required_sessions)
  VALUES ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2',
    '00000000-0000-0000-0000-00000000aa01', 'x', 'en-US', 'ptsd', 'beginner', 1);
  RAISE EXCEPTION 'FAIL: trainee created a skill test';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;

SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
DO $$ BEGIN
  INSERT INTO public.skill_test_assignments (supervisor_id, trainee_id, avatar_id, title, language,
    disorder_slug, difficulty, required_sessions)
  VALUES ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000c1',
    '00000000-0000-0000-0000-00000000aa01', 'x', 'en-US', 'ptsd', 'beginner', 1);
  RAISE EXCEPTION 'FAIL: supervisor created a test in another supervisor''s name';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;

INSERT INTO public.skill_test_assignments (id, supervisor_id, trainee_id, avatar_id, title, language,
  disorder_slug, comorbidity_slugs, difficulty, severity, required_sessions)
VALUES ('00000000-0000-0000-0000-00000000dd01', '00000000-0000-0000-0000-0000000000b1',
  '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000aa01',
  'PTSD intake', 'en-US', 'ptsd', '{alcohol-use-disorder}', 'advanced', 'moderate', 2);

DO $$ BEGIN
  UPDATE public.skill_test_assignments SET required_sessions = 12
  WHERE id = '00000000-0000-0000-0000-00000000dd01';
  RAISE EXCEPTION 'FAIL: direct update of an assignment was allowed';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;

-- 3. Visibility of the assignment ---------------------------------------------
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM public.skill_test_assignments;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: assigning supervisor sees % assignments', n; END IF;
END $$;
SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM public.skill_test_assignments;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: other supervisor sees the assignment'; END IF;
END $$;
SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000c2');
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM public.skill_test_assignments;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: other trainee sees the assignment'; END IF;
END $$;
SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM public.skill_test_assignments;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: trainee cannot see their own assignment'; END IF;
END $$;

-- 4. Session rules ------------------------------------------------------------
DO $$ BEGIN
  INSERT INTO public.sessions (therapist_id, avatar_id, clinical_snapshot, difficulty, skill_test_assignment_id)
  VALUES ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000aa01',
    '{"assessment_id":"A1","primary_diagnosis":{"slug":"mdd-recurrent-moderate"}}', 'advanced',
    '00000000-0000-0000-0000-00000000dd01');
  RAISE EXCEPTION 'FAIL: wrong disorder accepted for a test session';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;

DO $$ BEGIN
  INSERT INTO public.sessions (therapist_id, avatar_id, clinical_snapshot, difficulty, skill_test_assignment_id)
  VALUES ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000aa02',
    '{"assessment_id":"A1","primary_diagnosis":{"slug":"ptsd"}}', 'advanced',
    '00000000-0000-0000-0000-00000000dd01');
  RAISE EXCEPTION 'FAIL: wrong patient accepted for a test session';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;

SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000c2');
DO $$ BEGIN
  INSERT INTO public.sessions (therapist_id, avatar_id, clinical_snapshot, difficulty, skill_test_assignment_id)
  VALUES ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000aa01',
    '{"assessment_id":"A1","primary_diagnosis":{"slug":"ptsd"}}', 'advanced',
    '00000000-0000-0000-0000-00000000dd01');
  RAISE EXCEPTION 'FAIL: another trainee attached a session to the test';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;

SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
INSERT INTO public.sessions (id, therapist_id, avatar_id, clinical_snapshot, difficulty, case_instance_id,
  skill_test_assignment_id, test_session_number)
VALUES ('00000000-0000-0000-0000-0000000e0001', '00000000-0000-0000-0000-0000000000c1',
  '00000000-0000-0000-0000-00000000aa01',
  '{"assessment_id":"A1","primary_diagnosis":{"slug":"ptsd"},"therapy_course":{"session_number":1}}',
  'advanced', '00000000-0000-0000-0000-00000000cc01', '00000000-0000-0000-0000-00000000dd01', 7);

DO $$ DECLARE r record; BEGIN
  SELECT test_session_number INTO r FROM public.sessions WHERE id = '00000000-0000-0000-0000-0000000e0001';
  IF r.test_session_number <> 1 THEN RAISE EXCEPTION 'FAIL: session number not set by trigger'; END IF;
  SELECT status, clinical_snapshot, case_instance_id INTO r FROM public.skill_test_assignments
  WHERE id = '00000000-0000-0000-0000-00000000dd01';
  IF r.status <> 'in_progress' OR r.clinical_snapshot ->> 'assessment_id' <> 'A1'
     OR r.clinical_snapshot ? 'therapy_course'
     OR r.case_instance_id IS DISTINCT FROM '00000000-0000-0000-0000-00000000cc01' THEN
    RAISE EXCEPTION 'FAIL: case not pinned on first session: %', row_to_json(r);
  END IF;
END $$;

DO $$ BEGIN
  INSERT INTO public.sessions (therapist_id, avatar_id, clinical_snapshot, difficulty, skill_test_assignment_id)
  VALUES ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000aa01',
    '{"assessment_id":"A1","primary_diagnosis":{"slug":"ptsd"}}', 'advanced',
    '00000000-0000-0000-0000-00000000dd01');
  RAISE EXCEPTION 'FAIL: second test session started while one is active';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;

DO $$ BEGIN
  UPDATE public.sessions SET skill_test_assignment_id = NULL
  WHERE id = '00000000-0000-0000-0000-0000000e0001';
  RAISE EXCEPTION 'FAIL: trainee detached a test session';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;

-- Practice session of the same trainee (regression baseline).
INSERT INTO public.sessions (id, therapist_id, avatar_id, clinical_snapshot, difficulty)
VALUES ('00000000-0000-0000-0000-0000000e0009', '00000000-0000-0000-0000-0000000000c1',
  '00000000-0000-0000-0000-00000000aa01', '{"assessment_id":"P1"}', 'beginner');
DO $$ BEGIN
  UPDATE public.sessions SET skill_test_assignment_id = '00000000-0000-0000-0000-00000000dd01'
  WHERE id = '00000000-0000-0000-0000-0000000e0009';
  RAISE EXCEPTION 'FAIL: trainee attached a practice session to a test';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;

INSERT INTO public.session_messages (session_id, role, content) VALUES
  ('00000000-0000-0000-0000-0000000e0001', 'user', 'test hello'),
  ('00000000-0000-0000-0000-0000000e0009', 'user', 'practice hello');

-- End the first test session (trainee) and write both reports (server).
UPDATE public.sessions SET status = 'completed', ended_at = now()
WHERE id IN ('00000000-0000-0000-0000-0000000e0001', '00000000-0000-0000-0000-0000000e0009');

DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM public.session_messages WHERE session_id = '00000000-0000-0000-0000-0000000e0001';
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: trainee cannot read the transcript before the report (assessment needs it)'; END IF;
END $$;

RESET ROLE;
INSERT INTO public.session_reports (session_id) VALUES
  ('00000000-0000-0000-0000-0000000e0001'), ('00000000-0000-0000-0000-0000000e0009');
SET ROLE authenticated;

-- 5. Results visibility ---------------------------------------------------------
SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM public.session_messages WHERE session_id = '00000000-0000-0000-0000-0000000e0001';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: trainee still reads the test transcript after the report'; END IF;
  SELECT count(*) INTO n FROM public.session_messages WHERE session_id = '00000000-0000-0000-0000-0000000e0009';
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: trainee lost their practice transcript'; END IF;
  SELECT count(*) INTO n FROM public.session_reports;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: trainee reads reports'; END IF;
END $$;

SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM public.sessions;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: supervisor sees % sessions (expected the 1 test session)', n; END IF;
  SELECT count(*) INTO n FROM public.session_messages;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: supervisor sees % messages (expected test transcript only)', n; END IF;
  SELECT count(*) INTO n FROM public.session_reports;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: supervisor sees % reports (expected test report only)', n; END IF;
  SELECT count(*) INTO n FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000c1';
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: supervisor cannot see the trainee name'; END IF;
  SELECT count(*) INTO n FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000c2';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: supervisor sees an unassigned trainee profile'; END IF;
END $$;

SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM public.sessions;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: other supervisor sees sessions'; END IF;
  SELECT count(*) INTO n FROM public.session_messages;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: other supervisor sees transcripts'; END IF;
  SELECT count(*) INTO n FROM public.session_reports;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: other supervisor sees reports'; END IF;
  SELECT count(*) INTO n FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000c1';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: other supervisor sees the trainee'; END IF;
END $$;
DO $$ BEGIN
  PERFORM public.cancel_skill_test('00000000-0000-0000-0000-00000000dd01');
  RAISE EXCEPTION 'FAIL: other supervisor cancelled the test';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;

SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000c2');
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM public.session_messages;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: other trainee sees transcripts'; END IF;
END $$;
DO $$ BEGIN
  PERFORM public.list_skill_test_trainees();
  RAISE EXCEPTION 'FAIL: trainee listed trainees';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;

SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM public.session_messages;
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL: superadmin sees % messages', n; END IF;
  SELECT count(*) INTO n FROM public.session_reports;
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL: superadmin sees % reports', n; END IF;
END $$;

-- 6. Second session reuses the pinned case and completes the test -------------
SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
DO $$ BEGIN
  INSERT INTO public.sessions (therapist_id, avatar_id, clinical_snapshot, difficulty, skill_test_assignment_id)
  VALUES ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000aa01',
    '{"assessment_id":"OTHER","primary_diagnosis":{"slug":"ptsd"}}', 'advanced',
    '00000000-0000-0000-0000-00000000dd01');
  RAISE EXCEPTION 'FAIL: a different case was accepted after pinning';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;

INSERT INTO public.sessions (id, therapist_id, avatar_id, clinical_snapshot, difficulty, skill_test_assignment_id)
VALUES ('00000000-0000-0000-0000-0000000e0002', '00000000-0000-0000-0000-0000000000c1',
  '00000000-0000-0000-0000-00000000aa01',
  '{"assessment_id":"A1","primary_diagnosis":{"slug":"ptsd"},"therapy_course":{"session_number":2}}',
  'advanced', '00000000-0000-0000-0000-00000000dd01');
UPDATE public.sessions SET status = 'completed', ended_at = now()
WHERE id = '00000000-0000-0000-0000-0000000e0002';

DO $$ DECLARE r record; BEGIN
  SELECT status, completed_at INTO r FROM public.skill_test_assignments
  WHERE id = '00000000-0000-0000-0000-00000000dd01';
  IF r.status <> 'completed' OR r.completed_at IS NULL THEN
    RAISE EXCEPTION 'FAIL: test not completed after required sessions: %', row_to_json(r);
  END IF;
END $$;
DO $$ BEGIN
  INSERT INTO public.sessions (therapist_id, avatar_id, clinical_snapshot, difficulty, skill_test_assignment_id)
  VALUES ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000aa01',
    '{"assessment_id":"A1","primary_diagnosis":{"slug":"ptsd"}}', 'advanced',
    '00000000-0000-0000-0000-00000000dd01');
  RAISE EXCEPTION 'FAIL: session accepted on a completed test';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;

-- 7. Revoking the supervisor role removes access to results ------------------
SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
DELETE FROM public.supervisors WHERE user_id = '00000000-0000-0000-0000-0000000000b1';
SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM public.session_messages;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: revoked supervisor still reads transcripts'; END IF;
  SELECT count(*) INTO n FROM public.skill_test_assignments;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: revoked supervisor still sees assignments'; END IF;
END $$;

RESET ROLE;
SELECT 'skill test RLS: all assertions passed' AS result;

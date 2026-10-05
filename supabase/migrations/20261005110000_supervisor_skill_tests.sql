-- Supervisor-assigned skill tests.
--
-- A supervisor designs a test patient (persona, language, disorder,
-- comorbidities, difficulty, severity, number of required sessions) and assigns
-- it to one trainee. The first test session pins the case; every later session
-- reuses it. Results (sessions, transcripts, reports, the trainee's name) are
-- readable only by the superadmin (profiles.role = 'admin') and the supervisor
-- who made the assignment. Once a test session has a report, the trainee can no
-- longer read its transcript.
--
-- A skill test runs like a real exam: the trainee must work the case out. The
-- trainee reads their assignments only through my_skill_tests(), which leaves
-- out the disorder, comorbidities, difficulty and severity. The spec and the
-- pinned case reach the trainee's rows only as server-sealed ciphertext
-- (sealed_spec, sealed_case; AES-256-GCM with a key the browser never holds,
-- see src/lib/skill-tests/seal.ts). A test session's clinical_snapshot holds
-- just the visit context and locale, and no case_instances row is written.
--
-- Additive only: two new tables, three nullable columns on sessions, helper
-- functions, triggers, and RLS policies. The one replaced policy
-- ("Participants can view session messages") keeps its previous behaviour for
-- every non-test session.
--
-- Rollback:
--   DROP POLICY IF EXISTS "Participants can view session messages" ON public.session_messages;
--   CREATE POLICY "Participants can view session messages" ON public.session_messages
--     FOR SELECT TO authenticated USING ((select public.is_admin()) OR EXISTS (
--       SELECT 1 FROM public.sessions s WHERE s.id = session_messages.session_id
--         AND s.therapist_id = (select auth.uid())));
--   DROP POLICY IF EXISTS "Skill test supervisors can view test sessions" ON public.sessions;
--   DROP POLICY IF EXISTS "Skill test supervisors can view test reports" ON public.session_reports;
--   DROP POLICY IF EXISTS "Skill test supervisors can view their trainees" ON public.profiles;
--   DROP TRIGGER IF EXISTS sessions_skill_test_before_insert ON public.sessions;
--   DROP TRIGGER IF EXISTS sessions_skill_test_after_insert ON public.sessions;
--   DROP TRIGGER IF EXISTS sessions_skill_test_before_update ON public.sessions;
--   DROP TRIGGER IF EXISTS sessions_skill_test_after_update ON public.sessions;
--   ALTER TABLE public.sessions DROP COLUMN IF EXISTS sealed_case;
--   ALTER TABLE public.sessions DROP COLUMN IF EXISTS test_session_number;
--   ALTER TABLE public.sessions DROP COLUMN IF EXISTS skill_test_assignment_id;
--   DROP FUNCTION IF EXISTS public.my_skill_tests(uuid);
--   DROP FUNCTION IF EXISTS public.cancel_skill_test(uuid);
--   DROP FUNCTION IF EXISTS public.list_skill_test_trainees();
--   DROP FUNCTION IF EXISTS public.session_messages_readable(uuid);
--   DROP FUNCTION IF EXISTS public.supervises_trainee(uuid);
--   DROP FUNCTION IF EXISTS public.supervises_session(uuid);
--   DROP FUNCTION IF EXISTS public.supervises_skill_test(uuid);
--   DROP FUNCTION IF EXISTS public.skill_test_sessions_before_insert();
--   DROP FUNCTION IF EXISTS public.skill_test_sessions_after_insert();
--   DROP FUNCTION IF EXISTS public.skill_test_sessions_before_update();
--   DROP FUNCTION IF EXISTS public.skill_test_sessions_after_update();
--   DROP TABLE IF EXISTS public.skill_test_assignments;
--   DROP FUNCTION IF EXISTS public.is_supervisor();
--   DROP TABLE IF EXISTS public.supervisors;

-- ---------------------------------------------------------------------------
-- Supervisors: granted and revoked by the superadmin only.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supervisors (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  granted_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.supervisors IS
  'Users who may design and assign skill tests. Written by admins only.';

CREATE OR REPLACE FUNCTION public.is_supervisor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1 from public.supervisors where user_id = auth.uid()
  );
$$;

ALTER TABLE public.supervisors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Supervisors self or admin select" ON public.supervisors;
CREATE POLICY "Supervisors self or admin select" ON public.supervisors
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR (select public.is_admin()));

DROP POLICY IF EXISTS "Supervisors admin insert" ON public.supervisors;
CREATE POLICY "Supervisors admin insert" ON public.supervisors
  FOR INSERT TO authenticated
  WITH CHECK ((select public.is_admin()));

DROP POLICY IF EXISTS "Supervisors admin delete" ON public.supervisors;
CREATE POLICY "Supervisors admin delete" ON public.supervisors
  FOR DELETE TO authenticated
  USING ((select public.is_admin()));

REVOKE ALL ON public.supervisors FROM anon;
GRANT SELECT, INSERT, DELETE ON public.supervisors TO authenticated;

-- ---------------------------------------------------------------------------
-- Skill test assignments: one supervisor-designed patient for one trainee.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.skill_test_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  trainee_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  avatar_id uuid NOT NULL REFERENCES public.avatars (id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  language text NOT NULL CHECK (language IN ('en-US', 'ar-JO')),
  disorder_slug text NOT NULL CHECK (char_length(disorder_slug) BETWEEN 1 AND 80),
  comorbidity_slugs text[] NOT NULL DEFAULT '{}'
    CHECK (cardinality(comorbidity_slugs) <= 2),
  difficulty text NOT NULL
    CHECK (difficulty IN ('beginner', 'intermediate', 'advanced', 'expert')),
  severity text
    CHECK (severity IS NULL OR severity IN ('subclinical', 'mild', 'moderate', 'severe')),
  required_sessions integer NOT NULL CHECK (required_sessions BETWEEN 1 AND 12),
  trainee_instructions text CHECK (trainee_instructions IS NULL OR char_length(trainee_instructions) <= 1000),
  due_at timestamptz,
  status text NOT NULL DEFAULT 'assigned'
    CHECK (status IN ('assigned', 'in_progress', 'completed', 'cancelled')),
  -- The spec above, sealed by the server for the trainee's start path.
  sealed_spec text NOT NULL CHECK (char_length(sealed_spec) BETWEEN 1 AND 8000),
  -- Case pinned (sealed) by the first test session, so diagnosis and life
  -- story stay fixed across sessions.
  sealed_case text,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (supervisor_id <> trainee_id)
);

CREATE INDEX IF NOT EXISTS skill_test_assignments_trainee_idx
  ON public.skill_test_assignments (trainee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS skill_test_assignments_supervisor_idx
  ON public.skill_test_assignments (supervisor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS skill_test_assignments_avatar_idx
  ON public.skill_test_assignments (avatar_id);

COMMENT ON TABLE public.skill_test_assignments IS
  'Supervisor-designed test patient assigned to one trainee. Results visible to the assigning supervisor and admins only.';

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS skill_test_assignment_id uuid
    REFERENCES public.skill_test_assignments (id) ON DELETE RESTRICT;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS test_session_number integer
    CHECK (test_session_number IS NULL OR test_session_number >= 1);

-- Skill test sessions only: the full case, sealed. clinical_snapshot then
-- holds just the visit context, so the trainee cannot read the diagnosis.
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS sealed_case text;

CREATE INDEX IF NOT EXISTS sessions_skill_test_assignment_idx
  ON public.sessions (skill_test_assignment_id)
  WHERE skill_test_assignment_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER so policies do not recurse through RLS).
-- A revoked supervisor loses access to the results of their old assignments.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.supervises_skill_test(p_assignment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select public.is_supervisor() and exists (
    select 1 from public.skill_test_assignments a
    where a.id = p_assignment_id and a.supervisor_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.supervises_session(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select public.is_supervisor() and exists (
    select 1
    from public.sessions s
    join public.skill_test_assignments a on a.id = s.skill_test_assignment_id
    where s.id = p_session_id and a.supervisor_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.supervises_trainee(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select public.is_supervisor() and exists (
    select 1 from public.skill_test_assignments a
    where a.trainee_id = p_user_id and a.supervisor_id = auth.uid()
  );
$$;

-- Transcript read rule for non-admins. Practice sessions: the owner, as
-- before. Test sessions: the owner while the session runs and until its report
-- exists (the end route reads the transcript to assess it), then only the
-- assigning supervisor.
CREATE OR REPLACE FUNCTION public.session_messages_readable(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1 from public.sessions s
    where s.id = p_session_id
      and s.therapist_id = auth.uid()
      and (
        s.skill_test_assignment_id is null
        or s.status = 'active'
        or not exists (
          select 1 from public.session_reports r where r.session_id = s.id
        )
      )
  ) or public.supervises_session(p_session_id);
$$;

REVOKE ALL ON FUNCTION public.is_supervisor() FROM public, anon;
REVOKE ALL ON FUNCTION public.supervises_skill_test(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.supervises_session(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.supervises_trainee(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.session_messages_readable(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_supervisor() TO authenticated;
GRANT EXECUTE ON FUNCTION public.supervises_skill_test(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.supervises_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.supervises_trainee(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.session_messages_readable(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS: skill_test_assignments
-- ---------------------------------------------------------------------------
ALTER TABLE public.skill_test_assignments ENABLE ROW LEVEL SECURITY;

-- Trainees do not select from this table: the row names the case they are
-- examined on. They use my_skill_tests() instead.
DROP POLICY IF EXISTS "Skill tests supervisor or admin select" ON public.skill_test_assignments;
CREATE POLICY "Skill tests supervisor or admin select" ON public.skill_test_assignments
  FOR SELECT TO authenticated
  USING (
    (supervisor_id = (select auth.uid()) AND (select public.is_supervisor()))
    OR (select public.is_admin())
  );

DROP POLICY IF EXISTS "Skill tests supervisor or admin insert" ON public.skill_test_assignments;
CREATE POLICY "Skill tests supervisor or admin insert" ON public.skill_test_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    supervisor_id = (select auth.uid())
    AND ((select public.is_supervisor()) OR (select public.is_admin()))
    AND status = 'assigned'
    AND sealed_case IS NULL
    AND started_at IS NULL
    AND completed_at IS NULL
    AND cancelled_at IS NULL
  );

-- No UPDATE or DELETE policies: lifecycle changes go through the triggers and
-- cancel_skill_test(). Results persist like session history.
REVOKE ALL ON public.skill_test_assignments FROM anon;
GRANT SELECT, INSERT ON public.skill_test_assignments TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS: results readable by the assigning supervisor
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Skill test supervisors can view test sessions" ON public.sessions;
CREATE POLICY "Skill test supervisors can view test sessions" ON public.sessions
  FOR SELECT TO authenticated
  USING (
    skill_test_assignment_id IS NOT NULL
    AND public.supervises_skill_test(skill_test_assignment_id)
  );

DROP POLICY IF EXISTS "Skill test supervisors can view test reports" ON public.session_reports;
CREATE POLICY "Skill test supervisors can view test reports" ON public.session_reports
  FOR SELECT TO authenticated
  USING (public.supervises_session(session_id));

DROP POLICY IF EXISTS "Skill test supervisors can view their trainees" ON public.profiles;
CREATE POLICY "Skill test supervisors can view their trainees" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.supervises_trainee(id));

DROP POLICY IF EXISTS "Participants can view session messages" ON public.session_messages;
CREATE POLICY "Participants can view session messages" ON public.session_messages
  FOR SELECT TO authenticated
  USING (
    (select public.is_admin())
    OR public.session_messages_readable(session_id)
  );

-- ---------------------------------------------------------------------------
-- Session triggers: a test session must belong to the trainee's open
-- assignment, respect the session count, and use the assigned (then pinned)
-- case. The link cannot be added, moved, or removed afterwards.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.skill_test_sessions_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a public.skill_test_assignments%ROWTYPE;
  v_held integer;
BEGIN
  IF NEW.skill_test_assignment_id IS NULL THEN
    NEW.test_session_number := NULL;
    RETURN NEW;
  END IF;

  SELECT * INTO a FROM public.skill_test_assignments
  WHERE id = NEW.skill_test_assignment_id
  FOR UPDATE;

  IF NOT FOUND OR a.trainee_id IS DISTINCT FROM NEW.therapist_id THEN
    RAISE EXCEPTION 'skill_test_not_assigned' USING ERRCODE = '42501';
  END IF;
  IF a.status NOT IN ('assigned', 'in_progress') THEN
    RAISE EXCEPTION 'skill_test_closed' USING ERRCODE = '42501';
  END IF;
  IF a.avatar_id IS DISTINCT FROM NEW.avatar_id THEN
    RAISE EXCEPTION 'skill_test_wrong_patient' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.skill_test_assignment_id = a.id
      AND s.status = 'active'
      AND s.started_at + make_interval(secs => s.max_duration_sec) > now()
  ) THEN
    RAISE EXCEPTION 'skill_test_session_active' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_held FROM public.sessions s
  WHERE s.skill_test_assignment_id = a.id;
  IF v_held >= a.required_sessions THEN
    RAISE EXCEPTION 'skill_test_sessions_used' USING ERRCODE = '42501';
  END IF;

  -- Nothing about the case in the clear: the row carries only the visit
  -- context and locale, plus the sealed case. Later sessions must carry the
  -- case the first one pinned. The seal binds a case to this assignment, so
  -- the server refuses any other blob.
  IF NEW.sealed_case IS NULL
     OR NEW.case_instance_id IS NOT NULL
     OR NEW.difficulty IS NOT NULL
     OR NEW.therapy_modality IS NOT NULL
     OR NEW.instructor_preset_id IS NOT NULL
     OR (NEW.clinical_snapshot IS NOT NULL
         AND (jsonb_typeof(NEW.clinical_snapshot) <> 'object'
              OR (NEW.clinical_snapshot - 'therapy_course' - 'locale') <> '{}'::jsonb)) THEN
    RAISE EXCEPTION 'skill_test_case_mismatch' USING ERRCODE = '42501';
  END IF;
  IF a.sealed_case IS NOT NULL AND NEW.sealed_case IS DISTINCT FROM a.sealed_case THEN
    RAISE EXCEPTION 'skill_test_case_mismatch' USING ERRCODE = '42501';
  END IF;

  NEW.test_session_number := v_held + 1;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.skill_test_sessions_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.skill_test_assignment_id IS NULL THEN
    RETURN NEW;
  END IF;
  UPDATE public.skill_test_assignments
  SET
    sealed_case = coalesce(sealed_case, NEW.sealed_case),
    status = CASE WHEN status = 'assigned' THEN 'in_progress' ELSE status END,
    started_at = coalesce(started_at, now()),
    updated_at = now()
  WHERE id = NEW.skill_test_assignment_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.skill_test_sessions_before_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.skill_test_assignment_id IS DISTINCT FROM OLD.skill_test_assignment_id
      OR NEW.test_session_number IS DISTINCT FROM OLD.test_session_number
      OR NEW.sealed_case IS DISTINCT FROM OLD.sealed_case
      OR (OLD.skill_test_assignment_id IS NOT NULL
          AND NEW.case_instance_id IS DISTINCT FROM OLD.case_instance_id))
     AND auth.uid() IS NOT NULL
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Cannot change skill test link' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- Close the assignment once its required sessions have all finished.
CREATE OR REPLACE FUNCTION public.skill_test_sessions_after_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_required integer;
  v_finished integer;
BEGIN
  IF NEW.skill_test_assignment_id IS NULL
     OR OLD.status IS NOT DISTINCT FROM NEW.status
     OR NEW.status = 'active' THEN
    RETURN NEW;
  END IF;
  SELECT required_sessions INTO v_required
  FROM public.skill_test_assignments WHERE id = NEW.skill_test_assignment_id;
  SELECT count(*) INTO v_finished FROM public.sessions
  WHERE skill_test_assignment_id = NEW.skill_test_assignment_id
    AND status IN ('completed', 'expired');
  IF v_finished >= v_required THEN
    UPDATE public.skill_test_assignments
    SET status = 'completed', completed_at = now(), updated_at = now()
    WHERE id = NEW.skill_test_assignment_id AND status = 'in_progress';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.skill_test_sessions_before_insert() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.skill_test_sessions_after_insert() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.skill_test_sessions_before_update() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.skill_test_sessions_after_update() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS sessions_skill_test_before_insert ON public.sessions;
CREATE TRIGGER sessions_skill_test_before_insert
  BEFORE INSERT ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.skill_test_sessions_before_insert();

DROP TRIGGER IF EXISTS sessions_skill_test_after_insert ON public.sessions;
CREATE TRIGGER sessions_skill_test_after_insert
  AFTER INSERT ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.skill_test_sessions_after_insert();

DROP TRIGGER IF EXISTS sessions_skill_test_before_update ON public.sessions;
CREATE TRIGGER sessions_skill_test_before_update
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.skill_test_sessions_before_update();

DROP TRIGGER IF EXISTS sessions_skill_test_after_update ON public.sessions;
CREATE TRIGGER sessions_skill_test_after_update
  AFTER UPDATE OF status ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.skill_test_sessions_after_update();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Trainees a supervisor (or admin) can assign a test to.
CREATE OR REPLACE FUNCTION public.list_skill_test_trainees()
RETURNS TABLE (id uuid, display_name text, email text, is_supervisor boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_supervisor() OR public.is_admin()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT p.id, p.display_name::text, u.email::text,
           EXISTS (SELECT 1 FROM public.supervisors s WHERE s.user_id = p.id)
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.role = 'therapist' AND p.id <> auth.uid()
    ORDER BY p.display_name;
END;
$$;

-- The caller's own assignments, without the case: no disorder, comorbidities,
-- difficulty or severity. The spec and pinned case come back only sealed.
CREATE OR REPLACE FUNCTION public.my_skill_tests(p_assignment_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  trainee_id uuid,
  avatar_id uuid,
  title text,
  language text,
  required_sessions integer,
  trainee_instructions text,
  due_at timestamptz,
  status text,
  sealed_spec text,
  sealed_case text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select a.id, a.trainee_id, a.avatar_id, a.title, a.language,
         a.required_sessions, a.trainee_instructions, a.due_at, a.status,
         a.sealed_spec, a.sealed_case, a.started_at, a.completed_at, a.created_at
  from public.skill_test_assignments a
  where a.trainee_id = auth.uid()
    and (p_assignment_id is null or a.id = p_assignment_id)
  order by a.created_at desc;
$$;

CREATE OR REPLACE FUNCTION public.cancel_skill_test(p_assignment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.supervises_skill_test(p_assignment_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.skill_test_assignments
  SET status = 'cancelled', cancelled_at = now(), updated_at = now()
  WHERE id = p_assignment_id AND status IN ('assigned', 'in_progress');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'skill_test_closed' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.list_skill_test_trainees() FROM public, anon;
REVOKE ALL ON FUNCTION public.my_skill_tests(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.cancel_skill_test(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.list_skill_test_trainees() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_skill_tests(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_skill_test(uuid) TO authenticated;

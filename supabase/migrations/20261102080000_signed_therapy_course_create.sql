-- Signed therapy course creation (2026-11-02 security audit, finding 1).
--
-- 20261101170000 made the database accept a trainee's session only when the
-- server built and signed it. But a session that continues a therapy course is
-- built from the course row (clinical_snapshot, case_instance_id,
-- max_duration_sec), and a trainee could insert or edit that row straight
-- through the REST API. So a trainee could still get a signed session for a
-- patient they wrote themselves.
--
-- Now:
--   * Courses from signed-in non-admin users are created only through
--     create_signed_therapy_course(p_row, p_sig): HMAC over the exact row text
--     with the vault secret report_write_key, the key POST /api/sessions
--     already holds. The service role may call it without a signature.
--   * A direct INSERT from a signed-in non-admin is refused. Inside the signed
--     function a transaction-local flag lets the row through; the guard still
--     forces a fresh, open course and checks the time limit and case owner.
--   * An UPDATE from a signed-in non-admin cannot change the course's patient
--     (avatar, case, snapshot, language, time limit, owner) and cannot reopen
--     a finished course. The treatment plan stays editable while it is open.
--   Admins (two-step login) and the service role keep direct writes.
--
-- Canonical HMAC payload matches src/lib/therapy-course/create-course-row.ts:
--   'therapy_course' || E'\n' || p_row
--
-- Idempotent. No table, column or data change; existing courses are untouched.
--
-- Rollback:
--   DROP TRIGGER IF EXISTS therapy_courses_insert_guard ON public.therapy_courses;
--   DROP TRIGGER IF EXISTS therapy_courses_update_guard ON public.therapy_courses;
--   DROP FUNCTION IF EXISTS public.enforce_therapy_course_insert_guard();
--   DROP FUNCTION IF EXISTS public.enforce_therapy_course_update_guard();
--   DROP FUNCTION IF EXISTS public.create_signed_therapy_course(text, text);

-- ---------------------------------------------------------------------------
-- Signed create
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_signed_therapy_course(
  p_row text,
  p_sig text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_service boolean := (
    coalesce(auth.role(), '') = 'service_role'
    OR coalesce(auth.jwt() ->> 'role', '') = 'service_role'
  );
  v_row jsonb;
  v_key text;
  v_expected text;
  v_cols text;
  v_id uuid;
  -- Columns createCourse() writes; anything else in the row is refused.
  v_allowed constant text[] := ARRAY[
    'therapist_id', 'avatar_id', 'case_instance_id', 'clinical_snapshot',
    'language', 'max_duration_sec', 'status', 'planned_sessions'
  ];
BEGIN
  IF p_row IS NULL THEN
    RAISE EXCEPTION 'therapy_course_row_invalid' USING ERRCODE = '22023';
  END IF;

  IF NOT v_is_service THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
    END IF;
    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
    WHERE name = 'report_write_key'
    LIMIT 1;
    IF v_key IS NULL OR length(v_key) = 0 THEN
      RAISE EXCEPTION 'Course write key not configured';
    END IF;
    v_expected := encode(
      extensions.hmac('therapy_course' || E'\n' || p_row, v_key, 'sha256'),
      'hex'
    );
    IF p_sig IS NULL OR p_sig IS DISTINCT FROM v_expected THEN
      RAISE EXCEPTION 'therapy_course_signature_invalid' USING ERRCODE = '42501';
    END IF;
  END IF;

  BEGIN
    v_row := p_row::jsonb;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'therapy_course_row_invalid' USING ERRCODE = '22023';
  END;
  IF jsonb_typeof(v_row) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'therapy_course_row_invalid' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(v_row) k WHERE k <> ALL (v_allowed)
  ) THEN
    RAISE EXCEPTION 'therapy_course_row_invalid' USING ERRCODE = '22023';
  END IF;
  IF (v_row ->> 'therapist_id') IS NULL THEN
    RAISE EXCEPTION 'therapy_course_row_invalid' USING ERRCODE = '22023';
  END IF;

  -- A SECURITY DEFINER function skips row level security, so repeat what the
  -- insert policy checks for the caller.
  IF NOT v_is_service THEN
    IF (v_row ->> 'therapist_id')::uuid IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
    END IF;
    IF NOT public.is_approved() THEN
      RAISE EXCEPTION 'Account awaiting approval' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT string_agg(format('%I', k), ', ' ORDER BY k) INTO v_cols
  FROM jsonb_object_keys(v_row) k;

  PERFORM set_config('vtraining.signed_course_insert', 'on', true);
  EXECUTE format(
    'INSERT INTO public.therapy_courses (%1$s) SELECT %1$s FROM jsonb_populate_record(NULL::public.therapy_courses, $1) RETURNING id',
    v_cols
  ) INTO v_id USING v_row;
  PERFORM set_config('vtraining.signed_course_insert', 'off', true);

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_signed_therapy_course(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_signed_therapy_course(text, text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.create_signed_therapy_course(text, text) IS
  'Creates a therapy course row built by POST /api/sessions: HMAC over the row text (vault report_write_key) unless service role; caller must own the row and be approved.';

-- ---------------------------------------------------------------------------
-- Insert guard
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_therapy_course_insert_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_owner uuid;
BEGIN
  -- auth.uid() IS NULL: service role, migration or seed (already trusted).
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF coalesce(current_setting('vtraining.signed_course_insert', true), '') <> 'on' THEN
    RAISE EXCEPTION 'therapy_course_insert_requires_signature' USING ERRCODE = '42501';
  END IF;

  -- A new course is always open, with no plan and no ending yet.
  NEW.status := 'active';
  NEW.treatment_plan := NULL;
  NEW.plan_submitted_at := NULL;
  NEW.plan_updated_at := NULL;
  NEW.completed_at := NULL;
  NEW.completion_reason := NULL;
  NEW.created_at := now();
  NEW.updated_at := now();

  IF NEW.max_duration_sec IS NOT NULL
     AND NEW.max_duration_sec NOT BETWEEN 60 AND 5400 THEN
    RAISE EXCEPTION 'therapy_course_time_limit_out_of_range' USING ERRCODE = '42501';
  END IF;

  IF NEW.case_instance_id IS NOT NULL THEN
    SELECT ci.created_by INTO v_owner
    FROM public.case_instances ci
    WHERE ci.id = NEW.case_instance_id;
    IF v_owner IS DISTINCT FROM NEW.therapist_id THEN
      RAISE EXCEPTION 'case_instance_id not owned by therapist' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_therapy_course_insert_guard() IS
  'Therapy course INSERT from a signed-in non-admin: only via create_signed_therapy_course; always a fresh open course; time limit 60-5400 s; case must be the caller''s.';

DROP TRIGGER IF EXISTS therapy_courses_insert_guard ON public.therapy_courses;
CREATE TRIGGER therapy_courses_insert_guard
  BEFORE INSERT ON public.therapy_courses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_therapy_course_insert_guard();

-- ---------------------------------------------------------------------------
-- Update guard
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_therapy_course_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- The course's patient is fixed for its whole life.
  IF NEW.therapist_id IS DISTINCT FROM OLD.therapist_id
     OR NEW.avatar_id IS DISTINCT FROM OLD.avatar_id
     OR NEW.case_instance_id IS DISTINCT FROM OLD.case_instance_id
     OR NEW.clinical_snapshot IS DISTINCT FROM OLD.clinical_snapshot
     OR NEW.language IS DISTINCT FROM OLD.language
     OR NEW.max_duration_sec IS DISTINCT FROM OLD.max_duration_sec
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Cannot change the course patient' USING ERRCODE = '42501';
  END IF;

  -- A finished course stays finished, plan included.
  IF OLD.status <> 'active' AND (
       NEW.status IS DISTINCT FROM OLD.status
       OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
       OR NEW.completion_reason IS DISTINCT FROM OLD.completion_reason
       OR NEW.treatment_plan IS DISTINCT FROM OLD.treatment_plan
       OR NEW.planned_sessions IS DISTINCT FROM OLD.planned_sessions
       OR NEW.plan_submitted_at IS DISTINCT FROM OLD.plan_submitted_at
     ) THEN
    RAISE EXCEPTION 'Cannot change a finished course' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_therapy_course_update_guard() IS
  'Therapy course UPDATE from a signed-in non-admin: patient, case, snapshot, language, time limit and owner are fixed; a finished course cannot be reopened or edited.';

DROP TRIGGER IF EXISTS therapy_courses_update_guard ON public.therapy_courses;
CREATE TRIGGER therapy_courses_update_guard
  BEFORE UPDATE ON public.therapy_courses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_therapy_course_update_guard();

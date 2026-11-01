-- Signed session creation (2026-10-28 security audit, finding 1, last part).
--
-- 20261028100000 made the database set a session's status, start time and
-- institute and check its time limit, but a trainee could still insert a
-- session straight through the REST API with a clinical_snapshot they wrote
-- themselves (a patient prompt of their own, run on Vtraining's model bill).
--
-- Sessions from signed-in non-admin users are now created only through
-- create_signed_session(p_row, p_sig), a SECURITY DEFINER function that checks
-- an HMAC over the exact row text with the vault secret report_write_key (the
-- key the message, report and ladder RPCs already use). Only POST
-- /api/sessions holds that key, so a row the server did not build is refused.
-- The service role may call it without a signature.
--
-- The insert guard refuses a direct INSERT from a signed-in non-admin; inside
-- create_signed_session a transaction-local flag lets the row through, and
-- every other check in the guard (status, start time, institute, time limit,
-- course and case ownership) and the skill-test triggers still run.
-- Admins (two-step login) keep direct inserts for admin test sessions.
--
-- Canonical HMAC payload matches src/lib/sessions/create-session-row.ts:
--   'session' || E'\n' || p_row
--
-- Idempotent (CREATE OR REPLACE). No table, column or data change.
--
-- Rollback: re-run enforce_session_insert_guard from
-- 20261028100000_session_write_hardening.sql and
--   DROP FUNCTION IF EXISTS public.create_signed_session(text, text);

-- ---------------------------------------------------------------------------
-- Signed create
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_signed_session(
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
  -- Columns POST /api/sessions writes; anything else in the row is refused.
  v_allowed constant text[] := ARRAY[
    'id', 'therapist_id', 'avatar_id', 'status', 'max_duration_sec',
    'language', 'case_instance_id', 'clinical_snapshot', 'difficulty',
    'therapy_modality', 'instructor_preset_id', 'interaction_mode',
    'institution_id', 'skill_test_assignment_id', 'sealed_case',
    'therapy_course_id', 'course_session_number'
  ];
BEGIN
  IF p_row IS NULL THEN
    RAISE EXCEPTION 'session_row_invalid' USING ERRCODE = '22023';
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
      RAISE EXCEPTION 'Session write key not configured';
    END IF;
    v_expected := encode(
      extensions.hmac('session' || E'\n' || p_row, v_key, 'sha256'),
      'hex'
    );
    IF p_sig IS NULL OR p_sig IS DISTINCT FROM v_expected THEN
      RAISE EXCEPTION 'session_signature_invalid' USING ERRCODE = '42501';
    END IF;
  END IF;

  BEGIN
    v_row := p_row::jsonb;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'session_row_invalid' USING ERRCODE = '22023';
  END;
  IF jsonb_typeof(v_row) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'session_row_invalid' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(v_row) k WHERE k <> ALL (v_allowed)
  ) THEN
    RAISE EXCEPTION 'session_row_invalid' USING ERRCODE = '22023';
  END IF;
  IF (v_row ->> 'therapist_id') IS NULL THEN
    RAISE EXCEPTION 'session_row_invalid' USING ERRCODE = '22023';
  END IF;

  -- A SECURITY DEFINER function skips row level security, so repeat what the
  -- insert policies check for the caller.
  IF NOT v_is_service THEN
    IF (v_row ->> 'therapist_id')::uuid IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
    END IF;
    IF NOT public.is_approved() THEN
      RAISE EXCEPTION 'Account awaiting approval' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Only the keys present, so column defaults (id, started_at, …) still apply.
  SELECT string_agg(format('%I', k), ', ' ORDER BY k) INTO v_cols
  FROM jsonb_object_keys(v_row) k;

  PERFORM set_config('vtraining.signed_session_insert', 'on', true);
  EXECUTE format(
    'INSERT INTO public.sessions (%1$s) SELECT %1$s FROM jsonb_populate_record(NULL::public.sessions, $1) RETURNING id',
    v_cols
  ) INTO v_id USING v_row;
  PERFORM set_config('vtraining.signed_session_insert', 'off', true);

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_signed_session(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_signed_session(text, text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.create_signed_session(text, text) IS
  'Creates a session row built by POST /api/sessions: HMAC over the row text (vault report_write_key) unless service role; caller must own the row and be approved.';

-- ---------------------------------------------------------------------------
-- Insert guard: no direct INSERT from a signed-in non-admin
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_session_insert_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_owner uuid;
BEGIN
  -- Only an authenticated admin may mint a session carrying the admin_test marker.
  IF coalesce(NEW.clinical_snapshot ->> 'admin_test', '') = 'true' THEN
    IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'admin_test marker is not permitted for this role'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- auth.uid() IS NULL: service role, migration or seed (already trusted).
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Signed-in trainees create sessions only through create_signed_session.
  IF coalesce(current_setting('vtraining.signed_session_insert', true), '') <> 'on' THEN
    RAISE EXCEPTION 'session_insert_requires_signature' USING ERRCODE = '42501';
  END IF;

  NEW.status := 'active';
  NEW.started_at := now();
  NEW.ended_at := NULL;

  IF NEW.max_duration_sec IS NULL OR NEW.max_duration_sec NOT BETWEEN 60 AND 5400 THEN
    RAISE EXCEPTION 'session_time_limit_out_of_range' USING ERRCODE = '42501';
  END IF;

  SELECT p.primary_institution_id INTO NEW.institution_id
  FROM public.profiles p
  WHERE p.id = NEW.therapist_id;

  IF NEW.therapy_course_id IS NOT NULL THEN
    SELECT c.therapist_id INTO v_owner
    FROM public.therapy_courses c
    WHERE c.id = NEW.therapy_course_id;
    IF v_owner IS DISTINCT FROM NEW.therapist_id THEN
      RAISE EXCEPTION 'therapy_course_id not owned by therapist' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.case_instance_id IS NOT NULL THEN
    v_owner := NULL;
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

COMMENT ON FUNCTION public.enforce_session_insert_guard() IS
  'Session INSERT from a signed-in non-admin: only via create_signed_session; no admin_test marker; status, start time and institute set by the database; time limit 60-5400 s; course and case must be the caller''s.';

-- Security hardening (2026-10-28 audit, findings 1, 6 and 7).
--
-- 1. Sessions written straight through the REST API. The insert policy only
--    checks therapist_id = auth.uid(), so a trainee's own token could insert a
--    session with any max_duration_sec (no time limit), started_at, status,
--    ended_at or institution_id, or pointing at someone else's course or case.
--    For signed-in non-admin callers the insert guard now:
--      * forces status 'active', started_at now(), ended_at null;
--      * stamps institution_id from the caller's profile (as the app does);
--      * requires max_duration_sec between 60 and 5400 seconds (90 minutes,
--        the longest instructor preset);
--      * requires therapy_course_id and case_instance_id to be the caller's.
--    The update guard also freezes institution_id, therapy_course_id,
--    course_session_number and interaction_mode, lets language be filled only
--    when it was empty (the end route does that), and allows a running
--    session to move only to completed or expired.
--    Server-side callers with no end-user token (service role, migrations)
--    are unchanged, as in the existing admin_test guard.
--
-- 6. Training Program certificates (checked at /verify) could be written by
--    anyone who manages an institute. Institute managers keep their own
--    institute certificates; Training Program rows are written only by admins
--    (two-step login) or the SECURITY DEFINER issue/revoke functions.
--
-- 7. Learners could update their own assignment_completions rows (status,
--    score) and add enterprise_audit_events in their own name. The app writes
--    neither; both are now admin / institute-manager only, and a manager's
--    audit row must carry their own id.
--
-- Idempotent: CREATE OR REPLACE functions, DROP/CREATE POLICY by name. No
-- table, column or data change.
--
-- Rollback: re-run the previous definitions of
--   enforce_session_insert_guard (20260821084315_session_admin_test_insert_guard.sql),
--   enforce_session_update_guard, and the four policies
--   "Enterprise certificates write", "Enterprise audit insert",
--   "Assignment completions update", "Assignment completions learner insert update"
--   (20260803202511 / 20260807184355 / 20261015160000).

-- ---------------------------------------------------------------------------
-- 1. Sessions: insert guard
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
  'Session INSERT from a signed-in non-admin: no admin_test marker; status, start time and institute set by the database; time limit 60-5400 s; course and case must be the caller''s.';

-- ---------------------------------------------------------------------------
-- 1. Sessions: update guard
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_session_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_case_owner uuid;
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.therapist_id IS DISTINCT FROM OLD.therapist_id THEN
    RAISE EXCEPTION 'Cannot change therapist_id';
  END IF;
  IF NEW.avatar_id IS DISTINCT FROM OLD.avatar_id THEN
    RAISE EXCEPTION 'Cannot change avatar_id';
  END IF;
  IF NEW.max_duration_sec IS DISTINCT FROM OLD.max_duration_sec THEN
    RAISE EXCEPTION 'Cannot change max_duration_sec';
  END IF;
  IF NEW.started_at IS DISTINCT FROM OLD.started_at THEN
    RAISE EXCEPTION 'Cannot change started_at';
  END IF;
  IF OLD.status <> 'active' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Cannot reopen or change a finished session';
  END IF;

  -- CQG-010: Case Engine snapshot is immutable after mint.
  IF NEW.clinical_snapshot IS DISTINCT FROM OLD.clinical_snapshot THEN
    RAISE EXCEPTION 'Cannot change clinical_snapshot';
  END IF;
  IF NEW.difficulty IS DISTINCT FROM OLD.difficulty THEN
    RAISE EXCEPTION 'Cannot change difficulty';
  END IF;
  IF NEW.therapy_modality IS DISTINCT FROM OLD.therapy_modality THEN
    RAISE EXCEPTION 'Cannot change therapy_modality';
  END IF;
  IF NEW.instructor_preset_id IS DISTINCT FROM OLD.instructor_preset_id THEN
    RAISE EXCEPTION 'Cannot change instructor_preset_id';
  END IF;

  IF NEW.case_instance_id IS DISTINCT FROM OLD.case_instance_id THEN
    IF OLD.case_instance_id IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot rebind case_instance_id';
    END IF;
    IF NEW.case_instance_id IS NOT NULL THEN
      SELECT created_by INTO v_case_owner
      FROM public.case_instances
      WHERE id = NEW.case_instance_id;
      IF v_case_owner IS NULL THEN
        RAISE EXCEPTION 'case_instance_id not found';
      END IF;
      IF v_case_owner IS DISTINCT FROM NEW.therapist_id THEN
        RAISE EXCEPTION 'case_instance_id not owned by therapist';
      END IF;
    END IF;
  END IF;

  -- Server-side callers (service role, maintenance) may do the rest.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status NOT IN ('completed', 'expired') THEN
    RAISE EXCEPTION 'A running session can only be completed or expired';
  END IF;
  IF NEW.institution_id IS DISTINCT FROM OLD.institution_id THEN
    RAISE EXCEPTION 'Cannot change institution_id';
  END IF;
  IF NEW.therapy_course_id IS DISTINCT FROM OLD.therapy_course_id
     OR NEW.course_session_number IS DISTINCT FROM OLD.course_session_number THEN
    RAISE EXCEPTION 'Cannot change the therapy course link';
  END IF;
  IF NEW.interaction_mode IS DISTINCT FROM OLD.interaction_mode THEN
    RAISE EXCEPTION 'Cannot change interaction_mode';
  END IF;
  IF NEW.language IS DISTINCT FROM OLD.language AND OLD.language IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot change language';
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Training Program certificates: admins and the issue/revoke functions only
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Enterprise certificates write" ON public.enterprise_certificates;
CREATE POLICY "Enterprise certificates write" ON public.enterprise_certificates
  FOR ALL TO authenticated
  USING (
    (select public.is_platform_admin())
    OR (program IS NULL AND public.can_manage_institution(institution_id))
  )
  WITH CHECK (
    (select public.is_platform_admin())
    OR (program IS NULL AND public.can_manage_institution(institution_id))
  );

-- ---------------------------------------------------------------------------
-- 7. Institute audit log and assignment results: no self-written rows
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Enterprise audit insert" ON public.enterprise_audit_events;
CREATE POLICY "Enterprise audit insert" ON public.enterprise_audit_events
  FOR INSERT TO authenticated
  WITH CHECK (
    (select public.is_platform_admin())
    OR (
      institution_id IS NOT NULL
      AND actor_user_id = (select auth.uid())
      AND public.can_manage_institution(institution_id)
    )
  );

DROP POLICY IF EXISTS "Assignment completions update" ON public.assignment_completions;
CREATE POLICY "Assignment completions update" ON public.assignment_completions
  FOR UPDATE TO authenticated
  USING (
    (select public.is_platform_admin())
    OR EXISTS (
      SELECT 1 FROM public.learning_assignments a
      WHERE a.id = assignment_completions.assignment_id
        AND public.can_manage_institution(a.institution_id)
    )
  )
  WITH CHECK (
    (select public.is_platform_admin())
    OR EXISTS (
      SELECT 1 FROM public.learning_assignments a
      WHERE a.id = assignment_completions.assignment_id
        AND public.can_manage_institution(a.institution_id)
    )
  );

DROP POLICY IF EXISTS "Assignment completions learner insert update" ON public.assignment_completions;
CREATE POLICY "Assignment completions learner insert update" ON public.assignment_completions
  FOR INSERT TO authenticated
  WITH CHECK (
    (select public.is_platform_admin())
    OR EXISTS (
      SELECT 1 FROM public.learning_assignments a
      WHERE a.id = assignment_completions.assignment_id
        AND public.can_manage_institution(a.institution_id)
    )
  );

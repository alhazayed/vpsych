-- Trainee write guards (2026-11-02 security audit, findings 2, 3 and 4).
--
-- 2. Institute. 20261028100000 made the database copy a new session's
--    institute from the trainee's profile, but the trainee could change that
--    profile field (and learner_profiles.institution_id) themselves. Now only
--    admins (two-step login) and the service role change a profile's
--    institute, organization or retention setting, or a learner profile's
--    institute. Sign-up (auth trigger, no signed-in user) is unchanged.
--
-- 3. Accounts awaiting approval. The "Approved accounts only (read)" rule from
--    20261012105802 covers reads only, so a pending account could still insert
--    rows into tables with a self-write policy (case_instances, therapy
--    courses, clinic days, learner profiles, ...). Every public table that has
--    a write policy, other than profiles and the tables that already carry the
--    FOR ALL rule, gets RESTRICTIVE insert/update/delete rules on
--    (select is_approved()). Approved accounts and admins write exactly what
--    they did before; the service role and SECURITY DEFINER functions are not
--    affected by RLS.
--
-- 4. Session fields. A trainee's own UPDATE skipped the API's checks: the
--    end time of a finished session could be changed, and immersion_metrics /
--    private_notes had no size limit. Now a finished session's end time is
--    fixed for signed-in non-admins, and the two fields have the same limits
--    as the API (16 KB, 20,000 characters). Live data is far below both.
--
-- Idempotent. No data change.
--
-- Rollback:
--   DROP TRIGGER IF EXISTS profiles_tenant_guard ON public.profiles;
--   DROP FUNCTION IF EXISTS public.enforce_profile_tenant_guard();
--   DROP TRIGGER IF EXISTS learner_profiles_institution_guard ON public.learner_profiles;
--   DROP FUNCTION IF EXISTS public.enforce_learner_profile_institution_guard();
--   DO $$ DECLARE r record; BEGIN
--     FOR r IN SELECT tablename, policyname FROM pg_policies
--       WHERE schemaname = 'public' AND policyname IN (
--         'Approved accounts only (insert)', 'Approved accounts only (update)',
--         'Approved accounts only (delete)')
--     LOOP EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename); END LOOP;
--   END $$;
--   ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_immersion_metrics_size;
--   ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_private_notes_size;
--   and re-run enforce_session_update_guard from
--   20261028100000_session_write_hardening.sql.

-- ---------------------------------------------------------------------------
-- 2. Institute fields
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_profile_tenant_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.role() = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.primary_institution_id := NULL;
    RETURN NEW;
  END IF;
  IF NEW.primary_institution_id IS DISTINCT FROM OLD.primary_institution_id
     OR NEW.organization IS DISTINCT FROM OLD.organization
     OR NEW.data_retention_days IS DISTINCT FROM OLD.data_retention_days THEN
    RAISE EXCEPTION 'Cannot change institute or retention settings' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_profile_tenant_guard() IS
  'Only admins (two-step) or the service role set a profile''s institute, organization or retention.';

DROP TRIGGER IF EXISTS profiles_tenant_guard ON public.profiles;
CREATE TRIGGER profiles_tenant_guard
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_tenant_guard();

CREATE OR REPLACE FUNCTION public.enforce_learner_profile_institution_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.role() = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.institution_id := NULL;
    RETURN NEW;
  END IF;
  IF NEW.institution_id IS DISTINCT FROM OLD.institution_id THEN
    RAISE EXCEPTION 'Cannot change institute' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_learner_profile_institution_guard() IS
  'Only admins (two-step) or the service role set a learner profile''s institute.';

DROP TRIGGER IF EXISTS learner_profiles_institution_guard ON public.learner_profiles;
CREATE TRIGGER learner_profiles_institution_guard
  BEFORE INSERT OR UPDATE ON public.learner_profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_learner_profile_institution_guard();

-- ---------------------------------------------------------------------------
-- 3. Pending accounts write nothing
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT DISTINCT p.tablename
    FROM pg_policies p
    JOIN pg_class c ON c.relname = p.tablename
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    WHERE p.schemaname = 'public'
      AND p.permissive = 'PERMISSIVE'
      AND p.cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      AND c.relkind IN ('r', 'p')
      -- profiles: own row needed while pending.
      AND p.tablename <> 'profiles'
      -- Already covered by a FOR ALL approval rule.
      AND NOT EXISTS (
        SELECT 1 FROM pg_policies r
        WHERE r.schemaname = 'public' AND r.tablename = p.tablename
          AND r.permissive = 'RESTRICTIVE' AND r.cmd = 'ALL'
          AND r.qual ~ 'is_approved\(\)'
      )
    ORDER BY 1
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                   AND tablename = t AND policyname = 'Approved accounts only (insert)') THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated '
        'WITH CHECK ((select public.is_approved()))',
        'Approved accounts only (insert)', t);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                   AND tablename = t AND policyname = 'Approved accounts only (update)') THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated '
        'USING ((select public.is_approved())) WITH CHECK ((select public.is_approved()))',
        'Approved accounts only (update)', t);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                   AND tablename = t AND policyname = 'Approved accounts only (delete)') THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated '
        'USING ((select public.is_approved()))',
        'Approved accounts only (delete)', t);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Session fields
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'sessions_immersion_metrics_size'
                   AND conrelid = 'public.sessions'::regclass) THEN
    ALTER TABLE public.sessions ADD CONSTRAINT sessions_immersion_metrics_size
      CHECK (immersion_metrics IS NULL OR octet_length(immersion_metrics::text) <= 16384);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'sessions_private_notes_size'
                   AND conrelid = 'public.sessions'::regclass) THEN
    ALTER TABLE public.sessions ADD CONSTRAINT sessions_private_notes_size
      CHECK (private_notes IS NULL OR char_length(private_notes) <= 20000);
  END IF;
END $$;

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
  -- A finished session's end time is part of its record.
  IF OLD.status <> 'active' AND NEW.ended_at IS DISTINCT FROM OLD.ended_at THEN
    RAISE EXCEPTION 'Cannot change the end of a finished session';
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

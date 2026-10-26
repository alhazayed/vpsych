-- Supervisor review of session reports.
--
-- 1. supervisor_trainees: the superadmin links a supervisor to the trainees
--    they oversee. A linked supervisor can read those trainees' practice
--    sessions, transcripts and reports. Skill test sessions stay with the
--    supervisor who assigned the test (20261005110000), so a link never opens
--    another supervisor's exam.
-- 2. session_report_reviews: a supervisor (or admin) who can read a report adds
--    a comment, an optional flag, and an optional adjusted overall score. The
--    adjusted score is stored here only; session_reports and its AI scores are
--    never changed. An adjusted score needs a comment that explains it.
--
-- Revoking the supervisor role removes that supervisor's links (cascade), and
-- with them their access. Reviews they wrote stay readable to admins.
--
-- Additive and idempotent: two new tables, helper functions, one trigger, and
-- new permissive SELECT policies on sessions, session_messages,
-- session_reports and profiles. No existing policy, function, or column is
-- changed.
--
-- Rollback:
--   DROP POLICY IF EXISTS "Linked supervisors can view practice sessions" ON public.sessions;
--   DROP POLICY IF EXISTS "Linked supervisors can view practice transcripts" ON public.session_messages;
--   DROP POLICY IF EXISTS "Linked supervisors can view practice reports" ON public.session_reports;
--   DROP POLICY IF EXISTS "Linked supervisors can view their trainees" ON public.profiles;
--   DROP TABLE IF EXISTS public.session_report_reviews;
--   DROP FUNCTION IF EXISTS public.session_report_reviews_before_write();
--   DROP FUNCTION IF EXISTS public.can_review_session_report(uuid);
--   DROP FUNCTION IF EXISTS public.supervises_practice_session(uuid);
--   DROP FUNCTION IF EXISTS public.supervises_linked_trainee(uuid);
--   DROP TABLE IF EXISTS public.supervisor_trainees;

-- ---------------------------------------------------------------------------
-- Supervisor-to-trainee links: written by the superadmin only.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supervisor_trainees (
  supervisor_id uuid NOT NULL REFERENCES public.supervisors (user_id) ON DELETE CASCADE,
  trainee_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  linked_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (supervisor_id, trainee_id),
  CHECK (supervisor_id <> trainee_id)
);

CREATE INDEX IF NOT EXISTS supervisor_trainees_trainee_idx
  ON public.supervisor_trainees (trainee_id);
CREATE INDEX IF NOT EXISTS supervisor_trainees_linked_by_idx
  ON public.supervisor_trainees (linked_by);

COMMENT ON TABLE public.supervisor_trainees IS
  'Trainees a supervisor oversees: the supervisor reads their practice reports. Written by admins only.';

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER so policies do not recurse through RLS).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.supervises_linked_trainee(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select public.is_supervisor() and exists (
    select 1 from public.supervisor_trainees l
    where l.trainee_id = p_user_id and l.supervisor_id = auth.uid()
  );
$$;

-- Practice sessions only: a skill test session belongs to its assigning
-- supervisor (supervises_session) and never opens through a link.
CREATE OR REPLACE FUNCTION public.supervises_practice_session(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select public.is_supervisor() and exists (
    select 1
    from public.sessions s
    join public.supervisor_trainees l on l.trainee_id = s.therapist_id
    where s.id = p_session_id
      and s.skill_test_assignment_id is null
      and l.supervisor_id = auth.uid()
  );
$$;

-- Who may review a report: an admin, the supervisor who assigned the skill
-- test, or a supervisor linked to the trainee (practice sessions). The report
-- must exist.
CREATE OR REPLACE FUNCTION public.can_review_session_report(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1 from public.session_reports r where r.session_id = p_session_id
  ) and (
    public.is_admin()
    or public.supervises_session(p_session_id)
    or public.supervises_practice_session(p_session_id)
  );
$$;

REVOKE ALL ON FUNCTION public.supervises_linked_trainee(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.supervises_practice_session(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.can_review_session_report(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.supervises_linked_trainee(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.supervises_practice_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_review_session_report(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS: supervisor_trainees
-- ---------------------------------------------------------------------------
ALTER TABLE public.supervisor_trainees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Approved accounts only" ON public.supervisor_trainees;
CREATE POLICY "Approved accounts only" ON public.supervisor_trainees
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((select public.is_approved()))
  WITH CHECK ((select public.is_approved()));

DROP POLICY IF EXISTS "Supervisor links self or admin select" ON public.supervisor_trainees;
CREATE POLICY "Supervisor links self or admin select" ON public.supervisor_trainees
  FOR SELECT TO authenticated
  USING (
    (supervisor_id = (select auth.uid()) AND (select public.is_supervisor()))
    OR (select public.is_admin())
  );

DROP POLICY IF EXISTS "Supervisor links admin insert" ON public.supervisor_trainees;
CREATE POLICY "Supervisor links admin insert" ON public.supervisor_trainees
  FOR INSERT TO authenticated
  WITH CHECK ((select public.is_admin()) AND linked_by = (select auth.uid()));

DROP POLICY IF EXISTS "Supervisor links admin delete" ON public.supervisor_trainees;
CREATE POLICY "Supervisor links admin delete" ON public.supervisor_trainees
  FOR DELETE TO authenticated
  USING ((select public.is_admin()));

REVOKE ALL ON public.supervisor_trainees FROM anon;
GRANT SELECT, INSERT, DELETE ON public.supervisor_trainees TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS: practice results readable by a linked supervisor. Each policy checks
-- (select is_supervisor()) first, once per statement, so other users' queries
-- skip the per-row lookup.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Linked supervisors can view practice sessions" ON public.sessions;
CREATE POLICY "Linked supervisors can view practice sessions" ON public.sessions
  FOR SELECT TO authenticated
  USING (
    skill_test_assignment_id IS NULL
    AND (select public.is_supervisor())
    AND therapist_id IN (
      select l.trainee_id from public.supervisor_trainees l
      where l.supervisor_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Linked supervisors can view practice transcripts" ON public.session_messages;
CREATE POLICY "Linked supervisors can view practice transcripts" ON public.session_messages
  FOR SELECT TO authenticated
  USING ((select public.is_supervisor()) AND public.supervises_practice_session(session_id));

DROP POLICY IF EXISTS "Linked supervisors can view practice reports" ON public.session_reports;
CREATE POLICY "Linked supervisors can view practice reports" ON public.session_reports
  FOR SELECT TO authenticated
  USING ((select public.is_supervisor()) AND public.supervises_practice_session(session_id));

DROP POLICY IF EXISTS "Linked supervisors can view their trainees" ON public.profiles;
CREATE POLICY "Linked supervisors can view their trainees" ON public.profiles
  FOR SELECT TO authenticated
  USING ((select public.is_supervisor()) AND public.supervises_linked_trainee(id));

-- ---------------------------------------------------------------------------
-- Supervisor reviews: one per reviewer per session. The AI report is never
-- edited; the adjusted score lives here, beside it.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.session_report_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  -- Kept (author unknown) if the reviewer's account is deleted.
  reviewer_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  comment text
    CHECK (comment IS NULL OR char_length(btrim(comment)) BETWEEN 1 AND 4000),
  adjusted_overall integer
    CHECK (adjusted_overall IS NULL OR adjusted_overall BETWEEN 0 AND 100),
  flagged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, reviewer_id),
  -- A changed score must say why.
  CHECK (adjusted_overall IS NULL OR comment IS NOT NULL),
  CHECK (comment IS NOT NULL OR adjusted_overall IS NOT NULL OR flagged)
);

CREATE INDEX IF NOT EXISTS session_report_reviews_reviewer_idx
  ON public.session_report_reviews (reviewer_id);

COMMENT ON TABLE public.session_report_reviews IS
  'Supervisor comment, flag and adjusted overall score for a session report. The AI scores in session_reports are never changed.';

-- The author, session and creation time are fixed once written.
CREATE OR REPLACE FUNCTION public.session_report_reviews_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.session_id IS DISTINCT FROM OLD.session_id
       OR NEW.reviewer_id IS DISTINCT FROM OLD.reviewer_id THEN
      RAISE EXCEPTION 'Cannot move a review to another session or author'
        USING ERRCODE = '42501';
    END IF;
    NEW.created_at := OLD.created_at;
  ELSE
    NEW.created_at := now();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS session_report_reviews_before_write ON public.session_report_reviews;
CREATE TRIGGER session_report_reviews_before_write
  BEFORE INSERT OR UPDATE ON public.session_report_reviews
  FOR EACH ROW EXECUTE FUNCTION public.session_report_reviews_before_write();

ALTER TABLE public.session_report_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Approved accounts only" ON public.session_report_reviews;
CREATE POLICY "Approved accounts only" ON public.session_report_reviews
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((select public.is_approved()))
  WITH CHECK ((select public.is_approved()));

-- Everyone who may review a report sees every review of it; admins see all.
DROP POLICY IF EXISTS "Report reviewers can view reviews" ON public.session_report_reviews;
CREATE POLICY "Report reviewers can view reviews" ON public.session_report_reviews
  FOR SELECT TO authenticated
  USING (
    (select public.is_admin())
    OR public.can_review_session_report(session_id)
  );

DROP POLICY IF EXISTS "Report reviewers can add their review" ON public.session_report_reviews;
CREATE POLICY "Report reviewers can add their review" ON public.session_report_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    reviewer_id = (select auth.uid())
    AND public.can_review_session_report(session_id)
  );

DROP POLICY IF EXISTS "Report reviewers can edit their review" ON public.session_report_reviews;
CREATE POLICY "Report reviewers can edit their review" ON public.session_report_reviews
  FOR UPDATE TO authenticated
  USING (
    reviewer_id = (select auth.uid())
    AND public.can_review_session_report(session_id)
  )
  WITH CHECK (
    reviewer_id = (select auth.uid())
    AND public.can_review_session_report(session_id)
  );

DROP POLICY IF EXISTS "Report reviewers can remove their review" ON public.session_report_reviews;
CREATE POLICY "Report reviewers can remove their review" ON public.session_report_reviews
  FOR DELETE TO authenticated
  USING (
    (reviewer_id = (select auth.uid()) AND public.can_review_session_report(session_id))
    OR (select public.is_admin())
  );

REVOKE ALL ON public.session_report_reviews FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_report_reviews TO authenticated;

-- Canonical migration recovered for Release Configuration Board reconciliation.
-- Source: production supabase_migrations.schema_migrations statements
-- (enriched only when production statements were empty/placeholder).

-- Mission 07 Database Certification remediations
-- 1) Defense-in-depth: revoke table/routine privileges from anon
-- 2) Restrict PUBLIC RLS policies to authenticated
-- 3) Cover hot-path foreign keys with indexes
-- 4) Harden trigger function EXECUTE grants

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon;

REVOKE ALL ON TABLE
  public.competency_attempts,
  public.competency_decay,
  public.competency_edges,
  public.competency_nodes,
  public.competency_prerequisites,
  public.generated_case_instances,
  public.graph_versions,
  public.mastery_history,
  public.remediation_plans
FROM anon;

DROP POLICY IF EXISTS "Therapists can view own sessions" ON public.sessions;
CREATE POLICY "Therapists can view own sessions"
  ON public.sessions FOR SELECT
  TO authenticated
  USING (therapist_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "Therapists can create own sessions" ON public.sessions;
CREATE POLICY "Therapists can create own sessions"
  ON public.sessions FOR INSERT
  TO authenticated
  WITH CHECK (therapist_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Therapists can update own sessions" ON public.sessions;
CREATE POLICY "Therapists can update own sessions"
  ON public.sessions FOR UPDATE
  TO authenticated
  USING (therapist_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "Participants can view session messages" ON public.session_messages;
CREATE POLICY "Participants can view session messages"
  ON public.session_messages FOR SELECT
  TO authenticated
  USING (
    (SELECT public.is_admin())
    OR EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_messages.session_id
        AND s.therapist_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Therapists can insert user messages on own sessions" ON public.session_messages;
CREATE POLICY "Therapists can insert user messages on own sessions"
  ON public.session_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    role = 'user'
    AND EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_messages.session_id
        AND s.therapist_id = (SELECT auth.uid())
        AND s.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Admins can view reports" ON public.session_reports;
CREATE POLICY "Admins can view reports"
  ON public.session_reports FOR SELECT
  TO authenticated
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "Admins can update reports" ON public.session_reports;
CREATE POLICY "Admins can update reports"
  ON public.session_reports FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "Users can update own display name" ON public.profiles;
CREATE POLICY "Users can update own display name"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK (
    (SELECT auth.uid()) = id
    AND role = (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

CREATE INDEX IF NOT EXISTS adaptive_case_history_session_id_idx
  ON public.adaptive_case_history (session_id);
CREATE INDEX IF NOT EXISTS adaptive_case_history_case_instance_id_idx
  ON public.adaptive_case_history (case_instance_id);

CREATE INDEX IF NOT EXISTS coach_feedback_session_id_idx
  ON public.coach_feedback (session_id);

CREATE INDEX IF NOT EXISTS competency_scores_session_id_idx
  ON public.competency_scores (session_id);
CREATE INDEX IF NOT EXISTS competency_scores_competency_id_idx
  ON public.competency_scores (competency_id);

CREATE INDEX IF NOT EXISTS curriculum_progress_session_id_idx
  ON public.curriculum_progress (session_id);
CREATE INDEX IF NOT EXISTS curriculum_progress_case_instance_id_idx
  ON public.curriculum_progress (case_instance_id);

CREATE INDEX IF NOT EXISTS cge_attempts_session_id_idx
  ON public.cge_attempts (session_id);
CREATE INDEX IF NOT EXISTS cge_mastery_history_learner_id_idx
  ON public.cge_mastery_history (learner_id);
CREATE INDEX IF NOT EXISTS cge_decay_learner_id_idx
  ON public.cge_decay (learner_id);

CREATE INDEX IF NOT EXISTS case_instances_voice_profile_id_idx
  ON public.case_instances (voice_profile_id);
CREATE INDEX IF NOT EXISTS clinical_templates_voice_profile_id_idx
  ON public.clinical_templates (voice_profile_id);

REVOKE ALL ON FUNCTION public.enforce_learner_profile_guard() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enforce_profile_role_guard() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enforce_session_update_guard() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sync_avatar_flat_from_v2() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.enforce_learner_profile_guard() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enforce_profile_role_guard() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enforce_session_update_guard() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_avatar_flat_from_v2() TO authenticated, service_role;

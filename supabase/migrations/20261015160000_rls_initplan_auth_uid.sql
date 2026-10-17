-- Performance: 17 policies called auth.uid() directly, so Postgres re-ran it
-- for every row (Supabase advisor lint auth_rls_initplan). Wrapping it in
-- (select ...) evaluates it once per statement, as CLAUDE.md requires.
-- Logic, names, commands and roles are unchanged: ALTER POLICY keeps them and
-- only swaps the expressions. Idempotent; reverting means the same ALTER with
-- bare auth.uid().

BEGIN;

ALTER POLICY "Learner select own adaptive_case_history" ON public.adaptive_case_history
  USING (EXISTS ( SELECT 1 FROM learner_profiles lp WHERE ((lp.id = adaptive_case_history.learner_id) AND ((lp.user_id = (select auth.uid())) OR ( SELECT is_admin() AS is_admin)))));

ALTER POLICY "Learner select own certifications" ON public.certifications
  USING (EXISTS ( SELECT 1 FROM learner_profiles lp WHERE ((lp.id = certifications.learner_id) AND ((lp.user_id = (select auth.uid())) OR ( SELECT is_admin() AS is_admin)))));

ALTER POLICY "Learner select own cge_decay" ON public.cge_decay
  USING (EXISTS ( SELECT 1 FROM learner_profiles lp WHERE ((lp.id = cge_decay.learner_id) AND ((lp.user_id = (select auth.uid())) OR ( SELECT is_admin() AS is_admin)))));

ALTER POLICY "Learner select own cge_mastery_history" ON public.cge_mastery_history
  USING (EXISTS ( SELECT 1 FROM learner_profiles lp WHERE ((lp.id = cge_mastery_history.learner_id) AND ((lp.user_id = (select auth.uid())) OR ( SELECT is_admin() AS is_admin)))));

ALTER POLICY "Learner select own cge_remediation_plans" ON public.cge_remediation_plans
  USING (EXISTS ( SELECT 1 FROM learner_profiles lp WHERE ((lp.id = cge_remediation_plans.learner_id) AND ((lp.user_id = (select auth.uid())) OR ( SELECT is_admin() AS is_admin)))));

ALTER POLICY "Learner select own coach_feedback" ON public.coach_feedback
  USING (EXISTS ( SELECT 1 FROM learner_profiles lp WHERE ((lp.id = coach_feedback.learner_id) AND ((lp.user_id = (select auth.uid())) OR ( SELECT is_admin() AS is_admin)))));

ALTER POLICY "Learner select own competency_scores" ON public.competency_scores
  USING (EXISTS ( SELECT 1 FROM learner_profiles lp WHERE ((lp.id = competency_scores.learner_id) AND ((lp.user_id = (select auth.uid())) OR ( SELECT is_admin() AS is_admin)))));

ALTER POLICY "Learner select own learning_paths" ON public.learning_paths
  USING (EXISTS ( SELECT 1 FROM learner_profiles lp WHERE ((lp.id = learning_paths.learner_id) AND ((lp.user_id = (select auth.uid())) OR ( SELECT is_admin() AS is_admin)))));

ALTER POLICY "Learner select own performance_trends" ON public.performance_trends
  USING (EXISTS ( SELECT 1 FROM learner_profiles lp WHERE ((lp.id = performance_trends.learner_id) AND ((lp.user_id = (select auth.uid())) OR ( SELECT is_admin() AS is_admin)))));

ALTER POLICY "Assignment completions learner insert update" ON public.assignment_completions
  WITH CHECK ((user_id = (select auth.uid())) OR (EXISTS ( SELECT 1 FROM learning_assignments a WHERE ((a.id = assignment_completions.assignment_id) AND can_manage_institution(a.institution_id)))));

ALTER POLICY "Assignment completions self or manager" ON public.assignment_completions
  USING (is_platform_admin() OR (user_id = (select auth.uid())) OR (EXISTS ( SELECT 1 FROM learning_assignments a WHERE ((a.id = assignment_completions.assignment_id) AND can_manage_institution(a.institution_id)))));

ALTER POLICY "Assignment completions update" ON public.assignment_completions
  USING ((user_id = (select auth.uid())) OR (EXISTS ( SELECT 1 FROM learning_assignments a WHERE ((a.id = assignment_completions.assignment_id) AND can_manage_institution(a.institution_id)))))
  WITH CHECK ((user_id = (select auth.uid())) OR (EXISTS ( SELECT 1 FROM learning_assignments a WHERE ((a.id = assignment_completions.assignment_id) AND can_manage_institution(a.institution_id)))));

ALTER POLICY "Class memberships self or manager read" ON public.class_memberships
  USING (is_platform_admin() OR (user_id = (select auth.uid())) OR (EXISTS ( SELECT 1 FROM classes c WHERE ((c.id = class_memberships.class_id) AND can_manage_institution(c.institution_id)))));

ALTER POLICY "Learner select own curriculum_progress" ON public.curriculum_progress
  USING (EXISTS ( SELECT 1 FROM (learning_paths path JOIN learner_profiles lp ON ((lp.id = path.learner_id))) WHERE ((path.id = curriculum_progress.learning_path_id) AND ((lp.user_id = (select auth.uid())) OR ( SELECT is_admin() AS is_admin)))));

ALTER POLICY "Memberships self or manager read" ON public.institution_memberships
  USING (is_platform_admin() OR (user_id = (select auth.uid())) OR can_manage_institution(institution_id));

ALTER POLICY "Learner insert own learning_paths" ON public.learning_paths
  WITH CHECK (EXISTS ( SELECT 1 FROM learner_profiles lp WHERE ((lp.id = learning_paths.learner_id) AND (lp.user_id = (select auth.uid())))));

ALTER POLICY "Institution managers can view tenant sessions" ON public.sessions
  USING (can_manage_institution(institution_id) OR (therapist_id = (select auth.uid())) OR is_platform_admin());

COMMIT;

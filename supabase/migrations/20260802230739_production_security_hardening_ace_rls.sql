-- 5) ACE policies — learners read; seed insert; score/cert writes admin-only
--    (service_role bypasses RLS for server assessment persistence)
-- ---------------------------------------------------------------------------

-- learner_profiles: split FOR ALL
DROP POLICY IF EXISTS "Learner own profile" ON public.learner_profiles;
CREATE POLICY "Learner select own profile" ON public.learner_profiles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
CREATE POLICY "Learner insert own profile" ON public.learner_profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Learner update own profile prefs" ON public.learner_profiles
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
CREATE POLICY "Admin all learner_profiles" ON public.learner_profiles
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- learner_competencies: SELECT + seed INSERT; no learner UPDATE/DELETE
DROP POLICY IF EXISTS "Learner own competencies" ON public.learner_competencies;
CREATE POLICY "Learner select own competencies" ON public.learner_competencies
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.learner_profiles lp
    WHERE lp.id = learner_id
      AND (lp.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
      ))
  ));
CREATE POLICY "Learner seed own competencies" ON public.learner_competencies
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.learner_profiles lp
    WHERE lp.id = learner_id AND lp.user_id = auth.uid()
  ));
CREATE POLICY "Admin all learner_competencies" ON public.learner_competencies
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- competency_scores: SELECT only for learners
DROP POLICY IF EXISTS "Learner own competency_scores" ON public.competency_scores;
CREATE POLICY "Learner select own competency_scores" ON public.competency_scores
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.learner_profiles lp
    WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    ))
  ));
CREATE POLICY "Admin all competency_scores" ON public.competency_scores
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- learning_paths: SELECT + INSERT (curriculum create); no learner UPDATE of others' scores
DROP POLICY IF EXISTS "Learner own learning_paths" ON public.learning_paths;
CREATE POLICY "Learner select own learning_paths" ON public.learning_paths
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.learner_profiles lp
    WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    ))
  ));
CREATE POLICY "Learner insert own learning_paths" ON public.learning_paths
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.learner_profiles lp
    WHERE lp.id = learner_id AND lp.user_id = auth.uid()
  ));
CREATE POLICY "Admin all learning_paths" ON public.learning_paths
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- curriculum_progress: SELECT only
DROP POLICY IF EXISTS "Learner own curriculum_progress" ON public.curriculum_progress;
CREATE POLICY "Learner select own curriculum_progress" ON public.curriculum_progress
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.learning_paths path
    JOIN public.learner_profiles lp ON lp.id = path.learner_id
    WHERE path.id = learning_path_id
      AND (lp.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
      ))
  ));
CREATE POLICY "Admin all curriculum_progress" ON public.curriculum_progress
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- adaptive_case_history: SELECT only
DROP POLICY IF EXISTS "Learner own adaptive_case_history" ON public.adaptive_case_history;
CREATE POLICY "Learner select own adaptive_case_history" ON public.adaptive_case_history
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.learner_profiles lp
    WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    ))
  ));
CREATE POLICY "Admin all adaptive_case_history" ON public.adaptive_case_history
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- performance_trends: SELECT only
DROP POLICY IF EXISTS "Learner own performance_trends" ON public.performance_trends;
CREATE POLICY "Learner select own performance_trends" ON public.performance_trends
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.learner_profiles lp
    WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    ))
  ));
CREATE POLICY "Admin all performance_trends" ON public.performance_trends
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- certifications: SELECT only (no self-certify)
DROP POLICY IF EXISTS "Learner own certifications" ON public.certifications;
CREATE POLICY "Learner select own certifications" ON public.certifications
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.learner_profiles lp
    WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    ))
  ));
CREATE POLICY "Admin all certifications" ON public.certifications
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- coach_feedback: SELECT only
DROP POLICY IF EXISTS "Learner own coach_feedback" ON public.coach_feedback;
CREATE POLICY "Learner select own coach_feedback" ON public.coach_feedback
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.learner_profiles lp
    WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    ))
  ));
CREATE POLICY "Admin all coach_feedback" ON public.coach_feedback
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ---------------------------------------------------------------------------

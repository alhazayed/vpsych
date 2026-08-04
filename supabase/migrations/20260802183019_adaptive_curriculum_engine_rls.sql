-- Canonical migration recovered for Release Configuration Board reconciliation.
-- Source: production supabase_migrations.schema_migrations statements
-- (enriched only when production statements were empty/placeholder).

ALTER TABLE public.competency_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adaptive_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learner_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learner_competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competency_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adaptive_case_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read competency domains" ON public.competency_domains;
CREATE POLICY "Read competency domains" ON public.competency_domains FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin write competency domains" ON public.competency_domains;
CREATE POLICY "Admin write competency domains" ON public.competency_domains FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Read adaptive rules" ON public.adaptive_rules;
CREATE POLICY "Read adaptive rules" ON public.adaptive_rules FOR SELECT TO authenticated USING (enabled = true OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "Admin write adaptive rules" ON public.adaptive_rules;
CREATE POLICY "Admin write adaptive rules" ON public.adaptive_rules FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Learner own profile" ON public.learner_profiles;
CREATE POLICY "Learner own profile" ON public.learner_profiles FOR ALL TO authenticated USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')) WITH CHECK (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Learner own competencies" ON public.learner_competencies;
CREATE POLICY "Learner own competencies" ON public.learner_competencies FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.learner_profiles lp WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')))) WITH CHECK (EXISTS (SELECT 1 FROM public.learner_profiles lp WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))));

DROP POLICY IF EXISTS "Learner own competency_scores" ON public.competency_scores;
CREATE POLICY "Learner own competency_scores" ON public.competency_scores FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.learner_profiles lp WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')))) WITH CHECK (EXISTS (SELECT 1 FROM public.learner_profiles lp WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))));

DROP POLICY IF EXISTS "Learner own learning_paths" ON public.learning_paths;
CREATE POLICY "Learner own learning_paths" ON public.learning_paths FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.learner_profiles lp WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')))) WITH CHECK (EXISTS (SELECT 1 FROM public.learner_profiles lp WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))));

DROP POLICY IF EXISTS "Learner own curriculum_progress" ON public.curriculum_progress;
CREATE POLICY "Learner own curriculum_progress" ON public.curriculum_progress FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.learning_paths path JOIN public.learner_profiles lp ON lp.id = path.learner_id WHERE path.id = learning_path_id AND (lp.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')))) WITH CHECK (EXISTS (SELECT 1 FROM public.learning_paths path JOIN public.learner_profiles lp ON lp.id = path.learner_id WHERE path.id = learning_path_id AND (lp.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))));

DROP POLICY IF EXISTS "Learner own adaptive_case_history" ON public.adaptive_case_history;
CREATE POLICY "Learner own adaptive_case_history" ON public.adaptive_case_history FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.learner_profiles lp WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')))) WITH CHECK (EXISTS (SELECT 1 FROM public.learner_profiles lp WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))));

DROP POLICY IF EXISTS "Learner own performance_trends" ON public.performance_trends;
CREATE POLICY "Learner own performance_trends" ON public.performance_trends FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.learner_profiles lp WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')))) WITH CHECK (EXISTS (SELECT 1 FROM public.learner_profiles lp WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))));

DROP POLICY IF EXISTS "Learner own certifications" ON public.certifications;
CREATE POLICY "Learner own certifications" ON public.certifications FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.learner_profiles lp WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')))) WITH CHECK (EXISTS (SELECT 1 FROM public.learner_profiles lp WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))));

DROP POLICY IF EXISTS "Learner own coach_feedback" ON public.coach_feedback;
CREATE POLICY "Learner own coach_feedback" ON public.coach_feedback FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.learner_profiles lp WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')))) WITH CHECK (EXISTS (SELECT 1 FROM public.learner_profiles lp WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))));

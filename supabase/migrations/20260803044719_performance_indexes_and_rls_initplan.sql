-- Canonical migration recovered for Release Configuration Board reconciliation.
-- Source: production supabase_migrations.schema_migrations statements
-- (enriched only when production statements were empty/placeholder).

CREATE INDEX IF NOT EXISTS sessions_instructor_preset_id_idx ON public.sessions (instructor_preset_id);
CREATE INDEX IF NOT EXISTS sessions_learner_profile_id_idx ON public.sessions (learner_profile_id);
CREATE INDEX IF NOT EXISTS clinical_templates_primary_diagnosis_id_idx ON public.clinical_templates (primary_diagnosis_id);
CREATE INDEX IF NOT EXISTS clinical_templates_default_persona_id_idx ON public.clinical_templates (default_persona_id);
CREATE INDEX IF NOT EXISTS clinical_templates_created_by_idx ON public.clinical_templates (created_by);
CREATE INDEX IF NOT EXISTS template_objectives_template_id_idx ON public.template_objectives (template_id);
CREATE INDEX IF NOT EXISTS template_competencies_template_id_idx ON public.template_competencies (template_id);
CREATE INDEX IF NOT EXISTS template_diagnoses_disorder_id_idx ON public.template_diagnoses (disorder_id);
CREATE INDEX IF NOT EXISTS template_comorbidities_disorder_id_idx ON public.template_comorbidities (disorder_id);
CREATE INDEX IF NOT EXISTS template_versions_created_by_idx ON public.template_versions (created_by);
CREATE INDEX IF NOT EXISTS comorbidity_rules_comorbid_disorder_id_idx ON public.comorbidity_rules (comorbid_disorder_id);
CREATE INDEX IF NOT EXISTS personas_default_disorder_id_idx ON public.personas (default_disorder_id);
CREATE INDEX IF NOT EXISTS case_instances_created_by_idx ON public.case_instances (created_by);
CREATE INDEX IF NOT EXISTS instructor_presets_created_by_idx ON public.instructor_presets (created_by);
CREATE INDEX IF NOT EXISTS instructor_presets_scenario_template_id_idx ON public.instructor_presets (scenario_template_id);
CREATE INDEX IF NOT EXISTS preset_competencies_preset_id_idx ON public.preset_competencies (preset_id);
CREATE INDEX IF NOT EXISTS preset_templates_template_id_idx ON public.preset_templates (template_id);
CREATE INDEX IF NOT EXISTS preset_versions_created_by_idx ON public.preset_versions (created_by);
CREATE INDEX IF NOT EXISTS learner_competencies_competency_id_idx ON public.learner_competencies (competency_id);
CREATE INDEX IF NOT EXISTS cge_attempts_competency_id_idx ON public.cge_attempts (competency_id);
CREATE INDEX IF NOT EXISTS learning_paths_focus_competency_id_idx ON public.learning_paths (focus_competency_id);
CREATE INDEX IF NOT EXISTS learning_paths_instructor_preset_id_idx ON public.learning_paths (instructor_preset_id);
CREATE INDEX IF NOT EXISTS learning_paths_created_by_idx ON public.learning_paths (created_by);

DROP POLICY IF EXISTS "Therapists read own case_instances" ON public.case_instances;
CREATE POLICY "Therapists read own case_instances" ON public.case_instances FOR SELECT USING (created_by = (select auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.role = 'admin') OR EXISTS (SELECT 1 FROM public.sessions s WHERE s.case_instance_id = case_instances.id AND s.therapist_id = (select auth.uid())));
DROP POLICY IF EXISTS "Authenticated insert case_instances" ON public.case_instances;
CREATE POLICY "Authenticated insert case_instances" ON public.case_instances FOR INSERT WITH CHECK (created_by = (select auth.uid()));
DROP POLICY IF EXISTS "Admin all case_instances" ON public.case_instances;
CREATE POLICY "Admin all case_instances" ON public.case_instances FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.role = 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.role = 'admin'));

DROP POLICY IF EXISTS "Authenticated read enabled templates" ON public.clinical_templates;
CREATE POLICY "Authenticated read enabled templates" ON public.clinical_templates FOR SELECT USING (enabled = true OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.role = 'admin'));
DROP POLICY IF EXISTS "Admin write templates" ON public.clinical_templates;
CREATE POLICY "Admin write templates" ON public.clinical_templates FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.role = 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.role = 'admin'));

DROP POLICY IF EXISTS "Learner select own profile" ON public.learner_profiles;
CREATE POLICY "Learner select own profile" ON public.learner_profiles FOR SELECT USING (user_id = (select auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.role = 'admin'));
DROP POLICY IF EXISTS "Learner insert own profile" ON public.learner_profiles;
CREATE POLICY "Learner insert own profile" ON public.learner_profiles FOR INSERT WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Learner update own profile prefs" ON public.learner_profiles;
CREATE POLICY "Learner update own profile prefs" ON public.learner_profiles FOR UPDATE USING (user_id = (select auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.role = 'admin')) WITH CHECK (user_id = (select auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.role = 'admin'));
DROP POLICY IF EXISTS "Admin all learner_profiles" ON public.learner_profiles;
CREATE POLICY "Admin all learner_profiles" ON public.learner_profiles FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.role = 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.role = 'admin'));

DROP POLICY IF EXISTS "Learner select own competencies" ON public.learner_competencies;
CREATE POLICY "Learner select own competencies" ON public.learner_competencies FOR SELECT USING (EXISTS (SELECT 1 FROM public.learner_profiles lp WHERE lp.id = learner_competencies.learner_id AND (lp.user_id = (select auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.role = 'admin'))));
DROP POLICY IF EXISTS "Learner seed own competencies" ON public.learner_competencies;
CREATE POLICY "Learner seed own competencies" ON public.learner_competencies FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.learner_profiles lp WHERE lp.id = learner_competencies.learner_id AND lp.user_id = (select auth.uid())));
DROP POLICY IF EXISTS "Admin all learner_competencies" ON public.learner_competencies;
CREATE POLICY "Admin all learner_competencies" ON public.learner_competencies FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.role = 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.role = 'admin'));

DROP POLICY IF EXISTS "Learner select own cge_attempts" ON public.cge_attempts;
CREATE POLICY "Learner select own cge_attempts" ON public.cge_attempts FOR SELECT USING (EXISTS (SELECT 1 FROM public.learner_profiles lp WHERE lp.id = cge_attempts.learner_id AND (lp.user_id = (select auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.role = 'admin'))));
DROP POLICY IF EXISTS "Admin all cge_attempts" ON public.cge_attempts;
CREATE POLICY "Admin all cge_attempts" ON public.cge_attempts FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.role = 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.role = 'admin'));

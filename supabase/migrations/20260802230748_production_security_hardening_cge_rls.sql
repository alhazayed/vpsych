-- 6) CGE learner write lockdown (SELECT only; server/admin writes)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Learner own cge_attempts" ON public.cge_attempts;
CREATE POLICY "Learner select own cge_attempts" ON public.cge_attempts
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.learner_profiles lp
    WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    ))
  ));
CREATE POLICY "Admin all cge_attempts" ON public.cge_attempts
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Learner own cge_mastery_history" ON public.cge_mastery_history;
CREATE POLICY "Learner select own cge_mastery_history" ON public.cge_mastery_history
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.learner_profiles lp
    WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    ))
  ));
CREATE POLICY "Admin all cge_mastery_history" ON public.cge_mastery_history
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Learner own cge_decay" ON public.cge_decay;
CREATE POLICY "Learner select own cge_decay" ON public.cge_decay
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.learner_profiles lp
    WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    ))
  ));
CREATE POLICY "Admin all cge_decay" ON public.cge_decay
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Learner own cge_remediation_plans" ON public.cge_remediation_plans;
CREATE POLICY "Learner select own cge_remediation_plans" ON public.cge_remediation_plans
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.learner_profiles lp
    WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    ))
  ));
CREATE POLICY "Admin all cge_remediation_plans" ON public.cge_remediation_plans
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

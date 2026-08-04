-- Canonical migration recovered for Release Configuration Board reconciliation.
-- Source: production supabase_migrations.schema_migrations statements
-- (enriched only when production statements were empty/placeholder).

ALTER TABLE public.cge_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cge_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cge_graph_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cge_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cge_mastery_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cge_decay ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cge_remediation_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read cge_nodes" ON public.cge_nodes;
CREATE POLICY "Read cge_nodes" ON public.cge_nodes
  FOR SELECT TO authenticated USING (enabled = true OR EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
  ));
DROP POLICY IF EXISTS "Admin write cge_nodes" ON public.cge_nodes;
CREATE POLICY "Admin write cge_nodes" ON public.cge_nodes
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Read cge_edges" ON public.cge_edges;
CREATE POLICY "Read cge_edges" ON public.cge_edges
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin write cge_edges" ON public.cge_edges;
CREATE POLICY "Admin write cge_edges" ON public.cge_edges
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Read cge_graph_versions" ON public.cge_graph_versions;
CREATE POLICY "Read cge_graph_versions" ON public.cge_graph_versions
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin write cge_graph_versions" ON public.cge_graph_versions;
CREATE POLICY "Admin write cge_graph_versions" ON public.cge_graph_versions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Learner own cge_attempts" ON public.cge_attempts;
CREATE POLICY "Learner own cge_attempts" ON public.cge_attempts
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.learner_profiles lp
    WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    ))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.learner_profiles lp
    WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    ))
  ));

DROP POLICY IF EXISTS "Learner own cge_mastery_history" ON public.cge_mastery_history;
CREATE POLICY "Learner own cge_mastery_history" ON public.cge_mastery_history
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.learner_profiles lp
    WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    ))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.learner_profiles lp
    WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    ))
  ));

DROP POLICY IF EXISTS "Learner own cge_decay" ON public.cge_decay;
CREATE POLICY "Learner own cge_decay" ON public.cge_decay
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.learner_profiles lp
    WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    ))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.learner_profiles lp
    WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    ))
  ));

DROP POLICY IF EXISTS "Learner own cge_remediation_plans" ON public.cge_remediation_plans;
CREATE POLICY "Learner own cge_remediation_plans" ON public.cge_remediation_plans
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.learner_profiles lp
    WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    ))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.learner_profiles lp
    WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    ))
  ));

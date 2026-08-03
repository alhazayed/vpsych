-- Adaptive Learning Effectiveness storage (ALE v1.0)
CREATE TABLE IF NOT EXISTS public.adaptive_learning_effectiveness_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id text,
  learner_archetype text NOT NULL,
  overall numeric NOT NULL CHECK (overall >= 0 AND overall <= 100),
  ci_lower numeric,
  ci_upper numeric,
  ale_version text NOT NULL DEFAULT '1.0.0',
  weight_matrix_version text NOT NULL DEFAULT '1.0.0',
  adaptive_version text,
  curriculum_version text,
  competency_graph_version text,
  subscores jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  curriculum_quality_report text,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  learning_curve jsonb NOT NULL DEFAULT '[]'::jsonb,
  difficulty_curve jsonb NOT NULL DEFAULT '[]'::jsonb,
  versions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ale_scores_archetype_idx
  ON public.adaptive_learning_effectiveness_scores (learner_archetype);
CREATE INDEX IF NOT EXISTS ale_scores_created_idx
  ON public.adaptive_learning_effectiveness_scores (created_at DESC);
CREATE INDEX IF NOT EXISTS ale_scores_learner_idx
  ON public.adaptive_learning_effectiveness_scores (learner_id);

ALTER TABLE public.adaptive_learning_effectiveness_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ALE admin read" ON public.adaptive_learning_effectiveness_scores;
CREATE POLICY "ALE admin read" ON public.adaptive_learning_effectiveness_scores
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "ALE admin write" ON public.adaptive_learning_effectiveness_scores;
CREATE POLICY "ALE admin write" ON public.adaptive_learning_effectiveness_scores
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.adaptive_learning_effectiveness_scores TO authenticated;

-- Educational Reliability Index storage (ERI v1.0)
CREATE TABLE IF NOT EXISTS public.educational_reliability_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.sessions (id) ON DELETE SET NULL,
  learner_id text,
  locale text NOT NULL,
  difficulty text,
  assessment_mode text,
  overall numeric NOT NULL CHECK (overall >= 0 AND overall <= 100),
  ci_lower numeric,
  ci_upper numeric,
  eri_version text NOT NULL DEFAULT '1.0.0',
  weight_matrix_version text NOT NULL DEFAULT '1.0.0',
  assessment_version text,
  rubric_version text,
  competency_graph_version text,
  adaptive_curriculum_version text,
  prompt_version text,
  model_version text,
  subscores jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  educational_reasoning text,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  versions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS educational_reliability_scores_locale_idx
  ON public.educational_reliability_scores (locale);
CREATE INDEX IF NOT EXISTS educational_reliability_scores_difficulty_idx
  ON public.educational_reliability_scores (difficulty);
CREATE INDEX IF NOT EXISTS educational_reliability_scores_created_idx
  ON public.educational_reliability_scores (created_at DESC);
CREATE INDEX IF NOT EXISTS educational_reliability_scores_session_idx
  ON public.educational_reliability_scores (session_id);
CREATE INDEX IF NOT EXISTS educational_reliability_scores_learner_idx
  ON public.educational_reliability_scores (learner_id);

ALTER TABLE public.educational_reliability_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ERI admin read" ON public.educational_reliability_scores;
CREATE POLICY "ERI admin read" ON public.educational_reliability_scores
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "ERI admin write" ON public.educational_reliability_scores;
CREATE POLICY "ERI admin write" ON public.educational_reliability_scores
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.educational_reliability_scores TO authenticated;

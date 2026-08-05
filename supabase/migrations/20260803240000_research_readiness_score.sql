-- Research Readiness Score storage (RRS v1.0)
CREATE TABLE IF NOT EXISTS public.research_readiness_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id text NOT NULL,
  overall numeric NOT NULL CHECK (overall >= 0 AND overall <= 100),
  ci_lower numeric,
  ci_upper numeric,
  rrs_version text NOT NULL DEFAULT '1.0.0',
  weight_matrix_version text NOT NULL DEFAULT '1.0.0',
  dataset_version text,
  schema_version text,
  prompt_version text,
  model_version text,
  export_version text,
  subscores jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  publication_readiness_report text,
  dataset_quality_report text,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  version_matrix jsonb NOT NULL DEFAULT '[]'::jsonb,
  reproducibility_matrix jsonb NOT NULL DEFAULT '[]'::jsonb,
  versions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS research_readiness_scores_dataset_idx
  ON public.research_readiness_scores (dataset_id);
CREATE INDEX IF NOT EXISTS research_readiness_scores_created_idx
  ON public.research_readiness_scores (created_at DESC);

ALTER TABLE public.research_readiness_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "RRS admin read" ON public.research_readiness_scores;
CREATE POLICY "RRS admin read" ON public.research_readiness_scores
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "RRS admin write" ON public.research_readiness_scores;
CREATE POLICY "RRS admin write" ON public.research_readiness_scores
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.research_readiness_scores TO authenticated;

-- Assessment Validity Index storage (AVI v1.0)
CREATE TABLE IF NOT EXISTS public.assessment_validity_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.sessions (id) ON DELETE SET NULL,
  locale text NOT NULL,
  assessment_mode text,
  overall numeric NOT NULL CHECK (overall >= 0 AND overall <= 100),
  variance numeric,
  ci_lower numeric,
  ci_upper numeric,
  avi_version text NOT NULL DEFAULT '1.0.0',
  weight_matrix_version text NOT NULL DEFAULT '1.0.0',
  assessment_schema_version text,
  prompt_version text,
  model_version text,
  rubric_version text,
  subscores jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  validity_report text,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  versions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assessment_validity_scores_locale_idx
  ON public.assessment_validity_scores (locale);
CREATE INDEX IF NOT EXISTS assessment_validity_scores_mode_idx
  ON public.assessment_validity_scores (assessment_mode);
CREATE INDEX IF NOT EXISTS assessment_validity_scores_created_idx
  ON public.assessment_validity_scores (created_at DESC);
CREATE INDEX IF NOT EXISTS assessment_validity_scores_session_idx
  ON public.assessment_validity_scores (session_id);

ALTER TABLE public.assessment_validity_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AVI admin read" ON public.assessment_validity_scores;
CREATE POLICY "AVI admin read" ON public.assessment_validity_scores
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "AVI admin write" ON public.assessment_validity_scores;
CREATE POLICY "AVI admin write" ON public.assessment_validity_scores
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_validity_scores TO authenticated;

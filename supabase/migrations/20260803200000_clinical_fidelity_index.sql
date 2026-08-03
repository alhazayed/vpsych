-- Clinical Fidelity Index storage (CFI v1.0)
CREATE TABLE IF NOT EXISTS public.clinical_fidelity_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.sessions (id) ON DELETE SET NULL,
  case_instance_id uuid,
  assessment_id text,
  disorder_slug text NOT NULL,
  locale text NOT NULL,
  overall numeric NOT NULL CHECK (overall >= 0 AND overall <= 100),
  ci_lower numeric,
  ci_upper numeric,
  cfi_version text NOT NULL DEFAULT '1.0.0',
  weight_matrix_version text NOT NULL DEFAULT '1.0.0',
  prompt_version text,
  model_version text,
  persona_version text,
  clinical_template_version text,
  assessment_schema_version text,
  disorder_package_version text,
  subscores jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  clinical_reasoning text,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  versions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clinical_fidelity_scores_disorder_idx
  ON public.clinical_fidelity_scores (disorder_slug);
CREATE INDEX IF NOT EXISTS clinical_fidelity_scores_locale_idx
  ON public.clinical_fidelity_scores (locale);
CREATE INDEX IF NOT EXISTS clinical_fidelity_scores_created_idx
  ON public.clinical_fidelity_scores (created_at DESC);
CREATE INDEX IF NOT EXISTS clinical_fidelity_scores_session_idx
  ON public.clinical_fidelity_scores (session_id);

ALTER TABLE public.clinical_fidelity_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "CFI admin read" ON public.clinical_fidelity_scores;
CREATE POLICY "CFI admin read" ON public.clinical_fidelity_scores
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "CFI admin write" ON public.clinical_fidelity_scores;
CREATE POLICY "CFI admin write" ON public.clinical_fidelity_scores
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_fidelity_scores TO authenticated;

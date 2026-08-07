-- Parity copy: remote schema_migrations version matches this filename.
-- Canonical content also present under an earlier git timestamp; statements are idempotent.

-- Stage 8: Scientific Validation Platform (observational research tables)
-- Admin-only RLS. Validation never writes patient clinical state.

CREATE TABLE IF NOT EXISTS public.validation_runs (
  id text PRIMARY KEY,
  session_id uuid REFERENCES public.sessions (id) ON DELETE SET NULL,
  study_id text,
  realism_overall numeric NOT NULL CHECK (realism_overall >= 0 AND realism_overall <= 100),
  dsm_overall numeric NOT NULL CHECK (dsm_overall >= 0 AND dsm_overall <= 100),
  consistency_overall numeric NOT NULL CHECK (consistency_overall >= 0 AND consistency_overall <= 100),
  reliability_overall numeric CHECK (reliability_overall IS NULL OR (reliability_overall >= 0 AND reliability_overall <= 100)),
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  realism jsonb NOT NULL DEFAULT '{}'::jsonb,
  dsm jsonb NOT NULL DEFAULT '{}'::jsonb,
  consistency jsonb NOT NULL DEFAULT '{}'::jsonb,
  reliability jsonb NOT NULL DEFAULT '{}'::jsonb,
  psychometrics jsonb NOT NULL DEFAULT '[]'::jsonb,
  benchmarks jsonb NOT NULL DEFAULT '[]'::jsonb,
  longitudinal jsonb NOT NULL DEFAULT '[]'::jsonb,
  audits jsonb NOT NULL DEFAULT '[]'::jsonb,
  versions jsonb NOT NULL DEFAULT '{}'::jsonb,
  observational boolean NOT NULL DEFAULT true,
  patient_state_modified boolean NOT NULL DEFAULT false,
  validation_version text NOT NULL DEFAULT '1.0.0',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS validation_runs_session_idx
  ON public.validation_runs (session_id);
CREATE INDEX IF NOT EXISTS validation_runs_created_idx
  ON public.validation_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS validation_runs_study_idx
  ON public.validation_runs (study_id);

ALTER TABLE public.validation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "validation_runs admin read" ON public.validation_runs;
CREATE POLICY "validation_runs admin read" ON public.validation_runs
  FOR SELECT TO authenticated
  USING ((select public.is_admin()));

DROP POLICY IF EXISTS "validation_runs admin write" ON public.validation_runs;
CREATE POLICY "validation_runs admin write" ON public.validation_runs
  FOR ALL TO authenticated
  USING ((select public.is_admin()))
  WITH CHECK ((select public.is_admin()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.validation_runs TO authenticated;

CREATE TABLE IF NOT EXISTS public.validation_expert_ratings (
  id text PRIMARY KEY,
  rater_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  rater_key text NOT NULL,
  session_id uuid REFERENCES public.sessions (id) ON DELETE SET NULL,
  case_key text NOT NULL,
  domain text NOT NULL,
  score numeric NOT NULL,
  scale_max numeric NOT NULL DEFAULT 100,
  notes text,
  study_id text,
  rated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS validation_expert_ratings_case_idx
  ON public.validation_expert_ratings (case_key);
CREATE INDEX IF NOT EXISTS validation_expert_ratings_domain_idx
  ON public.validation_expert_ratings (domain);
CREATE INDEX IF NOT EXISTS validation_expert_ratings_study_idx
  ON public.validation_expert_ratings (study_id);

ALTER TABLE public.validation_expert_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "validation_ratings admin read" ON public.validation_expert_ratings;
CREATE POLICY "validation_ratings admin read" ON public.validation_expert_ratings
  FOR SELECT TO authenticated
  USING ((select public.is_admin()));

DROP POLICY IF EXISTS "validation_ratings admin write" ON public.validation_expert_ratings;
CREATE POLICY "validation_ratings admin write" ON public.validation_expert_ratings
  FOR ALL TO authenticated
  USING ((select public.is_admin()))
  WITH CHECK ((select public.is_admin()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.validation_expert_ratings TO authenticated;

CREATE TABLE IF NOT EXISTS public.validation_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS validation_audit_events_created_idx
  ON public.validation_audit_events (created_at DESC);

ALTER TABLE public.validation_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "validation_audit admin read" ON public.validation_audit_events;
CREATE POLICY "validation_audit admin read" ON public.validation_audit_events
  FOR SELECT TO authenticated
  USING ((select public.is_admin()));

DROP POLICY IF EXISTS "validation_audit admin write" ON public.validation_audit_events;
CREATE POLICY "validation_audit admin write" ON public.validation_audit_events
  FOR ALL TO authenticated
  USING ((select public.is_admin()))
  WITH CHECK ((select public.is_admin()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.validation_audit_events TO authenticated;

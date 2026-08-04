-- Canonical migration recovered for Release Configuration Board reconciliation.
-- Source: production supabase_migrations.schema_migrations statements
-- (enriched only when production statements were empty/placeholder).

DO $$ BEGIN
  CREATE TYPE public.cge_mastery_stage AS ENUM (
    'not_attempted', 'novice', 'developing', 'competent', 'proficient', 'expert'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.cge_edge_kind AS ENUM (
    'required', 'recommended', 'optional', 'depends_on'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.cge_node_difficulty AS ENUM (
    'foundation', 'intermediate', 'advanced', 'expert'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.cge_nodes (
  id text PRIMARY KEY REFERENCES public.competency_domains (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  domain text NOT NULL DEFAULT 'clinical',
  difficulty public.cge_node_difficulty NOT NULL DEFAULT 'intermediate',
  clinical_importance int NOT NULL DEFAULT 5 CHECK (clinical_importance BETWEEN 1 AND 10),
  learning_objectives jsonb NOT NULL DEFAULT '[]'::jsonb,
  assessment_methods jsonb NOT NULL DEFAULT '[]'::jsonb,
  mastery_threshold numeric NOT NULL DEFAULT 70,
  mastery_min_samples int NOT NULL DEFAULT 3,
  recommended_resources jsonb NOT NULL DEFAULT '[]'::jsonb,
  estimated_training_hours numeric NOT NULL DEFAULT 2,
  version int NOT NULL DEFAULT 1,
  enabled boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cge_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_competency_id text NOT NULL REFERENCES public.cge_nodes (id) ON DELETE CASCADE,
  to_competency_id text NOT NULL REFERENCES public.cge_nodes (id) ON DELETE CASCADE,
  edge_kind public.cge_edge_kind NOT NULL DEFAULT 'required',
  weight numeric NOT NULL DEFAULT 1,
  notes text,
  UNIQUE (from_competency_id, to_competency_id, edge_kind),
  CHECK (from_competency_id <> to_competency_id)
);

CREATE INDEX IF NOT EXISTS cge_edges_from_idx ON public.cge_edges (from_competency_id);
CREATE INDEX IF NOT EXISTS cge_edges_to_idx ON public.cge_edges (to_competency_id);

CREATE OR REPLACE VIEW public.competency_nodes
  WITH (security_invoker = true) AS
  SELECT * FROM public.cge_nodes;

CREATE OR REPLACE VIEW public.competency_edges
  WITH (security_invoker = true) AS
  SELECT * FROM public.cge_edges;

CREATE OR REPLACE VIEW public.competency_prerequisites
  WITH (security_invoker = true) AS
  SELECT
    to_competency_id AS competency_id,
    from_competency_id AS prerequisite_id,
    edge_kind,
    weight,
    notes
  FROM public.cge_edges
  WHERE edge_kind IN ('required', 'recommended', 'optional');

CREATE TABLE IF NOT EXISTS public.cge_graph_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version int NOT NULL UNIQUE,
  snapshot jsonb NOT NULL,
  change_notes text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.learner_competencies
  ADD COLUMN IF NOT EXISTS mastery_stage public.cge_mastery_stage
    NOT NULL DEFAULT 'not_attempted';
ALTER TABLE public.learner_competencies
  ADD COLUMN IF NOT EXISTS confidence numeric NOT NULL DEFAULT 50;
ALTER TABLE public.learner_competencies
  ADD COLUMN IF NOT EXISTS last_practiced_at timestamptz;
ALTER TABLE public.learner_competencies
  ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false;
ALTER TABLE public.learner_competencies
  ADD COLUMN IF NOT EXISTS instructor_approved boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.cge_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES public.learner_profiles (id) ON DELETE CASCADE,
  competency_id text NOT NULL REFERENCES public.cge_nodes (id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.sessions (id) ON DELETE SET NULL,
  score numeric NOT NULL CHECK (score >= 0 AND score <= 100),
  stage_before public.cge_mastery_stage,
  stage_after public.cge_mastery_stage,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cge_attempts_learner_comp_idx
  ON public.cge_attempts (learner_id, competency_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.cge_mastery_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES public.learner_profiles (id) ON DELETE CASCADE,
  competency_id text NOT NULL REFERENCES public.cge_nodes (id) ON DELETE CASCADE,
  from_stage public.cge_mastery_stage NOT NULL,
  to_stage public.cge_mastery_stage NOT NULL,
  score numeric,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cge_decay (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES public.learner_profiles (id) ON DELETE CASCADE,
  competency_id text NOT NULL REFERENCES public.cge_nodes (id) ON DELETE CASCADE,
  previous_confidence numeric NOT NULL,
  new_confidence numeric NOT NULL,
  days_idle int NOT NULL,
  recommended_refresher jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cge_remediation_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES public.learner_profiles (id) ON DELETE CASCADE,
  observed_failure text NOT NULL,
  root_cause_id text REFERENCES public.cge_nodes (id) ON DELETE SET NULL,
  pathway jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_cases jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'superseded', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS cge_remediation_learner_idx
  ON public.cge_remediation_plans (learner_id, status);

CREATE OR REPLACE VIEW public.remediation_plans
  WITH (security_invoker = true) AS
  SELECT * FROM public.cge_remediation_plans;

CREATE OR REPLACE VIEW public.competency_attempts
  WITH (security_invoker = true) AS
  SELECT * FROM public.cge_attempts;

CREATE OR REPLACE VIEW public.mastery_history
  WITH (security_invoker = true) AS
  SELECT * FROM public.cge_mastery_history;

CREATE OR REPLACE VIEW public.competency_decay
  WITH (security_invoker = true) AS
  SELECT * FROM public.cge_decay;

CREATE OR REPLACE VIEW public.graph_versions
  WITH (security_invoker = true) AS
  SELECT * FROM public.cge_graph_versions;

-- Restored CGE competency_domain extensions omitted from production statements
-- but present in live DB. Idempotent ON CONFLICT DO NOTHING.

INSERT INTO public.competency_domains (id, label, description, category, sort_order) VALUES
  ('clinical_communication', 'Clinical Communication', 'Foundational clinical communication', 'alliance', 5),
  ('risk_screening', 'Risk Screening', 'Initial risk screening', 'safety', 55),
  ('safety_planning', 'Safety Planning', 'Collaborative safety planning', 'safety', 75),
  ('case_formulation', 'Case Formulation', 'Integrative case formulation', 'diagnosis', 55),
  ('follow_up_planning', 'Follow-up Planning', 'Disposition and follow-up', 'treatment', 195),
  ('case_summary', 'Case Summary', 'Concise case summary', 'professional', 205),
  ('diagnostic_formulation', 'Diagnostic Formulation', 'Written diagnostic formulation', 'professional', 215),
  ('treatment_documentation', 'Treatment Documentation', 'Treatment plan documentation', 'professional', 225)
ON CONFLICT (id) DO NOTHING;

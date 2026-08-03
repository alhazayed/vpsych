-- VPsych Quality Index (VQI) v1.0 — normalized scientific metric storage

CREATE TABLE IF NOT EXISTS public.quality_metric_definitions (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  domain text NOT NULL,
  current_version text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quality_metric_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_id text NOT NULL REFERENCES public.quality_metric_definitions (id) ON DELETE CASCADE,
  version text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (metric_id, version)
);

CREATE TABLE IF NOT EXISTS public.quality_weight_sets (
  id text NOT NULL,
  version text NOT NULL,
  name text NOT NULL,
  frozen boolean NOT NULL DEFAULT false,
  algorithm_version text NOT NULL,
  entries jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, version)
);

CREATE TABLE IF NOT EXISTS public.vpsych_quality_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  overall numeric NOT NULL CHECK (overall >= 0 AND overall <= 100),
  maturity text NOT NULL,
  ci_lower numeric,
  ci_upper numeric,
  confidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  subscores jsonb NOT NULL DEFAULT '[]'::jsonb,
  missing_metrics jsonb NOT NULL DEFAULT '[]'::jsonb,
  outlier boolean NOT NULL DEFAULT false,
  scientific_interpretation text,
  strengths jsonb NOT NULL DEFAULT '[]'::jsonb,
  weaknesses jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  vqi_version text NOT NULL DEFAULT '1.0.0',
  algorithm_version text NOT NULL DEFAULT '1.0.0',
  weight_set_id text NOT NULL,
  weight_version text NOT NULL,
  metric_versions jsonb NOT NULL DEFAULT '{}'::jsonb,
  prompt_version text,
  model_version text,
  clinical_template_version text,
  persona_version text,
  competency_graph_version text,
  adaptive_curriculum_version text,
  instructor_preset_version text,
  assessment_schema_version text,
  platform_release_version text,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vqi_scores_entity_idx
  ON public.vpsych_quality_scores (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS vqi_scores_created_idx
  ON public.vpsych_quality_scores (created_at DESC);
CREATE INDEX IF NOT EXISTS vqi_scores_maturity_idx
  ON public.vpsych_quality_scores (maturity);

CREATE TABLE IF NOT EXISTS public.vqi_benchmark_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  reference numeric NOT NULL,
  current numeric NOT NULL,
  delta numeric NOT NULL,
  meaningful boolean NOT NULL DEFAULT false,
  entity_type text,
  entity_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vqi_trend_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period text NOT NULL,
  at text NOT NULL,
  mean numeric NOT NULL,
  n integer NOT NULL,
  moving_average_7 numeric,
  entity_type text,
  entity_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vqi_certificates (
  id text PRIMARY KEY,
  overall_vqi numeric NOT NULL,
  maturity text NOT NULL,
  confidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  issued_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quality_metric_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_metric_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_weight_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vpsych_quality_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vqi_benchmark_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vqi_trend_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vqi_certificates ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'quality_metric_definitions',
    'quality_metric_versions',
    'quality_weight_sets',
    'vpsych_quality_scores',
    'vqi_benchmark_snapshots',
    'vqi_trend_points',
    'vqi_certificates'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "VQI admin read %s" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "VQI admin read %s" ON public.%I FOR SELECT TO authenticated USING (public.is_admin())',
      t, t
    );
    EXECUTE format('DROP POLICY IF EXISTS "VQI admin write %s" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "VQI admin write %s" ON public.%I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())',
      t, t
    );
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated',
      t
    );
  END LOOP;
END $$;

-- Seed default metric definitions
INSERT INTO public.quality_metric_definitions (id, name, description, domain, current_version)
VALUES
  ('CFI', 'Clinical Fidelity Index', 'AI patient clinical fidelity', 'clinical', '1.0.0'),
  ('ERI', 'Educational Reliability Index', 'Assessment educational reliability', 'educational', '1.0.0'),
  ('AVI', 'Assessment Validity Index', 'Assessment validity', 'assessment', '1.0.0'),
  ('ALE', 'Adaptive Learning Effectiveness', 'Adaptive curriculum effectiveness', 'adaptive', '1.0.0'),
  ('RRS', 'Research Readiness Score', 'Research/publication readiness', 'research', '1.0.0')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.quality_weight_sets (id, version, name, frozen, algorithm_version, entries, notes)
VALUES (
  'default-v1',
  '1.0.0',
  'Default Scientific Board Weights',
  true,
  '1.0.0',
  '[
    {"metric_id":"CFI","weight":0.3,"rationale":"Clinical fidelity is the primary nosological quality anchor","required":true},
    {"metric_id":"ERI","weight":0.25,"rationale":"Educational reliability of assessments and feedback","required":true},
    {"metric_id":"AVI","weight":0.2,"rationale":"Whether assessments measure claimed competencies","required":true},
    {"metric_id":"ALE","weight":0.15,"rationale":"Adaptive curriculum selects increasingly appropriate experiences","required":false},
    {"metric_id":"RRS","weight":0.1,"rationale":"Research/publication readiness of data & provenance","required":false}
  ]'::jsonb,
  'Mission VQI default — CFI 30% / ERI 25% / AVI 20% / ALE 15% / RRS 10%'
)
ON CONFLICT (id, version) DO NOTHING;

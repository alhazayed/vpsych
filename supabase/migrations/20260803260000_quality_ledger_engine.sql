-- VPsych Quality Ledger Engine v1.0
-- Immutable scientific audit trail for every assessment.
-- NEVER UPDATE or DELETE ledger rows — corrections append a new version.
-- Depends on: quality_metric_definitions, quality_weight_sets (VQI migration).

CREATE TABLE IF NOT EXISTS public.quality_algorithms (
  id text NOT NULL,
  version text NOT NULL,
  name text NOT NULL,
  description text,
  domain text NOT NULL DEFAULT 'quality',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, version)
);

CREATE TABLE IF NOT EXISTS public.quality_ledgers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_version integer NOT NULL DEFAULT 1 CHECK (ledger_version >= 1),
  previous_ledger_id uuid REFERENCES public.quality_ledgers (id),
  supersedes_reason text,
  event_type text NOT NULL DEFAULT 'assessment_completed'
    CHECK (event_type IN (
      'assessment_completed',
      'report_generated',
      'competency_updated',
      'adaptive_curriculum_updated',
      'clinical_template_updated',
      'instructor_preset_updated',
      'ai_model_changed',
      'platform_upgraded',
      'correction'
    )),
  -- Assessment identity (scientific metadata — no free-text PHI in core columns)
  assessment_id text,
  session_id uuid,
  report_id uuid,
  learner_id uuid,
  instructor_id uuid,
  institution_id text,
  program_id text,
  clinical_template_id text,
  clinical_template_version text,
  persona_id text,
  persona_version text,
  diagnosis_slug text,
  comorbidities jsonb NOT NULL DEFAULT '[]'::jsonb,
  language text,
  locale text,
  voice_profile_id text,
  instructor_preset_id text,
  instructor_preset_version text,
  competency_graph_version text,
  adaptive_curriculum_version text,
  assessment_rubric_version text,
  prompt_version text,
  prompt_hash text,
  system_prompt_hash text,
  ai_provider text,
  ai_model text,
  ai_model_version text,
  reasoning_model text,
  fallback_used boolean NOT NULL DEFAULT false,
  fallback_reason text,
  assessment_duration_sec integer,
  conversation_turns integer,
  word_count integer,
  token_count integer,
  latency_ms integer,
  -- Master quality rollup (denormalized for analytics indexes; source of truth also in quality_scores)
  vqi numeric CHECK (vqi IS NULL OR (vqi >= 0 AND vqi <= 100)),
  cfi numeric CHECK (cfi IS NULL OR (cfi >= 0 AND cfi <= 100)),
  eri numeric CHECK (eri IS NULL OR (eri >= 0 AND eri <= 100)),
  avi numeric CHECK (avi IS NULL OR (avi >= 0 AND avi <= 100)),
  ale numeric CHECK (ale IS NULL OR (ale >= 0 AND ale <= 100)),
  rrs numeric CHECK (rrs IS NULL OR (rrs >= 0 AND rrs <= 100)),
  scientific_confidence numeric,
  educational_confidence numeric,
  clinical_confidence numeric,
  technical_confidence numeric,
  overall_confidence numeric,
  -- Version locks
  assessment_engine_version text,
  scoring_engine_version text,
  metric_algorithm_version text,
  quality_algorithm_version text NOT NULL DEFAULT '1.0.0',
  platform_release_version text,
  -- Auditability
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  git_commit_sha text,
  supabase_migration_version text,
  deployment_id text,
  vercel_deployment text,
  environment text,
  database_schema_version text,
  -- Explainability payloads
  calculation_inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  weight_matrix jsonb NOT NULL DEFAULT '[]'::jsonb,
  metric_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence_interval jsonb NOT NULL DEFAULT '{}'::jsonb,
  reasoning_summary text,
  -- Integrity
  content_hash text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT quality_ledgers_correction_link CHECK (
    (event_type <> 'correction') OR (previous_ledger_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS quality_ledgers_session_active_uidx
  ON public.quality_ledgers (session_id)
  WHERE session_id IS NOT NULL AND event_type = 'assessment_completed' AND previous_ledger_id IS NULL;

CREATE INDEX IF NOT EXISTS quality_ledgers_created_idx
  ON public.quality_ledgers (created_at DESC);
CREATE INDEX IF NOT EXISTS quality_ledgers_learner_idx
  ON public.quality_ledgers (learner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS quality_ledgers_instructor_idx
  ON public.quality_ledgers (instructor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS quality_ledgers_institution_idx
  ON public.quality_ledgers (institution_id, created_at DESC);
CREATE INDEX IF NOT EXISTS quality_ledgers_diagnosis_idx
  ON public.quality_ledgers (diagnosis_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS quality_ledgers_template_idx
  ON public.quality_ledgers (clinical_template_id, created_at DESC);
CREATE INDEX IF NOT EXISTS quality_ledgers_model_idx
  ON public.quality_ledgers (ai_model, created_at DESC);
CREATE INDEX IF NOT EXISTS quality_ledgers_release_idx
  ON public.quality_ledgers (platform_release_version, created_at DESC);
CREATE INDEX IF NOT EXISTS quality_ledgers_vqi_idx
  ON public.quality_ledgers (vqi);
CREATE INDEX IF NOT EXISTS quality_ledgers_event_idx
  ON public.quality_ledgers (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS quality_ledgers_previous_idx
  ON public.quality_ledgers (previous_ledger_id);

COMMENT ON TABLE public.quality_ledgers IS
  'Immutable Quality Ledger — permanent scientific audit trail. No UPDATE/DELETE.';

-- Per-metric score rows (normalized; FK to ledger)
CREATE TABLE IF NOT EXISTS public.quality_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_id uuid NOT NULL REFERENCES public.quality_ledgers (id) ON DELETE RESTRICT,
  metric_id text NOT NULL,
  metric_version text,
  score numeric NOT NULL CHECK (score >= 0 AND score <= 100),
  ci_lower numeric,
  ci_upper numeric,
  weight numeric,
  contribution numeric,
  confidence numeric,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  algorithm_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ledger_id, metric_id)
);

CREATE INDEX IF NOT EXISTS quality_scores_metric_idx
  ON public.quality_scores (metric_id, created_at DESC);
CREATE INDEX IF NOT EXISTS quality_scores_ledger_idx
  ON public.quality_scores (ledger_id);

CREATE TABLE IF NOT EXISTS public.quality_confidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_id uuid NOT NULL UNIQUE REFERENCES public.quality_ledgers (id) ON DELETE RESTRICT,
  overall numeric NOT NULL,
  scientific numeric NOT NULL,
  clinical numeric NOT NULL,
  educational numeric NOT NULL,
  technical numeric NOT NULL,
  institutional numeric,
  research numeric,
  interval jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quality_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_id uuid NOT NULL REFERENCES public.quality_ledgers (id) ON DELETE RESTRICT,
  snapshot_type text NOT NULL CHECK (snapshot_type IN (
    'clinical_template',
    'persona',
    'prompt',
    'rubric',
    'competency_graph',
    'adaptive_curriculum',
    'instructor_preset',
    'scoring_rules',
    'assessment_schema',
    'case_instance'
  )),
  version text,
  content_hash text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ledger_id, snapshot_type)
);

CREATE INDEX IF NOT EXISTS quality_snapshots_ledger_idx
  ON public.quality_snapshots (ledger_id);
CREATE INDEX IF NOT EXISTS quality_snapshots_type_hash_idx
  ON public.quality_snapshots (snapshot_type, content_hash);

CREATE TABLE IF NOT EXISTS public.quality_competency_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_id uuid NOT NULL UNIQUE REFERENCES public.quality_ledgers (id) ON DELETE RESTRICT,
  before_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  improvement numeric,
  regression numeric,
  mastery numeric,
  decay numeric,
  prerequisite_completion numeric,
  learning_velocity numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quality_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_id uuid REFERENCES public.quality_ledgers (id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  entity_type text,
  entity_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quality_events_created_idx
  ON public.quality_events (created_at DESC);
CREATE INDEX IF NOT EXISTS quality_events_type_idx
  ON public.quality_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS quality_events_entity_idx
  ON public.quality_events (entity_type, entity_id);

CREATE TABLE IF NOT EXISTS public.quality_trends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period text NOT NULL,
  at text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  mean_vqi numeric NOT NULL,
  n integer NOT NULL,
  moving_average numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quality_trends_entity_idx
  ON public.quality_trends (entity_type, entity_id, at);

CREATE TABLE IF NOT EXISTS public.quality_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_id uuid REFERENCES public.quality_ledgers (id) ON DELETE RESTRICT,
  label text NOT NULL,
  reference numeric NOT NULL,
  current numeric NOT NULL,
  delta numeric NOT NULL,
  meaningful boolean NOT NULL DEFAULT false,
  method text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quality_release_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_release_version text NOT NULL,
  git_commit_sha text,
  vercel_deployment text,
  notes text,
  mean_vqi numeric,
  n_assessments integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quality_ledger_access_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  ledger_id uuid,
  outcome text NOT NULL DEFAULT 'success',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quality_ledger_access_created_idx
  ON public.quality_ledger_access_audit (created_at DESC);

-- Immutability: reject UPDATE/DELETE on ledger core tables
CREATE OR REPLACE FUNCTION public.quality_ledger_reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Quality Ledger is immutable — UPDATE/DELETE forbidden on %', TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS quality_ledgers_no_update ON public.quality_ledgers;
CREATE TRIGGER quality_ledgers_no_update
  BEFORE UPDATE OR DELETE ON public.quality_ledgers
  FOR EACH ROW EXECUTE FUNCTION public.quality_ledger_reject_mutation();

DROP TRIGGER IF EXISTS quality_scores_no_update ON public.quality_scores;
CREATE TRIGGER quality_scores_no_update
  BEFORE UPDATE OR DELETE ON public.quality_scores
  FOR EACH ROW EXECUTE FUNCTION public.quality_ledger_reject_mutation();

DROP TRIGGER IF EXISTS quality_confidence_no_update ON public.quality_confidence;
CREATE TRIGGER quality_confidence_no_update
  BEFORE UPDATE OR DELETE ON public.quality_confidence
  FOR EACH ROW EXECUTE FUNCTION public.quality_ledger_reject_mutation();

DROP TRIGGER IF EXISTS quality_snapshots_no_update ON public.quality_snapshots;
CREATE TRIGGER quality_snapshots_no_update
  BEFORE UPDATE OR DELETE ON public.quality_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.quality_ledger_reject_mutation();

DROP TRIGGER IF EXISTS quality_competency_no_update ON public.quality_competency_snapshots;
CREATE TRIGGER quality_competency_no_update
  BEFORE UPDATE OR DELETE ON public.quality_competency_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.quality_ledger_reject_mutation();

-- Append-only RPC (service role / authenticated via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.append_quality_ledger(p_row jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_scores jsonb;
  v_score jsonb;
  v_snaps jsonb;
  v_snap jsonb;
  v_comp jsonb;
  v_conf jsonb;
BEGIN
  IF p_row IS NULL OR jsonb_typeof(p_row) <> 'object' THEN
    RAISE EXCEPTION 'ledger payload required';
  END IF;
  IF coalesce(p_row->>'content_hash', '') = '' THEN
    RAISE EXCEPTION 'content_hash required';
  END IF;

  INSERT INTO public.quality_ledgers (
    id, ledger_version, previous_ledger_id, supersedes_reason, event_type,
    assessment_id, session_id, report_id, learner_id, instructor_id,
    institution_id, program_id, clinical_template_id, clinical_template_version,
    persona_id, persona_version, diagnosis_slug, comorbidities, language, locale,
    voice_profile_id, instructor_preset_id, instructor_preset_version,
    competency_graph_version, adaptive_curriculum_version, assessment_rubric_version,
    prompt_version, prompt_hash, system_prompt_hash,
    ai_provider, ai_model, ai_model_version, reasoning_model,
    fallback_used, fallback_reason,
    assessment_duration_sec, conversation_turns, word_count, token_count, latency_ms,
    vqi, cfi, eri, avi, ale, rrs,
    scientific_confidence, educational_confidence, clinical_confidence,
    technical_confidence, overall_confidence,
    assessment_engine_version, scoring_engine_version, metric_algorithm_version,
    quality_algorithm_version, platform_release_version,
    created_by, git_commit_sha, supabase_migration_version, deployment_id,
    vercel_deployment, environment, database_schema_version,
    calculation_inputs, weight_matrix, metric_breakdown, evidence,
    confidence_interval, reasoning_summary, content_hash, payload
  )
  VALUES (
    coalesce((p_row->>'id')::uuid, gen_random_uuid()),
    coalesce((p_row->>'ledger_version')::integer, 1),
    nullif(p_row->>'previous_ledger_id', '')::uuid,
    p_row->>'supersedes_reason',
    coalesce(p_row->>'event_type', 'assessment_completed'),
    p_row->>'assessment_id',
    nullif(p_row->>'session_id', '')::uuid,
    nullif(p_row->>'report_id', '')::uuid,
    nullif(p_row->>'learner_id', '')::uuid,
    nullif(p_row->>'instructor_id', '')::uuid,
    p_row->>'institution_id',
    p_row->>'program_id',
    p_row->>'clinical_template_id',
    p_row->>'clinical_template_version',
    p_row->>'persona_id',
    p_row->>'persona_version',
    p_row->>'diagnosis_slug',
    coalesce(p_row->'comorbidities', '[]'::jsonb),
    p_row->>'language',
    p_row->>'locale',
    p_row->>'voice_profile_id',
    p_row->>'instructor_preset_id',
    p_row->>'instructor_preset_version',
    p_row->>'competency_graph_version',
    p_row->>'adaptive_curriculum_version',
    p_row->>'assessment_rubric_version',
    p_row->>'prompt_version',
    p_row->>'prompt_hash',
    p_row->>'system_prompt_hash',
    p_row->>'ai_provider',
    p_row->>'ai_model',
    p_row->>'ai_model_version',
    p_row->>'reasoning_model',
    coalesce((p_row->>'fallback_used')::boolean, false),
    p_row->>'fallback_reason',
    nullif(p_row->>'assessment_duration_sec', '')::integer,
    nullif(p_row->>'conversation_turns', '')::integer,
    nullif(p_row->>'word_count', '')::integer,
    nullif(p_row->>'token_count', '')::integer,
    nullif(p_row->>'latency_ms', '')::integer,
    nullif(p_row->>'vqi', '')::numeric,
    nullif(p_row->>'cfi', '')::numeric,
    nullif(p_row->>'eri', '')::numeric,
    nullif(p_row->>'avi', '')::numeric,
    nullif(p_row->>'ale', '')::numeric,
    nullif(p_row->>'rrs', '')::numeric,
    nullif(p_row->>'scientific_confidence', '')::numeric,
    nullif(p_row->>'educational_confidence', '')::numeric,
    nullif(p_row->>'clinical_confidence', '')::numeric,
    nullif(p_row->>'technical_confidence', '')::numeric,
    nullif(p_row->>'overall_confidence', '')::numeric,
    p_row->>'assessment_engine_version',
    p_row->>'scoring_engine_version',
    p_row->>'metric_algorithm_version',
    coalesce(p_row->>'quality_algorithm_version', '1.0.0'),
    p_row->>'platform_release_version',
    coalesce(nullif(p_row->>'created_by', '')::uuid, auth.uid()),
    p_row->>'git_commit_sha',
    p_row->>'supabase_migration_version',
    p_row->>'deployment_id',
    p_row->>'vercel_deployment',
    p_row->>'environment',
    p_row->>'database_schema_version',
    coalesce(p_row->'calculation_inputs', '{}'::jsonb),
    coalesce(p_row->'weight_matrix', '[]'::jsonb),
    coalesce(p_row->'metric_breakdown', '[]'::jsonb),
    coalesce(p_row->'evidence', '{}'::jsonb),
    coalesce(p_row->'confidence_interval', '{}'::jsonb),
    p_row->>'reasoning_summary',
    p_row->>'content_hash',
    coalesce(p_row->'payload', '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  v_scores := coalesce(p_row->'scores', '[]'::jsonb);
  FOR v_score IN SELECT * FROM jsonb_array_elements(v_scores)
  LOOP
    INSERT INTO public.quality_scores (
      ledger_id, metric_id, metric_version, score, ci_lower, ci_upper,
      weight, contribution, confidence, evidence, breakdown, algorithm_version
    ) VALUES (
      v_id,
      v_score->>'metric_id',
      v_score->>'metric_version',
      (v_score->>'score')::numeric,
      nullif(v_score->>'ci_lower', '')::numeric,
      nullif(v_score->>'ci_upper', '')::numeric,
      nullif(v_score->>'weight', '')::numeric,
      nullif(v_score->>'contribution', '')::numeric,
      nullif(v_score->>'confidence', '')::numeric,
      coalesce(v_score->'evidence', '{}'::jsonb),
      coalesce(v_score->'breakdown', '[]'::jsonb),
      v_score->>'algorithm_version'
    );
  END LOOP;

  v_conf := p_row->'confidence';
  IF v_conf IS NOT NULL AND jsonb_typeof(v_conf) = 'object' THEN
    INSERT INTO public.quality_confidence (
      ledger_id, overall, scientific, clinical, educational, technical,
      institutional, research, interval
    ) VALUES (
      v_id,
      coalesce((v_conf->>'overall')::numeric, 0),
      coalesce((v_conf->>'scientific')::numeric, 0),
      coalesce((v_conf->>'clinical')::numeric, 0),
      coalesce((v_conf->>'educational')::numeric, 0),
      coalesce((v_conf->>'technical')::numeric, 0),
      nullif(v_conf->>'institutional', '')::numeric,
      nullif(v_conf->>'research', '')::numeric,
      coalesce(v_conf->'interval', '{}'::jsonb)
    );
  END IF;

  v_snaps := coalesce(p_row->'snapshots', '[]'::jsonb);
  FOR v_snap IN SELECT * FROM jsonb_array_elements(v_snaps)
  LOOP
    INSERT INTO public.quality_snapshots (
      ledger_id, snapshot_type, version, content_hash, payload
    ) VALUES (
      v_id,
      v_snap->>'snapshot_type',
      v_snap->>'version',
      v_snap->>'content_hash',
      coalesce(v_snap->'payload', '{}'::jsonb)
    );
  END LOOP;

  v_comp := p_row->'competency';
  IF v_comp IS NOT NULL AND jsonb_typeof(v_comp) = 'object' THEN
    INSERT INTO public.quality_competency_snapshots (
      ledger_id, before_state, after_state, improvement, regression,
      mastery, decay, prerequisite_completion, learning_velocity
    ) VALUES (
      v_id,
      coalesce(v_comp->'before_state', '{}'::jsonb),
      coalesce(v_comp->'after_state', '{}'::jsonb),
      nullif(v_comp->>'improvement', '')::numeric,
      nullif(v_comp->>'regression', '')::numeric,
      nullif(v_comp->>'mastery', '')::numeric,
      nullif(v_comp->>'decay', '')::numeric,
      nullif(v_comp->>'prerequisite_completion', '')::numeric,
      nullif(v_comp->>'learning_velocity', '')::numeric
    );
  END IF;

  INSERT INTO public.quality_events (ledger_id, event_type, entity_type, entity_id, payload)
  VALUES (
    v_id,
    coalesce(p_row->>'event_type', 'assessment_completed'),
    'session',
    p_row->>'session_id',
    jsonb_build_object('ledger_id', v_id, 'content_hash', p_row->>'content_hash')
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.append_quality_ledger(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.append_quality_ledger(jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.log_quality_ledger_access(
  p_action text,
  p_ledger_id uuid DEFAULT NULL,
  p_outcome text DEFAULT 'success',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.quality_ledger_access_audit (actor_id, action, ledger_id, outcome, metadata)
  VALUES (auth.uid(), trim(p_action), p_ledger_id, coalesce(p_outcome, 'success'), coalesce(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_quality_ledger_access(text, uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_quality_ledger_access(text, uuid, text, jsonb) TO authenticated, service_role;

-- RLS: admin read; no direct client writes (use RPC)
ALTER TABLE public.quality_algorithms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_confidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_competency_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_release_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_ledger_access_audit ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'quality_algorithms',
    'quality_ledgers',
    'quality_scores',
    'quality_confidence',
    'quality_snapshots',
    'quality_competency_snapshots',
    'quality_events',
    'quality_trends',
    'quality_benchmarks',
    'quality_release_history',
    'quality_ledger_access_audit'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "QL admin read %s" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "QL admin read %s" ON public.%I FOR SELECT TO authenticated USING (public.is_admin())',
      t, t
    );
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
  END LOOP;
END $$;

-- Learners may see their own ledger headers (scientific metadata only; no snapshot PHI dumps via this policy path for nested tables)
DROP POLICY IF EXISTS "QL learner read own ledgers" ON public.quality_ledgers;
CREATE POLICY "QL learner read own ledgers"
  ON public.quality_ledgers FOR SELECT TO authenticated
  USING (learner_id = auth.uid() OR instructor_id = auth.uid() OR public.is_admin());

-- Seed algorithm registry
INSERT INTO public.quality_algorithms (id, version, name, description, domain)
VALUES
  ('quality-ledger', '1.0.0', 'Quality Ledger Engine', 'Immutable scientific audit trail', 'ledger'),
  ('vqi', '1.0.0', 'VPsych Quality Index', 'Master hierarchical composite', 'quality'),
  ('cfi', '1.0.0', 'Clinical Fidelity Index', 'Nosological fidelity', 'clinical'),
  ('eri', '1.0.0', 'Educational Reliability Index', 'Educational reliability', 'educational'),
  ('avi', '1.0.0', 'Assessment Validity Index', 'Assessment validity', 'assessment'),
  ('ale', '1.0.0', 'Adaptive Learning Effectiveness', 'Adaptive curriculum effectiveness', 'adaptive'),
  ('rrs', '1.0.0', 'Research Readiness Score', 'Research/publication readiness', 'research')
ON CONFLICT DO NOTHING;

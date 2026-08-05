-- VPsych Enterprise Multi-Ledger Platform v1.0
-- Three complementary ledgers: operational · education · quality
-- Shared correlation + integrity infrastructure.
-- Depends on: quality_ledgers (Scientific Quality Ledger Layer 3)

CREATE SCHEMA IF NOT EXISTS operational;
CREATE SCHEMA IF NOT EXISTS education;
CREATE SCHEMA IF NOT EXISTS quality;
CREATE SCHEMA IF NOT EXISTS ledger;

GRANT USAGE ON SCHEMA operational TO authenticated, service_role;
GRANT USAGE ON SCHEMA education TO authenticated, service_role;
GRANT USAGE ON SCHEMA quality TO authenticated, service_role;
GRANT USAGE ON SCHEMA ledger TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Shared: correlation graph + integrity seals
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ledger.correlations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id text NOT NULL UNIQUE,
  assessment_id text,
  session_id uuid,
  learner_id uuid,
  instructor_id uuid,
  institution_id text,
  program_id text,
  clinical_template_id text,
  persona_id text,
  release_id text,
  deployment_id text,
  ai_model_id text,
  prompt_version_id text,
  operational_event_id uuid,
  educational_event_id uuid,
  scientific_ledger_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ledger_corr_session_idx ON ledger.correlations (session_id);
CREATE INDEX IF NOT EXISTS ledger_corr_learner_idx ON ledger.correlations (learner_id);
CREATE INDEX IF NOT EXISTS ledger_corr_assessment_idx ON ledger.correlations (assessment_id);
CREATE INDEX IF NOT EXISTS ledger_corr_created_idx ON ledger.correlations (created_at DESC);

CREATE TABLE IF NOT EXISTS ledger.integrity_seals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_layer text NOT NULL CHECK (ledger_layer IN ('operational', 'education', 'quality')),
  record_id uuid NOT NULL,
  content_hash text NOT NULL,
  algorithm text NOT NULL DEFAULT 'sha256',
  sealed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ledger_layer, record_id)
);

CREATE TABLE IF NOT EXISTS ledger.schema_versions (
  layer text NOT NULL,
  version text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (layer, version)
);

INSERT INTO ledger.schema_versions (layer, version, notes) VALUES
  ('operational', '1.0.0', 'Operational Ledger v1'),
  ('education', '1.0.0', 'Educational Ledger v1'),
  ('quality', '1.0.0', 'Scientific Quality Ledger v1 (maps quality_ledgers)'),
  ('multi-ledger', '1.0.0', 'Enterprise Multi-Ledger Platform')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Layer 1: Operational Ledger
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS operational.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  correlation_id text,
  event_type text NOT NULL,
  category text NOT NULL DEFAULT 'system'
    CHECK (category IN (
      'auth', 'authorization', 'deployment', 'infrastructure', 'security',
      'api', 'runtime', 'ai', 'voice', 'database', 'jobs', 'admin', 'feature_flag', 'other'
    )),
  severity text NOT NULL DEFAULT 'info'
    CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),
  actor_id uuid,
  actor_role text,
  ip text,
  user_agent text,
  request_id text,
  deployment_id text,
  git_commit_sha text,
  environment text,
  resource_type text,
  resource_id text,
  outcome text NOT NULL DEFAULT 'success'
    CHECK (outcome IN ('success', 'failure', 'denied', 'partial')),
  latency_ms integer,
  error_classification text,
  previous_value jsonb,
  new_value jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_hash text NOT NULL,
  schema_version text NOT NULL DEFAULT '1.0.0',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS op_events_created_idx ON operational.events (created_at DESC);
CREATE INDEX IF NOT EXISTS op_events_type_idx ON operational.events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS op_events_category_idx ON operational.events (category, created_at DESC);
CREATE INDEX IF NOT EXISTS op_events_severity_idx ON operational.events (severity, created_at DESC);
CREATE INDEX IF NOT EXISTS op_events_corr_idx ON operational.events (correlation_id);
CREATE INDEX IF NOT EXISTS op_events_actor_idx ON operational.events (actor_id);

COMMENT ON TABLE operational.events IS
  'Operational Ledger — technical/security/infrastructure audit trail (immutable)';

-- ---------------------------------------------------------------------------
-- Layer 2: Educational Ledger
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS education.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  correlation_id text,
  event_type text NOT NULL
    CHECK (event_type IN (
      'assessment_started',
      'assessment_completed',
      'competency_updated',
      'instructor_feedback',
      'reflection_submitted',
      'clinical_template_used',
      'instructor_preset_used',
      'adaptive_decision',
      'learning_recommendation',
      'difficulty_progression',
      'learning_objective_achieved',
      'competency_unlocked',
      'prerequisite_completed',
      'osce_simulation',
      'learning_milestone'
    )),
  learner_id uuid,
  instructor_id uuid,
  institution_id text,
  program_id text,
  cohort_id text,
  assessment_id text,
  session_id uuid,
  clinical_template_id text,
  instructor_preset_id text,
  persona_id text,
  diagnosis_slug text,
  difficulty text,
  learning_path jsonb NOT NULL DEFAULT '[]'::jsonb,
  objectives jsonb NOT NULL DEFAULT '[]'::jsonb,
  competencies_before jsonb NOT NULL DEFAULT '{}'::jsonb,
  competencies_after jsonb NOT NULL DEFAULT '{}'::jsonb,
  adaptive_decision jsonb NOT NULL DEFAULT '{}'::jsonb,
  duration_sec integer,
  outcome text,
  language text,
  locale text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_hash text NOT NULL,
  schema_version text NOT NULL DEFAULT '1.0.0',
  platform_release_version text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS edu_events_created_idx ON education.events (created_at DESC);
CREATE INDEX IF NOT EXISTS edu_events_learner_idx ON education.events (learner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS edu_events_session_idx ON education.events (session_id);
CREATE INDEX IF NOT EXISTS edu_events_type_idx ON education.events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS edu_events_institution_idx ON education.events (institution_id, created_at DESC);
CREATE INDEX IF NOT EXISTS edu_events_corr_idx ON education.events (correlation_id);

COMMENT ON TABLE education.events IS
  'Educational Ledger — complete learner interaction history (immutable)';

-- ---------------------------------------------------------------------------
-- Layer 3: Scientific Quality — view over existing quality_ledgers + registry
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW quality.scientific_ledgers
WITH (security_invoker = true)
AS
SELECT
  id,
  session_id,
  learner_id,
  instructor_id,
  institution_id,
  program_id,
  assessment_id,
  clinical_template_id,
  persona_id,
  diagnosis_slug,
  language,
  locale,
  ai_model,
  ai_model_version,
  prompt_version,
  vqi, cfi, eri, avi, ale, rrs,
  scientific_confidence,
  educational_confidence,
  clinical_confidence,
  technical_confidence,
  overall_confidence,
  confidence_interval,
  weight_matrix,
  metric_breakdown,
  evidence,
  reasoning_summary,
  quality_algorithm_version,
  platform_release_version,
  content_hash,
  event_type,
  previous_ledger_id,
  created_at,
  git_commit_sha,
  supabase_migration_version,
  deployment_id,
  environment
FROM public.quality_ledgers;

COMMENT ON VIEW quality.scientific_ledgers IS
  'Scientific Quality Ledger Layer 3 — invoker-secure view over immutable quality_ledgers';

CREATE TABLE IF NOT EXISTS quality.export_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  export_type text NOT NULL,
  actor_id uuid,
  institution_id text,
  n_records integer,
  content_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- Immutability triggers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION ledger.reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Ledger is immutable — UPDATE/DELETE forbidden on %.%', TG_TABLE_SCHEMA, TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS operational_events_no_update ON operational.events;
CREATE TRIGGER operational_events_no_update
  BEFORE UPDATE OR DELETE ON operational.events
  FOR EACH ROW EXECUTE FUNCTION ledger.reject_mutation();

DROP TRIGGER IF EXISTS education_events_no_update ON education.events;
CREATE TRIGGER education_events_no_update
  BEFORE UPDATE OR DELETE ON education.events
  FOR EACH ROW EXECUTE FUNCTION ledger.reject_mutation();

DROP TRIGGER IF EXISTS ledger_corr_no_update ON ledger.correlations;
CREATE TRIGGER ledger_corr_no_update
  BEFORE UPDATE OR DELETE ON ledger.correlations
  FOR EACH ROW EXECUTE FUNCTION ledger.reject_mutation();

DROP TRIGGER IF EXISTS ledger_seals_no_update ON ledger.integrity_seals;
CREATE TRIGGER ledger_seals_no_update
  BEFORE UPDATE OR DELETE ON ledger.integrity_seals
  FOR EACH ROW EXECUTE FUNCTION ledger.reject_mutation();

-- ---------------------------------------------------------------------------
-- RPCs (public schema for supabase-js convenience)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.append_operational_event(p_row jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'operational', 'ledger', 'public'
AS $$
DECLARE
  v_id uuid;
  v_event_id text;
BEGIN
  IF p_row IS NULL OR coalesce(p_row->>'content_hash', '') = '' THEN
    RAISE EXCEPTION 'operational event requires content_hash';
  END IF;
  v_event_id := coalesce(nullif(p_row->>'event_id', ''), 'op_' || replace(gen_random_uuid()::text, '-', ''));

  INSERT INTO operational.events (
    id, event_id, correlation_id, event_type, category, severity,
    actor_id, actor_role, ip, user_agent, request_id, deployment_id,
    git_commit_sha, environment, resource_type, resource_id, outcome,
    latency_ms, error_classification, previous_value, new_value, payload,
    content_hash, schema_version
  ) VALUES (
    coalesce((p_row->>'id')::uuid, gen_random_uuid()),
    v_event_id,
    p_row->>'correlation_id',
    p_row->>'event_type',
    coalesce(p_row->>'category', 'system'),
    coalesce(p_row->>'severity', 'info'),
    coalesce(nullif(p_row->>'actor_id', '')::uuid, auth.uid()),
    p_row->>'actor_role',
    p_row->>'ip',
    p_row->>'user_agent',
    p_row->>'request_id',
    p_row->>'deployment_id',
    p_row->>'git_commit_sha',
    p_row->>'environment',
    p_row->>'resource_type',
    p_row->>'resource_id',
    coalesce(p_row->>'outcome', 'success'),
    nullif(p_row->>'latency_ms', '')::integer,
    p_row->>'error_classification',
    p_row->'previous_value',
    p_row->'new_value',
    coalesce(p_row->'payload', '{}'::jsonb),
    p_row->>'content_hash',
    coalesce(p_row->>'schema_version', '1.0.0')
  )
  RETURNING id INTO v_id;

  INSERT INTO ledger.integrity_seals (ledger_layer, record_id, content_hash)
  VALUES ('operational', v_id, p_row->>'content_hash')
  ON CONFLICT DO NOTHING;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.append_educational_event(p_row jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'education', 'ledger', 'public'
AS $$
DECLARE
  v_id uuid;
  v_event_id text;
BEGIN
  IF p_row IS NULL OR coalesce(p_row->>'content_hash', '') = '' THEN
    RAISE EXCEPTION 'educational event requires content_hash';
  END IF;
  v_event_id := coalesce(nullif(p_row->>'event_id', ''), 'edu_' || replace(gen_random_uuid()::text, '-', ''));

  INSERT INTO education.events (
    id, event_id, correlation_id, event_type,
    learner_id, instructor_id, institution_id, program_id, cohort_id,
    assessment_id, session_id, clinical_template_id, instructor_preset_id,
    persona_id, diagnosis_slug, difficulty, learning_path, objectives,
    competencies_before, competencies_after, adaptive_decision,
    duration_sec, outcome, language, locale, payload,
    content_hash, schema_version, platform_release_version
  ) VALUES (
    coalesce((p_row->>'id')::uuid, gen_random_uuid()),
    v_event_id,
    p_row->>'correlation_id',
    p_row->>'event_type',
    coalesce(nullif(p_row->>'learner_id', '')::uuid, auth.uid()),
    nullif(p_row->>'instructor_id', '')::uuid,
    p_row->>'institution_id',
    p_row->>'program_id',
    p_row->>'cohort_id',
    p_row->>'assessment_id',
    nullif(p_row->>'session_id', '')::uuid,
    p_row->>'clinical_template_id',
    p_row->>'instructor_preset_id',
    p_row->>'persona_id',
    p_row->>'diagnosis_slug',
    p_row->>'difficulty',
    coalesce(p_row->'learning_path', '[]'::jsonb),
    coalesce(p_row->'objectives', '[]'::jsonb),
    coalesce(p_row->'competencies_before', '{}'::jsonb),
    coalesce(p_row->'competencies_after', '{}'::jsonb),
    coalesce(p_row->'adaptive_decision', '{}'::jsonb),
    nullif(p_row->>'duration_sec', '')::integer,
    p_row->>'outcome',
    p_row->>'language',
    p_row->>'locale',
    coalesce(p_row->'payload', '{}'::jsonb),
    p_row->>'content_hash',
    coalesce(p_row->>'schema_version', '1.0.0'),
    p_row->>'platform_release_version'
  )
  RETURNING id INTO v_id;

  INSERT INTO ledger.integrity_seals (ledger_layer, record_id, content_hash)
  VALUES ('education', v_id, p_row->>'content_hash')
  ON CONFLICT DO NOTHING;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.link_ledger_correlation(p_row jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'ledger', 'public'
AS $$
DECLARE
  v_id uuid;
  v_corr text;
BEGIN
  v_corr := coalesce(nullif(p_row->>'correlation_id', ''), 'corr_' || replace(gen_random_uuid()::text, '-', ''));
  INSERT INTO ledger.correlations (
    correlation_id, assessment_id, session_id, learner_id, instructor_id,
    institution_id, program_id, clinical_template_id, persona_id, release_id,
    deployment_id, ai_model_id, prompt_version_id,
    operational_event_id, educational_event_id, scientific_ledger_id, metadata
  ) VALUES (
    v_corr,
    p_row->>'assessment_id',
    nullif(p_row->>'session_id', '')::uuid,
    nullif(p_row->>'learner_id', '')::uuid,
    nullif(p_row->>'instructor_id', '')::uuid,
    p_row->>'institution_id',
    p_row->>'program_id',
    p_row->>'clinical_template_id',
    p_row->>'persona_id',
    p_row->>'release_id',
    p_row->>'deployment_id',
    p_row->>'ai_model_id',
    p_row->>'prompt_version_id',
    nullif(p_row->>'operational_event_id', '')::uuid,
    nullif(p_row->>'educational_event_id', '')::uuid,
    nullif(p_row->>'scientific_ledger_id', '')::uuid,
    coalesce(p_row->'metadata', '{}'::jsonb)
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.append_operational_event(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.append_educational_event(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.link_ledger_correlation(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.append_operational_event(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.append_educational_event(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.link_ledger_correlation(jsonb) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE operational.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE education.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger.correlations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger.integrity_seals ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger.schema_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality.export_registry ENABLE ROW LEVEL SECURITY;

-- Operational: admins only
DROP POLICY IF EXISTS "op admin read" ON operational.events;
CREATE POLICY "op admin read" ON operational.events
  FOR SELECT TO authenticated USING (public.is_admin());

-- Education: learner own + instructor + admin
DROP POLICY IF EXISTS "edu learner read" ON education.events;
CREATE POLICY "edu learner read" ON education.events
  FOR SELECT TO authenticated
  USING (
    learner_id = auth.uid()
    OR instructor_id = auth.uid()
    OR public.is_admin()
  );

-- Correlations: admin or participant
DROP POLICY IF EXISTS "corr read" ON ledger.correlations;
CREATE POLICY "corr read" ON ledger.correlations
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR learner_id = auth.uid()
    OR instructor_id = auth.uid()
  );

DROP POLICY IF EXISTS "seals admin read" ON ledger.integrity_seals;
CREATE POLICY "seals admin read" ON ledger.integrity_seals
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "schema versions read" ON ledger.schema_versions;
CREATE POLICY "schema versions read" ON ledger.schema_versions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "export registry admin" ON quality.export_registry;
CREATE POLICY "export registry admin" ON quality.export_registry
  FOR SELECT TO authenticated USING (public.is_admin());

GRANT SELECT ON operational.events TO authenticated, service_role;
GRANT SELECT ON education.events TO authenticated, service_role;
GRANT SELECT ON ledger.correlations TO authenticated, service_role;
GRANT SELECT ON ledger.integrity_seals TO authenticated, service_role;
GRANT SELECT ON ledger.schema_versions TO authenticated, service_role;
GRANT SELECT ON quality.scientific_ledgers TO authenticated, service_role;
GRANT SELECT ON quality.export_registry TO authenticated, service_role;

-- Public convenience views (for clients that only use public schema)
CREATE OR REPLACE VIEW public.operational_ledger_events
WITH (security_invoker = true)
AS SELECT * FROM operational.events;

CREATE OR REPLACE VIEW public.educational_ledger_events
WITH (security_invoker = true)
AS SELECT * FROM education.events;

CREATE OR REPLACE VIEW public.ledger_correlations
WITH (security_invoker = true)
AS SELECT * FROM ledger.correlations;

GRANT SELECT ON public.operational_ledger_events TO authenticated, service_role;
GRANT SELECT ON public.educational_ledger_events TO authenticated, service_role;
GRANT SELECT ON public.ledger_correlations TO authenticated, service_role;

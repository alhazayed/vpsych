-- Educational Opportunity Intelligence (EOI)
-- Separate from CQI defect flags — teaching ideas are assets, never bugs.

CREATE TABLE IF NOT EXISTS public.eoi_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reviewer_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  anonymous boolean NOT NULL DEFAULT false,
  session_id uuid REFERENCES public.sessions (id) ON DELETE SET NULL,
  case_instance_id uuid NULL,
  avatar_id uuid NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Classification
  opportunity_type text NOT NULL
    CHECK (opportunity_type IN (
      'teaching_enhancement',
      'clinical_realism',
      'conversation_improvement',
      'therapeutic_alliance',
      'assessment_improvement',
      'supervisor_feedback',
      'adaptive_learning',
      'scenario_variation',
      'osce_improvement',
      'competency_mapping',
      'reflection_opportunity',
      'communication_skills',
      'professionalism',
      'ethics',
      'cultural_competence',
      'patient_safety',
      'shared_decision_making',
      'evidence_based_practice',
      'other'
    )),
  educational_impact integer NOT NULL DEFAULT 3
    CHECK (educational_impact BETWEEN 1 AND 5),
  target_learners text[] NOT NULL DEFAULT '{}',
  competencies text[] NOT NULL DEFAULT '{}',
  -- Narrative (asset, not defect)
  idea_text text NOT NULL DEFAULT '',
  idea_text_enc jsonb NULL,
  design_sketch text,
  expected_learning_experience text,
  annotations jsonb NOT NULL DEFAULT '[]'::jsonb,
  transcript_window jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Workflow — never uses defect statuses
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN (
      'open',
      'under_review',
      'accepted',
      'scheduled',
      'implemented',
      'validated',
      'published',
      'declined'
    )),
  cluster_id uuid NULL,
  fingerprint text NOT NULL DEFAULT '',
  platform_version text,
  release_version text,
  prompt_version text,
  language text,
  disorder_slug text,
  difficulty text,
  analyst jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_hash text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS eoi_opportunities_created_at_idx
  ON public.eoi_opportunities (created_at DESC);
CREATE INDEX IF NOT EXISTS eoi_opportunities_type_idx
  ON public.eoi_opportunities (opportunity_type);
CREATE INDEX IF NOT EXISTS eoi_opportunities_status_idx
  ON public.eoi_opportunities (status);
CREATE INDEX IF NOT EXISTS eoi_opportunities_impact_idx
  ON public.eoi_opportunities (educational_impact DESC);
CREATE INDEX IF NOT EXISTS eoi_opportunities_fingerprint_idx
  ON public.eoi_opportunities (fingerprint);
CREATE INDEX IF NOT EXISTS eoi_opportunities_disorder_idx
  ON public.eoi_opportunities (disorder_slug);
CREATE INDEX IF NOT EXISTS eoi_opportunities_session_id_idx
  ON public.eoi_opportunities (session_id);

COMMENT ON TABLE public.eoi_opportunities IS
  'EOI vault — educational opportunity assets (never defect reports)';

CREATE TABLE IF NOT EXISTS public.eoi_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  opportunity_type text,
  report_count integer NOT NULL DEFAULT 0,
  confidence_pct numeric(5,2) NOT NULL DEFAULT 0,
  fingerprint text NOT NULL UNIQUE,
  educational_impact_avg numeric(3,2) NOT NULL DEFAULT 0,
  expected_benefit text,
  target_learners text[] NOT NULL DEFAULT '{}',
  competencies text[] NOT NULL DEFAULT '{}',
  affected_disorders text[] NOT NULL DEFAULT '{}',
  affected_languages text[] NOT NULL DEFAULT '{}',
  affected_curriculum text[] NOT NULL DEFAULT '{}',
  difficulty_level text,
  educational_rationale text,
  learner_benefit text,
  research_value text,
  effort_estimate text
    CHECK (effort_estimate IS NULL OR effort_estimate IN ('xs', 's', 'm', 'l', 'xl')),
  educational_priority text
    CHECK (educational_priority IS NULL OR educational_priority IN ('p0', 'p1', 'p2', 'p3')),
  strategic_value text,
  backlog_score numeric(8,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN (
      'open', 'under_review', 'accepted', 'scheduled',
      'implemented', 'validated', 'published', 'declined'
    )),
  analyst jsonb NOT NULL DEFAULT '{}'::jsonb,
  recommendation jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS eoi_clusters_backlog_idx
  ON public.eoi_clusters (backlog_score DESC);
CREATE INDEX IF NOT EXISTS eoi_clusters_status_idx
  ON public.eoi_clusters (status);

ALTER TABLE public.eoi_opportunities
  DROP CONSTRAINT IF EXISTS eoi_opportunities_cluster_id_fkey;
ALTER TABLE public.eoi_opportunities
  ADD CONSTRAINT eoi_opportunities_cluster_id_fkey
  FOREIGN KEY (cluster_id) REFERENCES public.eoi_clusters (id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.eoi_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  opportunity_id uuid NOT NULL REFERENCES public.eoi_opportunities (id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  kind text NOT NULL
    CHECK (kind IN ('screenshot', 'screen_recording', 'audio', 'pdf', 'image', 'drawing', 'other')),
  storage_path text NOT NULL,
  mime_type text,
  byte_size integer,
  transcript text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS eoi_attachments_opportunity_id_idx
  ON public.eoi_attachments (opportunity_id);

-- RLS
ALTER TABLE public.eoi_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eoi_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eoi_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY eoi_opp_select_own_or_admin
  ON public.eoi_opportunities FOR SELECT
  TO authenticated
  USING (
    (select public.is_admin())
    OR reviewer_id = (select auth.uid())
  );

CREATE POLICY eoi_clusters_admin_select
  ON public.eoi_clusters FOR SELECT
  TO authenticated
  USING ((select public.is_admin()));

CREATE POLICY eoi_clusters_admin_insert
  ON public.eoi_clusters FOR INSERT
  TO authenticated
  WITH CHECK ((select public.is_admin()));

CREATE POLICY eoi_clusters_admin_update
  ON public.eoi_clusters FOR UPDATE
  TO authenticated
  USING ((select public.is_admin()))
  WITH CHECK ((select public.is_admin()));

CREATE POLICY eoi_att_select
  ON public.eoi_attachments FOR SELECT
  TO authenticated
  USING (
    (select public.is_admin())
    OR reviewer_id = (select auth.uid())
  );

CREATE POLICY eoi_att_insert
  ON public.eoi_attachments FOR INSERT
  TO authenticated
  WITH CHECK (reviewer_id = (select auth.uid()));

CREATE OR REPLACE FUNCTION public.eoi_submit_opportunity(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_actor uuid := auth.uid();
  v_anon boolean := coalesce((p_payload->>'anonymous')::boolean, false);
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO public.eoi_opportunities (
    reviewer_id, anonymous, session_id, case_instance_id, avatar_id,
    context, opportunity_type, educational_impact, target_learners, competencies,
    idea_text, idea_text_enc, design_sketch, expected_learning_experience,
    annotations, transcript_window, evidence, fingerprint,
    platform_version, release_version, prompt_version, language,
    disorder_slug, difficulty, content_hash
  ) VALUES (
    CASE WHEN v_anon THEN NULL ELSE v_actor END,
    v_anon,
    nullif(p_payload->>'session_id', '')::uuid,
    nullif(p_payload->>'case_instance_id', '')::uuid,
    nullif(p_payload->>'avatar_id', '')::uuid,
    coalesce(p_payload->'context', '{}'::jsonb),
    p_payload->>'opportunity_type',
    coalesce((p_payload->>'educational_impact')::integer, 3),
    coalesce(
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_payload->'target_learners', '[]'::jsonb))),
      '{}'::text[]
    ),
    coalesce(
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_payload->'competencies', '[]'::jsonb))),
      '{}'::text[]
    ),
    coalesce(p_payload->>'idea_text', ''),
    p_payload->'idea_text_enc',
    p_payload->>'design_sketch',
    p_payload->>'expected_learning_experience',
    coalesce(p_payload->'annotations', '[]'::jsonb),
    coalesce(p_payload->'transcript_window', '[]'::jsonb),
    coalesce(p_payload->'evidence', '{}'::jsonb),
    coalesce(p_payload->>'fingerprint', ''),
    p_payload->>'platform_version',
    p_payload->>'release_version',
    p_payload->>'prompt_version',
    p_payload->>'language',
    p_payload->>'disorder_slug',
    p_payload->>'difficulty',
    coalesce(p_payload->>'content_hash', '')
  )
  RETURNING id INTO v_id;

  PERFORM public.log_security_event(
    'eoi.opportunity.submit',
    'success',
    'eoi_opportunity',
    v_id::text,
    NULL,
    NULL,
    jsonb_build_object(
      'anonymous', v_anon,
      'opportunity_type', p_payload->>'opportunity_type',
      'educational_impact', p_payload->>'educational_impact',
      'session_id', p_payload->>'session_id'
    )
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.eoi_submit_opportunity(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eoi_submit_opportunity(jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.eoi_update_status(
  p_id uuid,
  p_status text,
  p_cluster_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin required';
  END IF;
  IF p_status NOT IN (
    'open', 'under_review', 'accepted', 'scheduled',
    'implemented', 'validated', 'published', 'declined'
  ) THEN
    RAISE EXCEPTION 'invalid eoi status';
  END IF;

  UPDATE public.eoi_opportunities
  SET
    status = p_status,
    cluster_id = coalesce(p_cluster_id, cluster_id),
    updated_at = now()
  WHERE id = p_id;

  PERFORM public.log_security_event(
    'eoi.opportunity.status',
    'success',
    'eoi_opportunity',
    p_id::text,
    NULL,
    NULL,
    jsonb_build_object('status', p_status, 'cluster_id', p_cluster_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.eoi_update_status(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eoi_update_status(uuid, text, uuid) TO authenticated, service_role;

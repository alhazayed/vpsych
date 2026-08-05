-- Clinical Quality Intelligence (CQI) Platform
-- Append-only quality vault + clustering + engineering recommendations.
-- RLS: reviewers insert/select own flags; admins read all + manage clusters/status.

-- ---------------------------------------------------------------------------
-- Enumerations (text + CHECK for forward compatibility)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cqi_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Immutable identity
  reviewer_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  anonymous boolean NOT NULL DEFAULT false,
  -- Session linkage
  session_id uuid REFERENCES public.sessions (id) ON DELETE SET NULL,
  assessment_id uuid NULL,
  case_instance_id uuid NULL,
  avatar_id uuid NULL,
  -- Clinical / runtime context (captured at flag time; never rely on live joins alone)
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Structured review
  category text NOT NULL
    CHECK (category IN (
      'clinical_realism',
      'human_conversation',
      'language',
      'voice',
      'emotion',
      'patient_behaviour',
      'educational_value',
      'assessment',
      'report',
      'user_interface',
      'performance',
      'security',
      'research',
      'other'
    )),
  severity text NOT NULL
    CHECK (severity IN ('critical', 'high', 'medium', 'low', 'suggestion')),
  confidence text NOT NULL
    CHECK (confidence IN ('definitely', 'probably', 'possibly')),
  -- Sensitive narrative (optionally envelope-encrypted at app layer)
  free_text text NOT NULL DEFAULT '',
  free_text_enc jsonb NULL,
  suggested_improvement text,
  expected_behaviour text,
  reduces_educational_quality boolean,
  usable_in_residency boolean,
  -- Quality scores 1–10
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  would_recommend boolean,
  -- Transcript annotations [{message_id, role, quote, note, start?, end?}]
  annotations jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Conversation window snapshot
  transcript_window jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Workflow
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN (
      'submitted',
      'triaged',
      'clustered',
      'in_progress',
      'resolved',
      'verified',
      'certified',
      'dismissed'
    )),
  cluster_id uuid NULL,
  fingerprint text NOT NULL DEFAULT '',
  platform_version text,
  release_version text,
  prompt_version text,
  pme_version text,
  tre_version text,
  ai_model text,
  language text,
  disorder_slug text,
  -- Evidence refs
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Analyst / ledger
  analyst_notes jsonb NOT NULL DEFAULT '{}'::jsonb,
  quality_ledger_ref text,
  -- Integrity
  content_hash text NOT NULL DEFAULT '',
  -- Never overwrite narrative: updates limited to status/cluster via admin RPC
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cqi_flags_created_at_idx
  ON public.cqi_flags (created_at DESC);
CREATE INDEX IF NOT EXISTS cqi_flags_session_id_idx
  ON public.cqi_flags (session_id);
CREATE INDEX IF NOT EXISTS cqi_flags_reviewer_id_idx
  ON public.cqi_flags (reviewer_id);
CREATE INDEX IF NOT EXISTS cqi_flags_category_idx
  ON public.cqi_flags (category);
CREATE INDEX IF NOT EXISTS cqi_flags_severity_idx
  ON public.cqi_flags (severity);
CREATE INDEX IF NOT EXISTS cqi_flags_status_idx
  ON public.cqi_flags (status);
CREATE INDEX IF NOT EXISTS cqi_flags_fingerprint_idx
  ON public.cqi_flags (fingerprint);
CREATE INDEX IF NOT EXISTS cqi_flags_disorder_idx
  ON public.cqi_flags (disorder_slug);
CREATE INDEX IF NOT EXISTS cqi_flags_cluster_id_idx
  ON public.cqi_flags (cluster_id);
CREATE INDEX IF NOT EXISTS cqi_flags_language_idx
  ON public.cqi_flags (language);

COMMENT ON TABLE public.cqi_flags IS
  'CQI Quality Vault — append-only expert feedback with full session context';

-- ---------------------------------------------------------------------------
-- Clusters
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cqi_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  category text,
  severity text,
  confidence_pct numeric(5,2) NOT NULL DEFAULT 0,
  report_count integer NOT NULL DEFAULT 0,
  fingerprint text NOT NULL UNIQUE,
  affected_languages text[] NOT NULL DEFAULT '{}',
  affected_disorders text[] NOT NULL DEFAULT '{}',
  affected_voices text[] NOT NULL DEFAULT '{}',
  affected_prompt_versions text[] NOT NULL DEFAULT '{}',
  affected_releases text[] NOT NULL DEFAULT '{}',
  affected_models text[] NOT NULL DEFAULT '{}',
  root_cause text,
  educational_impact text,
  clinical_impact text,
  effort_estimate text
    CHECK (effort_estimate IS NULL OR effort_estimate IN ('xs', 's', 'm', 'l', 'xl')),
  recommendation text,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'acknowledged', 'planned', 'in_progress', 'resolved', 'wont_fix')),
  analyst jsonb NOT NULL DEFAULT '{}'::jsonb,
  engineering jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS cqi_clusters_updated_at_idx
  ON public.cqi_clusters (updated_at DESC);
CREATE INDEX IF NOT EXISTS cqi_clusters_severity_idx
  ON public.cqi_clusters (severity);
CREATE INDEX IF NOT EXISTS cqi_clusters_status_idx
  ON public.cqi_clusters (status);

ALTER TABLE public.cqi_flags
  DROP CONSTRAINT IF EXISTS cqi_flags_cluster_id_fkey;
ALTER TABLE public.cqi_flags
  ADD CONSTRAINT cqi_flags_cluster_id_fkey
  FOREIGN KEY (cluster_id) REFERENCES public.cqi_clusters (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Attachments (storage object metadata; blobs in Storage bucket cqi-evidence)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cqi_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  flag_id uuid NOT NULL REFERENCES public.cqi_flags (id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  kind text NOT NULL
    CHECK (kind IN ('screenshot', 'screen_recording', 'audio', 'pdf', 'image', 'other')),
  storage_path text NOT NULL,
  mime_type text,
  byte_size integer,
  transcript text,
  checksum text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS cqi_attachments_flag_id_idx
  ON public.cqi_attachments (flag_id);

-- ---------------------------------------------------------------------------
-- Engineering recommendations (human-approved; never auto-PR)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cqi_engineering_recs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  cluster_id uuid REFERENCES public.cqi_clusters (id) ON DELETE CASCADE,
  flag_id uuid REFERENCES public.cqi_flags (id) ON DELETE SET NULL,
  title text NOT NULL,
  root_cause text,
  affected_files text[] NOT NULL DEFAULT '{}',
  affected_subsystem text,
  risk text,
  priority text
    CHECK (priority IS NULL OR priority IN ('p0', 'p1', 'p2', 'p3')),
  regression_requirements text,
  acceptance_criteria text,
  github_issue_md text,
  cursor_prompt text,
  approval_status text NOT NULL DEFAULT 'draft'
    CHECK (approval_status IN ('draft', 'pending_approval', 'approved', 'rejected', 'implemented')),
  approved_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  approved_at timestamptz,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS cqi_engineering_recs_cluster_id_idx
  ON public.cqi_engineering_recs (cluster_id);
CREATE INDEX IF NOT EXISTS cqi_engineering_recs_approval_idx
  ON public.cqi_engineering_recs (approval_status);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.cqi_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cqi_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cqi_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cqi_engineering_recs ENABLE ROW LEVEL SECURITY;

-- Flags: reviewers see own (unless anonymous to others — still own); admins see all
DROP POLICY IF EXISTS cqi_flags_select_own_or_admin ON public.cqi_flags;
CREATE POLICY cqi_flags_select_own_or_admin
  ON public.cqi_flags FOR SELECT
  TO authenticated
  USING (
    (select public.is_admin())
    OR reviewer_id = (select auth.uid())
  );

DROP POLICY IF EXISTS cqi_flags_insert_own ON public.cqi_flags;
CREATE POLICY cqi_flags_insert_own
  ON public.cqi_flags FOR INSERT
  TO authenticated
  WITH CHECK (
    reviewer_id = (select auth.uid())
    OR (
      anonymous = true
      AND reviewer_id IS NULL
      AND (select auth.uid()) IS NOT NULL
    )
  );

-- No direct UPDATE/DELETE for clients — status/cluster via SECURITY DEFINER RPC

DROP POLICY IF EXISTS cqi_clusters_admin_all ON public.cqi_clusters;
CREATE POLICY cqi_clusters_admin_select
  ON public.cqi_clusters FOR SELECT
  TO authenticated
  USING ((select public.is_admin()));

DROP POLICY IF EXISTS cqi_clusters_admin_write ON public.cqi_clusters;
CREATE POLICY cqi_clusters_admin_insert
  ON public.cqi_clusters FOR INSERT
  TO authenticated
  WITH CHECK ((select public.is_admin()));

CREATE POLICY cqi_clusters_admin_update
  ON public.cqi_clusters FOR UPDATE
  TO authenticated
  USING ((select public.is_admin()))
  WITH CHECK ((select public.is_admin()));

DROP POLICY IF EXISTS cqi_attachments_select ON public.cqi_attachments;
CREATE POLICY cqi_attachments_select
  ON public.cqi_attachments FOR SELECT
  TO authenticated
  USING (
    (select public.is_admin())
    OR reviewer_id = (select auth.uid())
  );

DROP POLICY IF EXISTS cqi_attachments_insert ON public.cqi_attachments;
CREATE POLICY cqi_attachments_insert
  ON public.cqi_attachments FOR INSERT
  TO authenticated
  WITH CHECK (reviewer_id = (select auth.uid()));

DROP POLICY IF EXISTS cqi_eng_admin_select ON public.cqi_engineering_recs;
CREATE POLICY cqi_eng_admin_select
  ON public.cqi_engineering_recs FOR SELECT
  TO authenticated
  USING ((select public.is_admin()));

CREATE POLICY cqi_eng_admin_insert
  ON public.cqi_engineering_recs FOR INSERT
  TO authenticated
  WITH CHECK ((select public.is_admin()));

CREATE POLICY cqi_eng_admin_update
  ON public.cqi_engineering_recs FOR UPDATE
  TO authenticated
  USING ((select public.is_admin()))
  WITH CHECK ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- RPCs: append-safe status update + anonymous insert helper
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cqi_submit_flag(p_payload jsonb)
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

  INSERT INTO public.cqi_flags (
    reviewer_id,
    anonymous,
    session_id,
    assessment_id,
    case_instance_id,
    avatar_id,
    context,
    category,
    severity,
    confidence,
    free_text,
    free_text_enc,
    suggested_improvement,
    expected_behaviour,
    reduces_educational_quality,
    usable_in_residency,
    scores,
    would_recommend,
    annotations,
    transcript_window,
    fingerprint,
    platform_version,
    release_version,
    prompt_version,
    pme_version,
    tre_version,
    ai_model,
    language,
    disorder_slug,
    evidence,
    content_hash
  ) VALUES (
    CASE WHEN v_anon THEN NULL ELSE v_actor END,
    v_anon,
    nullif(p_payload->>'session_id', '')::uuid,
    nullif(p_payload->>'assessment_id', '')::uuid,
    nullif(p_payload->>'case_instance_id', '')::uuid,
    nullif(p_payload->>'avatar_id', '')::uuid,
    coalesce(p_payload->'context', '{}'::jsonb),
    p_payload->>'category',
    p_payload->>'severity',
    p_payload->>'confidence',
    coalesce(p_payload->>'free_text', ''),
    p_payload->'free_text_enc',
    p_payload->>'suggested_improvement',
    p_payload->>'expected_behaviour',
    (p_payload->>'reduces_educational_quality')::boolean,
    (p_payload->>'usable_in_residency')::boolean,
    coalesce(p_payload->'scores', '{}'::jsonb),
    (p_payload->>'would_recommend')::boolean,
    coalesce(p_payload->'annotations', '[]'::jsonb),
    coalesce(p_payload->'transcript_window', '[]'::jsonb),
    coalesce(p_payload->>'fingerprint', ''),
    p_payload->>'platform_version',
    p_payload->>'release_version',
    p_payload->>'prompt_version',
    p_payload->>'pme_version',
    p_payload->>'tre_version',
    p_payload->>'ai_model',
    p_payload->>'language',
    p_payload->>'disorder_slug',
    coalesce(p_payload->'evidence', '{}'::jsonb),
    coalesce(p_payload->>'content_hash', '')
  )
  RETURNING id INTO v_id;

  PERFORM public.log_security_event(
    'cqi.flag.submit',
    'success',
    'cqi_flag',
    v_id::text,
    NULL,
    NULL,
    jsonb_build_object(
      'anonymous', v_anon,
      'category', p_payload->>'category',
      'severity', p_payload->>'severity',
      'session_id', p_payload->>'session_id'
    )
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.cqi_submit_flag(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cqi_submit_flag(jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cqi_update_flag_status(
  p_flag_id uuid,
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
    'submitted', 'triaged', 'clustered', 'in_progress',
    'resolved', 'verified', 'certified', 'dismissed'
  ) THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  UPDATE public.cqi_flags
  SET
    status = p_status,
    cluster_id = coalesce(p_cluster_id, cluster_id),
    updated_at = now()
  WHERE id = p_flag_id;

  PERFORM public.log_security_event(
    'cqi.flag.status',
    'success',
    'cqi_flag',
    p_flag_id::text,
    NULL,
    NULL,
    jsonb_build_object('status', p_status, 'cluster_id', p_cluster_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cqi_update_flag_status(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cqi_update_flag_status(uuid, text, uuid) TO authenticated, service_role;

-- Storage bucket for evidence (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cqi-evidence',
  'cqi-evidence',
  false,
  52428800,
  ARRAY[
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/mp4',
    'video/webm', 'video/mp4',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies: path prefix = auth.uid() / ...
DROP POLICY IF EXISTS cqi_evidence_select ON storage.objects;
CREATE POLICY cqi_evidence_select
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'cqi-evidence'
    AND (
      (select public.is_admin())
      OR (storage.foldername(name))[1] = (select auth.uid())::text
    )
  );

DROP POLICY IF EXISTS cqi_evidence_insert ON storage.objects;
CREATE POLICY cqi_evidence_insert
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'cqi-evidence'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

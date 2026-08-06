-- Defense in depth for CQG-001: in-body service_role gate
-- (EXECUTE already revoked from authenticated in 20260806130513)

CREATE OR REPLACE FUNCTION public.append_quality_ledger(p_row jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_id uuid;
  v_scores jsonb;
  v_score jsonb;
  v_snaps jsonb;
  v_snap jsonb;
  v_comp jsonb;
  v_conf jsonb;
BEGIN
  -- CQG-001: never allow authenticated PostgREST forgery.
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'append_quality_ledger requires service_role';
  END IF;

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
$fn$;



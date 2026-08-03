-- ACE post-assessment persistence without requiring SUPABASE_SERVICE_ROLE_KEY.
-- Security model matches session message RPCs: authenticated EXECUTE, ownership
-- checks in the function body, SECURITY DEFINER for RLS bypass. The learner
-- profile trigger still blocks direct PostgREST scoring writes unless the
-- session-local vpsych.allow_learner_scoring flag is set by this RPC.

create or replace function public.enforce_learner_profile_guard()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if auth.role() = 'service_role' then
    return new;
  end if;

  -- Trusted server RPC (apply_ace_session_progress) sets this for one transaction.
  if current_setting('vpsych.allow_learner_scoring', true) = 'on' then
    return new;
  end if;

  if new.certification_status is distinct from old.certification_status
     or new.completed_case_count is distinct from old.completed_case_count
     or new.learning_velocity is distinct from old.learning_velocity
     or new.confidence_score is distinct from old.confidence_score
     or new.min_competency_threshold is distinct from old.min_competency_threshold
     or new.max_difficulty is distinct from old.max_difficulty
     or new.locked_diagnoses is distinct from old.locked_diagnoses
     or new.locked_objectives is distinct from old.locked_objectives
     or new.required_competencies is distinct from old.required_competencies
     or new.optional_competencies is distinct from old.optional_competencies
  then
    raise exception 'Learner cannot mutate instructor or scoring fields';
  end if;

  return new;
end;
$$;

create or replace function public.apply_ace_session_progress(
  p_learner_id uuid,
  p_session_id uuid,
  p_completed_case_count integer,
  p_learning_velocity numeric,
  p_confidence_score numeric,
  p_certification_status text,
  p_metadata jsonb,
  p_competencies jsonb,
  p_coach jsonb default null,
  p_next_fingerprint text default null,
  p_diagnosis_slug text default null,
  p_difficulty text default null,
  p_focus text[] default null,
  p_adaptation jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_owner uuid;
  v_session_owner uuid;
  v_comp jsonb;
  v_is_service boolean := (auth.role() = 'service_role');
begin
  select user_id into v_owner
  from public.learner_profiles
  where id = p_learner_id;

  if v_owner is null then
    raise exception 'Learner profile not found';
  end if;

  if not v_is_service and v_owner is distinct from auth.uid() then
    raise exception 'Forbidden';
  end if;

  if p_session_id is not null then
    select therapist_id into v_session_owner
    from public.sessions
    where id = p_session_id;

    if v_session_owner is null then
      raise exception 'Session not found';
    end if;
    if not v_is_service and v_session_owner is distinct from auth.uid() then
      raise exception 'Forbidden session';
    end if;
  end if;

  perform set_config('vpsych.allow_learner_scoring', 'on', true);

  update public.learner_profiles
  set
    completed_case_count = coalesce(p_completed_case_count, completed_case_count),
    learning_velocity = coalesce(p_learning_velocity, learning_velocity),
    confidence_score = coalesce(p_confidence_score, confidence_score),
    certification_status = coalesce(
      p_certification_status::public.ace_certification_status,
      certification_status
    ),
    metadata = coalesce(p_metadata, metadata),
    updated_at = now()
  where id = p_learner_id;

  if p_competencies is not null then
    for v_comp in select * from jsonb_array_elements(p_competencies)
    loop
      if coalesce((v_comp->>'samples')::int, 0) <= 0 then
        continue;
      end if;

      insert into public.learner_competencies as lc (
        learner_id,
        competency_id,
        score,
        samples,
        trend,
        last_assessed_at,
        mastered_at
      ) values (
        p_learner_id,
        v_comp->>'competency_id',
        coalesce((v_comp->>'score')::numeric, 0),
        coalesce((v_comp->>'samples')::int, 0),
        coalesce((v_comp->>'trend')::numeric, 0),
        coalesce((v_comp->>'last_assessed_at')::timestamptz, now()),
        nullif(v_comp->>'mastered_at', '')::timestamptz
      )
      on conflict (learner_id, competency_id) do update
      set
        score = excluded.score,
        samples = excluded.samples,
        trend = excluded.trend,
        last_assessed_at = excluded.last_assessed_at,
        mastered_at = excluded.mastered_at;

      if p_session_id is not null then
        insert into public.competency_scores (
          learner_id,
          competency_id,
          session_id,
          score,
          evidence
        ) values (
          p_learner_id,
          v_comp->>'competency_id',
          p_session_id,
          coalesce((v_comp->>'score')::numeric, 0),
          jsonb_build_object('source', 'session_assessment')
        );
      end if;
    end loop;
  end if;

  if p_coach is not null and p_session_id is not null then
    insert into public.coach_feedback (
      learner_id,
      session_id,
      supervisor_feedback,
      reflective_questions,
      missed_opportunities,
      suggested_reading,
      suggested_next_cases,
      learning_goals,
      improvement_plan
    ) values (
      p_learner_id,
      p_session_id,
      coalesce(p_coach->>'supervisor_feedback', ''),
      coalesce(p_coach->'reflective_questions', '[]'::jsonb),
      coalesce(p_coach->'missed_opportunities', '[]'::jsonb),
      coalesce(p_coach->'suggested_reading', '[]'::jsonb),
      coalesce(p_coach->'suggested_next_cases', '[]'::jsonb),
      coalesce(p_coach->'learning_goals', '[]'::jsonb),
      coalesce(p_coach->>'improvement_plan', '')
    );
  end if;

  if p_next_fingerprint is not null then
    insert into public.adaptive_case_history (
      learner_id,
      session_id,
      focus_competencies,
      adaptation,
      diagnosis_slug,
      difficulty,
      fingerprint
    ) values (
      p_learner_id,
      p_session_id,
      coalesce(p_focus, '{}'),
      coalesce(p_adaptation, '{}'::jsonb),
      p_diagnosis_slug,
      p_difficulty,
      p_next_fingerprint
    )
    on conflict (learner_id, fingerprint) do nothing;
  end if;

  insert into public.performance_trends (
    learner_id,
    window_label,
    metrics,
    computed_at
  ) values (
    p_learner_id,
    'rolling_10',
    jsonb_build_object(
      'confidence', p_confidence_score,
      'velocity', p_learning_velocity,
      'completed', p_completed_case_count,
      'competencies', coalesce(p_competencies, '[]'::jsonb)
    ),
    now()
  )
  on conflict (learner_id, window_label) do update
  set
    metrics = excluded.metrics,
    computed_at = excluded.computed_at;

  return true;
end;
$$;

revoke all on function public.apply_ace_session_progress(
  uuid, uuid, integer, numeric, numeric, text, jsonb, jsonb, jsonb, text, text, text, text[], jsonb
) from public, anon;

grant execute on function public.apply_ace_session_progress(
  uuid, uuid, integer, numeric, numeric, text, jsonb, jsonb, jsonb, text, text, text, text[], jsonb
) to authenticated, service_role;

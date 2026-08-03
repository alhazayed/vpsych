-- Mission 20 — Enterprise Security Certification hardening
-- 1) Transcript forge: message RPCs service_role-only (ACL + in-body)
-- 2) ACE INSERT mass-assignment: force safe defaults on learner seed
-- 3) learner_competencies: baseline-only seed INSERT

-- ---------------------------------------------------------------------------
-- Message RPCs: require service_role even if EXECUTE is mis-granted
-- ---------------------------------------------------------------------------
create or replace function public.insert_assistant_message(
  p_session_id uuid,
  p_content text
)
returns public.session_messages
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_owner uuid;
  v_status public.session_status;
  v_last public.message_role;
  v_row public.session_messages;
begin
  -- Hard require privileged caller (defense-in-depth beyond GRANT)
  if coalesce(auth.role(), '') is distinct from 'service_role'
     and coalesce(auth.jwt() ->> 'role', '') is distinct from 'service_role' then
    raise exception 'Not authorized';
  end if;

  if p_content is null or length(trim(p_content)) = 0 then
    raise exception 'Empty content';
  end if;
  if length(p_content) > 8000 then
    raise exception 'Content too long';
  end if;

  select therapist_id, status into v_owner, v_status
  from public.sessions where id = p_session_id;

  if v_owner is null then
    raise exception 'Session not found';
  end if;
  if v_status <> 'active' then
    raise exception 'Session is not active';
  end if;

  select role into v_last
  from public.session_messages
  where session_id = p_session_id
  order by created_at desc
  limit 1;

  if v_last is distinct from 'user' then
    raise exception 'Assistant reply requires a preceding user turn';
  end if;

  insert into public.session_messages (session_id, role, content)
  values (p_session_id, 'assistant', p_content)
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.insert_system_message(
  p_session_id uuid,
  p_content text
)
returns public.session_messages
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_owner uuid;
  v_status public.session_status;
  v_row public.session_messages;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role'
     and coalesce(auth.jwt() ->> 'role', '') is distinct from 'service_role' then
    raise exception 'Not authorized';
  end if;

  select therapist_id, status into v_owner, v_status
  from public.sessions where id = p_session_id;

  if v_owner is null then
    raise exception 'Session not found';
  end if;
  if v_status <> 'active' then
    raise exception 'Session is not active';
  end if;

  insert into public.session_messages (session_id, role, content)
  values (p_session_id, 'system', coalesce(p_content, 'Session started.'))
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.insert_assistant_message(uuid, text) from public, anon, authenticated;
revoke all on function public.insert_system_message(uuid, text) from public, anon, authenticated;
grant execute on function public.insert_assistant_message(uuid, text) to service_role;
grant execute on function public.insert_system_message(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- learner_profiles: INSERT must not accept forged scoring / instructor fields
-- ---------------------------------------------------------------------------
create or replace function public.enforce_learner_profile_insert_guard()
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
  if current_setting('vpsych.allow_learner_scoring', true) = 'on' then
    return new;
  end if;

  -- Force safe seed defaults regardless of client-supplied payload
  new.certification_status := 'not_started';
  new.completed_case_count := 0;
  new.learning_velocity := 0;
  new.confidence_score := 50;
  new.min_competency_threshold := coalesce(new.min_competency_threshold, 70);
  if new.min_competency_threshold is distinct from 70 then
    new.min_competency_threshold := 70;
  end if;
  new.max_difficulty := coalesce(new.max_difficulty, 'expert');
  new.locked_diagnoses := coalesce(new.locked_diagnoses, '{}'::text[]);
  new.locked_objectives := coalesce(new.locked_objectives, '{}'::text[]);
  new.required_competencies := coalesce(new.required_competencies, '{}'::text[]);
  new.optional_competencies := coalesce(new.optional_competencies, '{}'::text[]);
  new.adaptive_mode := coalesce(new.adaptive_mode, true);
  new.curriculum_mode := coalesce(new.curriculum_mode, 'automatic');

  -- Strip privileged-looking metadata keys if present
  if new.metadata is not null then
    new.metadata := new.metadata
      - 'forged'
      - 'admin_override'
      - 'instructor_id';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_learner_profile_insert_guard on public.learner_profiles;
create trigger trg_learner_profile_insert_guard
  before insert on public.learner_profiles
  for each row
  execute function public.enforce_learner_profile_insert_guard();

-- ---------------------------------------------------------------------------
-- learner_competencies: only baseline seed rows via learner INSERT
-- ---------------------------------------------------------------------------
drop policy if exists "Learner seed own competencies" on public.learner_competencies;
create policy "Learner seed own competencies"
  on public.learner_competencies
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.learner_profiles lp
      where lp.id = learner_competencies.learner_id
        and lp.user_id = (select auth.uid())
    )
    and coalesce(score, 70) = 70
    and coalesce(samples, 0) = 0
    and coalesce(trend, 0) = 0
    and coalesce(locked, false) = false
    and coalesce(instructor_approved, false) = false
  );

-- Defense-in-depth INSERT trigger (covers columns policy cannot see uniformly)
create or replace function public.enforce_learner_competency_insert_guard()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if public.is_admin() or auth.role() = 'service_role' then
    return new;
  end if;
  if current_setting('vpsych.allow_learner_scoring', true) = 'on' then
    return new;
  end if;

  new.score := 70;
  new.samples := 0;
  new.trend := 0;
  new.locked := false;
  new.instructor_approved := false;
  new.mastery_stage := coalesce(new.mastery_stage, 'not_attempted');
  new.confidence := coalesce(new.confidence, 50);
  new.mastered_at := null;
  return new;
end;
$$;

drop trigger if exists trg_learner_competency_insert_guard on public.learner_competencies;
create trigger trg_learner_competency_insert_guard
  before insert on public.learner_competencies
  for each row
  execute function public.enforce_learner_competency_insert_guard();

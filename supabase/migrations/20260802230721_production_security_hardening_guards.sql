-- Canonical migration recovered for Release Configuration Board reconciliation.
-- Source: production supabase_migrations.schema_migrations statements

create or replace function public.enforce_session_update_guard()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_case_owner uuid;
begin
  if public.is_admin() then
    return new;
  end if;

  if new.therapist_id is distinct from old.therapist_id then
    raise exception 'Cannot change therapist_id';
  end if;
  if new.avatar_id is distinct from old.avatar_id then
    raise exception 'Cannot change avatar_id';
  end if;
  if new.max_duration_sec is distinct from old.max_duration_sec then
    raise exception 'Cannot change max_duration_sec';
  end if;
  if new.started_at is distinct from old.started_at then
    raise exception 'Cannot change started_at';
  end if;
  if old.status <> 'active' and new.status is distinct from old.status then
    raise exception 'Cannot reopen or change a finished session';
  end if;

  if new.case_instance_id is distinct from old.case_instance_id then
    if old.case_instance_id is not null then
      raise exception 'Cannot rebind case_instance_id';
    end if;
    if new.case_instance_id is not null then
      select created_by into v_case_owner
      from public.case_instances
      where id = new.case_instance_id;
      if v_case_owner is null then
        raise exception 'case_instance_id not found';
      end if;
      if v_case_owner is distinct from new.therapist_id then
        raise exception 'case_instance_id not owned by therapist';
      end if;
    end if;
  end if;

  return new;
end;
$$;

DROP POLICY IF EXISTS "Authenticated insert case_instances" ON public.case_instances;
CREATE POLICY "Authenticated insert case_instances" ON public.case_instances
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

create or replace function public.enforce_profile_role_guard()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Cannot change role';
  end if;
  return new;
end;
$$;

DROP TRIGGER IF EXISTS profiles_role_guard ON public.profiles;
CREATE TRIGGER profiles_role_guard
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_role_guard();

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

DROP TRIGGER IF EXISTS learner_profiles_guard ON public.learner_profiles;
CREATE TRIGGER learner_profiles_guard
  BEFORE UPDATE ON public.learner_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_learner_profile_guard();

-- Keep in sync with live apply_migration fix_session_guard_search_path
create or replace function public.enforce_session_update_guard()
returns trigger
language plpgsql
set search_path to 'public'
as $$
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

  return new;
end;
$$;

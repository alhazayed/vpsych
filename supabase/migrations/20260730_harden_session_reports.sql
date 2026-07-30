-- Harden report writes and session timer fields.
-- Review before applying to production (Supabase MCP apply_migration or CLI).
--
-- Does NOT revoke create_session_report from authenticated yet — that requires
-- wiring SUPABASE_SERVICE_ROLE_KEY into /api/sessions/[id]/end first.
-- Does NOT tighten session_messages.role — assistant inserts currently use the
-- therapist JWT; switch those to service_role (or a narrow definer) first.

-- 1) Insert-once reports: stop overwrite of existing assessments.
create or replace function public.create_session_report(
  p_session_id uuid,
  p_scores jsonb,
  p_narrative text,
  p_excerpts jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_report_id uuid;
  v_owner uuid;
begin
  select therapist_id into v_owner from public.sessions where id = p_session_id;
  if v_owner is null then
    raise exception 'Session not found';
  end if;
  if v_owner <> auth.uid() and not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  insert into public.session_reports (session_id, scores, narrative, excerpts)
  values (p_session_id, p_scores, p_narrative, p_excerpts)
  on conflict (session_id) do nothing
  returning id into v_report_id;

  if v_report_id is null then
    select id into v_report_id
    from public.session_reports
    where session_id = p_session_id;
  end if;

  return v_report_id;
end;
$function$;

-- Preferred follow-up after service_role is wired in the app:
--   revoke execute on function public.create_session_report from authenticated, anon;
--   grant execute on function public.create_session_report to service_role;

-- 2) Prevent therapists from extending time or reopening sessions via direct client updates.
create or replace function public.enforce_session_update_guard()
returns trigger
language plpgsql
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
  -- Allow active -> completed|expired only; block reopen.
  if old.status <> 'active' and new.status is distinct from old.status then
    raise exception 'Cannot reopen or change a finished session';
  end if;

  return new;
end;
$$;

drop trigger if exists session_update_guard on public.sessions;
create trigger session_update_guard
  before update on public.sessions
  for each row
  execute function public.enforce_session_update_guard();

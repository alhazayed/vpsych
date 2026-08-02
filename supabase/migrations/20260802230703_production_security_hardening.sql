-- Production Security Certification — harden High findings:
-- 1) Revoke client forge of assistant/system messages (server-only via service_role)
-- 2) Freeze case_instance_id rebinding; require created_by on case insert
-- 3) Split ACE/CGE learner policies: SELECT (+ limited seed INSERT); score/cert writes server/admin only
-- 4) Block non-admin mutation of instructor/scoring columns on learner_profiles
-- 5) Defense-in-depth: profiles.role immutable for non-admins

-- ---------------------------------------------------------------------------
-- 1) Message RPCs: service_role only + allow service_role auth bypass
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
  v_is_service boolean := (auth.role() = 'service_role');
begin
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
  if not v_is_service then
    if auth.uid() is null or (v_owner <> auth.uid() and not public.is_admin()) then
      raise exception 'Not authorized';
    end if;
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
  v_row public.session_messages;
  v_is_service boolean := (auth.role() = 'service_role');
begin
  select therapist_id into v_owner from public.sessions where id = p_session_id;
  if v_owner is null then
    raise exception 'Session not found';
  end if;
  if not v_is_service then
    if auth.uid() is null or (v_owner <> auth.uid() and not public.is_admin()) then
      raise exception 'Not authorized';
    end if;
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

-- Full hardening: insert-once signed reports, session timer guard,
-- message role constraints, report existence helper, ban demo accounts.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- 0) Vault HMAC key for report writes (server must sign with REPORT_WRITE_KEY)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from vault.decrypted_secrets where name = 'report_write_key'
  ) then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'report_write_key',
      'HMAC key for create_session_report signatures'
    );
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1) Owner-callable report existence check (no content leaked)
-- ---------------------------------------------------------------------------
create or replace function public.session_has_report(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_owner uuid;
begin
  select therapist_id into v_owner from public.sessions where id = p_session_id;
  if v_owner is null then
    return false;
  end if;
  if v_owner <> auth.uid() and not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  return exists (
    select 1 from public.session_reports where session_id = p_session_id
  );
end;
$$;

revoke all on function public.session_has_report(uuid) from public, anon;
grant execute on function public.session_has_report(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2) Signed, insert-once report writer (JSON as text for stable HMAC)
-- ---------------------------------------------------------------------------
-- Remove prior overloads so only the signed form remains.
drop function if exists public.create_session_report(uuid, jsonb, text, jsonb);
drop function if exists public.create_session_report(uuid, jsonb, text, jsonb, text);

create or replace function public.create_session_report(
  p_session_id uuid,
  p_scores_json text,
  p_narrative text,
  p_excerpts_json text default '[]',
  p_sig text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $function$
declare
  v_report_id uuid;
  v_owner uuid;
  v_status public.session_status;
  v_key text;
  v_payload text;
  v_expected text;
  v_is_service boolean;
  v_scores jsonb;
  v_excerpts jsonb;
begin
  v_is_service := coalesce(auth.jwt() ->> 'role', '') = 'service_role';

  select therapist_id, status into v_owner, v_status
  from public.sessions where id = p_session_id;

  if v_owner is null then
    raise exception 'Session not found';
  end if;

  begin
    v_scores := p_scores_json::jsonb;
    v_excerpts := coalesce(p_excerpts_json, '[]')::jsonb;
  exception when others then
    raise exception 'Invalid report JSON';
  end;

  if not v_is_service then
    if v_owner <> auth.uid() and not public.is_admin() then
      raise exception 'Not authorized';
    end if;

    select decrypted_secret into v_key
    from vault.decrypted_secrets
    where name = 'report_write_key';

    if v_key is null or length(v_key) < 16 then
      raise exception 'Report write key not configured';
    end if;

    v_payload := p_session_id::text
      || E'\n' || coalesce(p_narrative, '')
      || E'\n' || coalesce(p_scores_json, '')
      || E'\n' || coalesce(p_excerpts_json, '[]');
    v_expected := encode(extensions.hmac(v_payload, v_key, 'sha256'), 'hex');

    if p_sig is null or p_sig is distinct from v_expected then
      raise exception 'Invalid report signature';
    end if;
  end if;

  if v_status not in ('completed', 'expired') then
    raise exception 'Session must be completed before creating a report';
  end if;

  insert into public.session_reports (session_id, scores, narrative, excerpts)
  values (p_session_id, v_scores, p_narrative, v_excerpts)
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

revoke all on function public.create_session_report(uuid, text, text, text, text) from public, anon;
grant execute on function public.create_session_report(uuid, text, text, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3) Session update guard (timer / reopen bypass)
-- ---------------------------------------------------------------------------
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

drop trigger if exists session_update_guard on public.sessions;
create trigger session_update_guard
  before update on public.sessions
  for each row
  execute function public.enforce_session_update_guard();

-- ---------------------------------------------------------------------------
-- 4) Message role hardening + definer helpers for assistant/system
-- ---------------------------------------------------------------------------
drop policy if exists "Therapists can insert messages on own sessions" on public.session_messages;
drop policy if exists "Therapists can insert user messages on own sessions" on public.session_messages;
create policy "Therapists can insert user messages on own sessions"
  on public.session_messages
  for insert
  to authenticated
  with check (
    role = 'user'
    and exists (
      select 1
      from public.sessions s
      where s.id = session_messages.session_id
        and s.therapist_id = auth.uid()
        and s.status = 'active'
    )
  );

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
  if v_owner <> auth.uid() and not public.is_admin() then
    raise exception 'Not authorized';
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
begin
  select therapist_id into v_owner from public.sessions where id = p_session_id;
  if v_owner is null then
    raise exception 'Session not found';
  end if;
  if v_owner <> auth.uid() and not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  insert into public.session_messages (session_id, role, content)
  values (p_session_id, 'system', coalesce(p_content, 'Session started.'))
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.insert_assistant_message(uuid, text) from public, anon;
revoke all on function public.insert_system_message(uuid, text) from public, anon;
grant execute on function public.insert_assistant_message(uuid, text) to authenticated, service_role;
grant execute on function public.insert_system_message(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5) Disable demo accounts on the live project
-- ---------------------------------------------------------------------------
update auth.users
set
  banned_until = '2099-01-01 00:00:00+00',
  raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('demo_disabled', true)
where email in ('admin@vpsych.test', 'therapist@vpsych.test');

update public.profiles
set role = 'therapist'
where id in (
  select id from auth.users where email = 'admin@vpsych.test'
);

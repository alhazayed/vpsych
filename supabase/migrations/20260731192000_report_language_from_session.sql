-- Copy session.language onto session_reports.language when creating reports.
-- HMAC payload unchanged (language is not part of the signature).

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
  v_session_language text;
  v_key text;
  v_payload text;
  v_expected text;
  v_is_service boolean;
  v_scores jsonb;
  v_excerpts jsonb;
begin
  v_is_service := coalesce(auth.jwt() ->> 'role', '') = 'service_role';

  select therapist_id, status, language
    into v_owner, v_status, v_session_language
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

  insert into public.session_reports (session_id, scores, narrative, excerpts, language)
  values (p_session_id, v_scores, p_narrative, v_excerpts, v_session_language)
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

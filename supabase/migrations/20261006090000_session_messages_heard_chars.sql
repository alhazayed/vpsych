-- Heard vs generated patient text.
--
-- When the therapist barges in, the patient reply is stored in full but only
-- its first part was spoken aloud. `heard_chars` records, once, how many
-- characters of an assistant message the therapist could have heard. Reports
-- judge the reply up to that point. `content` is never rewritten.
--
-- Additive and reversible:
--   drop function public.mark_assistant_message_heard(uuid, integer);
--   alter table public.session_messages drop column heard_chars;

alter table public.session_messages
  add column if not exists heard_chars integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'session_messages_heard_chars_check'
      and conrelid = 'public.session_messages'::regclass
  ) then
    alter table public.session_messages
      add constraint session_messages_heard_chars_check
      check (heard_chars is null or (role = 'assistant' and heard_chars >= 0));
  end if;
end
$$;

comment on column public.session_messages.heard_chars is
  'Assistant rows only: characters of content heard before the therapist interrupted. Null = played in full / not interrupted. Set once via mark_assistant_message_heard.';

-- Set-once writer. The caller must own an active session; only assistant rows,
-- only within the stored content length, and never overwrites an earlier value.
create or replace function public.mark_assistant_message_heard(
  p_message_id uuid,
  p_heard_chars integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role public.message_role;
  v_len integer;
  v_heard integer;
  v_owner uuid;
  v_status public.session_status;
begin
  if p_message_id is null or p_heard_chars is null or p_heard_chars < 0 then
    raise exception 'Invalid heard offset';
  end if;

  select m.role, length(m.content), m.heard_chars, s.therapist_id, s.status
    into v_role, v_len, v_heard, v_owner, v_status
  from public.session_messages m
  join public.sessions s on s.id = m.session_id
  where m.id = p_message_id;

  if v_owner is null or v_owner is distinct from (select auth.uid()) then
    raise exception 'Message not found';
  end if;
  if v_role <> 'assistant' then
    raise exception 'Only patient replies can be marked as interrupted';
  end if;
  if v_status <> 'active' then
    raise exception 'Session is not active';
  end if;
  if v_heard is not null then
    return false;
  end if;

  update public.session_messages
     set heard_chars = least(p_heard_chars, v_len)
   where id = p_message_id
     and heard_chars is null;

  return found;
end;
$$;

revoke all on function public.mark_assistant_message_heard(uuid, integer) from public, anon;
grant execute on function public.mark_assistant_message_heard(uuid, integer) to authenticated, service_role;

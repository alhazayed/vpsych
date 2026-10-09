-- Cap therapist message length in the database.
--
-- The message API rejects a turn over MAX_TURN_MESSAGE_CHARS (4000,
-- lib/sessions/clinical-turn.ts), but RLS also lets a signed-in user insert
-- their own role = 'user' rows straight through Supabase REST. Without a
-- constraint that path accepts unbounded text, which then reaches the
-- examiner prompt and inflates AI cost. Assistant and system rows are written
-- only by SECURITY DEFINER RPCs and are not capped here.
--
-- char_length counts code points; JavaScript's String.length counts UTF-16
-- units, which is never fewer, so anything the API accepts also passes here.
--
-- Production had no user row over 324 characters when this was written.
--
-- Additive and reversible:
--   alter table public.session_messages
--     drop constraint session_messages_user_content_length_check;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'session_messages_user_content_length_check'
      and conrelid = 'public.session_messages'::regclass
  ) then
    alter table public.session_messages
      add constraint session_messages_user_content_length_check
      check (role <> 'user' or char_length(content) <= 4000);
  end if;
end
$$;

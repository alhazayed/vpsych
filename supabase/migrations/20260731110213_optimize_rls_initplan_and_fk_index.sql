-- Performance hygiene: wrap auth.uid()/is_admin() in scalar subqueries so they
-- are evaluated once per statement (initplan) instead of once per row, and add
-- the missing covering index on sessions.avatar_id. Policy logic is unchanged.

-- profiles
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using ((select auth.uid()) = id or (select public.is_admin()));

drop policy if exists "Admins can update any profile" on public.profiles;
create policy "Admins can update any profile"
  on public.profiles for update
  using ((select public.is_admin()));

drop policy if exists "Users can update own display name" on public.profiles;
create policy "Users can update own display name"
  on public.profiles for update
  using ((select auth.uid()) = id)
  with check (
    (select auth.uid()) = id
    and role = (select role from public.profiles where id = (select auth.uid()))
  );

-- avatars
drop policy if exists "Authenticated can read active avatars" on public.avatars;
create policy "Authenticated can read active avatars"
  on public.avatars for select
  to authenticated
  using (is_active = true or (select public.is_admin()));

drop policy if exists "Admins can insert avatars" on public.avatars;
create policy "Admins can insert avatars"
  on public.avatars for insert
  to authenticated
  with check ((select public.is_admin()));

drop policy if exists "Admins can update avatars" on public.avatars;
create policy "Admins can update avatars"
  on public.avatars for update
  to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admins can delete avatars" on public.avatars;
create policy "Admins can delete avatars"
  on public.avatars for delete
  to authenticated
  using ((select public.is_admin()));

-- sessions
drop policy if exists "Therapists can view own sessions" on public.sessions;
create policy "Therapists can view own sessions"
  on public.sessions for select
  using (therapist_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "Therapists can create own sessions" on public.sessions;
create policy "Therapists can create own sessions"
  on public.sessions for insert
  with check (therapist_id = (select auth.uid()));

drop policy if exists "Therapists can update own sessions" on public.sessions;
create policy "Therapists can update own sessions"
  on public.sessions for update
  using (therapist_id = (select auth.uid()) or (select public.is_admin()));

-- session_messages
drop policy if exists "Participants can view session messages" on public.session_messages;
create policy "Participants can view session messages"
  on public.session_messages for select
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.sessions s
      where s.id = session_messages.session_id
        and s.therapist_id = (select auth.uid())
    )
  );

drop policy if exists "Therapists can insert user messages on own sessions" on public.session_messages;
create policy "Therapists can insert user messages on own sessions"
  on public.session_messages for insert
  to authenticated
  with check (
    role = 'user'
    and exists (
      select 1 from public.sessions s
      where s.id = session_messages.session_id
        and s.therapist_id = (select auth.uid())
        and s.status = 'active'
    )
  );

-- session_reports
drop policy if exists "Admins can view reports" on public.session_reports;
create policy "Admins can view reports"
  on public.session_reports for select
  using ((select public.is_admin()));

drop policy if exists "Admins can update reports" on public.session_reports;
create policy "Admins can update reports"
  on public.session_reports for update
  using ((select public.is_admin()));

-- Covering index for the sessions.avatar_id foreign key
create index if not exists sessions_avatar_id_idx on public.sessions (avatar_id);

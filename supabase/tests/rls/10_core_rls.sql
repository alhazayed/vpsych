-- Database security rules for the core tables, run against a database built
-- from every migration in supabase/migrations (see scripts/test-db-rls.sh).
-- Everything runs in one transaction that is rolled back; a failed check
-- raises, and psql's ON_ERROR_STOP turns that into a non-zero exit.

\set ON_ERROR_STOP 1
begin;

-- ── helpers ────────────────────────────────────────────────────────────────
-- Run a statement as a signed-in user (uid) or as anon (uid null), the way
-- PostgREST does: switch role and set the JWT claims auth.uid() reads.
create function pg_temp.become(uid uuid) returns void language plpgsql as $$
begin
  if uid is null then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    perform set_config('role', 'anon', true);
  else
    -- Signed-in users pass two-step login (aal2) unless a check sets
    -- vpsych.test_aal to 'aal1' (password only).
    perform set_config('request.jwt.claims',
      json_build_object('sub', uid, 'role', 'authenticated',
        'aal', coalesce(nullif(current_setting('vpsych.test_aal', true), ''), 'aal2'))::text, true);
    perform set_config('role', 'authenticated', true);
  end if;
end $$;

create function pg_temp.unbecome() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- The statement must return exactly `expected` from its single count column.
create function pg_temp.expect_count(label text, uid uuid, stmt text, expected bigint)
returns void language plpgsql as $$
declare got bigint;
begin
  perform pg_temp.become(uid);
  execute stmt into got;
  perform pg_temp.unbecome();
  if got is distinct from expected then
    raise exception 'FAIL %: expected %, got %', label, expected, got;
  end if;
  raise notice 'ok   %', label;
end $$;

-- The statement must fail; `pattern` (ILIKE) must match the error message.
-- Its effects are rolled back either way.
create function pg_temp.expect_error(label text, uid uuid, stmt text, pattern text)
returns void language plpgsql as $$
declare failed boolean := false; msg text;
begin
  begin
    perform pg_temp.become(uid);
    execute stmt;
    raise exception using errcode = 'P0099', message = 'no error';
  exception when others then
    msg := sqlerrm;
    failed := sqlstate <> 'P0099';
  end;
  perform pg_temp.unbecome();
  if not failed then
    raise exception 'FAIL %: statement succeeded', label;
  end if;
  if msg not ilike pattern then
    raise exception 'FAIL %: wrong error "%"', label, msg;
  end if;
  raise notice 'ok   %', label;
end $$;

-- The statement must succeed. Its effects are rolled back.
create function pg_temp.expect_ok(label text, uid uuid, stmt text)
returns void language plpgsql as $$
declare msg text;
begin
  begin
    perform pg_temp.become(uid);
    execute stmt;
    raise exception using errcode = 'P0098', message = 'rollback';
  exception when others then
    msg := sqlerrm;
    if sqlstate <> 'P0098' then
      perform pg_temp.unbecome();
      raise exception 'FAIL %: %', label, msg;
    end if;
  end;
  perform pg_temp.unbecome();
  raise notice 'ok   %', label;
end $$;

-- ── fixtures ───────────────────────────────────────────────────────────────
-- A and B are approved trainees, C is an approved admin, P is pending.
insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a@rls.invalid', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'b@rls.invalid', 'authenticated', 'authenticated'),
  ('cccccccc-0000-4000-8000-000000000003', 'c@rls.invalid', 'authenticated', 'authenticated'),
  ('dddddddd-0000-4000-8000-000000000004', 'p@rls.invalid', 'authenticated', 'authenticated');

-- The role/approval guard triggers block these updates even for postgres;
-- fixtures bypass triggers, the checks below do not.
set local session_replication_role = replica;
update public.profiles set approval_status = 'approved'
  where id in ('aaaaaaaa-0000-4000-8000-000000000001',
               'bbbbbbbb-0000-4000-8000-000000000002',
               'cccccccc-0000-4000-8000-000000000003');
update public.profiles set role = 'admin'
  where id = 'cccccccc-0000-4000-8000-000000000003';
set local session_replication_role = origin;

do $$
begin
  if (select count(*) from public.profiles where id in (
        'aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002',
        'cccccccc-0000-4000-8000-000000000003', 'dddddddd-0000-4000-8000-000000000004')) <> 4 then
    raise exception 'FAIL fixtures: sign-up did not create profiles';
  end if;
  if not exists (select 1 from public.avatars) then
    raise exception 'FAIL fixtures: no avatars seeded';
  end if;
end $$;

-- A: one active session (a1) and one finished session with a report (a2).
-- B: one active session (b1).
insert into public.sessions (id, therapist_id, avatar_id)
  select 'a1000000-0000-4000-8000-000000000000', 'aaaaaaaa-0000-4000-8000-000000000001', id
  from public.avatars order by id limit 1;
insert into public.sessions (id, therapist_id, avatar_id)
  select 'a2000000-0000-4000-8000-000000000000', 'aaaaaaaa-0000-4000-8000-000000000001', id
  from public.avatars order by id limit 1;
insert into public.sessions (id, therapist_id, avatar_id)
  select 'b1000000-0000-4000-8000-000000000000', 'bbbbbbbb-0000-4000-8000-000000000002', id
  from public.avatars order by id limit 1;
insert into public.session_messages (session_id, role, content) values
  ('a1000000-0000-4000-8000-000000000000', 'assistant', 'patient line'),
  ('b1000000-0000-4000-8000-000000000000', 'assistant', 'patient line');
update public.sessions set status = 'completed', ended_at = now()
  where id = 'a2000000-0000-4000-8000-000000000000';
insert into public.session_reports (session_id, narrative)
  values ('a2000000-0000-4000-8000-000000000000', 'report');
-- A has a learner profile (an engine table whose admin policy used to inline
-- the role check instead of calling is_admin()).
set local session_replication_role = replica;
insert into public.learner_profiles (user_id) values ('aaaaaaaa-0000-4000-8000-000000000001');
set local session_replication_role = origin;

-- ── every public table has RLS on ──────────────────────────────────────────
do $$
declare missing text;
begin
  select string_agg(c.relname, ', ') into missing
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity;
  if missing is not null then
    raise exception 'FAIL rls enabled: no RLS on %', missing;
  end if;
  raise notice 'ok   every public table has RLS enabled';
end $$;

-- ── reads ──────────────────────────────────────────────────────────────────
select pg_temp.expect_count('trainee sees only own sessions',
  'aaaaaaaa-0000-4000-8000-000000000001', 'select count(*) from public.sessions', 2);
select pg_temp.expect_count('trainee cannot see another trainee''s session',
  'aaaaaaaa-0000-4000-8000-000000000001',
  $q$select count(*) from public.sessions where id = 'b1000000-0000-4000-8000-000000000000'$q$, 0);
select pg_temp.expect_count('trainee cannot read another trainee''s messages',
  'aaaaaaaa-0000-4000-8000-000000000001',
  $q$select count(*) from public.session_messages where session_id = 'b1000000-0000-4000-8000-000000000000'$q$, 0);
select pg_temp.expect_count('trainee sees only own profile',
  'aaaaaaaa-0000-4000-8000-000000000001', 'select count(*) from public.profiles', 1);
select pg_temp.expect_count('trainee cannot read reports, even on own session',
  'aaaaaaaa-0000-4000-8000-000000000001', 'select count(*) from public.session_reports', 0);
select pg_temp.expect_count('admin can read reports',
  'cccccccc-0000-4000-8000-000000000003',
  $q$select count(*) from public.session_reports where session_id = 'a2000000-0000-4000-8000-000000000000'$q$, 1);
select pg_temp.expect_count('pending account cannot read sessions',
  'dddddddd-0000-4000-8000-000000000004', 'select count(*) from public.sessions', 0);
select pg_temp.expect_count('trainee can read active patients',
  'aaaaaaaa-0000-4000-8000-000000000001',
  'select (count(*) > 0)::int from public.avatars', 1);
select pg_temp.expect_count('pending account cannot read patients',
  'dddddddd-0000-4000-8000-000000000004', 'select count(*) from public.avatars', 0);
select pg_temp.expect_count('pending account still reads its own profile',
  'dddddddd-0000-4000-8000-000000000004', 'select count(*) from public.profiles', 1);
-- An account waiting for approval (or rejected) reads nothing else at all.
do $$
declare t text; got bigint; leaked text;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v') and c.relname <> 'profiles'
      and has_table_privilege('authenticated', c.oid, 'select')
    order by 1
  loop
    perform pg_temp.become('dddddddd-0000-4000-8000-000000000004');
    execute format('select count(*) from public.%I', t) into got;
    perform pg_temp.unbecome();
    if got > 0 then
      leaked := concat_ws(', ', leaked, format('%s (%s)', t, got));
    end if;
  end loop;
  if leaked is not null then
    raise exception 'FAIL pending account reads rows from %', leaked;
  end if;
  raise notice 'ok   pending account reads no table but its own profile';
end $$;
-- New tables need the same rule, whether or not they have rows here.
do $$
declare missing text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into missing
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname <> 'profiles'
    and not exists (
      select 1 from pg_policies p
      where p.schemaname = 'public' and p.tablename = c.relname
        and p.permissive = 'RESTRICTIVE' and p.cmd in ('SELECT', 'ALL')
        and 'authenticated' = any (p.roles) and p.qual ~ 'is_approved\(\)');
  if missing is not null then
    raise exception 'FAIL approval rule: no "Approved accounts only" policy on %', missing;
  end if;
  raise notice 'ok   every public table but profiles requires an approved account';
end $$;
select pg_temp.expect_error('anon cannot read profiles', null,
  'select count(*) from public.profiles', '%permission denied%');
select pg_temp.expect_error('anon cannot read sessions', null,
  'select count(*) from public.sessions', '%permission denied%');
select pg_temp.expect_error('anon cannot read reports', null,
  'select count(*) from public.session_reports', '%permission denied%');

-- ── training ladder: a sealed level's case ─────────────────────────────────
-- A's session a1 uses case c1 in the clear. A's ladder session a3 keeps its
-- case (c2) sealed in the row, so A may not read c2's case_instances row, but
-- the patient's memory for c2 keeps working.
insert into public.case_instances (id, assessment_id, avatar_id, primary_disorder_id, clinical_snapshot, created_by)
  select v.id, v.assessment_id, a.id, d.id, '{}'::jsonb, 'aaaaaaaa-0000-4000-8000-000000000001'
  from (values ('c1000000-0000-4000-8000-000000000000'::uuid, 'RLS-CASE-1'),
               ('c2000000-0000-4000-8000-000000000000'::uuid, 'RLS-CASE-2')) v (id, assessment_id),
       (select id from public.avatars order by id limit 1) a,
       (select id from public.disorders order by id limit 1) d;
insert into public.case_memory (case_instance_id) values
  ('c1000000-0000-4000-8000-000000000000'), ('c2000000-0000-4000-8000-000000000000');
update public.sessions set case_instance_id = 'c1000000-0000-4000-8000-000000000000'
  where id = 'a1000000-0000-4000-8000-000000000000';
insert into public.sessions (id, therapist_id, avatar_id, case_instance_id, sealed_case)
  select 'a3000000-0000-4000-8000-000000000000', 'aaaaaaaa-0000-4000-8000-000000000001', id,
         'c2000000-0000-4000-8000-000000000000', 'v1.r.sealed'
  from public.avatars order by id limit 1;

select pg_temp.expect_count('trainee reads the case of an ordinary session',
  'aaaaaaaa-0000-4000-8000-000000000001',
  $q$select count(*) from public.case_instances where id = 'c1000000-0000-4000-8000-000000000000'$q$, 1);
select pg_temp.expect_count('trainee cannot read a sealed ladder case',
  'aaaaaaaa-0000-4000-8000-000000000001',
  $q$select count(*) from public.case_instances where id = 'c2000000-0000-4000-8000-000000000000'$q$, 0);
select pg_temp.expect_count('admin reads a sealed ladder case',
  'cccccccc-0000-4000-8000-000000000003',
  $q$select count(*) from public.case_instances where id = 'c2000000-0000-4000-8000-000000000000'$q$, 1);
select pg_temp.expect_count('trainee keeps the patient memory of a sealed case',
  'aaaaaaaa-0000-4000-8000-000000000001',
  $q$with u as (update public.case_memory set memory = '{"turns": []}'::jsonb
     where case_instance_id = 'c2000000-0000-4000-8000-000000000000' returning 1) select count(*) from u$q$, 1);
select pg_temp.expect_count('trainee cannot read another trainee''s case memory',
  'bbbbbbbb-0000-4000-8000-000000000002', 'select count(*) from public.case_memory', 0);
select pg_temp.expect_error('trainee cannot unseal a ladder session',
  'aaaaaaaa-0000-4000-8000-000000000001',
  $q$update public.sessions set sealed_case = null
     where id = 'a3000000-0000-4000-8000-000000000000'$q$,
  '%Cannot change skill test link%');

-- ── trainee feedback (my_session_feedback) ────────────────────────────────
-- A's finished session a2 gets a report with scores and words for the
-- trainee. A reads the words only; nobody else gets a row.
set local session_replication_role = replica;
update public.session_reports
  set scores = '{"overall": 72, "items": [{"id": "alliance", "score": 4}],
                 "trainee_feedback": {"strengths": ["You asked open questions."],
                                      "missed": [], "next_steps": []},
                 "scientific_provenance": {"assessment_mode": "llm_examiner"}}'::jsonb
  where session_id = 'a2000000-0000-4000-8000-000000000000';
set local session_replication_role = origin;

select pg_temp.expect_count('trainee reads the feedback words of own report',
  'aaaaaaaa-0000-4000-8000-000000000001',
  $q$select count(*) from public.my_session_feedback('a2000000-0000-4000-8000-000000000000')
     where feedback -> 'strengths' ->> 0 = 'You asked open questions.'
       and assessment_mode = 'llm_examiner'$q$, 1);
select pg_temp.expect_count('feedback carries no scores',
  'aaaaaaaa-0000-4000-8000-000000000001',
  $q$select count(*) from public.my_session_feedback('a2000000-0000-4000-8000-000000000000')
     where feedback ? 'overall' or feedback ? 'items'$q$, 0);
select pg_temp.expect_count('trainee cannot read another trainee''s feedback',
  'bbbbbbbb-0000-4000-8000-000000000002',
  $q$select count(*) from public.my_session_feedback('a2000000-0000-4000-8000-000000000000')$q$, 0);
select pg_temp.expect_count('trainee still cannot read the report itself',
  'aaaaaaaa-0000-4000-8000-000000000001', 'select count(*) from public.session_reports', 0);
select pg_temp.expect_error('anon cannot read feedback', null,
  $q$select count(*) from public.my_session_feedback('a2000000-0000-4000-8000-000000000000')$q$,
  '%permission denied%');
do $$
declare args text[];
begin
  select proargnames into args from pg_proc
  where oid = 'public.my_session_feedback(uuid)'::regprocedure;
  if args is distinct from array['p_session_id', 'feedback', 'assessment_mode'] then
    raise exception 'FAIL my_session_feedback returns more than feedback words: %', args;
  end if;
  raise notice 'ok   my_session_feedback returns only feedback and assessment_mode';
end $$;
-- A skill test session never shows feedback (results go to the supervisor).
-- Triggers and FK checks are off while the link is faked and restored.
set local session_replication_role = replica;
update public.sessions set skill_test_assignment_id = 'e1000000-0000-4000-8000-000000000000'
  where id = 'a2000000-0000-4000-8000-000000000000';
set local session_replication_role = origin;
select pg_temp.expect_count('no feedback for a skill test session',
  'aaaaaaaa-0000-4000-8000-000000000001',
  $q$select count(*) from public.my_session_feedback('a2000000-0000-4000-8000-000000000000')$q$, 0);
set local session_replication_role = replica;
update public.sessions set skill_test_assignment_id = null
  where id = 'a2000000-0000-4000-8000-000000000000';
set local session_replication_role = origin;

-- ── message writes ─────────────────────────────────────────────────────────
select pg_temp.expect_ok('trainee can add a therapist message to own active session',
  'aaaaaaaa-0000-4000-8000-000000000001',
  $q$insert into public.session_messages (session_id, role, content)
     values ('a1000000-0000-4000-8000-000000000000', 'user', 'hello')$q$);
select pg_temp.expect_error('trainee cannot write a patient message directly',
  'aaaaaaaa-0000-4000-8000-000000000001',
  $q$insert into public.session_messages (session_id, role, content)
     values ('a1000000-0000-4000-8000-000000000000', 'assistant', 'forged')$q$,
  '%row-level security%');
select pg_temp.expect_error('trainee cannot write into another trainee''s session',
  'aaaaaaaa-0000-4000-8000-000000000001',
  $q$insert into public.session_messages (session_id, role, content)
     values ('b1000000-0000-4000-8000-000000000000', 'user', 'x')$q$,
  '%row-level security%');
select pg_temp.expect_error('trainee cannot write into a finished session',
  'aaaaaaaa-0000-4000-8000-000000000001',
  $q$insert into public.session_messages (session_id, role, content)
     values ('a2000000-0000-4000-8000-000000000000', 'user', 'late')$q$,
  '%row-level security%');
select pg_temp.expect_error('therapist message over 4000 characters is refused',
  'aaaaaaaa-0000-4000-8000-000000000001',
  $q$insert into public.session_messages (session_id, role, content)
     values ('a1000000-0000-4000-8000-000000000000', 'user', repeat('x', 4001))$q$,
  '%session_messages_user_content_length_check%');
select pg_temp.expect_error('trainee cannot write a report',
  'aaaaaaaa-0000-4000-8000-000000000001',
  $q$insert into public.session_reports (session_id, narrative)
     values ('a1000000-0000-4000-8000-000000000000', 'self-graded')$q$,
  '%row-level security%');

-- ── account management (admin_delete_account) ─────────────────────────────
select pg_temp.expect_error('trainee cannot delete an account',
  'aaaaaaaa-0000-4000-8000-000000000001',
  $q$select public.admin_delete_account('bbbbbbbb-0000-4000-8000-000000000002')$q$,
  '%forbidden%');
select pg_temp.expect_error('anon cannot delete an account', null,
  $q$select public.admin_delete_account('bbbbbbbb-0000-4000-8000-000000000002')$q$,
  '%permission denied%');
select pg_temp.expect_error('admin cannot delete their own account',
  'cccccccc-0000-4000-8000-000000000003',
  $q$select public.admin_delete_account('cccccccc-0000-4000-8000-000000000003')$q$,
  '%cannot_delete_self%');
-- Deleting A removes the sign-in, the profile, and A's sessions, messages and
-- report; B is untouched. Rolled back afterwards.
do $$
begin
  begin
    perform pg_temp.become('cccccccc-0000-4000-8000-000000000003');
    perform public.admin_delete_account('aaaaaaaa-0000-4000-8000-000000000001');
    perform pg_temp.unbecome();
    if exists (select 1 from auth.users where id = 'aaaaaaaa-0000-4000-8000-000000000001')
       or exists (select 1 from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000001')
       or exists (select 1 from public.sessions where therapist_id = 'aaaaaaaa-0000-4000-8000-000000000001')
       or exists (select 1 from public.session_reports where session_id = 'a2000000-0000-4000-8000-000000000000') then
      raise exception 'FAIL admin delete: account rows remain';
    end if;
    if not exists (select 1 from public.sessions where id = 'b1000000-0000-4000-8000-000000000000') then
      raise exception 'FAIL admin delete: another trainee''s session was removed';
    end if;
    raise exception using errcode = 'P0098', message = 'rollback';
  exception when sqlstate 'P0098' then
    null;
  end;
  perform pg_temp.unbecome();
  raise notice 'ok   admin can delete an account and its records';
end $$;

-- ── account and session writes ─────────────────────────────────────────────
select pg_temp.expect_error('trainee cannot make themselves admin',
  'aaaaaaaa-0000-4000-8000-000000000001',
  $q$update public.profiles set role = 'admin' where id = 'aaaaaaaa-0000-4000-8000-000000000001'$q$,
  '%Cannot change role%');
select pg_temp.expect_error('pending account cannot approve itself',
  'dddddddd-0000-4000-8000-000000000004',
  $q$update public.profiles set approval_status = 'approved' where id = 'dddddddd-0000-4000-8000-000000000004'$q$,
  '%Cannot change account approval%');
-- The avatar id is read here, as postgres: the pending account cannot see it.
select pg_temp.expect_error('pending account cannot start a session',
  'dddddddd-0000-4000-8000-000000000004',
  format($q$insert into public.sessions (therapist_id, avatar_id)
     values ('dddddddd-0000-4000-8000-000000000004', %L)$q$,
     (select id from public.avatars order by id limit 1)),
  '%row-level security%');
select pg_temp.expect_error('trainee cannot start a session for someone else',
  'aaaaaaaa-0000-4000-8000-000000000001',
  $q$insert into public.sessions (therapist_id, avatar_id)
     select 'bbbbbbbb-0000-4000-8000-000000000002', id from public.avatars limit 1$q$,
  '%row-level security%');
select pg_temp.expect_count('trainee cannot touch another trainee''s session',
  'aaaaaaaa-0000-4000-8000-000000000001',
  $q$with u as (update public.sessions set status = 'completed'
     where id = 'b1000000-0000-4000-8000-000000000000' returning 1) select count(*) from u$q$, 0);
select pg_temp.expect_count('trainee cannot delete own messages',
  'aaaaaaaa-0000-4000-8000-000000000001',
  $q$with d as (delete from public.session_messages
     where session_id = 'a1000000-0000-4000-8000-000000000000' returning 1) select count(*) from d$q$, 0);

-- ── policies read the caller once per statement ───────────────────────────
-- A bare auth.uid() in a policy is re-evaluated for every row; wrapped as
-- (select auth.uid()) it runs once (Supabase lint auth_rls_initplan).
do $$
declare bad text;
begin
  select string_agg(tablename || ': ' || policyname, ', ') into bad
  from pg_policies
  where schemaname = 'public'
    and regexp_replace(coalesce(qual, '') || ' ' || coalesce(with_check, ''),
                       'select\s+auth\.(uid|role|jwt)\(\)', '', 'gi')
        ~* 'auth\.(uid|role|jwt)\(\)';
  if bad is not null then
    raise exception 'FAIL policies call auth.*() per row; wrap in (select ...): %', bad;
  end if;
  raise notice 'ok   every policy wraps auth.*() in (select ...)';
end $$;

-- ── admin two-step login ───────────────────────────────────────────────────
-- An admin signed in with a password only (aal1) gets no admin powers in the
-- database, the same as the app's admin pages.
do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public'
             and (coalesce(qual, '') || coalesce(with_check, '')) ~* $p$role\s*=\s*'admin'$p$) then
    raise exception 'FAIL admin policies: a policy checks profiles.role inline; call is_admin()';
  end if;
  raise notice 'ok   every admin policy goes through is_admin()';
end $$;

select set_config('vpsych.test_aal', 'aal1', true);
select pg_temp.expect_count('admin without two-step cannot read reports',
  'cccccccc-0000-4000-8000-000000000003', 'select count(*) from public.session_reports', 0);
select pg_temp.expect_count('admin without two-step cannot read trainee sessions',
  'cccccccc-0000-4000-8000-000000000003', 'select count(*) from public.sessions', 0);
select pg_temp.expect_count('admin without two-step sees only own profile',
  'cccccccc-0000-4000-8000-000000000003', 'select count(*) from public.profiles', 1);
select pg_temp.expect_count('admin without two-step cannot read learner profiles',
  'cccccccc-0000-4000-8000-000000000003', 'select count(*) from public.learner_profiles', 0);
select pg_temp.expect_count('admin without two-step cannot edit another profile',
  'cccccccc-0000-4000-8000-000000000003',
  $q$with u as (update public.profiles set display_name = 'x'
     where id = 'aaaaaaaa-0000-4000-8000-000000000001' returning 1) select count(*) from u$q$, 0);
select pg_temp.expect_error('admin without two-step cannot list account approvals',
  'cccccccc-0000-4000-8000-000000000003',
  'select count(*) from public.list_account_approvals()', '%forbidden%');

select set_config('vpsych.test_aal', 'aal2', true);
select pg_temp.expect_count('admin with two-step can read learner profiles',
  'cccccccc-0000-4000-8000-000000000003', 'select count(*) from public.learner_profiles', 1);
select pg_temp.expect_count('admin with two-step can read trainee sessions',
  'cccccccc-0000-4000-8000-000000000003', 'select count(*) from public.sessions', 4);
select pg_temp.expect_ok('admin with two-step can list account approvals',
  'cccccccc-0000-4000-8000-000000000003', 'select count(*) from public.list_account_approvals()');

-- ── training certificates ──────────────────────────────────────────────────
-- B clears the top level of every active program patient; the grade trigger's
-- update issues one certificate automatically.
do $$
declare p record; s uuid;
begin
  for p in select key, avatar_id from public.training_ladder_patients where is_active loop
    s := gen_random_uuid();
    insert into public.sessions (id, therapist_id, avatar_id) values
      (s, 'bbbbbbbb-0000-4000-8000-000000000002', p.avatar_id);
    update public.sessions set status = 'completed', ended_at = now() where id = s;
    insert into public.training_ladder_attempts (session_id, therapist_id, patient_key, level)
      values (s, 'bbbbbbbb-0000-4000-8000-000000000002', p.key, 5);
  end loop;
  if not found then
    raise exception 'FAIL fixtures: no active ladder patients';
  end if;
  update public.training_ladder_attempts set status = 'passed'
    where therapist_id = 'bbbbbbbb-0000-4000-8000-000000000002';
  if (select count(*) from public.enterprise_certificates
      where user_id = 'bbbbbbbb-0000-4000-8000-000000000002'
        and program = 'training_program' and source = 'training_ladder'
        and verification_code ~ '^VT-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$') <> 1 then
    raise exception 'FAIL certificate: clearing the ladder did not issue one certificate';
  end if;
  -- Passing a top level again does not issue a second one.
  update public.training_ladder_attempts set status = 'failed'
    where id = (select id from public.training_ladder_attempts
                where therapist_id = 'bbbbbbbb-0000-4000-8000-000000000002' limit 1);
  update public.training_ladder_attempts set status = 'passed'
    where therapist_id = 'bbbbbbbb-0000-4000-8000-000000000002';
  if (select count(*) from public.enterprise_certificates
      where user_id = 'bbbbbbbb-0000-4000-8000-000000000002') <> 1 then
    raise exception 'FAIL certificate: a replayed pass issued a second certificate';
  end if;
  -- A has not cleared the ladder.
  if exists (select 1 from public.enterprise_certificates
             where user_id = 'aaaaaaaa-0000-4000-8000-000000000001') then
    raise exception 'FAIL certificate: issued without clearing the ladder';
  end if;
  raise notice 'ok   clearing the ladder issues one certificate, once';
end $$;

create temp table cert_b as
  select id, verification_code from public.enterprise_certificates
  where user_id = 'bbbbbbbb-0000-4000-8000-000000000002';
grant select on cert_b to anon, authenticated;

select pg_temp.expect_count('anyone can verify a certificate number', null,
  'select count(*) from public.verify_training_certificate((select lower(verification_code) from cert_b))', 1);
select pg_temp.expect_count('an unknown certificate number verifies as nothing', null,
  $q$select count(*) from public.verify_training_certificate('VT-0000-0000-0000')$q$, 0);
select pg_temp.expect_count('trainee reads own certificate',
  'bbbbbbbb-0000-4000-8000-000000000002', 'select count(*) from public.enterprise_certificates', 1);
select pg_temp.expect_count('trainee cannot read another trainee''s certificate',
  'aaaaaaaa-0000-4000-8000-000000000001', 'select count(*) from public.enterprise_certificates', 0);
select pg_temp.expect_error('trainee cannot issue a certificate',
  'aaaaaaaa-0000-4000-8000-000000000001',
  $q$select public.admin_issue_training_certificate('aaaaaaaa-0000-4000-8000-000000000001', 'A')$q$,
  '%forbidden%');
select pg_temp.expect_error('trainee cannot write a certificate row directly',
  'aaaaaaaa-0000-4000-8000-000000000001',
  $q$insert into public.enterprise_certificates (user_id, kind, title, verification_code, qr_payload)
     values ('aaaaaaaa-0000-4000-8000-000000000001', 'course', 'x', 'VT-FAKE-FAKE-FAKE', 'x')$q$,
  '%row-level security%');
select pg_temp.expect_error('trainee cannot revoke a certificate',
  'bbbbbbbb-0000-4000-8000-000000000002',
  'select public.admin_revoke_training_certificate((select id from cert_b))', '%forbidden%');
select pg_temp.expect_error('anon cannot issue a certificate', null,
  $q$select public.admin_issue_training_certificate('aaaaaaaa-0000-4000-8000-000000000001', 'A')$q$,
  '%permission denied%');
select set_config('vpsych.test_aal', 'aal1', true);
select pg_temp.expect_error('admin without two-step cannot issue a certificate',
  'cccccccc-0000-4000-8000-000000000003',
  $q$select public.admin_issue_training_certificate('aaaaaaaa-0000-4000-8000-000000000001', 'A')$q$,
  '%forbidden%');
select set_config('vpsych.test_aal', 'aal2', true);
select pg_temp.expect_error('admin cannot issue a second active certificate',
  'cccccccc-0000-4000-8000-000000000003',
  $q$select public.admin_issue_training_certificate('bbbbbbbb-0000-4000-8000-000000000002', 'B')$q$,
  '%already_issued%');
select pg_temp.expect_ok('admin can issue a certificate',
  'cccccccc-0000-4000-8000-000000000003',
  $q$select public.admin_issue_training_certificate('aaaaaaaa-0000-4000-8000-000000000001', 'Trainee A', 'Institute', 'ar')$q$);

-- Revoking: verification reports it, the ladder does not re-issue it, and an
-- admin may issue a new one.
do $$
begin
  perform pg_temp.become('cccccccc-0000-4000-8000-000000000003');
  perform public.admin_revoke_training_certificate((select id from cert_b), 'wrong name');
  perform pg_temp.unbecome();
  perform pg_temp.become(null);
  if not (select v.revoked from public.verify_training_certificate((select verification_code from cert_b)) v) then
    raise exception 'FAIL certificate: revoked certificate verifies as valid';
  end if;
  perform pg_temp.unbecome();
  update public.training_ladder_attempts set status = 'failed'
    where id = (select id from public.training_ladder_attempts
                where therapist_id = 'bbbbbbbb-0000-4000-8000-000000000002' limit 1);
  update public.training_ladder_attempts set status = 'passed'
    where therapist_id = 'bbbbbbbb-0000-4000-8000-000000000002';
  if exists (select 1 from public.enterprise_certificates
             where user_id = 'bbbbbbbb-0000-4000-8000-000000000002' and not revoked) then
    raise exception 'FAIL certificate: the ladder re-issued a revoked certificate';
  end if;
  perform pg_temp.become('cccccccc-0000-4000-8000-000000000003');
  perform public.admin_issue_training_certificate('bbbbbbbb-0000-4000-8000-000000000002', 'Trainee B');
  perform pg_temp.unbecome();
  raise notice 'ok   revoked certificates verify as revoked and are not re-issued automatically';
end $$;
select pg_temp.expect_error('a certificate cannot be revoked twice',
  'cccccccc-0000-4000-8000-000000000003',
  'select public.admin_revoke_training_certificate((select id from cert_b))', '%already_revoked%');

rollback;

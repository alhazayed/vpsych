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
    perform set_config('request.jwt.claims',
      json_build_object('sub', uid, 'role', 'authenticated')::text, true);
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
select pg_temp.expect_error('anon cannot read profiles', null,
  'select count(*) from public.profiles', '%permission denied%');
select pg_temp.expect_error('anon cannot read sessions', null,
  'select count(*) from public.sessions', '%permission denied%');
select pg_temp.expect_error('anon cannot read reports', null,
  'select count(*) from public.session_reports', '%permission denied%');

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

-- ── account and session writes ─────────────────────────────────────────────
select pg_temp.expect_error('trainee cannot make themselves admin',
  'aaaaaaaa-0000-4000-8000-000000000001',
  $q$update public.profiles set role = 'admin' where id = 'aaaaaaaa-0000-4000-8000-000000000001'$q$,
  '%Cannot change role%');
select pg_temp.expect_error('pending account cannot approve itself',
  'dddddddd-0000-4000-8000-000000000004',
  $q$update public.profiles set approval_status = 'approved' where id = 'dddddddd-0000-4000-8000-000000000004'$q$,
  '%Cannot change account approval%');
select pg_temp.expect_error('pending account cannot start a session',
  'dddddddd-0000-4000-8000-000000000004',
  $q$insert into public.sessions (therapist_id, avatar_id)
     select 'dddddddd-0000-4000-8000-000000000004', id from public.avatars limit 1$q$,
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

rollback;

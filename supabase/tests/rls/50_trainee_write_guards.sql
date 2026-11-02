-- Signed therapy courses (20261102080000) and trainee write guards
-- (20261102090000): what a trainee's own token can write to therapy courses,
-- profiles, learner profiles and sessions, and what an account awaiting
-- approval can write at all. One transaction, rolled back; a failed check
-- raises.

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
-- T is a trainee, U another trainee, A an admin, P an account still awaiting
-- approval, I an institute.
insert into auth.users (id, email, aud, role) values
  ('91000000-0000-4000-8000-000000000001', 'guard-t@rls.invalid', 'authenticated', 'authenticated'),
  ('92000000-0000-4000-8000-000000000002', 'guard-u@rls.invalid', 'authenticated', 'authenticated'),
  ('9a000000-0000-4000-8000-0000000000aa', 'guard-a@rls.invalid', 'authenticated', 'authenticated'),
  ('94000000-0000-4000-8000-000000000004', 'guard-p@rls.invalid', 'authenticated', 'authenticated');

set local session_replication_role = replica;
update public.profiles set approval_status = 'approved'
  where id in ('91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000002',
               '9a000000-0000-4000-8000-0000000000aa');
update public.profiles set role = 'admin' where id = '9a000000-0000-4000-8000-0000000000aa';
insert into public.institutions (id, name, slug)
  values ('9e000000-0000-4000-8000-00000000000e', 'Guard Institute', 'guard-institute');
-- T's own case, U's case, T's open course, and a finished session of T.
insert into public.case_instances (id, assessment_id, avatar_id, primary_disorder_id, clinical_snapshot, created_by)
  select v.id, v.assessment_id, a.id, d.id, '{"version":2}'::jsonb, v.owner
  from (values ('9c100000-0000-4000-8000-000000000001'::uuid, 'GUARD-CASE-T', '91000000-0000-4000-8000-000000000001'::uuid),
               ('9c200000-0000-4000-8000-000000000002'::uuid, 'GUARD-CASE-U', '92000000-0000-4000-8000-000000000002'::uuid)) v (id, assessment_id, owner),
       (select id from public.avatars order by id limit 1) a,
       (select id from public.disorders order by id limit 1) d;
insert into public.therapy_courses (id, therapist_id, avatar_id, case_instance_id, clinical_snapshot, max_duration_sec, planned_sessions)
  select '9d100000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', id,
         '9c100000-0000-4000-8000-000000000001', '{"locale":"en-US"}'::jsonb, 2400, 8
  from public.avatars order by id limit 1;
insert into public.therapy_courses (id, therapist_id, avatar_id, clinical_snapshot, status, completed_at, completion_reason, planned_sessions)
  select '9d200000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000001', id,
         '{"locale":"en-US"}'::jsonb, 'completed', now(), 'terminated', 8
  from public.avatars order by id offset 1 limit 1;
insert into public.sessions (id, therapist_id, avatar_id, status, started_at, ended_at, max_duration_sec, language)
  select '9f000000-0000-4000-8000-00000000000f', '91000000-0000-4000-8000-000000000001', id,
         'completed', now() - interval '1 hour', now() - interval '30 minutes', 2400, 'en'
  from public.avatars order by id limit 1;
insert into public.sessions (id, therapist_id, avatar_id, status, max_duration_sec, language)
  select '9f100000-0000-4000-8000-00000000001f', '91000000-0000-4000-8000-000000000001', id,
         'active', 2400, 'en'
  from public.avatars order by id limit 1;
set local session_replication_role = origin;

create temp table guard_avatar as select id from public.avatars order by id offset 2 limit 1;
grant select on guard_avatar to authenticated;
-- A disorder id readable by any role (pending accounts cannot read disorders).
create temp table guard_disorder as select id from public.disorders order by id limit 1;
grant select on guard_disorder to authenticated;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'report_write_key') then
    perform vault.create_secret('rls-test-report-key', 'report_write_key');
  end if;
end $$;

-- SQL that calls create_signed_therapy_course with `row_text`, signed (as
-- postgres, before the role switch) the way POST /api/sessions signs it.
create function pg_temp.signed_course(row_text text) returns text language sql as $$
  select format('select public.create_signed_therapy_course(%L, %L)', row_text,
    encode(extensions.hmac('therapy_course' || E'\n' || row_text,
      (select decrypted_secret from vault.decrypted_secrets where name = 'report_write_key' limit 1),
      'sha256'), 'hex'))
$$;

-- A course row for therapist `uid` as createCourse() builds it, plus `extra`.
create function pg_temp.course_for(uid uuid, extra jsonb default '{}'::jsonb) returns text language sql as $$
  select (jsonb_build_object('therapist_id', uid, 'avatar_id', (select id from guard_avatar),
    'clinical_snapshot', '{"locale":"en-US"}'::jsonb, 'language', 'en-US',
    'max_duration_sec', 2400, 'status', 'active', 'planned_sessions', 8) || extra)::text
$$;

-- ── therapy courses: only signed rows from the server ──────────────────────
select pg_temp.expect_error('trainee cannot insert a course directly',
  '91000000-0000-4000-8000-000000000001',
  $q$insert into public.therapy_courses (therapist_id, avatar_id, clinical_snapshot)
     select '91000000-0000-4000-8000-000000000001', id, '{"clinical_core":{"disorder":"my own patient"}}'::jsonb
     from guard_avatar$q$,
  '%therapy_course_insert_requires_signature%');
select pg_temp.expect_error('trainee cannot call the course function without a signature',
  '91000000-0000-4000-8000-000000000001',
  format('select public.create_signed_therapy_course(%L)', pg_temp.course_for('91000000-0000-4000-8000-000000000001')),
  '%therapy_course_signature_invalid%');
select pg_temp.expect_error('a course signature for another row is refused',
  '91000000-0000-4000-8000-000000000001',
  replace(pg_temp.signed_course(pg_temp.course_for('91000000-0000-4000-8000-000000000001')),
    '"language": "en-US"', '"language": "ar-JO"'),
  '%therapy_course_signature_invalid%');
select pg_temp.expect_error('a session signature does not create a course',
  '91000000-0000-4000-8000-000000000001',
  format('select public.create_signed_therapy_course(%L, %L)',
    pg_temp.course_for('91000000-0000-4000-8000-000000000001'),
    encode(extensions.hmac('session' || E'\n' || pg_temp.course_for('91000000-0000-4000-8000-000000000001'),
      (select decrypted_secret from vault.decrypted_secrets where name = 'report_write_key' limit 1),
      'sha256'), 'hex')),
  '%therapy_course_signature_invalid%');
select pg_temp.expect_error('a signed course for someone else is refused',
  '91000000-0000-4000-8000-000000000001',
  pg_temp.signed_course(pg_temp.course_for('92000000-0000-4000-8000-000000000002')),
  '%Not authorized%');
select pg_temp.expect_error('a signed course with a column the server never writes is refused',
  '91000000-0000-4000-8000-000000000001',
  pg_temp.signed_course(pg_temp.course_for('91000000-0000-4000-8000-000000000001',
    '{"completed_at": "2026-01-01T00:00:00Z"}')),
  '%therapy_course_row_invalid%');
select pg_temp.expect_error('an account awaiting approval cannot create a course',
  '94000000-0000-4000-8000-000000000004',
  pg_temp.signed_course(pg_temp.course_for('94000000-0000-4000-8000-000000000004')),
  '%awaiting approval%');
select pg_temp.expect_error('anon cannot call the course function',
  null,
  pg_temp.signed_course(pg_temp.course_for('91000000-0000-4000-8000-000000000001')),
  '%permission denied%');
select pg_temp.expect_error('a signed course cannot use someone else''s case',
  '91000000-0000-4000-8000-000000000001',
  pg_temp.signed_course(pg_temp.course_for('91000000-0000-4000-8000-000000000001',
    '{"case_instance_id": "9c200000-0000-4000-8000-000000000002"}')),
  '%case_instance_id not owned%');
select pg_temp.expect_error('a signed course cannot have a time limit out of range',
  '91000000-0000-4000-8000-000000000001',
  pg_temp.signed_course(pg_temp.course_for('91000000-0000-4000-8000-000000000001',
    '{"max_duration_sec": 999999}')),
  '%therapy_course_time_limit_out_of_range%');
select pg_temp.expect_ok('a signed course from the server is created',
  '91000000-0000-4000-8000-000000000001',
  pg_temp.signed_course(pg_temp.course_for('91000000-0000-4000-8000-000000000001')));

-- A forged status in a signed row is replaced by the database.
do $$
declare
  v_stmt text := pg_temp.signed_course(pg_temp.course_for('91000000-0000-4000-8000-000000000001',
    '{"status": "completed"}'));
  v_id uuid;
  v_ok boolean;
begin
  perform pg_temp.become('91000000-0000-4000-8000-000000000001');
  execute v_stmt into v_id;
  select status = 'active' and treatment_plan is null and completed_at is null
    into v_ok from public.therapy_courses where id = v_id;
  perform pg_temp.unbecome();
  if v_ok is not true then
    raise exception 'FAIL a forged course status is replaced';
  end if;
  raise notice 'ok   a forged course status is replaced';
end $$;

do $$
declare
  v_row text := pg_temp.course_for('92000000-0000-4000-8000-000000000002');
  v_id uuid;
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('role', 'service_role', true);
  select public.create_signed_therapy_course(v_row) into v_id;
  perform pg_temp.unbecome();
  if v_id is null then
    raise exception 'FAIL service role course create';
  end if;
  raise notice 'ok   service role creates a course without a signature';
end $$;

select pg_temp.expect_ok('admin can still insert a course directly',
  '9a000000-0000-4000-8000-0000000000aa',
  $q$insert into public.therapy_courses (therapist_id, avatar_id, clinical_snapshot)
     select '9a000000-0000-4000-8000-0000000000aa', id, '{}'::jsonb from guard_avatar$q$);

-- ── therapy courses: the patient is fixed ──────────────────────────────────
select pg_temp.expect_error('trainee cannot rewrite the course patient',
  '91000000-0000-4000-8000-000000000001',
  $q$update public.therapy_courses set clinical_snapshot = '{"clinical_core":{"disorder":"mine"}}'::jsonb
     where id = '9d100000-0000-4000-8000-000000000001'$q$,
  '%Cannot change the course patient%');
select pg_temp.expect_error('trainee cannot lengthen course sessions',
  '91000000-0000-4000-8000-000000000001',
  $q$update public.therapy_courses set max_duration_sec = 5400
     where id = '9d100000-0000-4000-8000-000000000001'$q$,
  '%Cannot change the course patient%');
select pg_temp.expect_error('trainee cannot move the course to another case',
  '91000000-0000-4000-8000-000000000001',
  $q$update public.therapy_courses set case_instance_id = null
     where id = '9d100000-0000-4000-8000-000000000001'$q$,
  '%Cannot change the course patient%');
select pg_temp.expect_ok('trainee can still write the treatment plan',
  '91000000-0000-4000-8000-000000000001',
  $q$update public.therapy_courses
     set treatment_plan = '{"goals":["x"]}'::jsonb, planned_sessions = 10,
         plan_submitted_at = now(), plan_updated_at = now(), updated_at = now()
     where id = '9d100000-0000-4000-8000-000000000001'$q$);
select pg_temp.expect_ok('trainee can still end the course',
  '91000000-0000-4000-8000-000000000001',
  $q$update public.therapy_courses
     set status = 'completed', completed_at = now(), completion_reason = 'terminated', updated_at = now()
     where id = '9d100000-0000-4000-8000-000000000001'$q$);
select pg_temp.expect_error('trainee cannot reopen a finished course',
  '91000000-0000-4000-8000-000000000001',
  $q$update public.therapy_courses set status = 'active', completed_at = null, completion_reason = null
     where id = '9d200000-0000-4000-8000-000000000002'$q$,
  '%Cannot change a finished course%');
select pg_temp.expect_ok('admin can still edit a course',
  '9a000000-0000-4000-8000-0000000000aa',
  $q$update public.therapy_courses set max_duration_sec = 3000
     where id = '9d100000-0000-4000-8000-000000000001'$q$);

-- ── institute fields (finding 2) ───────────────────────────────────────────
select pg_temp.expect_error('trainee cannot put themselves in an institute',
  '91000000-0000-4000-8000-000000000001',
  $q$update public.profiles set primary_institution_id = '9e000000-0000-4000-8000-00000000000e'
     where id = '91000000-0000-4000-8000-000000000001'$q$,
  '%institute or retention%');
select pg_temp.expect_error('trainee cannot change their retention setting',
  '91000000-0000-4000-8000-000000000001',
  $q$update public.profiles set data_retention_days = 1
     where id = '91000000-0000-4000-8000-000000000001'$q$,
  '%institute or retention%');
select pg_temp.expect_ok('trainee can still change name and language',
  '91000000-0000-4000-8000-000000000001',
  $q$update public.profiles set display_name = 'T', preferred_language = 'ar'
     where id = '91000000-0000-4000-8000-000000000001'$q$);
select pg_temp.expect_ok('admin can still place a trainee in an institute',
  '9a000000-0000-4000-8000-0000000000aa',
  $q$update public.profiles set primary_institution_id = '9e000000-0000-4000-8000-00000000000e'
     where id = '91000000-0000-4000-8000-000000000001'$q$);
do $$
declare v_inst uuid;
begin
  perform pg_temp.become('91000000-0000-4000-8000-000000000001');
  insert into public.learner_profiles (user_id, institution_id)
    values ('91000000-0000-4000-8000-000000000001', '9e000000-0000-4000-8000-00000000000e')
    returning institution_id into v_inst;
  perform pg_temp.unbecome();
  if v_inst is not null then
    raise exception 'FAIL learner profile institute is cleared on insert';
  end if;
  raise notice 'ok   learner profile institute is cleared on insert';
end $$;
select pg_temp.expect_error('trainee cannot put their learner profile in an institute',
  '91000000-0000-4000-8000-000000000001',
  $q$update public.learner_profiles set institution_id = '9e000000-0000-4000-8000-00000000000e'
     where user_id = '91000000-0000-4000-8000-000000000001'$q$,
  '%Cannot change institute%');

-- ── accounts awaiting approval write nothing (finding 3) ───────────────────
select pg_temp.expect_error('pending account cannot add a case instance',
  '94000000-0000-4000-8000-000000000004',
  $q$insert into public.case_instances (assessment_id, avatar_id, primary_disorder_id, clinical_snapshot, created_by)
     select 'GUARD-PENDING', (select g.id from guard_avatar g), d.id, '{}'::jsonb, '94000000-0000-4000-8000-000000000004'
     from guard_disorder d$q$,
  '%row-level security%');
select pg_temp.expect_error('pending account cannot add a clinic day',
  '94000000-0000-4000-8000-000000000004',
  $q$insert into public.clinic_days (therapist_id, day_date)
     values ('94000000-0000-4000-8000-000000000004', current_date)$q$,
  '%row-level security%');
select pg_temp.expect_error('pending account cannot add a learner profile',
  '94000000-0000-4000-8000-000000000004',
  $q$insert into public.learner_profiles (user_id) values ('94000000-0000-4000-8000-000000000004')$q$,
  '%row-level security%');
select pg_temp.expect_ok('approved trainee can still add a clinic day',
  '91000000-0000-4000-8000-000000000001',
  $q$insert into public.clinic_days (therapist_id, day_date)
     values ('91000000-0000-4000-8000-000000000001', current_date)$q$);
select pg_temp.expect_ok('approved trainee can still add their case instance',
  '91000000-0000-4000-8000-000000000001',
  $q$insert into public.case_instances (assessment_id, avatar_id, primary_disorder_id, clinical_snapshot, created_by)
     select 'GUARD-APPROVED', (select g.id from guard_avatar g), d.id, '{}'::jsonb, '91000000-0000-4000-8000-000000000001'
     from guard_disorder d$q$);
do $$
declare missing text;
begin
  -- A table with any write policy (other than profiles) needs the approval
  -- rule for writes: FOR ALL, or one each for INSERT, UPDATE and DELETE.
  select string_agg(t, ', ') into missing
  from (
    select distinct p.tablename t
    from pg_policies p
    where p.schemaname = 'public' and p.permissive = 'PERMISSIVE'
      and p.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      and p.tablename <> 'profiles'
  ) w
  where not exists (
      select 1 from pg_policies r
      where r.schemaname = 'public' and r.tablename = w.t
        and r.permissive = 'RESTRICTIVE' and r.cmd = 'ALL' and r.qual ~ 'is_approved\(\)')
    and (
      select count(distinct r.cmd) from pg_policies r
      where r.schemaname = 'public' and r.tablename = w.t
        and r.permissive = 'RESTRICTIVE' and r.cmd in ('INSERT', 'UPDATE', 'DELETE')
        and coalesce(r.with_check, r.qual) ~ 'is_approved\(\)') < 3;
  if missing is not null then
    raise exception 'FAIL write approval rule missing on %', missing;
  end if;
  raise notice 'ok   every table a signed-in user can write requires an approved account';
end $$;

-- ── session fields (finding 4) ─────────────────────────────────────────────
select pg_temp.expect_error('trainee cannot change when a finished session ended',
  '91000000-0000-4000-8000-000000000001',
  $q$update public.sessions set ended_at = now() where id = '9f000000-0000-4000-8000-00000000000f'$q$,
  '%end of a finished session%');
select pg_temp.expect_error('room metrics over 16 KB are refused',
  '91000000-0000-4000-8000-000000000001',
  $q$update public.sessions set immersion_metrics = jsonb_build_object('x', repeat('a', 17000))
     where id = '9f100000-0000-4000-8000-00000000001f'$q$,
  '%sessions_immersion_metrics_size%');
select pg_temp.expect_error('private notes over 20,000 characters are refused',
  '91000000-0000-4000-8000-000000000001',
  $q$update public.sessions set private_notes = repeat('a', 20001)
     where id = '9f100000-0000-4000-8000-00000000001f'$q$,
  '%sessions_private_notes_size%');
select pg_temp.expect_ok('trainee can still end a running session and keep notes',
  '91000000-0000-4000-8000-000000000001',
  $q$update public.sessions set private_notes = 'notes', immersion_metrics = '{"a":1}'::jsonb,
       status = 'completed', ended_at = now()
     where id = '9f100000-0000-4000-8000-00000000001f'$q$);

rollback;

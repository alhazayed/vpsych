-- Course voice cap and assigned patients (20261116120000): who can read and
-- write trainee_patient_assignments, and how charge_course_voice counts a
-- course's patient voice. One transaction, rolled back; a failed check raises.

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
-- T is a trainee with an open course, U another trainee, A an admin, P an
-- account still awaiting approval.
insert into auth.users (id, email, aud, role) values
  ('81000000-0000-4000-8000-000000000001', 'course-t@rls.invalid', 'authenticated', 'authenticated'),
  ('82000000-0000-4000-8000-000000000002', 'course-u@rls.invalid', 'authenticated', 'authenticated'),
  ('8a000000-0000-4000-8000-0000000000aa', 'course-a@rls.invalid', 'authenticated', 'authenticated'),
  ('84000000-0000-4000-8000-000000000004', 'course-p@rls.invalid', 'authenticated', 'authenticated');

set local session_replication_role = replica;
update public.profiles set approval_status = 'approved'
  where id in ('81000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000002',
               '8a000000-0000-4000-8000-0000000000aa');
update public.profiles set role = 'admin' where id = '8a000000-0000-4000-8000-0000000000aa';
insert into public.therapy_courses (id, therapist_id, avatar_id, clinical_snapshot, max_duration_sec, planned_sessions)
  select '8d100000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', id,
         '{"locale":"en-US"}'::jsonb, 2400, 8
  from public.avatars order by id limit 1;
insert into public.trainee_patient_assignments (trainee_id, avatar_id, assigned_by)
  select '81000000-0000-4000-8000-000000000001', id, '8a000000-0000-4000-8000-0000000000aa'
  from public.avatars order by id limit 1;
set local session_replication_role = origin;

create temp table course_avatar as select id from public.avatars order by id offset 1 limit 1;
grant select on course_avatar to authenticated;

-- ── assigned patients ──────────────────────────────────────────────────────
select pg_temp.expect_count('a trainee reads their own assigned patients',
  '81000000-0000-4000-8000-000000000001',
  'select count(*) from public.trainee_patient_assignments', 1);
select pg_temp.expect_count('another trainee reads none of them',
  '82000000-0000-4000-8000-000000000002',
  'select count(*) from public.trainee_patient_assignments', 0);
select pg_temp.expect_count('an account awaiting approval reads none',
  '84000000-0000-4000-8000-000000000004',
  'select count(*) from public.trainee_patient_assignments', 0);
select pg_temp.expect_count('an admin reads every assignment',
  '8a000000-0000-4000-8000-0000000000aa',
  $q$select count(*) from public.trainee_patient_assignments
     where trainee_id = '81000000-0000-4000-8000-000000000001'$q$, 1);

select pg_temp.expect_error('a trainee cannot assign themselves a patient',
  '81000000-0000-4000-8000-000000000001',
  $q$insert into public.trainee_patient_assignments (trainee_id, avatar_id, assigned_by)
     select '81000000-0000-4000-8000-000000000001', id, '81000000-0000-4000-8000-000000000001'
     from course_avatar$q$,
  '%row-level security%');
select pg_temp.expect_count('a trainee cannot remove an assignment',
  '81000000-0000-4000-8000-000000000001',
  $q$with d as (delete from public.trainee_patient_assignments returning 1)
     select count(*) from d$q$, 0);
select pg_temp.expect_ok('an admin assigns a patient',
  '8a000000-0000-4000-8000-0000000000aa',
  $q$insert into public.trainee_patient_assignments (trainee_id, avatar_id, assigned_by)
     select '82000000-0000-4000-8000-000000000002', id, '8a000000-0000-4000-8000-0000000000aa'
     from course_avatar$q$);
select pg_temp.expect_error('an admin cannot sign an assignment as someone else',
  '8a000000-0000-4000-8000-0000000000aa',
  $q$insert into public.trainee_patient_assignments (trainee_id, avatar_id, assigned_by)
     select '82000000-0000-4000-8000-000000000002', id, '81000000-0000-4000-8000-000000000001'
     from course_avatar$q$,
  '%row-level security%');
select set_config('vpsych.test_aal', 'aal1', true);
select pg_temp.expect_error('an admin without two-step login cannot assign',
  '8a000000-0000-4000-8000-0000000000aa',
  $q$insert into public.trainee_patient_assignments (trainee_id, avatar_id, assigned_by)
     select '82000000-0000-4000-8000-000000000002', id, '8a000000-0000-4000-8000-0000000000aa'
     from course_avatar$q$,
  '%row-level security%');
select set_config('vpsych.test_aal', 'aal2', true);

-- ── course voice allowance ─────────────────────────────────────────────────
select pg_temp.expect_error('a trainee cannot write the voice count directly',
  '81000000-0000-4000-8000-000000000001',
  $q$update public.therapy_courses set voice_chars_used = 5
     where id = '8d100000-0000-4000-8000-000000000001'$q$,
  '%cannot change the course voice count%');
select pg_temp.expect_ok('a trainee can still save their treatment plan',
  '81000000-0000-4000-8000-000000000001',
  $q$update public.therapy_courses set treatment_plan = '{"goals":"sleep"}'::jsonb
     where id = '8d100000-0000-4000-8000-000000000001'$q$);
select pg_temp.expect_ok('an admin can correct the voice count',
  '8a000000-0000-4000-8000-0000000000aa',
  $q$update public.therapy_courses set voice_chars_used = 5
     where id = '8d100000-0000-4000-8000-000000000001'$q$);

do $$
declare charged boolean;
begin
  perform pg_temp.become('81000000-0000-4000-8000-000000000001');
  charged := public.charge_course_voice('8d100000-0000-4000-8000-000000000001', 600, 1000);
  perform pg_temp.unbecome();
  if not charged then raise exception 'FAIL the owner charges within the allowance'; end if;
  raise notice 'ok   the owner charges within the allowance';

  perform pg_temp.become('81000000-0000-4000-8000-000000000001');
  charged := public.charge_course_voice('8d100000-0000-4000-8000-000000000001', 500, 1000);
  perform pg_temp.unbecome();
  if charged then raise exception 'FAIL a charge past the allowance is refused'; end if;
  raise notice 'ok   a charge past the allowance is refused';

  perform pg_temp.become('82000000-0000-4000-8000-000000000002');
  charged := public.charge_course_voice('8d100000-0000-4000-8000-000000000001', 10, 1000);
  perform pg_temp.unbecome();
  if charged then raise exception 'FAIL another trainee cannot charge the course'; end if;
  raise notice 'ok   another trainee cannot charge the course';

  if (select voice_chars_used from public.therapy_courses
      where id = '8d100000-0000-4000-8000-000000000001') <> 600 then
    raise exception 'FAIL the course counts only the accepted charge';
  end if;
  raise notice 'ok   the course counts only the accepted charge';
end $$;

select pg_temp.expect_error('a negative charge is refused',
  '81000000-0000-4000-8000-000000000001',
  $q$select public.charge_course_voice('8d100000-0000-4000-8000-000000000001', -600, 1000)$q$,
  '%course_voice_charge_invalid%');
select pg_temp.expect_error('anon cannot charge a course',
  null,
  $q$select public.charge_course_voice('8d100000-0000-4000-8000-000000000001', 10, 1000)$q$,
  '%permission denied%');

rollback;

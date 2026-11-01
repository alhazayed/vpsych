-- Session write hardening (20261028100000): what a trainee's own token can
-- write to sessions, Training Program certificates, institute audit rows and
-- assignment results through the REST API. One transaction, rolled back; a
-- failed check raises.

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
-- T is a trainee, U another trainee, A an admin, M manages institute I,
-- P an account still awaiting approval.
insert into auth.users (id, email, aud, role) values
  ('81000000-0000-4000-8000-000000000001', 'hard-t@rls.invalid', 'authenticated', 'authenticated'),
  ('82000000-0000-4000-8000-000000000002', 'hard-u@rls.invalid', 'authenticated', 'authenticated'),
  ('83000000-0000-4000-8000-000000000003', 'hard-m@rls.invalid', 'authenticated', 'authenticated'),
  ('8a000000-0000-4000-8000-0000000000aa', 'hard-a@rls.invalid', 'authenticated', 'authenticated'),
  ('84000000-0000-4000-8000-000000000004', 'hard-p@rls.invalid', 'authenticated', 'authenticated');

set local session_replication_role = replica;
update public.profiles set approval_status = 'approved'
  where id in ('81000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000002',
               '83000000-0000-4000-8000-000000000003', '8a000000-0000-4000-8000-0000000000aa');
update public.profiles set role = 'admin' where id = '8a000000-0000-4000-8000-0000000000aa';
insert into public.institutions (id, name, slug)
  values ('8e000000-0000-4000-8000-00000000000e', 'Hardening Institute', 'hardening-institute');
insert into public.institution_memberships (institution_id, user_id, role)
  values ('8e000000-0000-4000-8000-00000000000e', '83000000-0000-4000-8000-000000000003', 'institution_admin');
-- U's course and case, and a running session of T.
insert into public.therapy_courses (id, therapist_id, avatar_id, clinical_snapshot, planned_sessions)
  select '8c000000-0000-4000-8000-00000000000c', '82000000-0000-4000-8000-000000000002', id, '{}'::jsonb, 4
  from public.avatars order by id limit 1;
insert into public.sessions (id, therapist_id, avatar_id, status, max_duration_sec, language)
  select '8d000000-0000-4000-8000-00000000000d', '81000000-0000-4000-8000-000000000001', id, 'active', 2400, 'en'
  from public.avatars order by id limit 1;
set local session_replication_role = origin;

create temp table hard_avatar as select id from public.avatars order by id limit 1;
grant select on hard_avatar to authenticated;

-- ── inserts: only signed rows from the server (20261101170000) ─────────────
-- The vault key the server signs with; created here if the database has none.
do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'report_write_key') then
    perform vault.create_secret('rls-test-report-key', 'report_write_key');
  end if;
end $$;

-- SQL that calls create_signed_session with `row_text`, signed (as postgres,
-- before the role switch) the way POST /api/sessions signs it.
create function pg_temp.signed(row_text text) returns text language sql as $$
  select format('select public.create_signed_session(%L, %L)', row_text,
    encode(extensions.hmac('session' || E'\n' || row_text,
      (select decrypted_secret from vault.decrypted_secrets where name = 'report_write_key' limit 1),
      'sha256'), 'hex'))
$$;

-- A session row for therapist `uid` as the start route builds it, plus `extra`.
create function pg_temp.row_for(uid uuid, extra jsonb default '{}'::jsonb) returns text language sql as $$
  select (jsonb_build_object('therapist_id', uid, 'avatar_id', (select id from hard_avatar),
    'status', 'active', 'max_duration_sec', 2400, 'language', 'en-US',
    'clinical_snapshot', '{"locale":"en-US"}'::jsonb) || extra)::text
$$;

select pg_temp.expect_error('trainee cannot insert a session directly',
  '81000000-0000-4000-8000-000000000001',
  $q$insert into public.sessions (therapist_id, avatar_id, max_duration_sec, clinical_snapshot)
     select '81000000-0000-4000-8000-000000000001', id, 2400, '{"persona_prompt":"my own patient"}'::jsonb
     from hard_avatar$q$,
  '%session_insert_requires_signature%');
select pg_temp.expect_error('trainee cannot call the create function without a signature',
  '81000000-0000-4000-8000-000000000001',
  format('select public.create_signed_session(%L)', pg_temp.row_for('81000000-0000-4000-8000-000000000001')),
  '%session_signature_invalid%');
select pg_temp.expect_error('a signature for another row is refused',
  '81000000-0000-4000-8000-000000000001',
  replace(pg_temp.signed(pg_temp.row_for('81000000-0000-4000-8000-000000000001')),
    '"language": "en-US"', '"language": "ar-JO"'),
  '%session_signature_invalid%');
select pg_temp.expect_error('a signed row for someone else is refused',
  '81000000-0000-4000-8000-000000000001',
  pg_temp.signed(pg_temp.row_for('82000000-0000-4000-8000-000000000002')),
  '%Not authorized%');
select pg_temp.expect_error('a signed row with a column the server never writes is refused',
  '81000000-0000-4000-8000-000000000001',
  pg_temp.signed(pg_temp.row_for('81000000-0000-4000-8000-000000000001',
    jsonb_build_object('ended_at', now()))),
  '%session_row_invalid%');
select pg_temp.expect_error('an account awaiting approval cannot start a session',
  '84000000-0000-4000-8000-000000000004',
  pg_temp.signed(pg_temp.row_for('84000000-0000-4000-8000-000000000004')),
  '%awaiting approval%');
select pg_temp.expect_error('anon cannot call the create function',
  null,
  pg_temp.signed(pg_temp.row_for('81000000-0000-4000-8000-000000000001')),
  '%permission denied%');

-- The guard's own checks still run on a signed row.
select pg_temp.expect_error('trainee cannot insert a session with no time limit',
  '81000000-0000-4000-8000-000000000001',
  pg_temp.signed(pg_temp.row_for('81000000-0000-4000-8000-000000000001', '{"max_duration_sec": 999999}')),
  '%session_time_limit_out_of_range%');
select pg_temp.expect_error('trainee cannot insert a session without a time limit',
  '81000000-0000-4000-8000-000000000001',
  pg_temp.signed(pg_temp.row_for('81000000-0000-4000-8000-000000000001', '{"max_duration_sec": null}')),
  '%session_time_limit_out_of_range%');
select pg_temp.expect_error('trainee cannot attach someone else''s therapy course',
  '81000000-0000-4000-8000-000000000001',
  pg_temp.signed(pg_temp.row_for('81000000-0000-4000-8000-000000000001',
    '{"therapy_course_id": "8c000000-0000-4000-8000-00000000000c", "course_session_number": 2}')),
  '%therapy_course_id not owned%');
select pg_temp.expect_ok('the 90-minute preset still starts',
  '81000000-0000-4000-8000-000000000001',
  pg_temp.signed(pg_temp.row_for('81000000-0000-4000-8000-000000000001', '{"max_duration_sec": 5400}')));

-- A forged status and institute in a signed row are replaced by the database.
do $$
declare
  v_stmt text := pg_temp.signed(pg_temp.row_for('81000000-0000-4000-8000-000000000001',
    '{"status": "completed", "institution_id": "8e000000-0000-4000-8000-00000000000e"}'));
  v_id uuid;
  v_ok boolean;
begin
  perform pg_temp.become('81000000-0000-4000-8000-000000000001');
  execute v_stmt into v_id;
  select status = 'active' and started_at <= now() and ended_at is null and institution_id is null
    into v_ok from public.sessions where id = v_id;
  perform pg_temp.unbecome();
  if v_ok is not true then
    raise exception 'FAIL a forged status and institute are replaced';
  end if;
  raise notice 'ok   a forged status and institute are replaced';
end $$;

-- The service role creates sessions without a signature (server without the key).
do $$
declare
  v_row text := pg_temp.row_for('81000000-0000-4000-8000-000000000001');
  v_id uuid;
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('role', 'service_role', true);
  select public.create_signed_session(v_row) into v_id;
  perform pg_temp.unbecome();
  if v_id is null then
    raise exception 'FAIL service role create';
  end if;
  raise notice 'ok   service role creates a session without a signature';
end $$;

-- An admin (two-step login) still inserts admin test sessions directly.
select pg_temp.expect_ok('admin can still insert a session directly',
  '8a000000-0000-4000-8000-0000000000aa',
  $q$insert into public.sessions (therapist_id, avatar_id, max_duration_sec)
     select '8a000000-0000-4000-8000-0000000000aa', id, 2400 from hard_avatar$q$);

-- ── updates on a running session ───────────────────────────────────────────
select pg_temp.expect_error('trainee cannot move their session into an institute',
  '81000000-0000-4000-8000-000000000001',
  $q$update public.sessions set institution_id = '8e000000-0000-4000-8000-00000000000e'
     where id = '8d000000-0000-4000-8000-00000000000d'$q$,
  '%institution_id%');
select pg_temp.expect_error('trainee cannot change the session language once set',
  '81000000-0000-4000-8000-000000000001',
  $q$update public.sessions set language = 'ar' where id = '8d000000-0000-4000-8000-00000000000d'$q$,
  '%language%');
select pg_temp.expect_error('trainee cannot link the session to a course afterwards',
  '81000000-0000-4000-8000-000000000001',
  $q$update public.sessions set therapy_course_id = '8c000000-0000-4000-8000-00000000000c'
     where id = '8d000000-0000-4000-8000-00000000000d'$q$,
  '%therapy course link%');
select pg_temp.expect_ok('trainee can still end their own session',
  '81000000-0000-4000-8000-000000000001',
  $q$update public.sessions set status = 'completed', ended_at = now()
     where id = '8d000000-0000-4000-8000-00000000000d'$q$);
select pg_temp.expect_ok('trainee can still switch the room view',
  '81000000-0000-4000-8000-000000000001',
  $q$update public.sessions set ui_mode = 'therapy_room', immersion_metrics = '{}'::jsonb
     where id = '8d000000-0000-4000-8000-00000000000d'$q$);

-- ── Training Program certificates ──────────────────────────────────────────
select pg_temp.expect_error('institute manager cannot forge a Training Program certificate',
  '83000000-0000-4000-8000-000000000003',
  $q$insert into public.enterprise_certificates
       (institution_id, user_id, kind, title, verification_code, qr_payload, program, source, recipient_name)
     values ('8e000000-0000-4000-8000-00000000000e', '81000000-0000-4000-8000-000000000001', 'course',
             'Training Program completion', 'VT-FAKE-FAKE-FAKE', 'x', 'training_program', 'admin', 'Forged')$q$,
  '%row-level security%');
select pg_temp.expect_ok('institute manager can still issue their own institute certificate',
  '83000000-0000-4000-8000-000000000003',
  $q$insert into public.enterprise_certificates
       (institution_id, user_id, kind, title, verification_code, qr_payload)
     values ('8e000000-0000-4000-8000-00000000000e', '81000000-0000-4000-8000-000000000001', 'course',
             'Institute course', 'INST-0001', '/verify?code=INST-0001')$q$);
select pg_temp.expect_error('trainee cannot write certificates',
  '81000000-0000-4000-8000-000000000001',
  $q$insert into public.enterprise_certificates
       (institution_id, user_id, kind, title, verification_code, qr_payload, program)
     values (null, '81000000-0000-4000-8000-000000000001', 'course', 'x', 'VT-SELF-SELF-SELF', 'x', 'training_program')$q$,
  '%row-level security%');
select pg_temp.expect_ok('admin can still issue a Training Program certificate',
  '8a000000-0000-4000-8000-0000000000aa',
  $q$select public.admin_issue_training_certificate('81000000-0000-4000-8000-000000000001', 'Trainee T')$q$);

-- ── institute audit log ────────────────────────────────────────────────────
select pg_temp.expect_error('trainee cannot add institute audit rows in their own name',
  '81000000-0000-4000-8000-000000000001',
  $q$insert into public.enterprise_audit_events (actor_user_id, action, outcome, resource_type)
     values ('81000000-0000-4000-8000-000000000001', 'x', 'success', 'y')$q$,
  '%row-level security%');
select pg_temp.expect_error('manager cannot write audit rows in someone else''s name',
  '83000000-0000-4000-8000-000000000003',
  $q$insert into public.enterprise_audit_events (institution_id, actor_user_id, action, outcome, resource_type)
     values ('8e000000-0000-4000-8000-00000000000e', '81000000-0000-4000-8000-000000000001', 'x', 'success', 'y')$q$,
  '%row-level security%');

rollback;

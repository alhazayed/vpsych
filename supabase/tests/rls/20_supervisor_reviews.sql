-- Supervisor review of session reports (20261025213000), run against a
-- database built from every migration (see scripts/test-db-rls.sh). One
-- transaction, rolled back; a failed check raises.

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
-- S supervises T1 (linked). S2 is another supervisor, who assigned T1 a skill
-- test. T2 is a trainee nobody is linked to. A is an admin.
insert into auth.users (id, email, aud, role) values
  ('51000000-0000-4000-8000-000000000001', 's@rls.invalid', 'authenticated', 'authenticated'),
  ('52000000-0000-4000-8000-000000000002', 's2@rls.invalid', 'authenticated', 'authenticated'),
  ('71000000-0000-4000-8000-000000000001', 't1@rls.invalid', 'authenticated', 'authenticated'),
  ('72000000-0000-4000-8000-000000000002', 't2@rls.invalid', 'authenticated', 'authenticated'),
  ('a1000000-0000-4000-8000-0000000000aa', 'admin@rls.invalid', 'authenticated', 'authenticated');

set local session_replication_role = replica;
update public.profiles set approval_status = 'approved'
  where id in ('51000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000002',
               '71000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000002',
               'a1000000-0000-4000-8000-0000000000aa');
update public.profiles set role = 'admin' where id = 'a1000000-0000-4000-8000-0000000000aa';
insert into public.supervisors (user_id) values
  ('51000000-0000-4000-8000-000000000001'), ('52000000-0000-4000-8000-000000000002');
insert into public.supervisor_trainees (supervisor_id, trainee_id) values
  ('51000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001');

-- T1: practice session p1 (report), p2 (running, no report), and skill test
-- session x1 (report) from S2's assignment. T2: practice session q1 (report).
insert into public.skill_test_assignments
  (id, supervisor_id, trainee_id, avatar_id, title, language, disorder_slug,
   difficulty, required_sessions, sealed_spec, status)
  select 'e1000000-0000-4000-8000-000000000000', '52000000-0000-4000-8000-000000000002',
         '71000000-0000-4000-8000-000000000001', id, 'Exam', 'en-US', 'mdd',
         'beginner', 1, 'v1.sealed', 'in_progress'
  from public.avatars order by id limit 1;
insert into public.sessions (id, therapist_id, avatar_id, status, skill_test_assignment_id, test_session_number)
  select v.id, v.who, a.id, v.status::public.session_status, v.test, v.n
  from (values
    ('d1000000-0000-4000-8000-000000000001'::uuid, '71000000-0000-4000-8000-000000000001'::uuid, 'completed', null::uuid, null::int),
    ('d2000000-0000-4000-8000-000000000002'::uuid, '71000000-0000-4000-8000-000000000001'::uuid, 'active', null, null),
    ('d3000000-0000-4000-8000-000000000003'::uuid, '71000000-0000-4000-8000-000000000001'::uuid, 'completed',
       'e1000000-0000-4000-8000-000000000000'::uuid, 1),
    ('d4000000-0000-4000-8000-000000000004'::uuid, '72000000-0000-4000-8000-000000000002'::uuid, 'completed', null, null)
  ) v (id, who, status, test, n),
  (select id from public.avatars order by id limit 1) a;
insert into public.session_messages (session_id, role, content) values
  ('d1000000-0000-4000-8000-000000000001', 'assistant', 'p1 line'),
  ('d3000000-0000-4000-8000-000000000003', 'assistant', 'x1 line'),
  ('d4000000-0000-4000-8000-000000000004', 'assistant', 'q1 line');
insert into public.session_reports (session_id, narrative, scores) values
  ('d1000000-0000-4000-8000-000000000001', 'p1 report', '{"overall": 60, "items": []}'),
  ('d3000000-0000-4000-8000-000000000003', 'x1 report', '{"overall": 50, "items": []}'),
  ('d4000000-0000-4000-8000-000000000004', 'q1 report', '{"overall": 70, "items": []}');
set local session_replication_role = origin;

-- ── linked supervisor reads practice results ───────────────────────────────
select pg_temp.expect_count('linked supervisor sees the trainee''s practice sessions',
  '51000000-0000-4000-8000-000000000001',
  $q$select count(*) from public.sessions where therapist_id = '71000000-0000-4000-8000-000000000001'$q$, 2);
select pg_temp.expect_count('linked supervisor cannot see another supervisor''s skill test session',
  '51000000-0000-4000-8000-000000000001',
  $q$select count(*) from public.sessions where id = 'd3000000-0000-4000-8000-000000000003'$q$, 0);
select pg_temp.expect_count('linked supervisor cannot see an unlinked trainee''s session',
  '51000000-0000-4000-8000-000000000001',
  $q$select count(*) from public.sessions where therapist_id = '72000000-0000-4000-8000-000000000002'$q$, 0);
select pg_temp.expect_count('linked supervisor reads the practice report only',
  '51000000-0000-4000-8000-000000000001',
  'select count(*) from public.session_reports', 1);
select pg_temp.expect_count('linked supervisor reads the practice transcript only',
  '51000000-0000-4000-8000-000000000001',
  'select count(*) from public.session_messages', 1);
select pg_temp.expect_count('linked supervisor reads own and linked trainee profiles only',
  '51000000-0000-4000-8000-000000000001',
  $q$select count(*) from public.profiles where id in ('51000000-0000-4000-8000-000000000001',
     '71000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000002')$q$, 2);
select pg_temp.expect_count('linked supervisor sees own links only',
  '51000000-0000-4000-8000-000000000001', 'select count(*) from public.supervisor_trainees', 1);
select pg_temp.expect_count('other supervisor sees no links',
  '52000000-0000-4000-8000-000000000002', 'select count(*) from public.supervisor_trainees', 0);
select pg_temp.expect_count('assigning supervisor still sees only the test session, not practice',
  '52000000-0000-4000-8000-000000000002', 'select count(*) from public.sessions', 1);
select pg_temp.expect_count('trainee cannot read their supervisor links',
  '71000000-0000-4000-8000-000000000001', 'select count(*) from public.supervisor_trainees', 0);
select pg_temp.expect_count('trainee still cannot read reports',
  '71000000-0000-4000-8000-000000000001', 'select count(*) from public.session_reports', 0);
select pg_temp.expect_count('trainee still sees only own sessions',
  '72000000-0000-4000-8000-000000000002', 'select count(*) from public.sessions', 1);

-- ── links are admin-written ────────────────────────────────────────────────
select pg_temp.expect_error('supervisor cannot link a trainee to themselves',
  '51000000-0000-4000-8000-000000000001',
  $q$insert into public.supervisor_trainees (supervisor_id, trainee_id, linked_by)
     values ('51000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000002',
             '51000000-0000-4000-8000-000000000001')$q$,
  '%row-level security%');
select pg_temp.expect_count('supervisor cannot remove a link',
  '51000000-0000-4000-8000-000000000001',
  $q$with d as (delete from public.supervisor_trainees returning 1) select count(*) from d$q$, 0);
select pg_temp.expect_ok('admin can link a supervisor to a trainee',
  'a1000000-0000-4000-8000-0000000000aa',
  $q$insert into public.supervisor_trainees (supervisor_id, trainee_id, linked_by)
     values ('51000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000002',
             'a1000000-0000-4000-8000-0000000000aa')$q$);
select pg_temp.expect_error('admin cannot link someone who is not a supervisor',
  'a1000000-0000-4000-8000-0000000000aa',
  $q$insert into public.supervisor_trainees (supervisor_id, trainee_id, linked_by)
     values ('72000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000001',
             'a1000000-0000-4000-8000-0000000000aa')$q$,
  '%foreign key%');
select pg_temp.expect_error('admin cannot link in someone else''s name',
  'a1000000-0000-4000-8000-0000000000aa',
  $q$insert into public.supervisor_trainees (supervisor_id, trainee_id, linked_by)
     values ('51000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000002',
             '51000000-0000-4000-8000-000000000001')$q$,
  '%row-level security%');

-- ── reviews ────────────────────────────────────────────────────────────────
select pg_temp.expect_ok('linked supervisor can review a practice report',
  '51000000-0000-4000-8000-000000000001',
  $q$insert into public.session_report_reviews (session_id, reviewer_id, comment, adjusted_overall, flagged)
     values ('d1000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001',
             'Missed the risk question', 52, true)$q$);
select pg_temp.expect_error('supervisor cannot review an unlinked trainee''s report',
  '51000000-0000-4000-8000-000000000001',
  $q$insert into public.session_report_reviews (session_id, reviewer_id, comment)
     values ('d4000000-0000-4000-8000-000000000004', '51000000-0000-4000-8000-000000000001', 'x')$q$,
  '%row-level security%');
select pg_temp.expect_error('linked supervisor cannot review another supervisor''s skill test',
  '51000000-0000-4000-8000-000000000001',
  $q$insert into public.session_report_reviews (session_id, reviewer_id, comment)
     values ('d3000000-0000-4000-8000-000000000003', '51000000-0000-4000-8000-000000000001', 'x')$q$,
  '%row-level security%');
select pg_temp.expect_ok('assigning supervisor can review the skill test report',
  '52000000-0000-4000-8000-000000000002',
  $q$insert into public.session_report_reviews (session_id, reviewer_id, comment)
     values ('d3000000-0000-4000-8000-000000000003', '52000000-0000-4000-8000-000000000002', 'Good')$q$);
select pg_temp.expect_error('no review before the report exists',
  '51000000-0000-4000-8000-000000000001',
  $q$insert into public.session_report_reviews (session_id, reviewer_id, comment)
     values ('d2000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000001', 'x')$q$,
  '%row-level security%');
select pg_temp.expect_error('cannot write a review in someone else''s name',
  '51000000-0000-4000-8000-000000000001',
  $q$insert into public.session_report_reviews (session_id, reviewer_id, comment)
     values ('d1000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000002', 'x')$q$,
  '%row-level security%');
select pg_temp.expect_error('trainee cannot review own report',
  '71000000-0000-4000-8000-000000000001',
  $q$insert into public.session_report_reviews (session_id, reviewer_id, comment)
     values ('d1000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', 'x')$q$,
  '%row-level security%');
select pg_temp.expect_error('an adjusted score needs a comment',
  '51000000-0000-4000-8000-000000000001',
  $q$insert into public.session_report_reviews (session_id, reviewer_id, adjusted_overall)
     values ('d1000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', 40)$q$,
  '%check constraint%');
select pg_temp.expect_error('an adjusted score stays within 0 to 100',
  '51000000-0000-4000-8000-000000000001',
  $q$insert into public.session_report_reviews (session_id, reviewer_id, comment, adjusted_overall)
     values ('d1000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', 'x', 101)$q$,
  '%check constraint%');
select pg_temp.expect_error('an empty review is refused',
  '51000000-0000-4000-8000-000000000001',
  $q$insert into public.session_report_reviews (session_id, reviewer_id)
     values ('d1000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001')$q$,
  '%check constraint%');

-- Keep two reviews for the checks below (as postgres; the RLS paths are
-- proven above).
insert into public.session_report_reviews (id, session_id, reviewer_id, comment, adjusted_overall, flagged) values
  ('f1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001',
   '51000000-0000-4000-8000-000000000001', 'Missed the risk question', 52, true),
  ('f2000000-0000-4000-8000-000000000002', 'd3000000-0000-4000-8000-000000000003',
   '52000000-0000-4000-8000-000000000002', 'Good', null, false);

select pg_temp.expect_count('reviewer sees only reviews of reports they can review',
  '51000000-0000-4000-8000-000000000001', 'select count(*) from public.session_report_reviews', 1);
select pg_temp.expect_count('assigning supervisor sees only the test review',
  '52000000-0000-4000-8000-000000000002', 'select count(*) from public.session_report_reviews', 1);
select pg_temp.expect_count('trainee cannot read reviews of own session',
  '71000000-0000-4000-8000-000000000001', 'select count(*) from public.session_report_reviews', 0);
select pg_temp.expect_count('admin reads every review',
  'a1000000-0000-4000-8000-0000000000aa', 'select count(*) from public.session_report_reviews', 2);
select pg_temp.expect_count('reviewer can change their review',
  '51000000-0000-4000-8000-000000000001',
  $q$with u as (update public.session_report_reviews set adjusted_overall = 55
     where id = 'f1000000-0000-4000-8000-000000000001' returning 1) select count(*) from u$q$, 1);
select pg_temp.expect_count('another supervisor cannot change the review',
  '52000000-0000-4000-8000-000000000002',
  $q$with u as (update public.session_report_reviews set adjusted_overall = 99
     where id = 'f1000000-0000-4000-8000-000000000001' returning 1) select count(*) from u$q$, 0);
select pg_temp.expect_count('admin cannot rewrite a supervisor''s review',
  'a1000000-0000-4000-8000-0000000000aa',
  $q$with u as (update public.session_report_reviews set adjusted_overall = 99
     where id = 'f1000000-0000-4000-8000-000000000001' returning 1) select count(*) from u$q$, 0);
select pg_temp.expect_error('a review cannot move to another session',
  '51000000-0000-4000-8000-000000000001',
  $q$update public.session_report_reviews set session_id = 'd2000000-0000-4000-8000-000000000002'
     where id = 'f1000000-0000-4000-8000-000000000001'$q$,
  '%Cannot move a review%');
select pg_temp.expect_count('the AI report cannot be edited by its reviewer',
  '51000000-0000-4000-8000-000000000001',
  $q$with u as (update public.session_reports set scores = '{"overall": 99, "items": []}'
     where session_id = 'd1000000-0000-4000-8000-000000000001' returning 1) select count(*) from u$q$, 0);
do $$
begin
  if (select (scores->>'overall')::int from public.session_reports
      where session_id = 'd1000000-0000-4000-8000-000000000001') <> 60 then
    raise exception 'FAIL original AI score changed';
  end if;
  raise notice 'ok   the original AI score is unchanged';
end $$;
select pg_temp.expect_count('another supervisor cannot delete the review',
  '52000000-0000-4000-8000-000000000002',
  $q$with d as (delete from public.session_report_reviews
     where id = 'f1000000-0000-4000-8000-000000000001' returning 1) select count(*) from d$q$, 0);
select pg_temp.expect_count('reviewer can delete their review',
  '51000000-0000-4000-8000-000000000001',
  $q$with d as (delete from public.session_report_reviews
     where id = 'f1000000-0000-4000-8000-000000000001' returning 1) select count(*) from d$q$, 1);

-- ── admin two-step login ───────────────────────────────────────────────────
select set_config('vpsych.test_aal', 'aal1', true);
select pg_temp.expect_count('admin without two-step reads no reviews',
  'a1000000-0000-4000-8000-0000000000aa', 'select count(*) from public.session_report_reviews', 0);
select pg_temp.expect_count('admin without two-step reads no links',
  'a1000000-0000-4000-8000-0000000000aa', 'select count(*) from public.supervisor_trainees', 0);
select pg_temp.expect_error('admin without two-step cannot link',
  'a1000000-0000-4000-8000-0000000000aa',
  $q$insert into public.supervisor_trainees (supervisor_id, trainee_id, linked_by)
     values ('51000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000002',
             'a1000000-0000-4000-8000-0000000000aa')$q$,
  '%row-level security%');
select set_config('vpsych.test_aal', 'aal2', true);

-- ── pending account ────────────────────────────────────────────────────────
set local session_replication_role = replica;
update public.profiles set approval_status = 'pending'
  where id = '51000000-0000-4000-8000-000000000001';
set local session_replication_role = origin;
select pg_temp.expect_count('a supervisor whose account is pending reads no practice reports',
  '51000000-0000-4000-8000-000000000001', 'select count(*) from public.session_reports', 0);
select pg_temp.expect_error('a supervisor whose account is pending cannot review',
  '51000000-0000-4000-8000-000000000001',
  $q$insert into public.session_report_reviews (session_id, reviewer_id, comment)
     values ('d1000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', 'x')$q$,
  '%row-level security%');
set local session_replication_role = replica;
update public.profiles set approval_status = 'approved'
  where id = '51000000-0000-4000-8000-000000000001';
set local session_replication_role = origin;

-- ── revoking the supervisor role ───────────────────────────────────────────
-- The links go with the role, and so does the access. Reviews stay for admins.
insert into public.session_report_reviews (session_id, reviewer_id, comment) values
  ('d1000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', 'kept');
delete from public.supervisors where user_id = '51000000-0000-4000-8000-000000000001';
select pg_temp.expect_count('revoked supervisor sees no practice sessions',
  '51000000-0000-4000-8000-000000000001', 'select count(*) from public.sessions', 0);
select pg_temp.expect_count('revoked supervisor reads no reports',
  '51000000-0000-4000-8000-000000000001', 'select count(*) from public.session_reports', 0);
select pg_temp.expect_count('revoked supervisor reads no reviews',
  '51000000-0000-4000-8000-000000000001', 'select count(*) from public.session_report_reviews', 0);
do $$
begin
  if exists (select 1 from public.supervisor_trainees
             where supervisor_id = '51000000-0000-4000-8000-000000000001') then
    raise exception 'FAIL revoke: links remain';
  end if;
  if not exists (select 1 from public.session_report_reviews where comment = 'kept') then
    raise exception 'FAIL revoke: the review was removed';
  end if;
  raise notice 'ok   revoking the role removes the links and keeps the reviews';
end $$;

rollback;

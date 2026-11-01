-- Training Program grading for a session with nothing to assess
-- (20261028150000): a report marked too_short grades the attempt 'too_short'
-- with no score; examiner reports still pass above 55 and fail otherwise; a
-- trainee cannot set the new status themselves. One transaction, rolled
-- back; a failed check raises.

\set ON_ERROR_STOP 1
begin;

create function pg_temp.check(label text, ok boolean) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'FAIL %', label;
  end if;
  raise notice 'ok   %', label;
end $$;

-- ── fixtures ───────────────────────────────────────────────────────────────
-- Trainee T has three finished Training Program sessions: e1 (nothing said),
-- e2 (examiner 70) and e3 (examiner 20).
insert into auth.users (id, email, aud, role) values
  ('91000000-0000-4000-8000-000000000001', 'short-t@rls.invalid', 'authenticated', 'authenticated');

set local session_replication_role = replica;
update public.profiles set approval_status = 'approved'
  where id = '91000000-0000-4000-8000-000000000001';
insert into public.sessions (id, therapist_id, avatar_id, status)
  select v.id, '91000000-0000-4000-8000-000000000001', p.avatar_id, 'completed'
  from (values
    ('9e000000-0000-4000-8000-000000000001'::uuid),
    ('9e000000-0000-4000-8000-000000000002'::uuid),
    ('9e000000-0000-4000-8000-000000000003'::uuid)
  ) v (id),
  (select avatar_id from public.training_ladder_patients where is_active order by key limit 1) p;
insert into public.training_ladder_attempts (session_id, therapist_id, patient_key, level)
  select s.id, s.therapist_id, p.key, 1
  from public.sessions s,
       (select key from public.training_ladder_patients where is_active order by key limit 1) p
  where s.therapist_id = '91000000-0000-4000-8000-000000000001';
set local session_replication_role = origin;

select pg_temp.check('fixtures: three attempts',
  (select count(*) from public.training_ladder_attempts
   where therapist_id = '91000000-0000-4000-8000-000000000001') = 3);

-- ── grading ────────────────────────────────────────────────────────────────
insert into public.session_reports (session_id, narrative, scores) values
  ('9e000000-0000-4000-8000-000000000001', 'too short',
   '{"overall": 0, "items": [], "too_short": true,
     "scientific_provenance": {"assessment_mode": "heuristic_fallback", "ai_source": "persona_fallback"}}'),
  ('9e000000-0000-4000-8000-000000000002', 'examiner',
   '{"overall": 70, "items": [], "scientific_provenance": {"assessment_mode": "llm_examiner", "ai_source": "gpt"}}'),
  ('9e000000-0000-4000-8000-000000000003', 'examiner',
   '{"overall": 20, "items": [], "scientific_provenance": {"assessment_mode": "llm_examiner", "ai_source": "gpt"}}');

select pg_temp.check('a too_short report grades the attempt too_short with no score',
  (select status = 'too_short' and score is null and report_id is not null
   from public.training_ladder_attempts
   where session_id = '9e000000-0000-4000-8000-000000000001'));
select pg_temp.check('an examiner report above 55 still passes',
  (select status = 'passed' and score = 70 from public.training_ladder_attempts
   where session_id = '9e000000-0000-4000-8000-000000000002'));
select pg_temp.check('an examiner report at 55 or below still fails',
  (select status = 'failed' and score = 20 from public.training_ladder_attempts
   where session_id = '9e000000-0000-4000-8000-000000000003'));

-- ── the trainee cannot set it ──────────────────────────────────────────────
do $$
declare n int;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', '91000000-0000-4000-8000-000000000001', 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    update public.training_ladder_attempts set status = 'too_short'
      where session_id = '9e000000-0000-4000-8000-000000000003';
    get diagnostics n = row_count;
  exception when others then
    n := 0;
  end;
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  if n <> 0 then
    raise exception 'FAIL trainee changed their own attempt status';
  end if;
  raise notice 'ok   trainee cannot mark their own attempt too_short';
end $$;
select pg_temp.check('the failed attempt is unchanged',
  (select status = 'failed' from public.training_ladder_attempts
   where session_id = '9e000000-0000-4000-8000-000000000003'));

rollback;

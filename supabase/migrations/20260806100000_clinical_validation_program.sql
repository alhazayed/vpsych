-- Clinical Validation Program (CVP)
-- Evidence-generation infrastructure. Does not alter simulation behaviour.

-- ── Studies ─────────────────────────────────────────────────────────────────
create table if not exists public.cvp_studies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  protocol_version text not null default '1.0',
  status text not null default 'draft'
    check (status in ('draft', 'active', 'closed', 'archived')),
  irb_reference text,
  consort_registered boolean not null default false,
  description text,
  settings jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  ended_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cvp_studies_status_idx on public.cvp_studies (status);

-- ── Study ↔ institution sites ───────────────────────────────────────────────
create table if not exists public.cvp_study_institutions (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.cvp_studies (id) on delete cascade,
  institution_id uuid not null references public.institutions (id) on delete cascade,
  site_code text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (study_id, institution_id),
  unique (study_id, site_code)
);

create index if not exists cvp_study_institutions_study_idx
  on public.cvp_study_institutions (study_id);

-- ── Invitations ─────────────────────────────────────────────────────────────
create table if not exists public.cvp_invitations (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.cvp_studies (id) on delete cascade,
  institution_id uuid references public.institutions (id) on delete set null,
  email text not null,
  token_hash text not null unique,
  role_in_study text not null default 'reviewer'
    check (role_in_study in (
      'reviewer', 'supervisor', 'resident', 'coordinator', 'blind_scorer'
    )),
  invited_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_profile_id uuid references public.profiles (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'expired', 'revoked')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists cvp_invitations_study_idx on public.cvp_invitations (study_id);
create index if not exists cvp_invitations_email_idx on public.cvp_invitations (email);
create index if not exists cvp_invitations_status_idx on public.cvp_invitations (status);

-- ── Enrollments ─────────────────────────────────────────────────────────────
create table if not exists public.cvp_enrollments (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.cvp_studies (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  institution_id uuid references public.institutions (id) on delete set null,
  invitation_id uuid references public.cvp_invitations (id) on delete set null,
  credentials text,
  specialty text,
  role_in_study text not null default 'reviewer',
  consent_version text not null default '1.0',
  consent_at timestamptz not null default now(),
  agreement_version text not null default '1.0',
  baseline_completed_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (study_id, profile_id)
);

create index if not exists cvp_enrollments_profile_idx on public.cvp_enrollments (profile_id);
create index if not exists cvp_enrollments_study_idx on public.cvp_enrollments (study_id);
create index if not exists cvp_enrollments_institution_idx
  on public.cvp_enrollments (institution_id);

-- ── Randomized session / avatar assignments ─────────────────────────────────
create table if not exists public.cvp_assignments (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.cvp_studies (id) on delete cascade,
  enrollment_id uuid not null references public.cvp_enrollments (id) on delete cascade,
  avatar_id uuid not null references public.avatars (id) on delete restrict,
  allocation_arm text not null default 'standard'
    check (allocation_arm in ('standard', 'blind_challenge', 'calibration', 'control')),
  allocation_seed text not null,
  sequence_index integer not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'completed', 'skipped', 'expired')),
  session_id uuid references public.sessions (id) on delete set null,
  assigned_at timestamptz not null default now(),
  due_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (enrollment_id, sequence_index)
);

create index if not exists cvp_assignments_enrollment_idx
  on public.cvp_assignments (enrollment_id);
create index if not exists cvp_assignments_study_status_idx
  on public.cvp_assignments (study_id, status);
create index if not exists cvp_assignments_session_idx
  on public.cvp_assignments (session_id);

-- ── Blind Psychiatrist Challenge records ────────────────────────────────────
create table if not exists public.cvp_blind_challenges (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.cvp_studies (id) on delete cascade,
  assignment_id uuid references public.cvp_assignments (id) on delete set null,
  session_id uuid references public.sessions (id) on delete set null,
  scorer_id uuid not null references public.profiles (id) on delete cascade,
  condition_code text not null default 'ai_patient'
    check (condition_code in ('ai_patient', 'human_sp', 'unknown')),
  revealed boolean not null default false,
  overall_realism smallint not null check (overall_realism between 1 and 5),
  would_use_in_training boolean,
  free_text text,
  protocol_version text not null default '1.0',
  created_at timestamptz not null default now()
);

create index if not exists cvp_blind_challenges_study_idx
  on public.cvp_blind_challenges (study_id);

-- ── Dual / multi-rater ratings for IRA ──────────────────────────────────────
create table if not exists public.cvp_dual_ratings (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.cvp_studies (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  rater_id uuid not null references public.profiles (id) on delete cascade,
  instrument text not null default 'ppp_likert_v1',
  scores jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (study_id, session_id, rater_id, instrument)
);

create index if not exists cvp_dual_ratings_session_idx
  on public.cvp_dual_ratings (session_id);

-- ── Educational outcome measures ────────────────────────────────────────────
create table if not exists public.cvp_outcome_measures (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.cvp_studies (id) on delete cascade,
  enrollment_id uuid not null references public.cvp_enrollments (id) on delete cascade,
  timepoint text not null check (timepoint in ('baseline', 'post', 'followup')),
  instrument_slug text not null,
  scores jsonb not null default '{}'::jsonb,
  administered_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists cvp_outcome_measures_enrollment_idx
  on public.cvp_outcome_measures (enrollment_id);
create index if not exists cvp_outcome_measures_study_tp_idx
  on public.cvp_outcome_measures (study_id, timepoint);

-- ── Longitudinal reviewer snapshots ─────────────────────────────────────────
create table if not exists public.cvp_reviewer_snapshots (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.cvp_enrollments (id) on delete cascade,
  captured_at timestamptz not null default now(),
  sessions_completed integer not null default 0,
  metrics jsonb not null default '{}'::jsonb
);

create index if not exists cvp_reviewer_snapshots_enrollment_idx
  on public.cvp_reviewer_snapshots (enrollment_id, captured_at desc);

-- ── Calibration corpus items ────────────────────────────────────────────────
create table if not exists public.cvp_calibration_items (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.cvp_studies (id) on delete cascade,
  item_key text not null,
  session_id uuid references public.sessions (id) on delete set null,
  transcript_ref text,
  expert_scores jsonb not null default '{}'::jsonb,
  disorder_slug text,
  locale text,
  created_at timestamptz not null default now(),
  unique (study_id, item_key)
);

create index if not exists cvp_calibration_items_study_idx
  on public.cvp_calibration_items (study_id);

-- ── Export jobs / publication datasets ──────────────────────────────────────
create table if not exists public.cvp_export_jobs (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.cvp_studies (id) on delete cascade,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  export_kind text not null check (export_kind in (
    'ratings_csv',
    'consort_summary',
    'publication_package',
    'institution_comparison',
    'reliability_report',
    'deidentified_full'
  )),
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed')),
  deidentify_level text not null default 'standard'
    check (deidentify_level in ('none', 'standard', 'strict')),
  artifact jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists cvp_export_jobs_study_idx
  on public.cvp_export_jobs (study_id, created_at desc);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.cvp_studies enable row level security;
alter table public.cvp_study_institutions enable row level security;
alter table public.cvp_invitations enable row level security;
alter table public.cvp_enrollments enable row level security;
alter table public.cvp_assignments enable row level security;
alter table public.cvp_blind_challenges enable row level security;
alter table public.cvp_dual_ratings enable row level security;
alter table public.cvp_outcome_measures enable row level security;
alter table public.cvp_reviewer_snapshots enable row level security;
alter table public.cvp_calibration_items enable row level security;
alter table public.cvp_export_jobs enable row level security;

-- Studies: admin all; enrolled reviewers read active studies
drop policy if exists "cvp_studies_admin" on public.cvp_studies;
create policy "cvp_studies_admin" on public.cvp_studies
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "cvp_studies_enrolled_select" on public.cvp_studies;
create policy "cvp_studies_enrolled_select" on public.cvp_studies
  for select to authenticated
  using (
    exists (
      select 1 from public.cvp_enrollments e
      where e.study_id = id
        and e.profile_id = (select auth.uid())
        and e.is_active
    )
  );

drop policy if exists "cvp_study_institutions_admin" on public.cvp_study_institutions;
create policy "cvp_study_institutions_admin" on public.cvp_study_institutions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "cvp_study_institutions_select" on public.cvp_study_institutions;
create policy "cvp_study_institutions_select" on public.cvp_study_institutions
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.cvp_enrollments e
      where e.study_id = study_id and e.profile_id = (select auth.uid())
    )
  );

-- Invitations: admin manage; invitee can read own email row via service later —
-- authenticated users only see invitations they accepted or admin
drop policy if exists "cvp_invitations_admin" on public.cvp_invitations;
create policy "cvp_invitations_admin" on public.cvp_invitations
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "cvp_invitations_acceptor_select" on public.cvp_invitations;
create policy "cvp_invitations_acceptor_select" on public.cvp_invitations
  for select to authenticated
  using (accepted_profile_id = (select auth.uid()));

-- Enrollments
drop policy if exists "cvp_enrollments_admin" on public.cvp_enrollments;
create policy "cvp_enrollments_admin" on public.cvp_enrollments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "cvp_enrollments_self_select" on public.cvp_enrollments;
create policy "cvp_enrollments_self_select" on public.cvp_enrollments
  for select to authenticated
  using (profile_id = (select auth.uid()));

drop policy if exists "cvp_enrollments_self_insert" on public.cvp_enrollments;
create policy "cvp_enrollments_self_insert" on public.cvp_enrollments
  for insert to authenticated
  with check (profile_id = (select auth.uid()));

drop policy if exists "cvp_enrollments_self_update" on public.cvp_enrollments;
create policy "cvp_enrollments_self_update" on public.cvp_enrollments
  for update to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin())
  with check (profile_id = (select auth.uid()) or public.is_admin());

-- Assignments
drop policy if exists "cvp_assignments_admin" on public.cvp_assignments;
create policy "cvp_assignments_admin" on public.cvp_assignments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "cvp_assignments_self_select" on public.cvp_assignments;
create policy "cvp_assignments_self_select" on public.cvp_assignments
  for select to authenticated
  using (
    exists (
      select 1 from public.cvp_enrollments e
      where e.id = enrollment_id and e.profile_id = (select auth.uid())
    )
  );

drop policy if exists "cvp_assignments_self_update" on public.cvp_assignments;
create policy "cvp_assignments_self_update" on public.cvp_assignments
  for update to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.cvp_enrollments e
      where e.id = enrollment_id and e.profile_id = (select auth.uid())
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.cvp_enrollments e
      where e.id = enrollment_id and e.profile_id = (select auth.uid())
    )
  );

-- Blind challenges
drop policy if exists "cvp_blind_admin" on public.cvp_blind_challenges;
create policy "cvp_blind_admin" on public.cvp_blind_challenges
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "cvp_blind_scorer" on public.cvp_blind_challenges;
create policy "cvp_blind_scorer" on public.cvp_blind_challenges
  for select to authenticated
  using (scorer_id = (select auth.uid()) or public.is_admin());

drop policy if exists "cvp_blind_scorer_insert" on public.cvp_blind_challenges;
create policy "cvp_blind_scorer_insert" on public.cvp_blind_challenges
  for insert to authenticated
  with check (scorer_id = (select auth.uid()) or public.is_admin());

-- Dual ratings
drop policy if exists "cvp_dual_admin" on public.cvp_dual_ratings;
create policy "cvp_dual_admin" on public.cvp_dual_ratings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "cvp_dual_rater" on public.cvp_dual_ratings;
create policy "cvp_dual_rater" on public.cvp_dual_ratings
  for select to authenticated
  using (rater_id = (select auth.uid()) or public.is_admin());

drop policy if exists "cvp_dual_rater_insert" on public.cvp_dual_ratings;
create policy "cvp_dual_rater_insert" on public.cvp_dual_ratings
  for insert to authenticated
  with check (rater_id = (select auth.uid()) or public.is_admin());

-- Outcomes
drop policy if exists "cvp_outcomes_admin" on public.cvp_outcome_measures;
create policy "cvp_outcomes_admin" on public.cvp_outcome_measures
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "cvp_outcomes_self" on public.cvp_outcome_measures;
create policy "cvp_outcomes_self" on public.cvp_outcome_measures
  for select to authenticated
  using (
    exists (
      select 1 from public.cvp_enrollments e
      where e.id = enrollment_id and e.profile_id = (select auth.uid())
    )
  );

drop policy if exists "cvp_outcomes_self_insert" on public.cvp_outcome_measures;
create policy "cvp_outcomes_self_insert" on public.cvp_outcome_measures
  for insert to authenticated
  with check (
    exists (
      select 1 from public.cvp_enrollments e
      where e.id = enrollment_id and e.profile_id = (select auth.uid())
    )
  );

-- Snapshots / calibration / exports — admin primary; self-read snapshots
drop policy if exists "cvp_snapshots_admin" on public.cvp_reviewer_snapshots;
create policy "cvp_snapshots_admin" on public.cvp_reviewer_snapshots
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "cvp_snapshots_self" on public.cvp_reviewer_snapshots;
create policy "cvp_snapshots_self" on public.cvp_reviewer_snapshots
  for select to authenticated
  using (
    exists (
      select 1 from public.cvp_enrollments e
      where e.id = enrollment_id and e.profile_id = (select auth.uid())
    )
  );

drop policy if exists "cvp_calibration_admin" on public.cvp_calibration_items;
create policy "cvp_calibration_admin" on public.cvp_calibration_items
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "cvp_exports_admin" on public.cvp_export_jobs;
create policy "cvp_exports_admin" on public.cvp_export_jobs
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.cvp_studies to authenticated;
grant select, insert, update, delete on public.cvp_study_institutions to authenticated;
grant select, insert, update, delete on public.cvp_invitations to authenticated;
grant select, insert, update, delete on public.cvp_enrollments to authenticated;
grant select, insert, update, delete on public.cvp_assignments to authenticated;
grant select, insert, update, delete on public.cvp_blind_challenges to authenticated;
grant select, insert, update, delete on public.cvp_dual_ratings to authenticated;
grant select, insert, update, delete on public.cvp_outcome_measures to authenticated;
grant select, insert, update, delete on public.cvp_reviewer_snapshots to authenticated;
grant select, insert, update, delete on public.cvp_calibration_items to authenticated;
grant select, insert, update, delete on public.cvp_export_jobs to authenticated;

-- Accept invitation by token hash (authenticated). Re-checks expiry & pending.
create or replace function public.accept_cvp_invitation(
  p_token_hash text,
  p_credentials text default null,
  p_specialty text default null,
  p_consent_version text default '1.0',
  p_agreement_version text default '1.0'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.cvp_invitations%rowtype;
  v_enr public.cvp_enrollments%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_inv
  from public.cvp_invitations
  where token_hash = p_token_hash
  for update;

  if not found then
    raise exception 'invitation not found';
  end if;
  if v_inv.status <> 'pending' then
    raise exception 'invitation not pending';
  end if;
  if v_inv.expires_at < now() then
    update public.cvp_invitations set status = 'expired' where id = v_inv.id;
    raise exception 'invitation expired';
  end if;

  update public.cvp_invitations
  set status = 'accepted',
      accepted_at = now(),
      accepted_profile_id = v_uid
  where id = v_inv.id;

  insert into public.cvp_enrollments (
    study_id, profile_id, institution_id, invitation_id,
    credentials, specialty, role_in_study,
    consent_version, consent_at, agreement_version, is_active
  ) values (
    v_inv.study_id, v_uid, v_inv.institution_id, v_inv.id,
    nullif(trim(p_credentials), ''), nullif(trim(p_specialty), ''),
    v_inv.role_in_study,
    coalesce(nullif(trim(p_consent_version), ''), '1.0'),
    now(),
    coalesce(nullif(trim(p_agreement_version), ''), '1.0'),
    true
  )
  on conflict (study_id, profile_id) do update set
    institution_id = excluded.institution_id,
    invitation_id = excluded.invitation_id,
    credentials = coalesce(excluded.credentials, public.cvp_enrollments.credentials),
    specialty = coalesce(excluded.specialty, public.cvp_enrollments.specialty),
    role_in_study = excluded.role_in_study,
    consent_version = excluded.consent_version,
    consent_at = excluded.consent_at,
    agreement_version = excluded.agreement_version,
    is_active = true,
    updated_at = now()
  returning * into v_enr;

  return jsonb_build_object(
    'invitation_id', v_inv.id,
    'enrollment_id', v_enr.id,
    'study_id', v_inv.study_id
  );
end;
$$;

revoke all on function public.accept_cvp_invitation(text, text, text, text, text) from public;
grant execute on function public.accept_cvp_invitation(text, text, text, text, text) to authenticated;

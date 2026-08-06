-- Professional Preview Program (PPP)
-- Expert-evaluation feedback, reviewer enrollment, and blind scoring.
-- Does not alter simulation behaviour or session_reports RLS.

-- Track first-run onboarding dismissal (therapist UX only)
alter table public.profiles
  add column if not exists onboarding_dismissed_at timestamptz;

-- ── Reviewer enrollment (therapist accounts invited into PPP) ───────────────
create table if not exists public.ppp_reviewers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  credentials text,
  specialty text,
  institution text,
  cohort text not null default 'ppp-1.0',
  agreement_version text not null default '1.0',
  agreement_accepted_at timestamptz not null default now(),
  invited_by uuid references public.profiles (id) on delete set null,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ppp_reviewers_cohort_idx on public.ppp_reviewers (cohort);
create index if not exists ppp_reviewers_active_idx on public.ppp_reviewers (is_active);

-- ── Post-session Likert ratings (1–5) ───────────────────────────────────────
create table if not exists public.ppp_session_ratings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  clinical_realism smallint not null check (clinical_realism between 1 and 5),
  educational_value smallint not null check (educational_value between 1 and 5),
  conversation_naturalness smallint not null check (conversation_naturalness between 1 and 5),
  therapeutic_alliance smallint not null check (therapeutic_alliance between 1 and 5),
  patient_believability smallint not null check (patient_believability between 1 and 5),
  learning_impact smallint not null check (learning_impact between 1 and 5),
  voice_realism smallint check (voice_realism is null or voice_realism between 1 and 5),
  arabic_quality smallint check (arabic_quality is null or arabic_quality between 1 and 5),
  english_quality smallint check (english_quality is null or english_quality between 1 and 5),
  used_voice boolean not null default false,
  session_language text,
  free_text text,
  created_at timestamptz not null default now(),
  unique (session_id, reviewer_id)
);

create index if not exists ppp_session_ratings_reviewer_idx
  on public.ppp_session_ratings (reviewer_id);
create index if not exists ppp_session_ratings_created_idx
  on public.ppp_session_ratings (created_at desc);

-- ── CQI — reported issues / defects ─────────────────────────────────────────
create table if not exists public.ppp_cqi_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid references public.sessions (id) on delete set null,
  severity text not null check (severity in ('critical', 'high', 'medium', 'wishlist')),
  category text not null check (category in (
    'clinical_realism',
    'conversation',
    'voice_tts',
    'assessment',
    'safety',
    'ui_ux',
    'bilingual',
    'other'
  )),
  title text not null check (char_length(title) between 3 and 200),
  description text not null check (char_length(description) between 10 and 4000),
  status text not null default 'open' check (status in ('open', 'triaged', 'resolved', 'wont_fix')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ppp_cqi_reports_status_idx on public.ppp_cqi_reports (status);
create index if not exists ppp_cqi_reports_severity_idx on public.ppp_cqi_reports (severity);
create index if not exists ppp_cqi_reports_created_idx on public.ppp_cqi_reports (created_at desc);

-- ── Educational Opportunity feedback ────────────────────────────────────────
create table if not exists public.ppp_educational_opportunities (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid references public.sessions (id) on delete set null,
  opportunity_type text not null check (opportunity_type in (
    'missed_teaching_moment',
    'strong_teaching_moment',
    'curriculum_gap',
    'competency_focus',
    'supervision_use_case',
    'other'
  )),
  competency_area text,
  title text not null check (char_length(title) between 3 and 200),
  description text not null check (char_length(description) between 10 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists ppp_eoi_created_idx
  on public.ppp_educational_opportunities (created_at desc);
create index if not exists ppp_eoi_type_idx
  on public.ppp_educational_opportunities (opportunity_type);

-- ── Feature requests (aggregated on dashboard) ──────────────────────────────
create table if not exists public.ppp_feature_requests (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 200),
  description text not null check (char_length(description) between 10 and 4000),
  theme text not null default 'general' check (theme in (
    'simulation',
    'assessment',
    'voice',
    'curriculum',
    'admin',
    'bilingual',
    'general'
  )),
  created_at timestamptz not null default now()
);

create index if not exists ppp_feature_requests_theme_idx
  on public.ppp_feature_requests (theme);
create index if not exists ppp_feature_requests_created_idx
  on public.ppp_feature_requests (created_at desc);

-- ── Blind psychiatrist protocol scores ──────────────────────────────────────
create table if not exists public.ppp_blind_scores (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions (id) on delete set null,
  scorer_id uuid not null references public.profiles (id) on delete cascade,
  protocol_version text not null default '1.0',
  blind_condition text not null default 'ai_patient'
    check (blind_condition in ('ai_patient', 'human_sp', 'unknown')),
  overall_realism smallint not null check (overall_realism between 1 and 5),
  would_use_in_training boolean,
  free_text text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ppp_blind_scores_created_idx
  on public.ppp_blind_scores (created_at desc);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.ppp_reviewers enable row level security;
alter table public.ppp_session_ratings enable row level security;
alter table public.ppp_cqi_reports enable row level security;
alter table public.ppp_educational_opportunities enable row level security;
alter table public.ppp_feature_requests enable row level security;
alter table public.ppp_blind_scores enable row level security;

-- Reviewers: self read/insert/update; admin all
drop policy if exists "ppp_reviewers_self_select" on public.ppp_reviewers;
create policy "ppp_reviewers_self_select" on public.ppp_reviewers
  for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());

drop policy if exists "ppp_reviewers_self_insert" on public.ppp_reviewers;
create policy "ppp_reviewers_self_insert" on public.ppp_reviewers
  for insert to authenticated
  with check (profile_id = (select auth.uid()) or public.is_admin());

drop policy if exists "ppp_reviewers_self_update" on public.ppp_reviewers;
create policy "ppp_reviewers_self_update" on public.ppp_reviewers
  for update to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin())
  with check (profile_id = (select auth.uid()) or public.is_admin());

drop policy if exists "ppp_reviewers_admin_delete" on public.ppp_reviewers;
create policy "ppp_reviewers_admin_delete" on public.ppp_reviewers
  for delete to authenticated
  using (public.is_admin());

-- Session ratings: owner insert/select; admin select
drop policy if exists "ppp_ratings_owner_select" on public.ppp_session_ratings;
create policy "ppp_ratings_owner_select" on public.ppp_session_ratings
  for select to authenticated
  using (reviewer_id = (select auth.uid()) or public.is_admin());

drop policy if exists "ppp_ratings_owner_insert" on public.ppp_session_ratings;
create policy "ppp_ratings_owner_insert" on public.ppp_session_ratings
  for insert to authenticated
  with check (
    reviewer_id = (select auth.uid())
    and exists (
      select 1 from public.sessions s
      where s.id = session_id
        and (s.therapist_id = (select auth.uid()) or public.is_admin())
        and s.status in ('completed', 'expired')
    )
  );

-- CQI: reporter insert/select; admin all
drop policy if exists "ppp_cqi_owner_select" on public.ppp_cqi_reports;
create policy "ppp_cqi_owner_select" on public.ppp_cqi_reports
  for select to authenticated
  using (reporter_id = (select auth.uid()) or public.is_admin());

drop policy if exists "ppp_cqi_owner_insert" on public.ppp_cqi_reports;
create policy "ppp_cqi_owner_insert" on public.ppp_cqi_reports
  for insert to authenticated
  with check (reporter_id = (select auth.uid()));

drop policy if exists "ppp_cqi_admin_update" on public.ppp_cqi_reports;
create policy "ppp_cqi_admin_update" on public.ppp_cqi_reports
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- EOI
drop policy if exists "ppp_eoi_owner_select" on public.ppp_educational_opportunities;
create policy "ppp_eoi_owner_select" on public.ppp_educational_opportunities
  for select to authenticated
  using (reporter_id = (select auth.uid()) or public.is_admin());

drop policy if exists "ppp_eoi_owner_insert" on public.ppp_educational_opportunities;
create policy "ppp_eoi_owner_insert" on public.ppp_educational_opportunities
  for insert to authenticated
  with check (reporter_id = (select auth.uid()));

-- Feature requests
drop policy if exists "ppp_fr_owner_select" on public.ppp_feature_requests;
create policy "ppp_fr_owner_select" on public.ppp_feature_requests
  for select to authenticated
  using (reporter_id = (select auth.uid()) or public.is_admin());

drop policy if exists "ppp_fr_owner_insert" on public.ppp_feature_requests;
create policy "ppp_fr_owner_insert" on public.ppp_feature_requests
  for insert to authenticated
  with check (reporter_id = (select auth.uid()));

-- Blind scores: admin write/read; scorer read own
drop policy if exists "ppp_blind_select" on public.ppp_blind_scores;
create policy "ppp_blind_select" on public.ppp_blind_scores
  for select to authenticated
  using (scorer_id = (select auth.uid()) or public.is_admin());

drop policy if exists "ppp_blind_admin_insert" on public.ppp_blind_scores;
create policy "ppp_blind_admin_insert" on public.ppp_blind_scores
  for insert to authenticated
  with check (public.is_admin() and scorer_id = (select auth.uid()));

grant select, insert, update, delete on public.ppp_reviewers to authenticated;
grant select, insert on public.ppp_session_ratings to authenticated;
grant select, insert, update on public.ppp_cqi_reports to authenticated;
grant select, insert on public.ppp_educational_opportunities to authenticated;
grant select, insert on public.ppp_feature_requests to authenticated;
grant select, insert on public.ppp_blind_scores to authenticated;

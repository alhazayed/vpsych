-- Roles helper: store role in profiles; never trust user_metadata for authz
create extension if not exists "pgcrypto";

create type public.user_role as enum ('therapist', 'admin');
create type public.session_status as enum ('active', 'completed', 'expired');
create type public.message_role as enum ('user', 'assistant', 'system');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  role public.user_role not null default 'therapist',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.avatars (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  disorder text not null,
  age integer,
  gender text,
  portrait_url text,
  persona_prompt text not null,
  ideal_guidelines jsonb not null default '{}'::jsonb,
  rubric jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references public.profiles (id) on delete cascade,
  avatar_id uuid not null references public.avatars (id) on delete restrict,
  status public.session_status not null default 'active',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  max_duration_sec integer not null default 2400,
  created_at timestamptz not null default now()
);

create table public.session_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  role public.message_role not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table public.session_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.sessions (id) on delete cascade,
  scores jsonb not null default '{}'::jsonb,
  narrative text not null default '',
  excerpts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index sessions_therapist_id_idx on public.sessions (therapist_id);
create index sessions_status_idx on public.sessions (status);
create index session_messages_session_id_idx on public.session_messages (session_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Therapist'),
    'therapist'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Role helpers (read from profiles, not user_metadata)
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.avatars enable row level security;
alter table public.sessions enable row level security;
alter table public.session_messages enable row level security;
alter table public.session_reports enable row level security;

-- Profiles
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

create policy "Users can update own display name"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));

create policy "Admins can update any profile"
  on public.profiles for update
  using (public.is_admin());

-- Avatars: authenticated can read active; admins manage all
create policy "Authenticated can read active avatars"
  on public.avatars for select
  to authenticated
  using (is_active = true or public.is_admin());

create policy "Admins can insert avatars"
  on public.avatars for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update avatars"
  on public.avatars for update
  to authenticated
  using (public.is_admin());

create policy "Admins can delete avatars"
  on public.avatars for delete
  to authenticated
  using (public.is_admin());

-- Sessions: therapists own their sessions; admins see all
create policy "Therapists can view own sessions"
  on public.sessions for select
  using (therapist_id = auth.uid() or public.is_admin());

create policy "Therapists can create own sessions"
  on public.sessions for insert
  with check (therapist_id = auth.uid());

create policy "Therapists can update own sessions"
  on public.sessions for update
  using (therapist_id = auth.uid() or public.is_admin());

-- Messages
create policy "Participants can view session messages"
  on public.session_messages for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.sessions s
      where s.id = session_id and s.therapist_id = auth.uid()
    )
  );

create policy "Therapists can insert messages on own sessions"
  on public.session_messages for insert
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = session_id and s.therapist_id = auth.uid() and s.status = 'active'
    )
  );

-- Reports: ADMIN ONLY read; insert via security definer function
create policy "Admins can view reports"
  on public.session_reports for select
  using (public.is_admin());

create policy "Admins can update reports"
  on public.session_reports for update
  using (public.is_admin());

-- Secure report insert function (callable by session owner after end)
create or replace function public.create_session_report(
  p_session_id uuid,
  p_scores jsonb,
  p_narrative text,
  p_excerpts jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report_id uuid;
  v_owner uuid;
begin
  select therapist_id into v_owner from public.sessions where id = p_session_id;
  if v_owner is null then
    raise exception 'Session not found';
  end if;
  if v_owner <> auth.uid() and not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  insert into public.session_reports (session_id, scores, narrative, excerpts)
  values (p_session_id, p_scores, p_narrative, p_excerpts)
  on conflict (session_id) do update
    set scores = excluded.scores,
        narrative = excluded.narrative,
        excerpts = excluded.excerpts
  returning id into v_report_id;

  return v_report_id;
end;
$$;

grant execute on function public.create_session_report(uuid, jsonb, text, jsonb) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.current_user_role() to authenticated;

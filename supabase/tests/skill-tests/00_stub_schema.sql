-- Minimal stand-in for the Supabase schema the skill test migration builds on.
-- Mirrors the live policies and guards on profiles, sessions, session_messages
-- and session_reports (as of 2026-10-05) so RLS can be exercised on a plain
-- Postgres. Used only by scripts/test-skill-test-rls.sh.

DO $$ BEGIN
  CREATE ROLE anon NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE service_role NOLOGIN BYPASSRLS;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon, service_role;
GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;

CREATE TYPE public.user_role AS ENUM ('therapist', 'admin');
CREATE TYPE public.session_status AS ENUM ('active', 'completed', 'expired');
CREATE TYPE public.message_role AS ENUM ('user', 'assistant', 'system');
CREATE TYPE public.case_difficulty AS ENUM ('beginner', 'intermediate', 'advanced', 'expert');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id),
  display_name text NOT NULL,
  role public.user_role NOT NULL DEFAULT 'therapist'
);
CREATE TABLE public.avatars (id uuid PRIMARY KEY, name text, is_active boolean NOT NULL DEFAULT true);
CREATE TABLE public.case_instances (id uuid PRIMARY KEY, created_by uuid);
CREATE TABLE public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES public.profiles (id),
  avatar_id uuid NOT NULL REFERENCES public.avatars (id),
  status public.session_status NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  max_duration_sec integer NOT NULL DEFAULT 2400,
  clinical_snapshot jsonb,
  difficulty public.case_difficulty,
  case_instance_id uuid REFERENCES public.case_instances (id)
);
CREATE TABLE public.session_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions (id),
  role public.message_role NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.session_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL UNIQUE REFERENCES public.sessions (id),
  scores jsonb NOT NULL DEFAULT '{}'
);

CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avatars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated
  USING (((select auth.uid()) = id) OR (select public.is_admin()));
CREATE POLICY "Authenticated can read active avatars" ON public.avatars FOR SELECT TO authenticated
  USING (is_active OR (select public.is_admin()));
CREATE POLICY "Therapists can create own sessions" ON public.sessions FOR INSERT TO authenticated
  WITH CHECK (therapist_id = (select auth.uid()));
CREATE POLICY "Therapists can view own sessions" ON public.sessions FOR SELECT TO authenticated
  USING (therapist_id = (select auth.uid()) OR (select public.is_admin()));
CREATE POLICY "Therapists can update own sessions" ON public.sessions FOR UPDATE TO authenticated
  USING (therapist_id = (select auth.uid()) OR (select public.is_admin()));
CREATE POLICY "Therapists can insert user messages on own sessions" ON public.session_messages
  FOR INSERT TO authenticated
  WITH CHECK (role = 'user' AND EXISTS (SELECT 1 FROM public.sessions s
    WHERE s.id = session_messages.session_id AND s.therapist_id = (select auth.uid())
      AND s.status = 'active'));
CREATE POLICY "Participants can view session messages" ON public.session_messages
  FOR SELECT TO authenticated
  USING ((select public.is_admin()) OR EXISTS (SELECT 1 FROM public.sessions s
    WHERE s.id = session_messages.session_id AND s.therapist_id = (select auth.uid())));
CREATE POLICY "Admins can view reports" ON public.session_reports FOR SELECT TO authenticated
  USING ((select public.is_admin()));

-- Live guard: the case snapshot and core columns are immutable for non-admins.
CREATE FUNCTION public.enforce_session_update_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path = public AS $$
BEGIN
  IF public.is_admin() THEN RETURN NEW; END IF;
  IF NEW.therapist_id IS DISTINCT FROM OLD.therapist_id THEN RAISE EXCEPTION 'Cannot change therapist_id'; END IF;
  IF NEW.clinical_snapshot IS DISTINCT FROM OLD.clinical_snapshot THEN RAISE EXCEPTION 'Cannot change clinical_snapshot'; END IF;
  IF OLD.status <> 'active' AND NEW.status IS DISTINCT FROM OLD.status THEN RAISE EXCEPTION 'Cannot reopen'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER session_update_guard BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_session_update_guard();

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

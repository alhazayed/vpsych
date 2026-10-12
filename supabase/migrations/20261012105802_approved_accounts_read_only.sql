-- Accounts waiting for approval read nothing but their own profile.
--
-- The app confines pending (and rejected) accounts to /pending, but the
-- database API did not: with the public anon key and their own token they
-- could read every shared table any signed-in user can, including the active
-- patients (default disorder, clinical notes, persona prompt), disorders,
-- scenario templates, instructor presets, voices and the competency graph.
--
-- This gives every public table except profiles the RESTRICTIVE read rule that
-- sessions and session_messages already carry (20261006080000_account_approval).
-- Restrictive policies are AND-ed with the permissive ones, and is_approved()
-- is true for approved accounts and admins, so they read exactly what they did
-- before. Reads only: write policies are unchanged. The service role bypasses
-- RLS. profiles stays as it is: /pending and the middleware read the account's
-- own row to show its status. Views in public are security_invoker, so they
-- follow their tables.
--
-- supabase/tests/rls/10_core_rls.sql fails if a public table other than
-- profiles lacks this rule, so a new table needs it too.
--
-- Idempotent. Reversal:
--   DO $$ DECLARE t text; BEGIN
--     FOR t IN SELECT tablename FROM pg_policies
--       WHERE schemaname = 'public' AND policyname = 'Approved accounts only (read)'
--     LOOP
--       EXECUTE format('DROP POLICY %I ON public.%I', 'Approved accounts only (read)', t);
--     END LOOP;
--   END $$;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND c.relrowsecurity
      -- profiles: own row needed while pending. sessions, session_messages:
      -- already covered by "Approved accounts only" (FOR ALL).
      AND c.relname NOT IN ('profiles', 'sessions', 'session_messages')
    ORDER BY c.relname
  LOOP
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
        AND policyname = 'Approved accounts only (read)'
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated '
      'USING ((select public.is_approved()))',
      'Approved accounts only (read)', t
    );
  END LOOP;
END $$;

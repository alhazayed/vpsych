-- Canonical migration recovered for Release Configuration Board reconciliation.
-- Source: production supabase_migrations.schema_migrations statements
-- (enriched only when production statements were empty/placeholder).

-- AuthZ: profiles self-UPDATE WITH CHECK re-queried public.profiles under RLS,
-- which re-entered SELECT policies and raised "infinite recursion detected in
-- policy for relation \"profiles\"" (verified on production for display_name /
-- preferred_language / role escalate attempts). Use SECURITY DEFINER
-- current_user_role() so the role immutability check does not recurse.
-- profiles_role_guard trigger remains defense-in-depth for non-admin role changes.

DROP POLICY IF EXISTS "Users can update own display name" ON public.profiles;

CREATE POLICY "Users can update own display name"
  ON public.profiles FOR UPDATE
  USING ((SELECT auth.uid()) = id)
  WITH CHECK (
    (SELECT auth.uid()) = id
    AND role = (SELECT public.current_user_role())
  );

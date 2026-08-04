-- Canonical migration recovered for Release Configuration Board reconciliation.
-- Source: production supabase_migrations.schema_migrations statements
-- (enriched only when production statements were empty/placeholder).

-- Mission 14 — DevOps / security ops
-- Trigger helper must not be callable as a public RPC (SECURITY DEFINER).

REVOKE ALL ON FUNCTION public.finish_session_on_report() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finish_session_on_report() FROM anon;
REVOKE ALL ON FUNCTION public.finish_session_on_report() FROM authenticated;

COMMENT ON FUNCTION public.finish_session_on_report() IS
  'Trigger-only helper (AFTER INSERT on session_reports). Not an API RPC.';

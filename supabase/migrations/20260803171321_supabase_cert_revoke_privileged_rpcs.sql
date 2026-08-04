-- Canonical migration recovered for Release Configuration Board reconciliation.
-- Source: production supabase_migrations.schema_migrations statements
-- (enriched only when production statements were empty/placeholder).

-- Mission: Supabase Certification
-- Verified Critical: authenticated clients could EXECUTE apply_ace_session_progress
-- and forge certification_status / competency scores (live JWT probe on production).
-- Verified High: insert_assistant_message / insert_system_message remained executable
-- by authenticated after restore_session_message_rpc_grants, contrary to Mission 02
-- intent (app uses service_role only). Ownership checks still apply, but revoke
-- removes the Data API forge surface.

REVOKE ALL ON FUNCTION public.apply_ace_session_progress(
  uuid, uuid, integer, numeric, numeric, text, jsonb, jsonb, jsonb, text, text, text, text[], jsonb
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.apply_ace_session_progress(
  uuid, uuid, integer, numeric, numeric, text, jsonb, jsonb, jsonb, text, text, text, text[], jsonb
) TO service_role;

REVOKE ALL ON FUNCTION public.insert_assistant_message(uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.insert_system_message(uuid, text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.insert_assistant_message(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.insert_system_message(uuid, text) TO service_role;

COMMENT ON FUNCTION public.apply_ace_session_progress(
  uuid, uuid, integer, numeric, numeric, text, jsonb, jsonb, jsonb, text, text, text, text[], jsonb
) IS
  'Service-role only. Persists ACE scoring after assessment; not callable by authenticated Data API clients.';

-- Canonical migration recovered for Release Configuration Board reconciliation.
-- Source: production supabase_migrations.schema_migrations statements
-- (enriched only when production statements were empty/placeholder).

-- AI Runtime Certification: session start/message must work when
-- SUPABASE_SERVICE_ROLE_KEY is unset on the deployment. Function bodies still
-- enforce ownership / active session / turn order. ACE scoring RPCs remain
-- service_role-only (do not re-grant apply_ace_session_progress).

REVOKE ALL ON FUNCTION public.insert_system_message(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.insert_assistant_message(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.insert_system_message(uuid, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.insert_assistant_message(uuid, text)
  TO authenticated, service_role;

-- V1 release certification: session start/message RPCs must be callable by
-- authenticated session owners when SUPABASE_SERVICE_ROLE_KEY is unset.
-- Function bodies still enforce ownership / active session / turn order.
-- A prior draft-branch revoke left production service_role-only and broke
-- therapist session create/message without the service role env.

REVOKE ALL ON FUNCTION public.insert_system_message(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.insert_assistant_message(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.insert_system_message(uuid, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.insert_assistant_message(uuid, text)
  TO authenticated, service_role;

-- Defense in depth: retention purge stays admin-gated in-body; keep EXECUTE
-- for authenticated so platform admins can invoke via PostgREST, revoke anon.
REVOKE ALL ON FUNCTION public.purge_training_sessions_older_than(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_training_sessions_older_than(integer)
  TO authenticated, service_role;

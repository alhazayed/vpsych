-- Restore authenticated EXECUTE on session message RPCs so therapy sessions
-- work when SUPABASE_SERVICE_ROLE_KEY is unset. Ownership / active-session /
-- turn-order checks remain inside the SECURITY DEFINER function bodies.

REVOKE ALL ON FUNCTION public.insert_system_message(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.insert_assistant_message(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.insert_system_message(uuid, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.insert_assistant_message(uuid, text)
  TO authenticated, service_role;

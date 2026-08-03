-- Functional fix: session start/message RPCs must be executable by authenticated
-- session owners. Function bodies still enforce ownership / admin / service_role.
-- A prior security hardening migration revoked authenticated EXECUTE and broke
-- POST /api/sessions (permission denied for function insert_system_message).

REVOKE ALL ON FUNCTION public.insert_system_message(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.insert_assistant_message(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.insert_system_message(uuid, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.insert_assistant_message(uuid, text)
  TO authenticated, service_role;

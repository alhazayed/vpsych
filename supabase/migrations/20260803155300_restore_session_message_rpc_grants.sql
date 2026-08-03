-- Functional/nav journey: session start/message RPCs must be executable by
-- authenticated session owners. Function bodies still enforce ownership /
-- admin / service_role. Production security hardening had revoked authenticated
-- EXECUTE; restore for messageRpcClient fallback when service role is unset.

REVOKE ALL ON FUNCTION public.insert_system_message(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.insert_assistant_message(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.insert_system_message(uuid, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.insert_assistant_message(uuid, text)
  TO authenticated, service_role;

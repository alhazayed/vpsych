-- Reconciliation: explicit EXECUTE grants required for greenfield parity with production.
-- On managed Supabase, service_role often inherits EXECUTE via default privileges; bare
-- replays and some trigger helpers still need these grants recorded in git.
-- Idempotent. Does not alter production history of prior versions.

-- Trigger helpers created without GRANT in enterprise_security_cert_hardening
REVOKE ALL ON FUNCTION public.enforce_learner_profile_insert_guard() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enforce_learner_competency_insert_guard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enforce_learner_profile_insert_guard() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enforce_learner_competency_insert_guard() TO authenticated, service_role;

-- Align service_role EXECUTE with production ACL surface for core RPCs / helpers
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_session_on_report() TO service_role;
GRANT EXECUTE ON FUNCTION public.log_security_event(text, text, text, text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_institution(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_institution_role(uuid, VARIADIC public.enterprise_membership_role[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_institution_member(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO service_role;
GRANT EXECUTE ON FUNCTION public.user_institution_ids() TO service_role;

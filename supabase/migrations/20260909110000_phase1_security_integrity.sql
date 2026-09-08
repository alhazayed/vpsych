-- Phase 1 security integrity hardening.
-- Safe to apply after staging verification. This migration intentionally
-- changes only function configuration and EXECUTE privileges.

BEGIN;

ALTER FUNCTION public.voice_profiles_set_updated_at()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.quality_ledger_reject_mutation()
  SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.quality_ledger_reject_mutation()
  FROM PUBLIC, anon, authenticated;

COMMIT;

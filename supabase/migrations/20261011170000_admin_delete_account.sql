-- Admins can delete an account from Admin > Account approvals.
--
-- admin_delete_account(target_id) removes the sign-in (auth.users). Every
-- table that points at the account cascades or sets null, so the profile,
-- the person's sessions, transcripts, reports and progress go with it; rows
-- the person only authored for others (templates, presets, audit events)
-- keep existing with created_by / actor set to null.
--
-- * Only an admin (is_admin(), which requires two-step login once
--   20261011163157_admin_rls_requires_mfa is applied) may call it.
-- * Nobody can delete their own account here, so at least one admin always
--   remains.
-- * sessions.skill_test_assignment_id is ON DELETE RESTRICT. The person's own
--   sessions are removed first so their own assignments can cascade. If
--   another trainee already took a test this person assigned as supervisor,
--   the delete is refused (account_supervises_taken_tests) rather than
--   removing someone else's exam record; revoke access instead.
--
-- Reversal (additive and reversible):
--   DROP FUNCTION IF EXISTS public.admin_delete_account(uuid);

CREATE OR REPLACE FUNCTION public.admin_delete_account(target_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF target_id IS NULL OR target_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_delete_self' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_id) THEN
    RAISE EXCEPTION 'account_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.sessions s
    JOIN public.skill_test_assignments a ON a.id = s.skill_test_assignment_id
    WHERE a.supervisor_id = target_id
      AND s.therapist_id <> target_id
  ) THEN
    RAISE EXCEPTION 'account_supervises_taken_tests' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.sessions WHERE therapist_id = target_id;
  DELETE FROM auth.users WHERE id = target_id;
END;
$$;

COMMENT ON FUNCTION public.admin_delete_account(uuid) IS
  'Admin-only: permanently delete an account and everything that cascades from it. Refuses the caller''s own account.';

REVOKE EXECUTE ON FUNCTION public.admin_delete_account(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_account(uuid) TO authenticated;

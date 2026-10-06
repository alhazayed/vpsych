-- Account approval: no new account can use VPsych until the superadmin
-- approves it.
--
-- * profiles.approval_status ('pending' | 'approved' | 'rejected').
--   Every profile that exists when this migration runs is backfilled as
--   'approved'; the column default then becomes 'pending', so each new
--   sign-up (handle_new_user) starts pending.
-- * Only an admin (or the service role) can change approval fields; a user
--   cannot approve themselves through the "own display name" update policy.
-- * Defense in depth below the app: RESTRICTIVE RLS on sessions and
--   session_messages, so a pending account cannot start a session or write a
--   transcript even by calling PostgREST directly with its own JWT.
-- * list_account_approvals(): admin-only directory with emails.
--
-- Reversal (additive and reversible):
--   DROP FUNCTION IF EXISTS public.list_account_approvals();
--   DROP POLICY IF EXISTS "Approved accounts only" ON public.sessions;
--   DROP POLICY IF EXISTS "Approved accounts only" ON public.session_messages;
--   DROP TRIGGER IF EXISTS profiles_approval_guard ON public.profiles;
--   DROP FUNCTION IF EXISTS public.enforce_profile_approval_guard();
--   DROP FUNCTION IF EXISTS public.is_approved();
--   ALTER TABLE public.profiles
--     DROP COLUMN IF EXISTS approval_decided_at,
--     DROP COLUMN IF EXISTS approval_decided_by,
--     DROP COLUMN IF EXISTS approval_status;

-- Backfill existing accounts as approved, then flip the default for new rows.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS approval_decided_by uuid
    REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_decided_at timestamptz;

ALTER TABLE public.profiles
  ALTER COLUMN approval_status SET DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_approval_status_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_approval_status_check
      CHECK (approval_status IN ('pending', 'approved', 'rejected'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS profiles_approval_status_idx
  ON public.profiles (approval_status)
  WHERE approval_status <> 'approved';

COMMENT ON COLUMN public.profiles.approval_status IS
  'pending until the superadmin approves the account; only admins may change it.';

-- Approved accounts (and admins, always) may use the platform.
CREATE OR REPLACE FUNCTION public.is_approved()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND (approval_status = 'approved' OR role = 'admin')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_approved() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_approved() TO authenticated, service_role;

-- New rows always start pending unless an admin / service role writes them;
-- approval fields change only by an admin or the service role.
CREATE OR REPLACE FUNCTION public.enforce_profile_approval_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.is_admin() OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.approval_status := 'pending';
    NEW.approval_decided_by := NULL;
    NEW.approval_decided_at := NULL;
    RETURN NEW;
  END IF;

  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status
     OR NEW.approval_decided_by IS DISTINCT FROM OLD.approval_decided_by
     OR NEW.approval_decided_at IS DISTINCT FROM OLD.approval_decided_at
  THEN
    RAISE EXCEPTION 'Cannot change account approval' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_approval_guard ON public.profiles;
CREATE TRIGGER profiles_approval_guard
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_approval_guard();

-- Restrictive: AND-ed with every existing permissive policy on these tables.
DROP POLICY IF EXISTS "Approved accounts only" ON public.sessions;
CREATE POLICY "Approved accounts only" ON public.sessions
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((select public.is_approved()))
  WITH CHECK ((select public.is_approved()));

DROP POLICY IF EXISTS "Approved accounts only" ON public.session_messages;
CREATE POLICY "Approved accounts only" ON public.session_messages
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((select public.is_approved()))
  WITH CHECK ((select public.is_approved()));

-- Admin directory of accounts with their sign-up email.
CREATE OR REPLACE FUNCTION public.list_account_approvals()
RETURNS TABLE (
  id uuid,
  display_name text,
  email text,
  role text,
  approval_status text,
  created_at timestamptz,
  approval_decided_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT p.id, p.display_name::text, u.email::text, p.role::text,
           p.approval_status, p.created_at, p.approval_decided_at
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    ORDER BY
      CASE p.approval_status WHEN 'pending' THEN 0 WHEN 'rejected' THEN 1 ELSE 2 END,
      p.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_account_approvals() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.list_account_approvals() TO authenticated;

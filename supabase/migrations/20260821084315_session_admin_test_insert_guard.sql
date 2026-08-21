-- OD-27 / C-1 — close the forged `admin_test` scoring-evasion vector at the database.
--
-- THE DEFECT
-- The sessions INSERT policy is `WITH CHECK (therapist_id = (SELECT auth.uid()))`.
-- It constrains WHO owns the row and nothing about WHAT the row contains, so a
-- therapist writing directly to the table could mint a session carrying
-- `clinical_snapshot.admin_test = true`, end it, receive 403, and thereby evade
-- assessment of their own session permanently.
--
-- The learner-facing API already strips the marker (`stripAdminTestMarker`,
-- src/app/api/sessions/route.ts), but a direct INSERT bypasses that route entirely.
-- The application-layer guard existed; the database-layer guard did not.
--
-- WHY A TRIGGER AND NOT A POLICY CHANGE
-- Remediation shape 3 of the three recorded under OD-27. It closes the vector
-- rather than the symptom: the marker can no longer be created by a non-admin at
-- all, so the downstream question the protocol left open — whether a forged
-- session should be assessed or refused (F-5) — becomes unreachable for any
-- session minted after this migration.
--
-- SCOPE — deliberately narrow
-- The UPDATE path is ALREADY closed by `enforce_session_update_guard`
-- (CQG-010: "Cannot change clinical_snapshot"), verified against the live
-- function body. This migration therefore adds an INSERT guard only and changes
-- no policy, no column, and no existing function.

CREATE OR REPLACE FUNCTION public.enforce_session_insert_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Only an authenticated admin may mint a session carrying the admin_test marker.
  --
  -- `->>` renders JSON boolean true and JSON string "true" identically as 'true',
  -- so both shapes are caught. That is intentionally stricter than the
  -- application's `admin_test === true` check: a string marker cannot evade
  -- assessment, but there is no legitimate reason to write one either.
  IF coalesce(NEW.clinical_snapshot ->> 'admin_test', '') = 'true' THEN
    -- auth.uid() IS NULL means no end-user JWT: the service role, a migration, or
    -- a seed. Those are server-side callers that can already bypass RLS entirely,
    -- so this guard adds no new trust and deliberately does not obstruct them.
    -- Every browser-originated request carries a uid, which is the attack path.
    IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'admin_test marker is not permitted for this role'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_session_insert_guard() IS
  'OD-27 / C-1: rejects a session INSERT carrying clinical_snapshot.admin_test from any authenticated non-admin. Closes the forged admin_test scoring-evasion vector at the database layer.';

DROP TRIGGER IF EXISTS session_insert_guard ON public.sessions;
CREATE TRIGGER session_insert_guard
  BEFORE INSERT ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_session_insert_guard();

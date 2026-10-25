-- Verifiable Training Program certificates.
--
-- Until now /admin/certificates printed a sheet whose number was not recorded
-- anywhere, so nobody could check it. This keeps every issued certificate in
-- the existing public.enterprise_certificates table:
--
-- * A trainee who clears every level of every active Training Program patient
--   gets a certificate automatically (trigger on training_ladder_attempts,
--   which the report trigger grades). Best effort: a failure here is a
--   warning and never stops a report or a grade from being written.
-- * An admin (is_admin(): two-step login) can issue one by hand and revoke
--   any certificate, with a reason, through SECURITY DEFINER RPCs.
-- * Anyone, signed in or not, can check a certificate number through
--   verify_training_certificate(code), which returns only what the printed
--   sheet already shows (name, title, date, institute, revoked or not).
--
-- One active Training Program certificate per trainee. An automatic
-- certificate is issued once: after an admin revokes it, only an admin can
-- issue a new one.
--
-- Wording rule: this is an educational training certificate, not a clinical
-- licence. The app prints and shows that next to every certificate.
--
-- Additive and idempotent: new nullable columns, a relaxed NOT NULL on
-- institution_id (most trainees have no institute), new functions, a trigger,
-- and a backfill guarded by NOT EXISTS. Existing policies are unchanged.
--
-- Reversal:
--   DROP TRIGGER IF EXISTS training_ladder_attempts_issue_certificate ON public.training_ladder_attempts;
--   DROP FUNCTION IF EXISTS public.training_ladder_issue_certificate();
--   DROP FUNCTION IF EXISTS public.issue_training_program_certificate(uuid, text, uuid, text, text, text);
--   DROP FUNCTION IF EXISTS public.admin_issue_training_certificate(uuid, text, text, text);
--   DROP FUNCTION IF EXISTS public.admin_revoke_training_certificate(uuid, text);
--   DROP FUNCTION IF EXISTS public.verify_training_certificate(text);
--   DROP FUNCTION IF EXISTS public.training_ladder_completed(uuid);
--   DROP FUNCTION IF EXISTS public.new_certificate_number();
--   DROP INDEX IF EXISTS public.enterprise_certificates_one_active_program_idx;
--   ALTER TABLE public.enterprise_certificates DROP COLUMN IF EXISTS program,
--     DROP COLUMN IF EXISTS source, DROP COLUMN IF EXISTS recipient_name,
--     DROP COLUMN IF EXISTS institution_name, DROP COLUMN IF EXISTS locale,
--     DROP COLUMN IF EXISTS issued_by, DROP COLUMN IF EXISTS revoked_at,
--     DROP COLUMN IF EXISTS revoked_by, DROP COLUMN IF EXISTS revoked_reason;
--   (Only after deleting rows with a null institution_id:)
--   ALTER TABLE public.enterprise_certificates ALTER COLUMN institution_id SET NOT NULL;

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.enterprise_certificates
  ALTER COLUMN institution_id DROP NOT NULL;

ALTER TABLE public.enterprise_certificates
  ADD COLUMN IF NOT EXISTS program text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS recipient_name text,
  ADD COLUMN IF NOT EXISTS institution_name text,
  ADD COLUMN IF NOT EXISTS locale text,
  ADD COLUMN IF NOT EXISTS issued_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revoked_reason text;

DO $$ BEGIN
  ALTER TABLE public.enterprise_certificates
    ADD CONSTRAINT enterprise_certificates_program_check
    CHECK (program IS NULL OR program IN ('training_program'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.enterprise_certificates
    ADD CONSTRAINT enterprise_certificates_source_check
    CHECK (source IS NULL OR source IN ('training_ladder', 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.enterprise_certificates
    ADD CONSTRAINT enterprise_certificates_locale_check
    CHECK (locale IS NULL OR locale IN ('en', 'ar'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.enterprise_certificates
    ADD CONSTRAINT enterprise_certificates_text_lengths_check
    CHECK (
      coalesce(length(recipient_name), 0) <= 120
      AND coalesce(length(institution_name), 0) <= 120
      AND coalesce(length(revoked_reason), 0) <= 300
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS enterprise_certificates_one_active_program_idx
  ON public.enterprise_certificates (user_id)
  WHERE program = 'training_program' AND NOT revoked;

CREATE INDEX IF NOT EXISTS enterprise_certificates_issued_by_idx
  ON public.enterprise_certificates (issued_by);
CREATE INDEX IF NOT EXISTS enterprise_certificates_revoked_by_idx
  ON public.enterprise_certificates (revoked_by);

COMMENT ON COLUMN public.enterprise_certificates.verification_code IS
  'The printed certificate number (VT-XXXX-XXXX-XXXX); checked at /verify.';
COMMENT ON COLUMN public.enterprise_certificates.recipient_name IS
  'Name as printed, frozen when the certificate is issued.';

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- VT-XXXX-XXXX-XXXX from 48 random bits (upper-case hex: no O, I or L).
CREATE OR REPLACE FUNCTION public.new_certificate_number()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  v_hex text;
  v_code text;
BEGIN
  FOR i IN 1..8 LOOP
    v_hex := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    v_code := 'VT-' || substr(v_hex, 1, 4) || '-' || substr(v_hex, 5, 4) || '-' || substr(v_hex, 9, 4);
    IF NOT EXISTS (
      SELECT 1 FROM public.enterprise_certificates WHERE verification_code = v_code
    ) THEN
      RETURN v_code;
    END IF;
  END LOOP;
  RAISE EXCEPTION 'certificate_number_unavailable';
END;
$$;

REVOKE ALL ON FUNCTION public.new_certificate_number() FROM public, anon, authenticated;

-- True when the trainee has passed the top level of every active program
-- patient. Levels unlock in order, so a passed top level means every level
-- below it was cleared too.
CREATE OR REPLACE FUNCTION public.training_ladder_completed(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.training_ladder_patients WHERE is_active)
    AND NOT EXISTS (
      SELECT 1
      FROM public.training_ladder_patients p
      WHERE p.is_active
        AND NOT EXISTS (
          SELECT 1
          FROM public.training_ladder_attempts a
          WHERE a.therapist_id = p_user_id
            AND a.patient_key = p.key
            AND a.level = 5
            AND a.status = 'passed'
        )
    );
$$;

REVOKE ALL ON FUNCTION public.training_ladder_completed(uuid) FROM public, anon, authenticated;

-- Inserts one Training Program certificate; returns the new row's id, or null
-- when the trainee already holds an active one. Internal: callers check who
-- may issue.
CREATE OR REPLACE FUNCTION public.issue_training_program_certificate(
  p_user_id uuid,
  p_source text,
  p_issued_by uuid,
  p_recipient_name text DEFAULT NULL,
  p_institution_name text DEFAULT NULL,
  p_locale text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile record;
  v_code text;
  v_id uuid;
BEGIN
  SELECT id, display_name, preferred_language INTO v_profile
  FROM public.profiles WHERE id = p_user_id;
  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'account_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_code := public.new_certificate_number();

  INSERT INTO public.enterprise_certificates (
    institution_id, user_id, kind, title, verification_code, qr_payload,
    metadata, program, source, recipient_name, institution_name, locale, issued_by
  )
  VALUES (
    NULL,
    p_user_id,
    'course',
    'Training Program completion',
    v_code,
    '/verify?code=' || v_code,
    jsonb_build_object('disclaimer', 'Educational training certificate, not a clinical licence.'),
    'training_program',
    p_source,
    left(coalesce(nullif(btrim(p_recipient_name), ''), nullif(btrim(v_profile.display_name), '')), 120),
    left(nullif(btrim(p_institution_name), ''), 120),
    coalesce(p_locale, v_profile.preferred_language, 'en'),
    p_issued_by
  )
  ON CONFLICT (user_id) WHERE program = 'training_program' AND NOT revoked DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_training_program_certificate(uuid, text, uuid, text, text, text)
  FROM public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Automatic issue when the ladder is cleared
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.training_ladder_issue_certificate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    IF NOT EXISTS (
         SELECT 1 FROM public.enterprise_certificates
         WHERE user_id = NEW.therapist_id
           AND program = 'training_program'
           AND (NOT revoked OR source = 'training_ladder')
       )
       AND public.training_ladder_completed(NEW.therapist_id) THEN
      PERFORM public.issue_training_program_certificate(NEW.therapist_id, 'training_ladder', NULL);
    END IF;
  EXCEPTION WHEN others THEN
    -- Never block grading or the report that triggered it.
    RAISE WARNING 'training certificate not issued for %: %', NEW.therapist_id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.training_ladder_issue_certificate() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS training_ladder_attempts_issue_certificate ON public.training_ladder_attempts;
CREATE TRIGGER training_ladder_attempts_issue_certificate
  AFTER UPDATE OF status ON public.training_ladder_attempts
  FOR EACH ROW
  WHEN (NEW.status = 'passed' AND NEW.level = 5 AND OLD.status IS DISTINCT FROM 'passed')
  EXECUTE FUNCTION public.training_ladder_issue_certificate();

-- ---------------------------------------------------------------------------
-- Admin: issue by hand, revoke
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_issue_training_certificate(
  p_user_id uuid,
  p_recipient_name text,
  p_institution_name text DEFAULT NULL,
  p_locale text DEFAULT NULL
)
RETURNS public.enterprise_certificates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_row public.enterprise_certificates;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_recipient_name IS NULL OR btrim(p_recipient_name) = '' THEN
    RAISE EXCEPTION 'recipient_name_required' USING ERRCODE = '22023';
  END IF;
  IF length(btrim(p_recipient_name)) > 120 OR length(coalesce(btrim(p_institution_name), '')) > 120 THEN
    RAISE EXCEPTION 'text_too_long' USING ERRCODE = '22023';
  END IF;
  IF p_locale IS NOT NULL AND p_locale NOT IN ('en', 'ar') THEN
    RAISE EXCEPTION 'invalid_locale' USING ERRCODE = '22023';
  END IF;

  v_id := public.issue_training_program_certificate(
    p_user_id, 'admin', auth.uid(), p_recipient_name, p_institution_name, p_locale
  );
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'already_issued' USING ERRCODE = '23505';
  END IF;

  SELECT * INTO v_row FROM public.enterprise_certificates WHERE id = v_id;
  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.admin_issue_training_certificate(uuid, text, text, text) IS
  'Admin-only: record a Training Program certificate for a trainee. Refuses when one is already active.';

REVOKE ALL ON FUNCTION public.admin_issue_training_certificate(uuid, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_issue_training_certificate(uuid, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_revoke_training_certificate(
  p_certificate_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS public.enterprise_certificates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.enterprise_certificates;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF length(coalesce(btrim(p_reason), '')) > 300 THEN
    RAISE EXCEPTION 'text_too_long' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_row FROM public.enterprise_certificates
  WHERE id = p_certificate_id
  FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'certificate_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_row.revoked THEN
    RAISE EXCEPTION 'already_revoked' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.enterprise_certificates
  SET revoked = true,
      revoked_at = now(),
      revoked_by = auth.uid(),
      revoked_reason = nullif(btrim(p_reason), '')
  WHERE id = p_certificate_id
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.admin_revoke_training_certificate(uuid, text) IS
  'Admin-only: mark a certificate revoked. Verification then reports it as revoked.';

REVOKE ALL ON FUNCTION public.admin_revoke_training_certificate(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_revoke_training_certificate(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Public verification
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_training_certificate(p_code text)
RETURNS TABLE (
  certificate_number text,
  recipient_name text,
  title text,
  program text,
  institution_name text,
  issued_at timestamptz,
  revoked boolean,
  revoked_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.verification_code, c.recipient_name, c.title, c.program,
         c.institution_name, c.issued_at, c.revoked, c.revoked_at
  FROM public.enterprise_certificates c
  WHERE p_code IS NOT NULL
    AND length(p_code) BETWEEN 8 AND 40
    AND c.verification_code = upper(regexp_replace(p_code, '\s', '', 'g'))
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.verify_training_certificate(text) IS
  'Public: look up a certificate number. Returns only what the printed sheet shows.';

REVOKE ALL ON FUNCTION public.verify_training_certificate(text) FROM public;
GRANT EXECUTE ON FUNCTION public.verify_training_certificate(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Backfill: trainees who already cleared the ladder
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_user uuid;
BEGIN
  FOR v_user IN
    SELECT DISTINCT a.therapist_id
    FROM public.training_ladder_attempts a
    WHERE a.level = 5 AND a.status = 'passed'
  LOOP
    IF NOT EXISTS (
         SELECT 1 FROM public.enterprise_certificates
         WHERE user_id = v_user AND program = 'training_program'
       )
       AND public.training_ladder_completed(v_user) THEN
      PERFORM public.issue_training_program_certificate(v_user, 'training_ladder', NULL);
    END IF;
  END LOOP;
END $$;

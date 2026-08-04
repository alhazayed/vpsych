-- Mission 22: Enterprise compliance — consent fields, retention purge helper.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_processing_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cookie_preferences jsonb NOT NULL DEFAULT '{"essential":true,"preferences":false}'::jsonb,
  ADD COLUMN IF NOT EXISTS organization text,
  ADD COLUMN IF NOT EXISTS data_retention_days integer NOT NULL DEFAULT 365
    CHECK (data_retention_days >= 30 AND data_retention_days <= 2555);

COMMENT ON COLUMN public.profiles.terms_accepted_at IS 'Timestamp when user accepted Terms of Service (signup / re-consent)';
COMMENT ON COLUMN public.profiles.privacy_accepted_at IS 'Timestamp when user accepted Privacy Policy';
COMMENT ON COLUMN public.profiles.ai_processing_accepted_at IS 'Timestamp when user consented to AI/voice subprocessors for training simulation';
COMMENT ON COLUMN public.profiles.marketing_opt_in IS 'Optional newsletter / product updates consent';
COMMENT ON COLUMN public.profiles.cookie_preferences IS 'Cookie preference object: essential (always true), preferences (locale extras)';
COMMENT ON COLUMN public.profiles.organization IS 'Institution / organization name (free text; not hard tenancy)';
COMMENT ON COLUMN public.profiles.data_retention_days IS 'Preferred retention window for learner training data (default 365 days)';

-- Capture consent from auth signup metadata when the profile is created.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  accepted_at timestamptz;
BEGIN
  accepted_at := CASE
    WHEN coalesce(new.raw_user_meta_data->>'terms_accepted', 'false') IN ('true', '1', 'yes')
      THEN now()
    ELSE NULL
  END;

  INSERT INTO public.profiles (
    id,
    display_name,
    role,
    terms_accepted_at,
    privacy_accepted_at,
    ai_processing_accepted_at,
    marketing_opt_in,
    organization
  )
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Therapist'),
    'therapist',
    accepted_at,
    accepted_at,
    CASE
      WHEN coalesce(new.raw_user_meta_data->>'ai_processing_accepted', new.raw_user_meta_data->>'terms_accepted', 'false')
        IN ('true', '1', 'yes') THEN now()
      ELSE NULL
    END,
    coalesce((new.raw_user_meta_data->>'newsletter')::boolean, false),
    nullif(new.raw_user_meta_data->>'organization', '')
  );
  RETURN new;
END;
$$;

-- Admin/service retention purge: delete completed/expired sessions (cascade messages/reports)
-- older than p_days. Does NOT delete auth users. Returns deleted session count.
CREATE OR REPLACE FUNCTION public.purge_training_sessions_older_than(p_days integer DEFAULT 365)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_days IS NULL OR p_days < 30 THEN
    RAISE EXCEPTION 'p_days must be >= 30';
  END IF;

  WITH doomed AS (
    DELETE FROM public.sessions s
    WHERE s.status IN ('completed', 'expired')
      AND coalesce(s.ended_at, s.started_at) < (now() - make_interval(days => p_days))
    RETURNING s.id
  )
  SELECT count(*)::integer INTO deleted_count FROM doomed;

  PERFORM public.log_security_event(
    'compliance.retention.purge',
    'success',
    'sessions',
    NULL,
    NULL,
    NULL,
    jsonb_build_object('days', p_days, 'deleted', deleted_count)
  );

  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_training_sessions_older_than(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_training_sessions_older_than(integer) TO authenticated;

COMMENT ON FUNCTION public.purge_training_sessions_older_than(integer) IS
  'Admin-only retention purge of completed/expired training sessions older than N days (GDPR storage limitation)';

-- CQG-010 / CQG-011 / CQG-013 — session immutability + signed message RPCs
--
-- CQG-010 (Critical): therapists could UPDATE sessions.clinical_snapshot and
-- rewrite the Case Engine diagnosis / disclosure rules mid-session.
--
-- CQG-011 (Critical): authenticated owners could call insert_assistant_message
-- via PostgREST and forge graded transcripts. Require HMAC (report_write_key)
-- for non-service_role callers — same pattern as create_session_report.
--
-- CQG-013 (High): concurrent assistant inserts raced on last-role check.
-- Lock the session row FOR UPDATE before reading turn order.

-- ─── CQG-010: freeze clinical case fields on sessions ───────────────────────
CREATE OR REPLACE FUNCTION public.enforce_session_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_case_owner uuid;
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.therapist_id IS DISTINCT FROM OLD.therapist_id THEN
    RAISE EXCEPTION 'Cannot change therapist_id';
  END IF;
  IF NEW.avatar_id IS DISTINCT FROM OLD.avatar_id THEN
    RAISE EXCEPTION 'Cannot change avatar_id';
  END IF;
  IF NEW.max_duration_sec IS DISTINCT FROM OLD.max_duration_sec THEN
    RAISE EXCEPTION 'Cannot change max_duration_sec';
  END IF;
  IF NEW.started_at IS DISTINCT FROM OLD.started_at THEN
    RAISE EXCEPTION 'Cannot change started_at';
  END IF;
  IF OLD.status <> 'active' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Cannot reopen or change a finished session';
  END IF;

  -- CQG-010: Case Engine snapshot is immutable after mint.
  IF NEW.clinical_snapshot IS DISTINCT FROM OLD.clinical_snapshot THEN
    RAISE EXCEPTION 'Cannot change clinical_snapshot';
  END IF;
  IF NEW.difficulty IS DISTINCT FROM OLD.difficulty THEN
    RAISE EXCEPTION 'Cannot change difficulty';
  END IF;
  IF NEW.therapy_modality IS DISTINCT FROM OLD.therapy_modality THEN
    RAISE EXCEPTION 'Cannot change therapy_modality';
  END IF;
  IF NEW.instructor_preset_id IS DISTINCT FROM OLD.instructor_preset_id THEN
    RAISE EXCEPTION 'Cannot change instructor_preset_id';
  END IF;

  IF NEW.case_instance_id IS DISTINCT FROM OLD.case_instance_id THEN
    IF OLD.case_instance_id IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot rebind case_instance_id';
    END IF;
    IF NEW.case_instance_id IS NOT NULL THEN
      SELECT created_by INTO v_case_owner
      FROM public.case_instances
      WHERE id = NEW.case_instance_id;
      IF v_case_owner IS NULL THEN
        RAISE EXCEPTION 'case_instance_id not found';
      END IF;
      IF v_case_owner IS DISTINCT FROM NEW.therapist_id THEN
        RAISE EXCEPTION 'case_instance_id not owned by therapist';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ─── CQG-011 / CQG-013: signed + locked message RPCs ────────────────────────
-- Drop 2-arg forms so PostgREST exposes the signed 3-arg contract.
DROP FUNCTION IF EXISTS public.insert_assistant_message(uuid, text);
DROP FUNCTION IF EXISTS public.insert_system_message(uuid, text);

CREATE OR REPLACE FUNCTION public.insert_assistant_message(
  p_session_id uuid,
  p_content text,
  p_sig text DEFAULT NULL
)
RETURNS public.session_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owner uuid;
  v_status public.session_status;
  v_last public.message_role;
  v_row public.session_messages;
  v_is_service boolean := (
    coalesce(auth.role(), '') = 'service_role'
    OR coalesce(auth.jwt() ->> 'role', '') = 'service_role'
  );
  v_key text;
  v_expected text;
  v_payload text;
BEGIN
  IF p_content IS NULL OR length(trim(p_content)) = 0 THEN
    RAISE EXCEPTION 'Empty content';
  END IF;
  IF length(p_content) > 8000 THEN
    RAISE EXCEPTION 'Content too long';
  END IF;

  -- CQG-013: serialize turn checks per session.
  SELECT therapist_id, status INTO v_owner, v_status
  FROM public.sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  IF NOT v_is_service THEN
    IF auth.uid() IS NULL OR (v_owner <> auth.uid() AND NOT public.is_admin()) THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
    -- CQG-011: HMAC required for non-service callers (blocks PostgREST forge).
    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
    WHERE name = 'report_write_key'
    LIMIT 1;
    IF v_key IS NULL OR length(v_key) = 0 THEN
      RAISE EXCEPTION 'Message write key not configured';
    END IF;
    v_payload := p_session_id::text || E'\n' || p_content || E'\nassistant';
    v_expected := encode(extensions.hmac(v_payload, v_key, 'sha256'), 'hex');
    IF p_sig IS NULL OR p_sig IS DISTINCT FROM v_expected THEN
      RAISE EXCEPTION 'Invalid message signature';
    END IF;
  END IF;
  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'Session is not active';
  END IF;

  SELECT role INTO v_last
  FROM public.session_messages
  WHERE session_id = p_session_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_last IS DISTINCT FROM 'user' THEN
    RAISE EXCEPTION 'Assistant reply requires a preceding user turn';
  END IF;

  INSERT INTO public.session_messages (session_id, role, content)
  VALUES (p_session_id, 'assistant', p_content)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.insert_system_message(
  p_session_id uuid,
  p_content text,
  p_sig text DEFAULT NULL
)
RETURNS public.session_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owner uuid;
  v_status public.session_status;
  v_row public.session_messages;
  v_is_service boolean := (
    coalesce(auth.role(), '') = 'service_role'
    OR coalesce(auth.jwt() ->> 'role', '') = 'service_role'
  );
  v_key text;
  v_expected text;
  v_payload text;
BEGIN
  SELECT therapist_id, status INTO v_owner, v_status
  FROM public.sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  IF NOT v_is_service THEN
    IF auth.uid() IS NULL OR (v_owner <> auth.uid() AND NOT public.is_admin()) THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
    WHERE name = 'report_write_key'
    LIMIT 1;
    IF v_key IS NULL OR length(v_key) = 0 THEN
      RAISE EXCEPTION 'Message write key not configured';
    END IF;
    v_payload := p_session_id::text || E'\n' || coalesce(p_content, 'Session started.') || E'\nsystem';
    v_expected := encode(extensions.hmac(v_payload, v_key, 'sha256'), 'hex');
    IF p_sig IS NULL OR p_sig IS DISTINCT FROM v_expected THEN
      RAISE EXCEPTION 'Invalid message signature';
    END IF;
  END IF;
  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'Session is not active';
  END IF;

  INSERT INTO public.session_messages (session_id, role, content)
  VALUES (p_session_id, 'system', coalesce(p_content, 'Session started.'))
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.insert_system_message(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.insert_assistant_message(uuid, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.insert_system_message(uuid, text, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.insert_assistant_message(uuid, text, text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.insert_assistant_message(uuid, text, text) IS
  'Insert assistant turn. service_role unrestricted; authenticated requires HMAC(report_write_key) over sessionId\\ncontent\\nassistant (CQG-011). Session row locked FOR UPDATE (CQG-013).';

COMMENT ON FUNCTION public.insert_system_message(uuid, text, text) IS
  'Insert system turn. service_role unrestricted; authenticated requires HMAC(report_write_key) over sessionId\\ncontent\\nsystem (CQG-011).';

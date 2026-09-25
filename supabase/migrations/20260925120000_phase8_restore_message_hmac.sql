-- Phase 8.2 — restore CQG-011 HMAC on session message RPCs.
-- Authenticated owners may EXECUTE but must present a valid p_sig.
-- service_role bypasses HMAC (trusted server). Anon remains revoked.
-- Canonical payload matches src/lib/report-sign.ts signSessionMessage:
--   sessionId || '\n' || content || '\n' || ('assistant'|'system')

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
  v_content text := coalesce(p_content, 'Session started.');
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
    v_payload := p_session_id::text || E'\n' || v_content || E'\nsystem';
    v_expected := encode(extensions.hmac(v_payload, v_key, 'sha256'), 'hex');
    IF p_sig IS NULL OR p_sig IS DISTINCT FROM v_expected THEN
      RAISE EXCEPTION 'Invalid message signature';
    END IF;
  END IF;
  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'Session is not active';
  END IF;

  INSERT INTO public.session_messages (session_id, role, content)
  VALUES (p_session_id, 'system', v_content)
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
  'Phase 8.2 / CQG-011: service_role unrestricted; authenticated requires HMAC(report_write_key) over sessionId\ncontent\nassistant.';

COMMENT ON FUNCTION public.insert_system_message(uuid, text, text) IS
  'Phase 8.2 / CQG-011: service_role unrestricted; authenticated requires HMAC(report_write_key) over sessionId\ncontent\nsystem.';

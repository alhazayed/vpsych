-- Phase 9.1S — atomic tip identity guard for insert_assistant_message.
--
-- Closes the TOCTOU race where an application-level tip check and the RPC
-- insert were separate statements: a newer user message could land between
-- them and a stale assistant could attach to the wrong user turn.
--
-- Additive: locks sessions FOR UPDATE as before; additionally requires that
-- the tip message is the originating user row identified by p_user_message_id.
-- HMAC payload for authenticated callers is UNCHANGED
-- (sessionId || E'\n' || content || E'\nassistant').
--
-- Drops the prior 3-arg overload so callers must pass the user message id.

DROP FUNCTION IF EXISTS public.insert_assistant_message(uuid, text, text);

CREATE OR REPLACE FUNCTION public.insert_assistant_message(
  p_session_id uuid,
  p_user_message_id uuid,
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
  v_tip public.session_messages;
  v_row public.session_messages;
  v_is_service boolean := (
    coalesce(auth.role(), '') = 'service_role'
    OR coalesce(auth.jwt() ->> 'role', '') = 'service_role'
  );
  v_key text;
  v_expected text;
  v_payload text;
BEGIN
  IF p_user_message_id IS NULL THEN
    RAISE EXCEPTION 'User message id required';
  END IF;
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

  -- Atomic tip identity: role=user AND id matches the originating user turn.
  SELECT * INTO v_tip
  FROM public.session_messages
  WHERE session_id = p_session_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_tip.id IS NULL THEN
    RAISE EXCEPTION 'Assistant reply requires a preceding user turn';
  END IF;
  IF v_tip.role IS DISTINCT FROM 'user' THEN
    RAISE EXCEPTION 'Assistant reply requires a preceding user turn';
  END IF;
  IF v_tip.id IS DISTINCT FROM p_user_message_id THEN
    -- Deterministic superseded signal for the API route (not a 500).
    RAISE EXCEPTION 'Turn superseded'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.session_messages (session_id, role, content)
  VALUES (p_session_id, 'assistant', p_content)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.insert_assistant_message(uuid, uuid, text, text)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.insert_assistant_message(uuid, uuid, text, text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.insert_assistant_message(uuid, uuid, text, text) IS
  'Phase 9.1S: service_role unrestricted; authenticated requires HMAC(report_write_key) over sessionId\ncontent\nassistant. Tip must be user row p_user_message_id (atomic).';

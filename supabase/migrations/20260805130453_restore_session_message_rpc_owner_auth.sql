-- W1-C1 / RC3 Wave 1 Critical: complete V1-C1 restore.
--
-- History: enterprise_security_cert_hardening (20260803194707) replaced
-- insert_system_message / insert_assistant_message bodies with a hard
-- service_role-only gate. Later restore_session_message_rpc_grants_v1
-- (20260804055602) re-granted EXECUTE to authenticated but left the
-- service_role-only body intact. With SUPABASE_SERVICE_ROLE_KEY unset,
-- messageRpcClient falls back to the user client and session create
-- fails with HTTP 500 {"error":"Not authorized"} after the sessions row
-- is inserted.
--
-- Certified intent (V1-C1, F-C1/F-C2, RC1_CODE_FREEZE): authenticated
-- session owners may call these RPCs; bodies enforce ownership / active
-- status / turn order. service_role remains allowed for privileged writers.

CREATE OR REPLACE FUNCTION public.insert_assistant_message(
  p_session_id uuid,
  p_content text
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
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
  );
BEGIN
  IF p_content IS NULL OR length(trim(p_content)) = 0 THEN
    RAISE EXCEPTION 'Empty content';
  END IF;
  IF length(p_content) > 8000 THEN
    RAISE EXCEPTION 'Content too long';
  END IF;

  SELECT therapist_id, status INTO v_owner, v_status
  FROM public.sessions WHERE id = p_session_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  IF NOT v_is_service THEN
    IF auth.uid() IS NULL OR (v_owner <> auth.uid() AND NOT public.is_admin()) THEN
      RAISE EXCEPTION 'Not authorized';
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
  p_content text
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
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
  );
BEGIN
  SELECT therapist_id, status INTO v_owner, v_status
  FROM public.sessions WHERE id = p_session_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  IF NOT v_is_service THEN
    IF auth.uid() IS NULL OR (v_owner <> auth.uid() AND NOT public.is_admin()) THEN
      RAISE EXCEPTION 'Not authorized';
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

REVOKE ALL ON FUNCTION public.insert_system_message(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.insert_assistant_message(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.insert_system_message(uuid, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.insert_assistant_message(uuid, text)
  TO authenticated, service_role;

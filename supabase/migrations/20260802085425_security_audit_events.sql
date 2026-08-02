-- Append-only security audit log for admin access and sensitive mutations.
-- Writes go through a SECURITY DEFINER RPC so callers cannot spoof actor_id.

CREATE TABLE IF NOT EXISTS public.security_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  action text NOT NULL,
  outcome text NOT NULL
    CHECK (outcome IN ('success', 'failure', 'denied')),
  resource_type text,
  resource_id text,
  ip text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS security_audit_events_created_at_idx
  ON public.security_audit_events (created_at DESC);
CREATE INDEX IF NOT EXISTS security_audit_events_actor_id_idx
  ON public.security_audit_events (actor_id);
CREATE INDEX IF NOT EXISTS security_audit_events_action_idx
  ON public.security_audit_events (action);

COMMENT ON TABLE public.security_audit_events IS
  'Append-only security audit trail (admin access, authz denials, sensitive mutations)';

ALTER TABLE public.security_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read security audit events"
  ON public.security_audit_events;
CREATE POLICY "Admins can read security audit events"
  ON public.security_audit_events FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- No direct INSERT/UPDATE/DELETE for clients — use the RPC below.

CREATE OR REPLACE FUNCTION public.log_security_event(
  p_action text,
  p_outcome text,
  p_resource_type text DEFAULT NULL,
  p_resource_id text DEFAULT NULL,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_actor uuid := auth.uid();
BEGIN
  IF p_action IS NULL OR length(trim(p_action)) = 0 THEN
    RAISE EXCEPTION 'action required';
  END IF;
  IF p_outcome IS NULL OR p_outcome NOT IN ('success', 'failure', 'denied') THEN
    RAISE EXCEPTION 'invalid outcome';
  END IF;

  INSERT INTO public.security_audit_events (
    actor_id,
    action,
    outcome,
    resource_type,
    resource_id,
    ip,
    user_agent,
    metadata
  )
  VALUES (
    v_actor,
    trim(p_action),
    p_outcome,
    nullif(trim(coalesce(p_resource_type, '')), ''),
    nullif(trim(coalesce(p_resource_id, '')), ''),
    nullif(trim(coalesce(p_ip, '')), ''),
    nullif(trim(coalesce(p_user_agent, '')), ''),
    coalesce(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_security_event(
  text, text, text, text, text, text, jsonb
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.log_security_event(
  text, text, text, text, text, text, jsonb
) TO authenticated;

COMMENT ON FUNCTION public.log_security_event IS
  'Insert a security audit row; actor_id is always auth.uid()';

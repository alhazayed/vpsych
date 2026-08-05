-- Human Conversation Engine — turn audit log (server-written, therapist-readable).

CREATE TABLE IF NOT EXISTS public.hce_turn_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  turn_index integer NOT NULL,
  therapist_message text NOT NULL,
  patient_utterance text NOT NULL,
  turn_brief jsonb NOT NULL DEFAULT '{}'::jsonb,
  engine_snapshots jsonb NOT NULL DEFAULT '{}'::jsonb,
  reasoning_mode text NOT NULL DEFAULT 'fast',
  gpt_model text,
  latency_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hce_turn_log_session_id_idx
  ON public.hce_turn_log (session_id, turn_index);

ALTER TABLE public.hce_turn_log ENABLE ROW LEVEL SECURITY;

-- Therapists read logs for their sessions; admins read all.
DROP POLICY IF EXISTS "HCE turn log select" ON public.hce_turn_log;
CREATE POLICY "HCE turn log select" ON public.hce_turn_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = hce_turn_log.session_id
        AND (
          s.therapist_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'admin'
          )
        )
    )
  );

-- INSERT only for session owner or service role (server route uses service client).
DROP POLICY IF EXISTS "HCE turn log insert" ON public.hce_turn_log;
CREATE POLICY "HCE turn log insert" ON public.hce_turn_log
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = hce_turn_log.session_id
        AND s.therapist_id = auth.uid()
        AND s.status = 'active'
    )
  );

-- No client UPDATE/DELETE — audit integrity.
REVOKE UPDATE, DELETE ON public.hce_turn_log FROM authenticated;
GRANT SELECT, INSERT ON public.hce_turn_log TO authenticated;
GRANT ALL ON public.hce_turn_log TO service_role;

COMMENT ON TABLE public.hce_turn_log IS
  'HCE per-turn audit: engine snapshots and turn briefs for training QA. No internal GPT notes stored.';

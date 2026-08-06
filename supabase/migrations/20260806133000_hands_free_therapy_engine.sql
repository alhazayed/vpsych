-- Hands-Free Therapy Engine (HFTE) v1
-- Voice conversation preferences + aggregate metrics (NO audio storage).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS voice_conversation_preferences jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.voice_conversation_preferences IS
  'HFTE UX preferences (mode, interrupt, thinking delay, waveform, sensitivity). Never stores audio.';

CREATE TABLE IF NOT EXISTS public.hfte_session_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  therapist_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  interruption_count integer NOT NULL DEFAULT 0 CHECK (interruption_count >= 0),
  pause_count integer NOT NULL DEFAULT 0 CHECK (pause_count >= 0),
  speech_duration_ms integer NOT NULL DEFAULT 0 CHECK (speech_duration_ms >= 0),
  thinking_latency_ms integer NOT NULL DEFAULT 0 CHECK (thinking_latency_ms >= 0),
  turn_count integer NOT NULL DEFAULT 0 CHECK (turn_count >= 0),
  vad_confidence_avg numeric NOT NULL DEFAULT 0
    CHECK (vad_confidence_avg >= 0 AND vad_confidence_avg <= 1),
  network_disconnect_count integer NOT NULL DEFAULT 0 CHECK (network_disconnect_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id)
);

CREATE INDEX IF NOT EXISTS hfte_session_metrics_therapist_idx
  ON public.hfte_session_metrics (therapist_id);
CREATE INDEX IF NOT EXISTS hfte_session_metrics_created_idx
  ON public.hfte_session_metrics (created_at DESC);

COMMENT ON TABLE public.hfte_session_metrics IS
  'HFTE aggregate conversation UX metrics only — never raw audio or recordings.';

ALTER TABLE public.hfte_session_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "HFTE metrics owner upsert" ON public.hfte_session_metrics;
CREATE POLICY "HFTE metrics owner upsert" ON public.hfte_session_metrics
  FOR ALL TO authenticated
  USING (
    therapist_id = (select auth.uid())
    OR (select public.is_admin())
  )
  WITH CHECK (
    therapist_id = (select auth.uid())
  );

DROP POLICY IF EXISTS "HFTE metrics admin read" ON public.hfte_session_metrics;
CREATE POLICY "HFTE metrics admin read" ON public.hfte_session_metrics
  FOR SELECT TO authenticated
  USING ((select public.is_admin()));

GRANT SELECT, INSERT, UPDATE ON public.hfte_session_metrics TO authenticated;

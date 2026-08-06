-- Therapy Room architecture consolidation (Mission 35)
-- Single session mode (interaction_mode), single notes store (session_private_notes).
-- Drops duplicate ui_mode + sessions.private_notes after backfill.

-- 1) Backfill interaction_mode from legacy ui_mode
UPDATE public.sessions
SET interaction_mode = 'therapy_room'
WHERE ui_mode = 'therapy_room'
  AND interaction_mode IS DISTINCT FROM 'therapy_room';

-- 2) Backfill free-text private_notes into structured table (idempotent)
INSERT INTO public.session_private_notes (
  session_id,
  therapist_id,
  format,
  body,
  created_at,
  updated_at
)
SELECT
  s.id,
  s.therapist_id,
  'free'::public.clinic_note_format,
  s.private_notes,
  coalesce(s.ended_at, s.started_at, now()),
  now()
FROM public.sessions s
WHERE s.private_notes IS NOT NULL
  AND length(trim(s.private_notes)) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.session_private_notes n
    WHERE n.session_id = s.id
      AND n.format = 'free'
      AND n.body = s.private_notes
  );

-- 3) Drop duplicate columns
ALTER TABLE public.sessions DROP COLUMN IF EXISTS ui_mode;
ALTER TABLE public.sessions DROP COLUMN IF EXISTS private_notes;

COMMENT ON COLUMN public.sessions.interaction_mode IS
  'Canonical session UI mode: classic = VoiceSession; therapy_room = Therapy Room (TRM + VMHC clinic visits).';
COMMENT ON TABLE public.session_private_notes IS
  'Canonical therapist private notes (SOAP/DAP/BIRP/free/voice). Never used in patient LLM prompts.';

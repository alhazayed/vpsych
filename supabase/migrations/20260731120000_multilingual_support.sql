-- Multilingual session support (additive only).
-- New columns are nullable with no backfill so existing rows are unchanged.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_language text;

ALTER TABLE public.avatars
  ADD COLUMN IF NOT EXISTS language text,
  ADD COLUMN IF NOT EXISTS dialect text,
  ADD COLUMN IF NOT EXISTS voice_id text;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS language text;

ALTER TABLE public.session_reports
  ADD COLUMN IF NOT EXISTS language text;

COMMENT ON COLUMN public.profiles.preferred_language IS 'UI / session language preference (e.g. en, ar)';
COMMENT ON COLUMN public.avatars.language IS 'Primary language for this avatar persona';
COMMENT ON COLUMN public.avatars.dialect IS 'Optional dialect or regional variety';
COMMENT ON COLUMN public.avatars.voice_id IS 'TTS / voice provider identifier';
COMMENT ON COLUMN public.sessions.language IS 'Language used for the therapy session';
COMMENT ON COLUMN public.session_reports.language IS 'Language of the generated assessment report';

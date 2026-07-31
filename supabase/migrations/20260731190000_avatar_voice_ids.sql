-- Multilingual TTS voice IDs per avatar.
-- voice_id remains the English (primary) ElevenLabs voice for backward compatibility.
-- voice_id_ar stores the Arabic ElevenLabs voice used for Arabic sessions.

ALTER TABLE public.avatars
  ADD COLUMN IF NOT EXISTS voice_id_ar text;

COMMENT ON COLUMN public.avatars.voice_id IS 'ElevenLabs voice id for English (or primary) TTS';
COMMENT ON COLUMN public.avatars.voice_id_ar IS 'ElevenLabs voice id for Arabic TTS';

-- Seed defaults for existing presets (public multilingual-capable voices).
UPDATE public.avatars
SET
  voice_id = COALESCE(voice_id, '21m00Tcm4TlvDq8ikWAM'),
  voice_id_ar = COALESCE(voice_id_ar, 'XB0fDUnXU5powFXDhCwa'),
  language = COALESCE(language, 'en'),
  updated_at = now()
WHERE voice_id IS NULL OR voice_id_ar IS NULL;

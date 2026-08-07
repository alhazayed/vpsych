-- Mission 3 — Clinical Voice Profiles
-- Extends the ElevenLabs voice registry with per-patient clinical delivery
-- parameters and emotion-modulation flags. Voice ID stays stable; prosody
-- switches live by emotion (depressed / anxious / manic / psychotic).

ALTER TABLE public.voice_profiles
  ADD COLUMN IF NOT EXISTS speech_rate double precision NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS pitch double precision NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS energy text NOT NULL DEFAULT 'moderate',
  ADD COLUMN IF NOT EXISTS prosody text NOT NULL DEFAULT 'measured',
  ADD COLUMN IF NOT EXISTS breathing text NOT NULL DEFAULT 'calm',
  ADD COLUMN IF NOT EXISTS hesitation_frequency double precision NOT NULL DEFAULT 0.18,
  ADD COLUMN IF NOT EXISTS speaker_boost double precision NOT NULL DEFAULT 0.75,
  ADD COLUMN IF NOT EXISTS emotion_modulation boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pronunciation_ar text,
  ADD COLUMN IF NOT EXISTS pronunciation_en text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.voice_profiles
  DROP CONSTRAINT IF EXISTS voice_profiles_speech_rate_check;
ALTER TABLE public.voice_profiles
  ADD CONSTRAINT voice_profiles_speech_rate_check
  CHECK (speech_rate >= 0.5 AND speech_rate <= 1.8);

ALTER TABLE public.voice_profiles
  DROP CONSTRAINT IF EXISTS voice_profiles_pitch_check;
ALTER TABLE public.voice_profiles
  ADD CONSTRAINT voice_profiles_pitch_check
  CHECK (pitch >= 0.5 AND pitch <= 1.8);

ALTER TABLE public.voice_profiles
  DROP CONSTRAINT IF EXISTS voice_profiles_energy_check;
ALTER TABLE public.voice_profiles
  ADD CONSTRAINT voice_profiles_energy_check
  CHECK (energy IN ('low', 'moderate', 'high', 'labile'));

ALTER TABLE public.voice_profiles
  DROP CONSTRAINT IF EXISTS voice_profiles_prosody_check;
ALTER TABLE public.voice_profiles
  ADD CONSTRAINT voice_profiles_prosody_check
  CHECK (prosody IN (
    'flat', 'measured', 'anxious_edge', 'pressured', 'fragmented', 'labile'
  ));

ALTER TABLE public.voice_profiles
  DROP CONSTRAINT IF EXISTS voice_profiles_breathing_check;
ALTER TABLE public.voice_profiles
  ADD CONSTRAINT voice_profiles_breathing_check
  CHECK (breathing IN ('calm', 'short', 'deep', 'irregular', 'held'));

ALTER TABLE public.voice_profiles
  DROP CONSTRAINT IF EXISTS voice_profiles_hesitation_check;
ALTER TABLE public.voice_profiles
  ADD CONSTRAINT voice_profiles_hesitation_check
  CHECK (hesitation_frequency >= 0 AND hesitation_frequency <= 1);

ALTER TABLE public.voice_profiles
  DROP CONSTRAINT IF EXISTS voice_profiles_speaker_boost_check;
ALTER TABLE public.voice_profiles
  ADD CONSTRAINT voice_profiles_speaker_boost_check
  CHECK (speaker_boost >= 0 AND speaker_boost <= 1);

COMMENT ON COLUMN public.voice_profiles.speech_rate IS
  'Baseline relative speech rate (0.5–1.8). Emotion modulation multiplies this live.';
COMMENT ON COLUMN public.voice_profiles.pitch IS
  'Baseline relative pitch (0.5–1.8).';
COMMENT ON COLUMN public.voice_profiles.energy IS
  'Baseline clinical energy: low | moderate | high | labile';
COMMENT ON COLUMN public.voice_profiles.prosody IS
  'Baseline prosody contour: flat | measured | anxious_edge | pressured | fragmented | labile';
COMMENT ON COLUMN public.voice_profiles.breathing IS
  'Breathing phenotype hint for delivery: calm | short | deep | irregular | held';
COMMENT ON COLUMN public.voice_profiles.hesitation_frequency IS
  '0–1 hesitation / filler tendency in clinical delivery hints';
COMMENT ON COLUMN public.voice_profiles.speaker_boost IS
  'ElevenLabs similarity_boost (0–1); speaker identity lock';
COMMENT ON COLUMN public.voice_profiles.emotion_modulation IS
  'When true, depressed/anxious/manic/psychotic overlays adjust delivery at TTS time';
COMMENT ON COLUMN public.voice_profiles.pronunciation_ar IS
  'Arabic pronunciation / dialect guidance for TTS casting';
COMMENT ON COLUMN public.voice_profiles.pronunciation_en IS
  'English pronunciation / dialect guidance for TTS casting';

-- Backfill pronunciation hints for seeded registry voices.
UPDATE public.voice_profiles
SET
  pronunciation_ar = COALESCE(
    pronunciation_ar,
    CASE
      WHEN language = 'ar' THEN 'Levantine Arabic; soft consonants; measured cadence'
      ELSE NULL
    END
  ),
  pronunciation_en = COALESCE(
    pronunciation_en,
    CASE
      WHEN language = 'en' THEN 'General American; clear clinical interview cadence'
      ELSE NULL
    END
  ),
  updated_at = now()
WHERE pronunciation_ar IS NULL OR pronunciation_en IS NULL;

-- Touch updated_at on row changes (admin editor).
CREATE OR REPLACE FUNCTION public.voice_profiles_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS voice_profiles_set_updated_at ON public.voice_profiles;
CREATE TRIGGER voice_profiles_set_updated_at
  BEFORE UPDATE ON public.voice_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.voice_profiles_set_updated_at();

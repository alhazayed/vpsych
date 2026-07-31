-- ElevenLabs Voice Registry
-- Avatar → voice_profile → voice_id → ElevenLabs API
-- Keeps avatars.voice_id / voice_id_ar for backward compatibility (synced on assign).

CREATE TABLE IF NOT EXISTS public.voice_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'elevenlabs',
  voice_name text NOT NULL,
  voice_id text NOT NULL,
  language text NOT NULL,
  dialect text,
  gender text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT voice_profiles_language_check
    CHECK (language IN ('en', 'ar')),
  CONSTRAINT voice_profiles_provider_voice_id_key
    UNIQUE (provider, voice_id)
);

COMMENT ON TABLE public.voice_profiles IS 'Provider voice registry (ElevenLabs). Avatars reference a profile instead of raw voice ids.';
COMMENT ON COLUMN public.voice_profiles.provider IS 'TTS provider key (elevenlabs)';
COMMENT ON COLUMN public.voice_profiles.voice_name IS 'Human-readable voice label';
COMMENT ON COLUMN public.voice_profiles.voice_id IS 'Provider voice identifier sent to the TTS API';
COMMENT ON COLUMN public.voice_profiles.language IS 'Primary language: en | ar';
COMMENT ON COLUMN public.voice_profiles.dialect IS 'Optional dialect / regional variety';
COMMENT ON COLUMN public.voice_profiles.gender IS 'Optional voice gender presentation';
COMMENT ON COLUMN public.voice_profiles.is_active IS 'Inactive voices cannot be newly assigned; synthesis falls back if inactive';

CREATE INDEX IF NOT EXISTS voice_profiles_provider_idx
  ON public.voice_profiles (provider);
CREATE INDEX IF NOT EXISTS voice_profiles_language_idx
  ON public.voice_profiles (language);
CREATE INDEX IF NOT EXISTS voice_profiles_is_active_idx
  ON public.voice_profiles (is_active);

ALTER TABLE public.avatars
  ADD COLUMN IF NOT EXISTS voice_profile_id uuid
    REFERENCES public.voice_profiles (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS avatars_voice_profile_id_idx
  ON public.avatars (voice_profile_id);

COMMENT ON COLUMN public.avatars.voice_profile_id IS 'FK to voice_profiles; preferred over direct voice_id for TTS resolution';

-- Seed ElevenLabs Arabic voices (stable UUIDs for deterministic assigns).
INSERT INTO public.voice_profiles (
  id, provider, voice_name, voice_id, language, dialect, gender, is_active
) VALUES
  (
    'a1000000-0000-4000-8000-000000000001',
    'elevenlabs',
    'Youssef',
    'ZCXYdzd5Evtsll2EdoCi',
    'ar',
    'Levantine Arabic',
    'male',
    true
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    'elevenlabs',
    'Omars',
    'HJ8unGw6UFYkApOU0Oea',
    'ar',
    'Levantine Arabic',
    'male',
    true
  ),
  (
    'a1000000-0000-4000-8000-000000000003',
    'elevenlabs',
    'Amira',
    'cdxrkuYK4nZwDSkjw5sa',
    'ar',
    'Levantine Arabic',
    'female',
    true
  ),
  (
    'a1000000-0000-4000-8000-000000000004',
    'elevenlabs',
    'Noura',
    'isQLuoVuANx6FjDxyasX',
    'ar',
    'Gulf Arabic',
    'female',
    true
  )
ON CONFLICT (provider, voice_id) DO UPDATE
SET
  voice_name = EXCLUDED.voice_name,
  language = EXCLUDED.language,
  dialect = EXCLUDED.dialect,
  gender = EXCLUDED.gender,
  is_active = EXCLUDED.is_active;

-- Assign registry voices to seeded presets by gender (Arabic TTS path).
-- English TTS keeps legacy voice_id for backward compatibility.
UPDATE public.avatars a
SET
  voice_profile_id = 'a1000000-0000-4000-8000-000000000003', -- Amira
  voice_id_ar = 'cdxrkuYK4nZwDSkjw5sa',
  updated_at = now()
WHERE lower(a.name) LIKE '%maya%'
  AND a.voice_profile_id IS NULL;

UPDATE public.avatars a
SET
  voice_profile_id = 'a1000000-0000-4000-8000-000000000001', -- Youssef
  voice_id_ar = 'ZCXYdzd5Evtsll2EdoCi',
  updated_at = now()
WHERE lower(a.name) LIKE '%jordan%'
  AND a.voice_profile_id IS NULL;

-- RLS
ALTER TABLE public.voice_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read active voice profiles" ON public.voice_profiles;
CREATE POLICY "Authenticated can read active voice profiles"
  ON public.voice_profiles FOR SELECT
  TO authenticated
  USING (is_active = true OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "Admins can insert voice profiles" ON public.voice_profiles;
CREATE POLICY "Admins can insert voice profiles"
  ON public.voice_profiles FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "Admins can update voice profiles" ON public.voice_profiles;
CREATE POLICY "Admins can update voice profiles"
  ON public.voice_profiles FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "Admins can delete voice profiles" ON public.voice_profiles;
CREATE POLICY "Admins can delete voice profiles"
  ON public.voice_profiles FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

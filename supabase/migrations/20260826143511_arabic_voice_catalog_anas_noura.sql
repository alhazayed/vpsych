-- Arabic voice catalogue: Anas (new) + Noura (activated).
--
-- Makes the intended Arabic catalogue state reproducible from git. Noura was
-- activated in production by a controlled admin-equivalent data write before
-- this migration existed, so the statements below describe the *intended final
-- state* and are written to be no-ops where production already matches.
--
-- Both voices are verified against ElevenLabs structured metadata
-- (labels.language = ar) and are classified in src/lib/voice/voice-language.ts.
-- Gamal (JTMaHm6sHVI3NZgPaWDz) is deliberately NOT added: its labels object is
-- empty and Arabic is asserted only in free-text description, so its language
-- verification is still pending.
--
-- Scope: voice_profiles catalogue rows only. No avatar, no assignment, no
-- English row, no default, and no existing catalogue row is rewritten.

-- Anas — new row. Clinical delivery params are intentionally omitted so the
-- table defaults apply; no metadata is asserted beyond what ElevenLabs
-- publishes as structured labels (language ar, accent modern standard, male).
INSERT INTO public.voice_profiles (
  id, provider, voice_name, voice_id, language, dialect, gender, is_active
) VALUES (
  'a1000000-0000-4000-8000-000000000005',
  'elevenlabs',
  'Anas',
  'R6nda3uM038xEEKi7GFl',
  'ar',
  'Modern Standard Arabic',
  'male',
  true
)
ON CONFLICT (provider, voice_id) DO UPDATE
SET
  voice_name = EXCLUDED.voice_name,
  language = EXCLUDED.language,
  dialect = EXCLUDED.dialect,
  gender = EXCLUDED.gender,
  is_active = EXCLUDED.is_active;

-- Noura — existing seeded row (a1000000-0000-4000-8000-000000000004), set
-- inactive by 20260801160000_premade_elevenlabs_voices.sql. Reactivate it and
-- nothing else: voice_id, voice_name, dialect, gender, pronunciation and the
-- clinical params are left exactly as they are. Matching on provider +
-- voice_id + language rather than on id alone means a row that is not the
-- verified Arabic Noura can never be flipped active by this statement.
UPDATE public.voice_profiles
SET is_active = true
WHERE provider = 'elevenlabs'
  AND voice_id = 'isQLuoVuANx6FjDxyasX'
  AND language = 'ar'
  AND is_active IS DISTINCT FROM true;

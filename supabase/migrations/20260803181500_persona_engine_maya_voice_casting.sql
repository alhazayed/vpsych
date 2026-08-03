-- Persona Engine certification: restore Maya Chen Arabic voice casting.
-- Premade-voice remapping left Amira (Bella) inactive while maya-chen still
-- referenced that profile, so Arabic resolution fell through to a duplicated
-- English Bella id with no active registry path.

UPDATE public.voice_profiles
SET is_active = true,
    voice_name = 'Amira (Bella)',
    voice_id = 'EXAVITQu4vr4xnSDxMaL',
    language = 'ar',
    dialect = 'Levantine Arabic',
    gender = 'female'
WHERE id = 'a1000000-0000-4000-8000-000000000003';

UPDATE public.avatars
SET
  voice_profile_id = 'a1000000-0000-4000-8000-000000000003',
  voice_id = 'EXAVITQu4vr4xnSDxMaL',
  voice_id_ar = 'EXAVITQu4vr4xnSDxMaL',
  personalities = jsonb_set(
    jsonb_set(
      COALESCE(personalities, '{}'::jsonb),
      '{en-US,voice,voice_id}',
      to_jsonb('EXAVITQu4vr4xnSDxMaL'::text),
      true
    ),
    '{ar-JO,voice,voice_id}',
    to_jsonb('EXAVITQu4vr4xnSDxMaL'::text),
    true
  )
WHERE slug = 'maya-chen';

-- Align Jordan Arabic personality voice_id with the active Omars profile /
-- legacy voice_id_ar (personality fallback previously still held Adam).
UPDATE public.avatars
SET personalities = jsonb_set(
  COALESCE(personalities, '{}'::jsonb),
  '{ar-JO,voice,voice_id}',
  to_jsonb('HJ8unGw6UFYkApOU0Oea'::text),
  true
)
WHERE slug = 'jordan-hale'
  AND personalities ? 'ar-JO';

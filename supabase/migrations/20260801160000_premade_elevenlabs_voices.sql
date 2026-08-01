-- Replace Voice Library Arabic ids (paid API) with premade ElevenLabs voices.
-- Free / restricted API keys reject library voices with paid_plan_required.

UPDATE public.voice_profiles
SET is_active = false
WHERE id IN (
  'a1000000-0000-4000-8000-000000000002',
  'a1000000-0000-4000-8000-000000000004'
);

UPDATE public.voice_profiles
SET voice_id = 'XB0fDUnXU5powFXDhCwa',
    voice_name = 'Amira (Charlotte)'
WHERE id = 'a1000000-0000-4000-8000-000000000003';

UPDATE public.voice_profiles
SET voice_id = 'pNInz6obpgDQGcFmaJgB',
    voice_name = 'Youssef (Adam)'
WHERE id = 'a1000000-0000-4000-8000-000000000001';

UPDATE public.avatars
SET voice_id_ar = 'XB0fDUnXU5powFXDhCwa'
WHERE name = 'Maya Chen';

UPDATE public.avatars
SET voice_id_ar = 'pNInz6obpgDQGcFmaJgB'
WHERE name = 'Jordan Hale';

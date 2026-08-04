-- Enriched from git history: production recorded a placeholder/empty statement.
-- Restored full SQL for greenfield parity.

-- Point TTS at premade ElevenLabs voices that work without Voice Library
-- paid access. Classic defaults (Rachel / Charlotte / Sam) return
-- paid_plan_required on restricted API keys.

UPDATE public.voice_profiles
SET is_active = false
WHERE id IN (
  'a1000000-0000-4000-8000-000000000002',
  'a1000000-0000-4000-8000-000000000004'
);

UPDATE public.voice_profiles
SET voice_id = 'EXAVITQu4vr4xnSDxMaL',
    voice_name = 'Amira (Bella)'
WHERE id = 'a1000000-0000-4000-8000-000000000003';

UPDATE public.voice_profiles
SET voice_id = 'pNInz6obpgDQGcFmaJgB',
    voice_name = 'Youssef (Adam)'
WHERE id = 'a1000000-0000-4000-8000-000000000001';

UPDATE public.avatars
SET voice_id = 'EXAVITQu4vr4xnSDxMaL',
    voice_id_ar = 'EXAVITQu4vr4xnSDxMaL'
WHERE name = 'Maya Chen';

UPDATE public.avatars
SET voice_id = 'pNInz6obpgDQGcFmaJgB',
    voice_id_ar = 'pNInz6obpgDQGcFmaJgB'
WHERE name = 'Jordan Hale';

-- Owner request 2026-10-07: remove "Youssef (Adam)" and "Amira (Bella)" from
-- the platform. Both are labelled Arabic but carry English ElevenLabs voices
-- (Adam pNInz6obpgDQGcFmaJgB, Sarah EXAVITQu4vr4xnSDxMaL), which conflicts
-- with Arabic pronunciation. Deactivated rather than deleted: inactive draft
-- and test patients still reference them, and an inactive profile can no
-- longer be chosen or assigned. No active patient uses either.
-- Revert: set is_active = true for these two ids.
update public.voice_profiles
set is_active = false,
    updated_at = now()
where id in (
  'a1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000003'
);

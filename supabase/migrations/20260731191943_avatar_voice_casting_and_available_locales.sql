-- H3: give every personality its own gender-appropriate TTS voice.
--     Previously no personality carried a voice_id, so every persona fell back
--     to the same flat avatars.voice_id / voice_id_ar.
-- H4: expose the locales an avatar actually supports. The flat language/dialect
--     columns are (by design) the projection of the default_locale personality,
--     so they cannot answer "does this avatar support Arabic?". Add
--     available_locales, maintained by the same sync trigger.

ALTER TABLE public.avatars
  ADD COLUMN IF NOT EXISTS available_locales text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.avatars.available_locales IS
  'BCP-47 locales with an authored personality; kept in sync from personalities';

-- Extend the flat-projection trigger: maintain available_locales, and derive
-- voice_id_ar from whichever personality is Arabic.
CREATE OR REPLACE FUNCTION public.sync_avatar_flat_from_v2()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  loc text;
  personality jsonb;
  identity jsonb;
  voice jsonb;
  core jsonb;
  goals jsonb;
  approach text;
  ar_voice jsonb;
BEGIN
  -- Always keep the locale inventory truthful, even for v1 rows.
  IF NEW.personalities IS NOT NULL THEN
    NEW.available_locales := ARRAY(
      SELECT k FROM jsonb_object_keys(NEW.personalities) AS k ORDER BY k
    );
  ELSE
    NEW.available_locales := ARRAY[
      COALESCE(NULLIF(NEW.default_locale, ''), NEW.language, 'en-US')
    ];
  END IF;

  IF NEW.schema_version IS DISTINCT FROM 2 THEN
    RETURN NEW;
  END IF;

  IF NEW.clinical_core IS NULL OR NEW.personalities IS NULL THEN
    RETURN NEW;
  END IF;

  loc := COALESCE(NULLIF(NEW.default_locale, ''), 'en-US');
  personality := NEW.personalities -> loc;
  IF personality IS NULL THEN
    SELECT value INTO personality
    FROM jsonb_each(NEW.personalities)
    LIMIT 1;
  END IF;

  IF personality IS NULL THEN
    RETURN NEW;
  END IF;

  identity := COALESCE(personality -> 'identity', '{}'::jsonb);
  voice := COALESCE(personality -> 'voice', '{}'::jsonb);
  core := NEW.clinical_core;

  NEW.name := COALESCE(identity ->> 'display_name', NEW.name);
  NEW.disorder := COALESCE(core ->> 'disorder', NEW.disorder);
  NEW.age := COALESCE((core ->> 'age')::integer, NEW.age);
  NEW.gender := COALESCE(core ->> 'gender', NEW.gender);
  NEW.portrait_url := COALESCE(identity ->> 'portrait_url', NEW.portrait_url);
  NEW.persona_prompt := COALESCE(personality ->> 'persona_prompt', NEW.persona_prompt);
  NEW.language := COALESCE(personality ->> 'language', NEW.language);
  NEW.dialect := COALESCE(personality ->> 'dialect', NEW.dialect);
  NEW.voice_id := COALESCE(voice ->> 'voice_id', NEW.voice_id);

  -- Flat Arabic voice for v1 consumers: take it from the Arabic personality.
  SELECT value -> 'voice' INTO ar_voice
  FROM jsonb_each(NEW.personalities)
  WHERE value ->> 'language' = 'ar'
  LIMIT 1;

  IF ar_voice IS NOT NULL THEN
    NEW.voice_id_ar := COALESCE(ar_voice ->> 'voice_id', NEW.voice_id_ar);
  END IF;

  goals := COALESCE(core -> 'session_goals', '[]'::jsonb);
  approach := COALESCE(core ->> 'ideal_approach', '');
  NEW.ideal_guidelines := jsonb_build_object(
    'session_goals', goals,
    'ideal_approach', approach
  );

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_avatar_flat_from_v2() FROM PUBLIC;

-- H3 casting. ElevenLabs premade voices; multilingual v2 renders Arabic with
-- any of them, so the choice is driven by the persona's gender and age.
--   Maya Chen   (en-US, female)     -> Rachel
--   ليان خوري    (ar-JO, female)     -> Charlotte
--   Jordan Hale (en-US, non-binary) -> Sam   (distinct from Maya; see note)
--   رامي نصّار    (ar-JO, male)       -> Adam
UPDATE public.avatars
SET personalities = jsonb_set(
      jsonb_set(
        personalities,
        '{en-US,voice,voice_id}', '"21m00Tcm4TlvDq8ikWAM"'::jsonb, true
      ),
      '{ar-JO,voice,voice_id}', '"XB0fDUnXU5powFXDhCwa"'::jsonb, true
    )
WHERE slug = 'maya-chen'
  AND personalities ? 'en-US'
  AND personalities ? 'ar-JO';

UPDATE public.avatars
SET personalities = jsonb_set(
      jsonb_set(
        personalities,
        '{en-US,voice,voice_id}', '"yoZ06aMxZJJ28mfd3POQ"'::jsonb, true
      ),
      '{ar-JO,voice,voice_id}', '"pNInz6obpgDQGcFmaJgB"'::jsonb, true
    )
WHERE slug = 'jordan-hale'
  AND personalities ? 'en-US'
  AND personalities ? 'ar-JO';

-- Backfill available_locales for any row the trigger did not touch.
UPDATE public.avatars
SET available_locales = ARRAY(
      SELECT k FROM jsonb_object_keys(personalities) AS k ORDER BY k
    )
WHERE personalities IS NOT NULL
  AND (available_locales IS NULL OR cardinality(available_locales) = 0);

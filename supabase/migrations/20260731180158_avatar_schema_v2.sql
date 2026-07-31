-- Avatar schema v2: multi-personality, natively authored per locale.
-- Additive only. Flat v1 columns remain populated for backward compatibility.

ALTER TABLE public.avatars
  ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS default_locale text NOT NULL DEFAULT 'en-US',
  ADD COLUMN IF NOT EXISTS clinical_core jsonb,
  ADD COLUMN IF NOT EXISTS personalities jsonb;

COMMENT ON COLUMN public.avatars.schema_version IS '1 = flat columns only; 2 = clinical_core + personalities document';
COMMENT ON COLUMN public.avatars.slug IS 'Stable URL-safe identifier (e.g. maya-chen)';
COMMENT ON COLUMN public.avatars.default_locale IS 'BCP-47 default personality locale (e.g. en-US)';
COMMENT ON COLUMN public.avatars.clinical_core IS 'Language-neutral clinical presentation (avatar.v2 Module 1)';
COMMENT ON COLUMN public.avatars.personalities IS 'Map of BCP-47 locale -> natively authored personality (avatar.v2 Module 2)';

CREATE UNIQUE INDEX IF NOT EXISTS avatars_slug_key
  ON public.avatars (slug)
  WHERE slug IS NOT NULL;

-- Keep flat projection in sync when v2 documents are written.
-- Uses default_locale personality for name/persona/voice; clinical_core for disorder/guidelines.
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
BEGIN
  IF NEW.schema_version IS DISTINCT FROM 2 THEN
    RETURN NEW;
  END IF;

  IF NEW.clinical_core IS NULL OR NEW.personalities IS NULL THEN
    RETURN NEW;
  END IF;

  loc := COALESCE(NULLIF(NEW.default_locale, ''), 'en-US');
  personality := NEW.personalities -> loc;
  IF personality IS NULL THEN
    -- Fall back to first personality key
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

  goals := COALESCE(core -> 'session_goals', '[]'::jsonb);
  approach := COALESCE(core ->> 'ideal_approach', '');
  NEW.ideal_guidelines := jsonb_build_object(
    'session_goals', goals,
    'ideal_approach', approach
  );

  IF NEW.rubric IS NULL OR NEW.rubric = '[]'::jsonb THEN
    -- Leave existing rubric; v2 keeps rubric on the row as language-neutral.
    NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_avatar_flat_from_v2 ON public.avatars;
CREATE TRIGGER trg_sync_avatar_flat_from_v2
  BEFORE INSERT OR UPDATE OF schema_version, clinical_core, personalities, default_locale, rubric
  ON public.avatars
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_avatar_flat_from_v2();

REVOKE ALL ON FUNCTION public.sync_avatar_flat_from_v2() FROM PUBLIC;

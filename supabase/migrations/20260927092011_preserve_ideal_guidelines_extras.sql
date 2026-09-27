-- Phase 10C-2 hotfix: preserve authored ideal_guidelines extras when the
-- v2 flat-projection trigger runs.
--
-- ROOT CAUSE:
--   public.sync_avatar_flat_from_v2() (BEFORE INSERT OR UPDATE OF
--   schema_version, clinical_core, personalities, default_locale, rubric)
--   rebuilt ideal_guidelines as ONLY { session_goals, ideal_approach }
--   from clinical_core. That discarded Guided/Advanced extras such as
--   communication_style, therapeutic_challenges, primary_framework, and
--   case_type — even though admin_create/update_virtual_patient correctly
--   wrote them into the row.
--
-- FIX:
--   Keep syncing the two flat keys from clinical_core (canonical projection
--   for v1 consumers), but merge them into the existing NEW.ideal_guidelines
--   object so other keys survive. jsonb || gives right-hand precedence for
--   session_goals / ideal_approach.
--
-- No new columns. No second representation. MERGE-ONLY contract preserved.

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
  existing_guidelines jsonb;
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
  existing_guidelines := COALESCE(NEW.ideal_guidelines, '{}'::jsonb);
  IF jsonb_typeof(existing_guidelines) IS DISTINCT FROM 'object' THEN
    existing_guidelines := '{}'::jsonb;
  END IF;

  -- Preserve extras (communication_style, therapeutic_challenges,
  -- primary_framework, case_type, educator notes, …) while keeping the
  -- clinical_core-derived flat projection authoritative for the two keys.
  NEW.ideal_guidelines := existing_guidelines || jsonb_build_object(
    'session_goals', goals,
    'ideal_approach', approach
  );

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_avatar_flat_from_v2() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_avatar_flat_from_v2() TO authenticated, service_role;

COMMENT ON FUNCTION public.sync_avatar_flat_from_v2() IS
  'Projects v2 clinical_core/personalities onto flat avatar columns. '
  'ideal_guidelines keeps authored extras and syncs session_goals + '
  'ideal_approach from clinical_core (Phase 10C-2 preserve-extras hotfix).';

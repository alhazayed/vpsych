-- Phase 3B (lifecycle-aware): Atomic admin Virtual Patient create / update / duplicate.
-- SECURITY INVOKER so RLS remains in force; is_admin() is defense in depth.
-- Canonical lifecycle: avatars.lifecycle_status (draft|testing|published|archived).
-- is_active is the therapist-visibility projection (synced by existing triggers).
--
-- Production already has lifecycle_status (migration avatar_lifecycle_status,
-- prod version 20260808172816). The shim below is ADD COLUMN IF NOT EXISTS /
-- trigger recreate for environments that lack PR #188 — no-op on production.
-- DO NOT re-apply 20260808171439 / rename production migration history.

-- ============================================================================
-- Compatibility shim: ensure lifecycle_status + sync triggers exist.
-- On production (column already present) this is a no-op for the column.
-- Does NOT replace or rename production migration 20260808172816 /
-- git PR #188 file 20260808171439_avatar_lifecycle_status.sql.
-- ============================================================================

ALTER TABLE public.avatars
  ADD COLUMN IF NOT EXISTS lifecycle_status text;

UPDATE public.avatars
SET lifecycle_status = CASE
  WHEN is_active THEN 'published'
  ELSE 'archived'
END
WHERE lifecycle_status IS NULL;

ALTER TABLE public.avatars
  ALTER COLUMN lifecycle_status SET DEFAULT 'draft';

ALTER TABLE public.avatars
  ALTER COLUMN lifecycle_status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'avatars_lifecycle_status_check'
  ) THEN
    ALTER TABLE public.avatars
      ADD CONSTRAINT avatars_lifecycle_status_check
      CHECK (lifecycle_status IN ('draft', 'testing', 'published', 'archived'));
  END IF;
END $$;

COMMENT ON COLUMN public.avatars.lifecycle_status IS
  'Admin VP lifecycle: draft | testing | published | archived. Syncs is_active (published=true).';

CREATE OR REPLACE FUNCTION public.sync_avatar_is_active_from_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.is_active := (NEW.lifecycle_status = 'published');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS avatars_lifecycle_is_active_sync ON public.avatars;
CREATE TRIGGER avatars_lifecycle_is_active_sync
  BEFORE INSERT OR UPDATE OF lifecycle_status ON public.avatars
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_avatar_is_active_from_lifecycle();

CREATE OR REPLACE FUNCTION public.sync_avatar_lifecycle_from_is_active()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.is_active IS DISTINCT FROM OLD.is_active
     AND NEW.lifecycle_status IS NOT DISTINCT FROM OLD.lifecycle_status
  THEN
    IF NEW.is_active THEN
      NEW.lifecycle_status := 'published';
    ELSIF OLD.lifecycle_status = 'published' THEN
      NEW.lifecycle_status := 'archived';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS avatars_is_active_lifecycle_sync ON public.avatars;
CREATE TRIGGER avatars_is_active_lifecycle_sync
  BEFORE UPDATE OF is_active ON public.avatars
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_avatar_lifecycle_from_is_active();

CREATE OR REPLACE FUNCTION public.admin_create_virtual_patient(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_avatar_id uuid;
  v_persona_id uuid;
  v_slug text;
  v_core jsonb;
  v_personalities jsonb;
  v_hp jsonb;
  v_rubric jsonb;
  v_guidelines jsonb;
  v_default_locale text;
  v_voice_profile_id uuid;
  v_voice_id text;
  v_voice_id_ar text;
  v_name text;
  v_disorder text;
  v_age integer;
  v_gender text;
  v_portrait text;
  v_persona_prompt text;
  v_language text;
  v_dialect text;
  v_create_persona boolean;
  v_disorder_id uuid;
  v_persona_slug text;
  v_display_name text;
  v_identity jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Invalid payload' USING ERRCODE = '22023';
  END IF;

  v_slug := nullif(trim(coalesce(p_payload->>'slug', '')), '');
  IF v_slug IS NULL THEN
    RAISE EXCEPTION 'slug required' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM public.avatars a WHERE a.slug = v_slug) THEN
    RAISE EXCEPTION 'Slug already exists' USING ERRCODE = '23505';
  END IF;
  IF EXISTS (SELECT 1 FROM public.personas p WHERE p.slug = v_slug) THEN
    RAISE EXCEPTION 'Persona slug already exists' USING ERRCODE = '23505';
  END IF;

  v_core := p_payload->'clinical_core';
  v_personalities := p_payload->'personalities';
  v_hp := coalesce(p_payload->'human_personality', '{}'::jsonb);
  v_rubric := coalesce(p_payload->'rubric', '[]'::jsonb);
  v_guidelines := coalesce(p_payload->'ideal_guidelines', '{}'::jsonb);
  v_default_locale := coalesce(nullif(trim(p_payload->>'default_locale'), ''), 'en-US');
  v_voice_profile_id := nullif(p_payload->>'voice_profile_id', '')::uuid;
  v_voice_id := nullif(p_payload->>'voice_id', '');
  v_voice_id_ar := nullif(p_payload->>'voice_id_ar', '');

  -- Server-derived flats (never trust client as source of truth).
  v_name := coalesce(
    nullif(trim(p_payload->>'name'), ''),
    nullif(trim(v_personalities #>> ARRAY[v_default_locale, 'identity', 'display_name']), ''),
    v_slug
  );
  v_disorder := coalesce(
    nullif(trim(p_payload->>'disorder'), ''),
    nullif(trim(v_core->>'disorder'), ''),
    'Unspecified'
  );
  v_age := coalesce(
    nullif(p_payload->>'age', '')::integer,
    nullif(v_core->>'age', '')::integer
  );
  v_gender := coalesce(
    nullif(trim(p_payload->>'gender'), ''),
    nullif(trim(v_core->>'gender'), '')
  );
  v_portrait := coalesce(
    nullif(trim(p_payload->>'portrait_url'), ''),
    nullif(trim(v_personalities #>> ARRAY[v_default_locale, 'identity', 'portrait_url']), '')
  );
  v_persona_prompt := coalesce(
    nullif(trim(p_payload->>'persona_prompt'), ''),
    nullif(trim(v_personalities #>> ARRAY[v_default_locale, 'persona_prompt']), ''),
    'You are a patient in a therapy training session.'
  );
  v_language := coalesce(
    nullif(trim(p_payload->>'language'), ''),
    nullif(trim(v_personalities #>> ARRAY[v_default_locale, 'language']), '')
  );
  v_dialect := coalesce(
    nullif(trim(p_payload->>'dialect'), ''),
    nullif(trim(v_personalities #>> ARRAY[v_default_locale, 'dialect']), '')
  );

  INSERT INTO public.avatars (
    name,
    disorder,
    age,
    gender,
    portrait_url,
    persona_prompt,
    ideal_guidelines,
    rubric,
    lifecycle_status,
    language,
    dialect,
    voice_id,
    voice_id_ar,
    schema_version,
    slug,
    default_locale,
    clinical_core,
    personalities,
    human_personality,
    voice_profile_id
  ) VALUES (
    v_name,
    v_disorder,
    v_age,
    v_gender,
    v_portrait,
    v_persona_prompt,
    v_guidelines,
    v_rubric,
    'draft', -- canonical create state; trigger projects is_active=false
    v_language,
    v_dialect,
    v_voice_id,
    v_voice_id_ar,
    2,
    v_slug,
    v_default_locale,
    v_core,
    v_personalities,
    v_hp,
    v_voice_profile_id
  )
  RETURNING id INTO v_avatar_id;

  v_create_persona := coalesce((p_payload->'persona'->>'create')::boolean, false);
  IF v_create_persona THEN
    v_disorder_id := nullif(p_payload->'persona'->>'default_disorder_id', '')::uuid;
    IF v_disorder_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.disorders d WHERE d.id = v_disorder_id AND d.is_active = true
    ) THEN
      RAISE EXCEPTION 'Invalid or inactive default disorder' USING ERRCODE = '22023';
    END IF;

    v_persona_slug := coalesce(
      nullif(trim(p_payload->'persona'->>'slug'), ''),
      v_slug
    );
    v_display_name := coalesce(
      nullif(trim(p_payload->'persona'->>'display_name'), ''),
      v_name
    );
    v_identity := coalesce(p_payload->'persona'->'identity', jsonb_build_object(
      'age', v_age,
      'gender', coalesce(v_gender, 'unspecified'),
      'source', 'admin_create'
    ));

    INSERT INTO public.personas (
      avatar_id,
      slug,
      display_name,
      identity,
      traits,
      baseline_history,
      default_disorder_id,
      is_active
    ) VALUES (
      v_avatar_id,
      v_persona_slug,
      v_display_name,
      v_identity,
      coalesce(p_payload->'persona'->'traits', '{}'::jsonb),
      coalesce(p_payload->'persona'->'baseline_history', '{}'::jsonb),
      v_disorder_id,
      false
    )
    RETURNING id INTO v_persona_id;
  END IF;

  RETURN jsonb_build_object(
    'avatar_id', v_avatar_id,
    'persona_id', v_persona_id,
    'slug', v_slug,
    'lifecycle_status', 'draft',
    'is_active', false
  );
END;
$$;

COMMENT ON FUNCTION public.admin_create_virtual_patient(jsonb) IS
  'Phase 3B — atomic draft Virtual Patient create (avatars + optional personas). Always lifecycle_status=draft.';

CREATE OR REPLACE FUNCTION public.admin_update_virtual_patient(
  p_avatar_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_row public.avatars%ROWTYPE;
  v_slug text;
  v_core jsonb;
  v_personalities jsonb;
  v_hp jsonb;
  v_rubric jsonb;
  v_guidelines jsonb;
  v_default_locale text;
  v_voice_profile_id uuid;
  v_voice_id text;
  v_voice_id_ar text;
  v_name text;
  v_disorder text;
  v_age integer;
  v_gender text;
  v_portrait text;
  v_persona_prompt text;
  v_language text;
  v_dialect text;
  v_create_persona boolean;
  v_disorder_id uuid;
  v_persona_id uuid;
  v_persona_slug text;
  v_display_name text;
  v_identity jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.avatars WHERE id = p_avatar_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Avatar not found' USING ERRCODE = 'P0002';
  END IF;

  -- Published avatars are immutable via update (duplicate to edit).
  IF coalesce(v_row.lifecycle_status, CASE WHEN v_row.is_active THEN 'published' ELSE 'draft' END) = 'published' THEN
    RAISE EXCEPTION 'Published avatars are immutable; duplicate to edit' USING ERRCODE = 'P0001';
  END IF;

  -- Archived must be restored to draft before editing.
  IF coalesce(v_row.lifecycle_status, 'draft') = 'archived' THEN
    RAISE EXCEPTION 'Archived avatars must be restored to draft before editing' USING ERRCODE = 'P0001';
  END IF;

  -- draft|testing: slug mutable when unique. Published/archived blocked above.
  IF coalesce(v_row.lifecycle_status, 'draft') IN ('draft', 'testing') THEN
    v_slug := coalesce(nullif(trim(p_payload->>'slug'), ''), v_row.slug);
    IF v_slug IS DISTINCT FROM v_row.slug THEN
      IF EXISTS (
        SELECT 1 FROM public.avatars a WHERE a.slug = v_slug AND a.id <> p_avatar_id
      ) THEN
        RAISE EXCEPTION 'Slug already exists' USING ERRCODE = '23505';
      END IF;
    END IF;
  ELSE
    v_slug := v_row.slug;
  END IF;

  v_core := CASE WHEN p_payload ? 'clinical_core' THEN p_payload->'clinical_core' ELSE v_row.clinical_core END;
  v_personalities := CASE WHEN p_payload ? 'personalities' THEN p_payload->'personalities' ELSE v_row.personalities END;
  v_hp := CASE WHEN p_payload ? 'human_personality' THEN coalesce(p_payload->'human_personality', '{}'::jsonb) ELSE v_row.human_personality END;
  v_rubric := CASE WHEN p_payload ? 'rubric' THEN coalesce(p_payload->'rubric', '[]'::jsonb) ELSE v_row.rubric END;
  v_guidelines := CASE WHEN p_payload ? 'ideal_guidelines' THEN coalesce(p_payload->'ideal_guidelines', '{}'::jsonb) ELSE v_row.ideal_guidelines END;
  v_default_locale := coalesce(nullif(trim(p_payload->>'default_locale'), ''), v_row.default_locale, 'en-US');

  IF p_payload ? 'voice_profile_id' THEN
    v_voice_profile_id := nullif(p_payload->>'voice_profile_id', '')::uuid;
  ELSE
    v_voice_profile_id := v_row.voice_profile_id;
  END IF;
  IF p_payload ? 'voice_id' THEN
    v_voice_id := nullif(p_payload->>'voice_id', '');
  ELSE
    v_voice_id := v_row.voice_id;
  END IF;
  IF p_payload ? 'voice_id_ar' THEN
    v_voice_id_ar := nullif(p_payload->>'voice_id_ar', '');
  ELSE
    v_voice_id_ar := v_row.voice_id_ar;
  END IF;

  v_name := coalesce(
    nullif(trim(v_personalities #>> ARRAY[v_default_locale, 'identity', 'display_name']), ''),
    nullif(trim(p_payload->>'name'), ''),
    v_row.name
  );
  v_disorder := coalesce(
    nullif(trim(v_core->>'disorder'), ''),
    nullif(trim(p_payload->>'disorder'), ''),
    v_row.disorder
  );
  v_age := coalesce(
    nullif(v_core->>'age', '')::integer,
    nullif(p_payload->>'age', '')::integer,
    v_row.age
  );
  v_gender := coalesce(
    nullif(trim(v_core->>'gender'), ''),
    nullif(trim(p_payload->>'gender'), ''),
    v_row.gender
  );
  v_portrait := coalesce(
    nullif(trim(v_personalities #>> ARRAY[v_default_locale, 'identity', 'portrait_url']), ''),
    nullif(trim(p_payload->>'portrait_url'), ''),
    v_row.portrait_url
  );
  v_persona_prompt := coalesce(
    nullif(trim(v_personalities #>> ARRAY[v_default_locale, 'persona_prompt']), ''),
    nullif(trim(p_payload->>'persona_prompt'), ''),
    v_row.persona_prompt
  );
  v_language := coalesce(
    nullif(trim(v_personalities #>> ARRAY[v_default_locale, 'language']), ''),
    nullif(trim(p_payload->>'language'), ''),
    v_row.language
  );
  v_dialect := coalesce(
    nullif(trim(v_personalities #>> ARRAY[v_default_locale, 'dialect']), ''),
    nullif(trim(p_payload->>'dialect'), ''),
    v_row.dialect
  );

  -- Never publish via update — publish endpoint owns lifecycle_status='published'.
  UPDATE public.avatars SET
    slug = v_slug,
    schema_version = 2,
    default_locale = v_default_locale,
    clinical_core = v_core,
    personalities = v_personalities,
    human_personality = v_hp,
    rubric = v_rubric,
    ideal_guidelines = v_guidelines,
    voice_profile_id = v_voice_profile_id,
    voice_id = v_voice_id,
    voice_id_ar = v_voice_id_ar,
    name = v_name,
    disorder = v_disorder,
    age = v_age,
    gender = v_gender,
    portrait_url = v_portrait,
    persona_prompt = v_persona_prompt,
    language = v_language,
    dialect = v_dialect,
    updated_at = now()
  WHERE id = p_avatar_id;

  v_create_persona := coalesce((p_payload->'persona'->>'create')::boolean, false)
    OR (p_payload->'persona'->>'default_disorder_id') IS NOT NULL
    OR (p_payload->'persona'->>'default_disorder_slug') IS NOT NULL;

  IF v_create_persona OR p_payload ? 'persona' THEN
    v_disorder_id := nullif(p_payload->'persona'->>'default_disorder_id', '')::uuid;
    IF v_disorder_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.disorders d WHERE d.id = v_disorder_id AND d.is_active = true
    ) THEN
      RAISE EXCEPTION 'Invalid or inactive default disorder' USING ERRCODE = '22023';
    END IF;

    SELECT id INTO v_persona_id FROM public.personas WHERE avatar_id = p_avatar_id;
    v_persona_slug := coalesce(
      nullif(trim(p_payload->'persona'->>'slug'), ''),
      v_slug
    );
    v_display_name := coalesce(
      nullif(trim(p_payload->'persona'->>'display_name'), ''),
      v_name
    );
    v_identity := coalesce(p_payload->'persona'->'identity', jsonb_build_object(
      'age', v_age,
      'gender', coalesce(v_gender, 'unspecified'),
      'source', 'admin_update'
    ));

    IF v_persona_id IS NULL THEN
      INSERT INTO public.personas (
        avatar_id, slug, display_name, identity, traits, baseline_history,
        default_disorder_id, is_active
      ) VALUES (
        p_avatar_id,
        v_persona_slug,
        v_display_name,
        v_identity,
        coalesce(p_payload->'persona'->'traits', '{}'::jsonb),
        coalesce(p_payload->'persona'->'baseline_history', '{}'::jsonb),
        v_disorder_id,
        false
      )
      RETURNING id INTO v_persona_id;
    ELSE
      UPDATE public.personas SET
        slug = CASE WHEN coalesce(v_row.lifecycle_status,'draft') = 'published' THEN slug ELSE v_persona_slug END,
        display_name = v_display_name,
        identity = v_identity,
        traits = CASE
          WHEN p_payload->'persona' ? 'traits' THEN coalesce(p_payload->'persona'->'traits', '{}'::jsonb)
          ELSE traits
        END,
        default_disorder_id = coalesce(v_disorder_id, default_disorder_id),
        updated_at = now()
      WHERE id = v_persona_id;
    END IF;
  ELSE
    SELECT id INTO v_persona_id FROM public.personas WHERE avatar_id = p_avatar_id;
  END IF;

  RETURN jsonb_build_object(
    'avatar_id', p_avatar_id,
    'persona_id', v_persona_id,
    'slug', v_slug,
    'lifecycle_status', (SELECT lifecycle_status FROM public.avatars WHERE id = p_avatar_id),
    'is_active', (SELECT is_active FROM public.avatars WHERE id = p_avatar_id)
  );
END;
$$;

COMMENT ON FUNCTION public.admin_update_virtual_patient(uuid, jsonb) IS
  'Phase 3B — atomic Virtual Patient update (avatars + optional personas). Does not publish.';

CREATE OR REPLACE FUNCTION public.admin_duplicate_virtual_patient(
  p_source_avatar_id uuid,
  p_new_slug text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_src public.avatars%ROWTYPE;
  v_src_persona public.personas%ROWTYPE;
  v_new_id uuid;
  v_persona_id uuid;
  v_slug text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  v_slug := nullif(trim(coalesce(p_new_slug, '')), '');
  IF v_slug IS NULL THEN
    RAISE EXCEPTION 'slug required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_src FROM public.avatars WHERE id = p_source_avatar_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Avatar not found' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (SELECT 1 FROM public.avatars a WHERE a.slug = v_slug) THEN
    RAISE EXCEPTION 'Slug already exists' USING ERRCODE = '23505';
  END IF;
  IF EXISTS (SELECT 1 FROM public.personas p WHERE p.slug = v_slug) THEN
    RAISE EXCEPTION 'Persona slug already exists' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.avatars (
    name, disorder, age, gender, portrait_url, persona_prompt,
    ideal_guidelines, rubric, lifecycle_status, language, dialect,
    voice_id, voice_id_ar, schema_version, slug, default_locale,
    clinical_core, personalities, human_personality, voice_profile_id
  ) VALUES (
    v_src.name,
    v_src.disorder,
    v_src.age,
    v_src.gender,
    v_src.portrait_url,
    v_src.persona_prompt,
    v_src.ideal_guidelines,
    v_src.rubric,
    'draft',
    v_src.language,
    v_src.dialect,
    v_src.voice_id,
    v_src.voice_id_ar,
    2,
    v_slug,
    coalesce(v_src.default_locale, 'en-US'),
    v_src.clinical_core,
    v_src.personalities,
    coalesce(v_src.human_personality, '{}'::jsonb),
    v_src.voice_profile_id
  )
  RETURNING id INTO v_new_id;

  SELECT * INTO v_src_persona FROM public.personas WHERE avatar_id = p_source_avatar_id;
  IF FOUND THEN
    INSERT INTO public.personas (
      avatar_id, slug, display_name, identity, traits, baseline_history,
      default_disorder_id, is_active
    ) VALUES (
      v_new_id,
      v_slug,
      v_src_persona.display_name,
      v_src_persona.identity,
      v_src_persona.traits,
      v_src_persona.baseline_history,
      v_src_persona.default_disorder_id,
      false
    )
    RETURNING id INTO v_persona_id;
  END IF;

  RETURN jsonb_build_object(
    'avatar_id', v_new_id,
    'persona_id', v_persona_id,
    'slug', v_slug,
    'lifecycle_status', 'draft',
    'is_active', false,
    'source_avatar_id', p_source_avatar_id
  );
END;
$$;

COMMENT ON FUNCTION public.admin_duplicate_virtual_patient(uuid, text) IS
  'Phase 3B — duplicate Virtual Patient as draft. Does not copy sessions/reports/cases.';

REVOKE ALL ON FUNCTION public.admin_create_virtual_patient(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_virtual_patient(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_duplicate_virtual_patient(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_create_virtual_patient(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_virtual_patient(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_duplicate_virtual_patient(uuid, text) TO authenticated, service_role;

-- Virtual Patient lifecycle for admin UX.
-- Maps DRAFT → TESTING → PUBLISHED → ARCHIVED without changing RLS or roles.
-- Syncs is_active so therapists only see published patients.

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

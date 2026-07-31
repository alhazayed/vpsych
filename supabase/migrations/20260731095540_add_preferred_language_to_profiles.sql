-- Store UI language preference on therapist/admin profiles.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'en'
  CHECK (preferred_language IN ('en', 'ar'));

COMMENT ON COLUMN public.profiles.preferred_language IS 'UI locale preference: en or ar';

-- Canonical migration recovered for Release Configuration Board reconciliation.
-- Source: production supabase_migrations.schema_migrations statements
-- (enriched only when production statements were empty/placeholder).

-- Mission 13 — Data Integrity Certification
-- Repair inconsistent rows, harden uniqueness for concurrent ACE writes,
-- and keep session/report/language invariants coherent.

UPDATE public.session_reports r
SET language = coalesce(
  (SELECT s.language FROM public.sessions s WHERE s.id = r.session_id),
  'en-US'
)
WHERE r.language IS NULL;

UPDATE public.sessions s
SET language = coalesce(
  (SELECT r.language FROM public.session_reports r WHERE r.session_id = s.id LIMIT 1),
  'en-US'
)
WHERE s.language IS NULL;

UPDATE public.sessions s
SET
  status = CASE
    WHEN EXTRACT(EPOCH FROM (coalesce(s.ended_at, now()) - s.started_at)) >= s.max_duration_sec
      THEN 'expired'::public.session_status
    ELSE 'completed'::public.session_status
  END,
  ended_at = coalesce(
    s.ended_at,
    (
      SELECT r.created_at
      FROM public.session_reports r
      WHERE r.session_id = s.id
      LIMIT 1
    ),
    now()
  )
WHERE s.status = 'active'
  AND EXISTS (
    SELECT 1 FROM public.session_reports r WHERE r.session_id = s.id
  );

UPDATE public.sessions s
SET
  status = 'expired'::public.session_status,
  ended_at = s.started_at + make_interval(secs => s.max_duration_sec)
WHERE s.status = 'active'
  AND EXTRACT(EPOCH FROM (now() - s.started_at)) >= s.max_duration_sec;

CREATE UNIQUE INDEX IF NOT EXISTS competency_scores_session_competency_uidx
  ON public.competency_scores (session_id, competency_id)
  WHERE session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS coach_feedback_session_uidx
  ON public.coach_feedback (session_id)
  WHERE session_id IS NOT NULL;

ALTER TABLE public.disorders
  DROP CONSTRAINT IF EXISTS disorders_require_clinical_code;

ALTER TABLE public.disorders
  ADD CONSTRAINT disorders_require_clinical_code
  CHECK (
    coalesce(nullif(trim(dsm5_code), ''), nullif(trim(icd11_code), '')) IS NOT NULL
  );

COMMENT ON CONSTRAINT disorders_require_clinical_code ON public.disorders IS
  'ICD-11-only disorders (e.g. complex PTSD 6B41) are valid; at least one of DSM-5 or ICD-11 required.';

CREATE OR REPLACE FUNCTION public.finish_session_on_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.sessions s
  SET
    status = CASE
      WHEN EXTRACT(EPOCH FROM (now() - s.started_at)) >= s.max_duration_sec
        THEN 'expired'::public.session_status
      ELSE 'completed'::public.session_status
    END,
    ended_at = coalesce(s.ended_at, NEW.created_at, now())
  WHERE s.id = NEW.session_id
    AND s.status = 'active';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_finish_session_on_report ON public.session_reports;
CREATE TRIGGER trg_finish_session_on_report
  AFTER INSERT ON public.session_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.finish_session_on_report();

ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_language_check;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_language_check
  CHECK (
    language IS NULL
    OR language IN ('en', 'ar', 'en-US', 'ar-JO')
  );

ALTER TABLE public.session_reports
  DROP CONSTRAINT IF EXISTS session_reports_language_check;

ALTER TABLE public.session_reports
  ADD CONSTRAINT session_reports_language_check
  CHECK (
    language IS NULL
    OR language IN ('en', 'ar', 'en-US', 'ar-JO')
  );

-- Training Program attempts with nothing to assess.
--
-- A session in which the therapist said nothing (mic never captured speech,
-- or the room was closed straight away) used to be sent to the examiner,
-- which could score nothing: overall 0, and the ladder graded the attempt
-- "failed". The end route now writes a "too short" report for such a session
-- without calling a model (scores.too_short = true,
-- src/lib/ai/assessment.ts). This migration:
--
-- 1. allows training_ladder_attempts.status = 'too_short';
-- 2. grades an attempt 'too_short' (no score) when its report says too_short,
--    before the heuristic / pass checks. The pass rule (> 55) is unchanged;
-- 3. regrades attempts already marked 'failed' whose session holds no
--    therapist message at all (two rows on 2026-10-28), so a mic failure does
--    not stay on the trainee's record as a failed attempt.
--
-- Additive: one allowed status value, the same trigger function with one
-- extra branch, a backfill limited to sessions without any therapist turn.
--
-- Rollback:
--   UPDATE public.training_ladder_attempts SET status = 'failed', score = 0
--     WHERE status = 'too_short';
--   restore the CHECK without 'too_short' and the previous function body
--   (20261007100000_training_ladder.sql).

ALTER TABLE public.training_ladder_attempts
  DROP CONSTRAINT IF EXISTS training_ladder_attempts_status_check;
ALTER TABLE public.training_ladder_attempts
  ADD CONSTRAINT training_ladder_attempts_status_check
  CHECK (status IN ('in_progress', 'awaiting_score', 'passed', 'failed', 'too_short'));

CREATE OR REPLACE FUNCTION public.training_ladder_grade_attempt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_heuristic boolean;
  v_too_short boolean;
  v_overall numeric;
BEGIN
  v_too_short := coalesce((NEW.scores ->> 'too_short') = 'true', false);
  v_heuristic := coalesce(
    NEW.scores -> 'scientific_provenance' ->> 'assessment_mode' = 'heuristic_fallback'
    OR NEW.scores -> 'scientific_provenance' ->> 'ai_source' = 'persona_fallback'
    OR NEW.scores -> 'educational_reliability' ->> 'assessment_mode' = 'heuristic_fallback',
    false
  );
  v_overall := CASE
    WHEN jsonb_typeof(NEW.scores -> 'overall') = 'number'
      THEN (NEW.scores ->> 'overall')::numeric
  END;

  UPDATE public.training_ladder_attempts
  SET
    score = CASE WHEN v_too_short OR v_heuristic THEN NULL ELSE v_overall END,
    status = CASE
      WHEN v_too_short THEN 'too_short'
      WHEN v_heuristic OR v_overall IS NULL THEN 'awaiting_score'
      WHEN v_overall > 55 THEN 'passed'
      ELSE 'failed'
    END,
    report_id = NEW.id,
    graded_at = now()
  WHERE session_id = NEW.session_id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.training_ladder_grade_attempt()
  FROM public, anon, authenticated;

UPDATE public.training_ladder_attempts a
SET status = 'too_short', score = NULL
WHERE a.status = 'failed'
  AND NOT EXISTS (
    SELECT 1 FROM public.session_messages m
    WHERE m.session_id = a.session_id
      AND m.role = 'user'
      AND length(btrim(m.content)) > 0
  );

-- Trainee feedback in words after a practice session.
--
-- Reports stay admin-only: trainees still cannot select from
-- session_reports. This function returns one narrow slice of the trainee's
-- own report, the examiner's words for the trainee
-- (scores->'trainee_feedback': strengths, missed, next steps) and whether the
-- report came from the heuristic fallback. It never returns scores, items,
-- the narrative or excerpts.
--
-- Nothing comes back for a skill test session (the exam results go to the
-- assigning supervisor only), for another trainee's session, or for an
-- account that is not approved.
--
-- Additive only: one function, no table or policy change.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.my_session_feedback(uuid);

CREATE OR REPLACE FUNCTION public.my_session_feedback(p_session_id uuid)
RETURNS TABLE (feedback jsonb, assessment_mode text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.scores -> 'trainee_feedback',
    r.scores -> 'scientific_provenance' ->> 'assessment_mode'
  FROM public.session_reports r
  JOIN public.sessions s ON s.id = r.session_id
  WHERE r.session_id = p_session_id
    AND s.therapist_id = (select auth.uid())
    AND s.skill_test_assignment_id IS NULL
    AND (select public.is_approved());
$$;

REVOKE ALL ON FUNCTION public.my_session_feedback(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_session_feedback(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.my_session_feedback(uuid) IS
  'Trainee-facing words from the owner''s own report (no scores). Never for skill tests.';

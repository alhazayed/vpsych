-- Supervisor comments for the trainee, on practice sessions.
--
-- Reviews (20261026051005) stay with admins and supervisors: trainees still
-- cannot select from session_report_reviews. This migration adds:
--
-- 1. session_report_reviews.trainee_visible (default false). The review route
--    (PUT /api/supervise/reviews/[sessionId]) sets it on every save, on the
--    server: true only for a practice session whose comment does not read
--    like a score and, on a sealed Training Program level, does not name the
--    diagnosis (src/lib/supervisor-reviews/trainee-comments.ts). The database
--    cannot open a sealed case, so that check has to run on the server before
--    the row is written, not on the trainee's page.
-- 2. my_session_review_comments(): for the caller's own practice session, the
--    comments marked trainee_visible, with the reviewer's display name and
--    the time. Never the adjusted score, the flag, a review without a
--    comment, or anything on a skill test. It also drops, whatever the flag
--    says, a comment that contains the review's own adjusted score as a
--    number (Western or Arabic-Indic digits), so changing the score without
--    the route cannot expose it.
--
-- Nothing comes back for another trainee's session or for an account that is
-- not approved. Existing reviews start hidden (trainee_visible false).
--
-- Additive: one column with a default, one function. No policy change.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.my_session_review_comments(uuid);
--   ALTER TABLE public.session_report_reviews DROP COLUMN IF EXISTS trainee_visible;

ALTER TABLE public.session_report_reviews
  ADD COLUMN IF NOT EXISTS trainee_visible boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.session_report_reviews.trainee_visible IS
  'Set by the review route: the trainee may read this comment (practice session, no score, no sealed diagnosis).';

CREATE OR REPLACE FUNCTION public.my_session_review_comments(p_session_id uuid)
RETURNS TABLE (comment text, reviewer_name text, updated_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rv.comment, p.display_name, rv.updated_at
  FROM public.session_report_reviews rv
  JOIN public.sessions s ON s.id = rv.session_id
  LEFT JOIN public.profiles p ON p.id = rv.reviewer_id
  WHERE rv.session_id = p_session_id
    AND s.therapist_id = (select auth.uid())
    AND s.skill_test_assignment_id IS NULL
    AND rv.trainee_visible
    AND rv.comment IS NOT NULL
    AND NOT (
      rv.adjusted_overall IS NOT NULL
      AND translate(rv.comment, '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789')
          ~ ('(^|[^0-9])0*' || rv.adjusted_overall::text || '([^0-9]|$)')
    )
    AND (select public.is_approved())
  ORDER BY rv.updated_at;
$$;

REVOKE ALL ON FUNCTION public.my_session_review_comments(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_session_review_comments(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.my_session_review_comments(uuid) IS
  'Trainee-facing supervisor comments on the owner''s own practice session (trainee_visible only; no scores, no flags). Never for skill tests.';

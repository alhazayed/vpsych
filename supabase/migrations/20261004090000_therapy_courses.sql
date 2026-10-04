-- Therapy courses — one trainee continuing therapy with one patient case
-- across sessions, with a trainee-written treatment plan due after session 2.
--
-- Additive only: one new table plus two nullable columns on sessions.
-- Rollback:
--   ALTER TABLE public.sessions DROP COLUMN IF EXISTS course_session_number;
--   ALTER TABLE public.sessions DROP COLUMN IF EXISTS therapy_course_id;
--   DROP TABLE IF EXISTS public.therapy_courses;

CREATE TABLE IF NOT EXISTS public.therapy_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  avatar_id uuid NOT NULL REFERENCES public.avatars (id) ON DELETE CASCADE,
  -- The case is pinned for the whole course so diagnosis and life story stay
  -- the same from visit to visit.
  case_instance_id uuid REFERENCES public.case_instances (id) ON DELETE SET NULL,
  clinical_snapshot jsonb NOT NULL,
  language text,
  max_duration_sec integer,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed')),
  planned_sessions integer NOT NULL DEFAULT 8
    CHECK (planned_sessions BETWEEN 1 AND 20),
  treatment_plan jsonb,
  plan_submitted_at timestamptz,
  plan_updated_at timestamptz,
  completed_at timestamptz,
  completion_reason text
    CHECK (completion_reason IS NULL OR completion_reason IN ('terminated', 'course_length')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- At most one open course per trainee and patient.
CREATE UNIQUE INDEX IF NOT EXISTS therapy_courses_one_active_idx
  ON public.therapy_courses (therapist_id, avatar_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS therapy_courses_therapist_idx
  ON public.therapy_courses (therapist_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS therapy_courses_avatar_idx
  ON public.therapy_courses (avatar_id);

CREATE INDEX IF NOT EXISTS therapy_courses_case_instance_idx
  ON public.therapy_courses (case_instance_id)
  WHERE case_instance_id IS NOT NULL;

COMMENT ON TABLE public.therapy_courses IS
  'One trainee with one patient case across sessions; treatment plan required before session 3.';

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS therapy_course_id uuid
    REFERENCES public.therapy_courses (id) ON DELETE SET NULL;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS course_session_number integer
    CHECK (course_session_number IS NULL OR course_session_number >= 1);

CREATE INDEX IF NOT EXISTS sessions_therapy_course_idx
  ON public.sessions (therapy_course_id)
  WHERE therapy_course_id IS NOT NULL;

ALTER TABLE public.therapy_courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Therapy courses owner or admin select" ON public.therapy_courses;
CREATE POLICY "Therapy courses owner or admin select" ON public.therapy_courses
  FOR SELECT TO authenticated
  USING (
    therapist_id = (select auth.uid())
    OR (select public.is_admin())
  );

DROP POLICY IF EXISTS "Therapy courses owner insert" ON public.therapy_courses;
CREATE POLICY "Therapy courses owner insert" ON public.therapy_courses
  FOR INSERT TO authenticated
  WITH CHECK (therapist_id = (select auth.uid()));

DROP POLICY IF EXISTS "Therapy courses owner update" ON public.therapy_courses;
CREATE POLICY "Therapy courses owner update" ON public.therapy_courses
  FOR UPDATE TO authenticated
  USING (therapist_id = (select auth.uid()))
  WITH CHECK (therapist_id = (select auth.uid()));

-- No DELETE: course history persists like session history.
GRANT SELECT, INSERT ON public.therapy_courses TO authenticated;
-- The pinned case snapshot is immutable after insert; only plan and lifecycle
-- columns can change.
GRANT UPDATE (
  status,
  planned_sessions,
  treatment_plan,
  plan_submitted_at,
  plan_updated_at,
  completed_at,
  completion_reason,
  updated_at
) ON public.therapy_courses TO authenticated;

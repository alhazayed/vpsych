-- Course voice cap and assigned patients (council course: 3 patients x 8 sessions).
--
-- 1. therapy_courses.voice_chars_used: patient-voice characters (ElevenLabs)
--    spoken in this course. POST /api/voice/tts charges it through
--    charge_course_voice() and falls back to the browser voice once the
--    course's allowance (COURSE_VOICE_CHARS in src/lib/voice/course-voice-budget.ts)
--    is used up. A signed-in trainee cannot write the column directly: the
--    therapy_courses_voice_guard trigger refuses any change made outside
--    charge_course_voice().
-- 2. trainee_patient_assignments: patients an admin assigned to a trainee
--    (for example the 3 patients of a paid course). A trainee with at least one
--    row may start practice only with those patients, always as a therapy
--    course (enforced in POST /api/sessions, which is the only way a trainee's
--    session or course row reaches the database since 20261101170000 and
--    20261102080000). A trainee with no rows is unchanged. Admin-written.
--
-- Additive and idempotent. No existing row changes meaning
-- (voice_chars_used starts at 0 for every course).
--
-- Rollback:
--   DROP TRIGGER IF EXISTS therapy_courses_voice_guard ON public.therapy_courses;
--   DROP FUNCTION IF EXISTS public.enforce_therapy_course_voice_guard();
--   DROP FUNCTION IF EXISTS public.charge_course_voice(uuid, integer, integer);
--   ALTER TABLE public.therapy_courses DROP COLUMN IF EXISTS voice_chars_used;
--   DROP TABLE IF EXISTS public.trainee_patient_assignments;

-- ---------------------------------------------------------------------------
-- 1. Course voice allowance
-- ---------------------------------------------------------------------------
ALTER TABLE public.therapy_courses
  ADD COLUMN IF NOT EXISTS voice_chars_used integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'therapy_courses_voice_chars_used_check'
      AND conrelid = 'public.therapy_courses'::regclass
  ) THEN
    ALTER TABLE public.therapy_courses
      ADD CONSTRAINT therapy_courses_voice_chars_used_check
      CHECK (voice_chars_used >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.therapy_courses.voice_chars_used IS
  'Patient-voice (ElevenLabs) characters spoken in this course; charged by charge_course_voice().';

-- Adds p_chars to the course's voice count when the total stays within p_cap.
-- Returns true when charged, false when the allowance would be exceeded or the
-- course is not the caller's. Atomic: concurrent calls cannot overshoot.
-- A trainee calling it directly can only raise their own count.
CREATE OR REPLACE FUNCTION public.charge_course_voice(
  p_course_id uuid,
  p_chars integer,
  p_cap integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_service boolean := (
    coalesce(auth.role(), '') = 'service_role'
    OR coalesce(auth.jwt() ->> 'role', '') = 'service_role'
  );
  v_id uuid;
BEGIN
  IF p_course_id IS NULL
     OR p_chars IS NULL OR p_chars < 1 OR p_chars > 10000
     OR p_cap IS NULL OR p_cap < 1 THEN
    RAISE EXCEPTION 'course_voice_charge_invalid' USING ERRCODE = '22023';
  END IF;
  IF NOT v_is_service AND auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  -- Only voice_chars_used moves, so the course update guard (patient and
  -- lifecycle columns) lets the change through, finished courses included.
  PERFORM set_config('vtraining.course_voice_charge', 'on', true);
  UPDATE public.therapy_courses c
  SET voice_chars_used = c.voice_chars_used + p_chars
  WHERE c.id = p_course_id
    AND (v_is_service OR c.therapist_id = auth.uid())
    AND c.voice_chars_used + p_chars <= p_cap
  RETURNING c.id INTO v_id;
  PERFORM set_config('vtraining.course_voice_charge', 'off', true);

  RETURN v_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.charge_course_voice(uuid, integer, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.charge_course_voice(uuid, integer, integer)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.charge_course_voice(uuid, integer, integer) IS
  'POST /api/voice/tts: add patient-voice characters to the caller''s therapy course if the total stays within p_cap.';

-- The hosted project grants table-wide UPDATE to authenticated, so a trainee
-- could otherwise reset their own count through the REST API. Only
-- charge_course_voice() (transaction-local flag), admins (two-step login) and
-- the service role may change it.
CREATE OR REPLACE FUNCTION public.enforce_therapy_course_voice_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.voice_chars_used IS NOT DISTINCT FROM OLD.voice_chars_used THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF coalesce(current_setting('vtraining.course_voice_charge', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Cannot change the course voice count' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_therapy_course_voice_guard() IS
  'Therapy course UPDATE from a signed-in non-admin: voice_chars_used changes only through charge_course_voice().';

DROP TRIGGER IF EXISTS therapy_courses_voice_guard ON public.therapy_courses;
CREATE TRIGGER therapy_courses_voice_guard
  BEFORE UPDATE ON public.therapy_courses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_therapy_course_voice_guard();

-- ---------------------------------------------------------------------------
-- 2. Assigned patients
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trainee_patient_assignments (
  trainee_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  avatar_id uuid NOT NULL REFERENCES public.avatars (id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (trainee_id, avatar_id)
);

CREATE INDEX IF NOT EXISTS trainee_patient_assignments_avatar_idx
  ON public.trainee_patient_assignments (avatar_id);
CREATE INDEX IF NOT EXISTS trainee_patient_assignments_assigned_by_idx
  ON public.trainee_patient_assignments (assigned_by);

COMMENT ON TABLE public.trainee_patient_assignments IS
  'Patients an admin assigned to a trainee. A trainee with any row practises only with these patients, as therapy courses. Written by admins only.';

ALTER TABLE public.trainee_patient_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Approved accounts only" ON public.trainee_patient_assignments;
CREATE POLICY "Approved accounts only" ON public.trainee_patient_assignments
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((select public.is_approved()))
  WITH CHECK ((select public.is_approved()));

DROP POLICY IF EXISTS "Assigned patients self or admin select" ON public.trainee_patient_assignments;
CREATE POLICY "Assigned patients self or admin select" ON public.trainee_patient_assignments
  FOR SELECT TO authenticated
  USING (
    trainee_id = (select auth.uid())
    OR (select public.is_admin())
  );

DROP POLICY IF EXISTS "Assigned patients admin insert" ON public.trainee_patient_assignments;
CREATE POLICY "Assigned patients admin insert" ON public.trainee_patient_assignments
  FOR INSERT TO authenticated
  WITH CHECK ((select public.is_admin()) AND assigned_by = (select auth.uid()));

DROP POLICY IF EXISTS "Assigned patients admin delete" ON public.trainee_patient_assignments;
CREATE POLICY "Assigned patients admin delete" ON public.trainee_patient_assignments
  FOR DELETE TO authenticated
  USING ((select public.is_admin()));

GRANT SELECT, INSERT, DELETE ON public.trainee_patient_assignments TO authenticated;

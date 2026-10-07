-- Patient training ladder (phase 1).
--
-- A trainee works through five levels (1 Easy .. 5 Expert) with each program
-- patient. One session is one attempt at one level. The level unlocks only
-- when the previous one is passed, and "passed" means the session's report
-- (the existing assessment) has an overall score strictly greater than 55.
--
-- Everything that decides progress runs here, not in the browser:
-- * attempts are inserted only by start_training_ladder_attempt (SECURITY
--   DEFINER; service role, or an HMAC with the vault report_write_key), which
--   refuses a level above the unlocked one;
-- * attempts are graded only by a trigger on session_reports, so the score is
--   the report's own overall score. Heuristic-fallback reports do not count
--   until an admin regenerates them;
-- * trainees can read their own attempts; there is no insert, update or
--   delete policy.
--
-- Additive and reversible: drop the trigger, the functions and the two tables.

-- ---------------------------------------------------------------------------
-- Program patients (mirror of src/lib/training-ladder/program.ts)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.training_ladder_patients (
  key text PRIMARY KEY CHECK (key ~ '^[a-z0-9-]{1,40}$'),
  slot smallint NOT NULL UNIQUE CHECK (slot BETWEEN 1 AND 99),
  avatar_id uuid NOT NULL REFERENCES public.avatars (id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.training_ladder_patients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ladder patients readable" ON public.training_ladder_patients;
CREATE POLICY "Ladder patients readable" ON public.training_ladder_patients
  FOR SELECT TO authenticated
  USING (is_active OR (SELECT public.is_admin()));

REVOKE ALL ON public.training_ladder_patients FROM anon;
GRANT SELECT ON public.training_ladder_patients TO authenticated;

-- Provisional first patient until the program's own patients are authored.
INSERT INTO public.training_ladder_patients (key, slot, avatar_id)
SELECT 'maya', 1, a.id
FROM public.avatars a
WHERE a.slug = 'maya-chen'
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Attempts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.training_ladder_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL UNIQUE REFERENCES public.sessions (id) ON DELETE CASCADE,
  therapist_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  patient_key text NOT NULL REFERENCES public.training_ladder_patients (key) ON DELETE CASCADE,
  level smallint NOT NULL CHECK (level BETWEEN 1 AND 5),
  status text NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'awaiting_score', 'passed', 'failed')),
  score numeric(5, 2),
  report_id uuid,
  graded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS training_ladder_attempts_trainee_idx
  ON public.training_ladder_attempts (therapist_id, patient_key, level);

ALTER TABLE public.training_ladder_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ladder attempts owner or admin select" ON public.training_ladder_attempts;
CREATE POLICY "Ladder attempts owner or admin select" ON public.training_ladder_attempts
  FOR SELECT TO authenticated
  USING (therapist_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

REVOKE ALL ON public.training_ladder_attempts FROM anon;
GRANT SELECT ON public.training_ladder_attempts TO authenticated;

-- ---------------------------------------------------------------------------
-- Start an attempt (server only)
-- Canonical HMAC payload matches src/lib/training-ladder/persist.ts:
--   sessionId || '\n' || patientKey || '\n' || level
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_training_ladder_attempt(
  p_session_id uuid,
  p_patient_key text,
  p_level integer,
  p_sig text DEFAULT NULL
)
RETURNS public.training_ladder_attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session public.sessions;
  v_patient public.training_ladder_patients;
  v_cleared integer;
  v_row public.training_ladder_attempts;
  v_is_service boolean := (
    coalesce(auth.role(), '') = 'service_role'
    OR coalesce(auth.jwt() ->> 'role', '') = 'service_role'
  );
  v_key text;
  v_expected text;
BEGIN
  IF p_level IS NULL OR p_level < 1 OR p_level > 5 THEN
    RAISE EXCEPTION 'Invalid ladder level';
  END IF;

  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id FOR UPDATE;
  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF NOT v_is_service THEN
    IF auth.uid() IS NULL OR v_session.therapist_id <> auth.uid() THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
    WHERE name = 'report_write_key'
    LIMIT 1;
    IF v_key IS NULL OR length(v_key) = 0 THEN
      RAISE EXCEPTION 'Ladder write key not configured';
    END IF;
    v_expected := encode(
      extensions.hmac(
        p_session_id::text || E'\n' || p_patient_key || E'\n' || p_level::text,
        v_key,
        'sha256'
      ),
      'hex'
    );
    IF p_sig IS NULL OR p_sig IS DISTINCT FROM v_expected THEN
      RAISE EXCEPTION 'Invalid ladder signature';
    END IF;
  END IF;

  IF v_session.status <> 'active' THEN
    RAISE EXCEPTION 'Session is not active';
  END IF;
  IF v_session.skill_test_assignment_id IS NOT NULL
     OR v_session.therapy_course_id IS NOT NULL THEN
    RAISE EXCEPTION 'Session belongs to another program';
  END IF;

  SELECT * INTO v_patient
  FROM public.training_ladder_patients
  WHERE key = p_patient_key AND is_active;
  IF v_patient.key IS NULL THEN
    RAISE EXCEPTION 'Ladder patient not found';
  END IF;
  IF v_patient.avatar_id <> v_session.avatar_id THEN
    RAISE EXCEPTION 'Session patient does not match';
  END IF;

  -- One attempt at a time per trainee and patient, so two starts cannot both
  -- pass the unlock check.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_session.therapist_id::text || ':' || p_patient_key, 0)
  );

  -- Levels unlock in order and attempts are only ever created at or below
  -- the unlocked level, so the highest passed level is the cleared run.
  SELECT coalesce(max(level), 0) INTO v_cleared
  FROM public.training_ladder_attempts
  WHERE therapist_id = v_session.therapist_id
    AND patient_key = p_patient_key
    AND status = 'passed';

  IF p_level > least(v_cleared + 1, 5) THEN
    RAISE EXCEPTION 'Ladder level is locked';
  END IF;

  INSERT INTO public.training_ladder_attempts (
    session_id, therapist_id, patient_key, level
  )
  VALUES (p_session_id, v_session.therapist_id, p_patient_key, p_level)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.start_training_ladder_attempt(uuid, text, integer, text)
  FROM public, anon;
GRANT EXECUTE ON FUNCTION public.start_training_ladder_attempt(uuid, text, integer, text)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Grade an attempt when its session's report is written or regenerated
-- Pass rule matches src/lib/training-ladder/levels.ts isLadderPass: > 55.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.training_ladder_grade_attempt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_heuristic boolean;
  v_overall numeric;
BEGIN
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
    score = CASE WHEN v_heuristic THEN NULL ELSE v_overall END,
    status = CASE
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

DROP TRIGGER IF EXISTS session_reports_grade_ladder_attempt ON public.session_reports;
CREATE TRIGGER session_reports_grade_ladder_attempt
  AFTER INSERT OR UPDATE OF scores ON public.session_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.training_ladder_grade_attempt();

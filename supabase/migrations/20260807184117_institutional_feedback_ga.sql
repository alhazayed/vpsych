-- GA Controlled Institutional Deployment — institutional user feedback store.
-- Independent of patient cognition. NEVER writes clinical_snapshot, case_memory,
-- patient_long_term_memory, DecisionPlan, or any patient-engine tables.

CREATE TABLE IF NOT EXISTS public.institutional_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  submitter_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  institution_id uuid REFERENCES public.institutions (id) ON DELETE SET NULL,
  role_persona text NOT NULL
    CHECK (role_persona IN (
      'resident',
      'student',
      'supervisor',
      'faculty',
      'clinician',
      'researcher',
      'administrator',
      'institution'
    )),
  category text NOT NULL
    CHECK (category IN (
      'clinical_realism',
      'educational_value',
      'conversation_quality',
      'voice_realtime',
      'assessment_report',
      'supervisor_tools',
      'enterprise_admin',
      'security_privacy',
      'bug',
      'critical_safety',
      'other'
    )),
  severity text NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('critical', 'high', 'medium', 'low', 'wishlist')),
  rating smallint CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 8000),
  session_id uuid REFERENCES public.sessions (id) ON DELETE SET NULL,
  locale text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Explicit isolation: feedback never carries patient mind payloads.
  CONSTRAINT institutional_feedback_no_clinical_payload
    CHECK (
      NOT (metadata ? 'clinical_snapshot')
      AND NOT (metadata ? 'decision_plan')
      AND NOT (metadata ? 'case_memory')
      AND NOT (metadata ? 'patient_long_term_memory')
    )
);

CREATE INDEX IF NOT EXISTS institutional_feedback_created_at_idx
  ON public.institutional_feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS institutional_feedback_role_idx
  ON public.institutional_feedback (role_persona);
CREATE INDEX IF NOT EXISTS institutional_feedback_severity_idx
  ON public.institutional_feedback (severity);
CREATE INDEX IF NOT EXISTS institutional_feedback_institution_idx
  ON public.institutional_feedback (institution_id);

ALTER TABLE public.institutional_feedback ENABLE ROW LEVEL SECURITY;

-- Submitters insert their own rows; admins read all.
DROP POLICY IF EXISTS institutional_feedback_insert_own ON public.institutional_feedback;
CREATE POLICY institutional_feedback_insert_own
  ON public.institutional_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (
    submitter_id = (select auth.uid())
  );

DROP POLICY IF EXISTS institutional_feedback_select_own_or_admin ON public.institutional_feedback;
CREATE POLICY institutional_feedback_select_own_or_admin
  ON public.institutional_feedback
  FOR SELECT
  TO authenticated
  USING (
    submitter_id = (select auth.uid())
    OR public.is_admin()
  );

-- No UPDATE/DELETE for authenticated clients (immutable feedback ledger).
REVOKE UPDATE, DELETE ON public.institutional_feedback FROM authenticated, anon;
GRANT SELECT, INSERT ON public.institutional_feedback TO authenticated;

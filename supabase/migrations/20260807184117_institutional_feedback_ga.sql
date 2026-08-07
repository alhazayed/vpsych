-- Institutional feedback foundation (applied on production as institutional_feedback_ga).
-- Reconstructed for git ↔ remote migration parity. Idempotent.
-- Never writes clinical_snapshot / case_memory / patient_long_term_memory.

CREATE TABLE IF NOT EXISTS public.institutional_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  submitter_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  institution_id uuid REFERENCES public.institutions (id) ON DELETE SET NULL,
  role_persona text NOT NULL,
  category text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  rating smallint,
  body text NOT NULL,
  session_id uuid REFERENCES public.sessions (id) ON DELETE SET NULL,
  locale text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT institutional_feedback_body_check
    CHECK (char_length(body) >= 1 AND char_length(body) <= 8000),
  CONSTRAINT institutional_feedback_category_check
    CHECK (
      category = ANY (
        ARRAY[
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
        ]
      )
    ),
  CONSTRAINT institutional_feedback_role_persona_check
    CHECK (
      role_persona = ANY (
        ARRAY[
          'resident',
          'student',
          'supervisor',
          'faculty',
          'clinician',
          'researcher',
          'administrator',
          'institution'
        ]
      )
    ),
  CONSTRAINT institutional_feedback_severity_check
    CHECK (
      severity = ANY (
        ARRAY['critical', 'high', 'medium', 'low', 'wishlist']
      )
    ),
  CONSTRAINT institutional_feedback_rating_check
    CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
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
CREATE INDEX IF NOT EXISTS institutional_feedback_institution_idx
  ON public.institutional_feedback (institution_id);
CREATE INDEX IF NOT EXISTS institutional_feedback_role_idx
  ON public.institutional_feedback (role_persona);
CREATE INDEX IF NOT EXISTS institutional_feedback_severity_idx
  ON public.institutional_feedback (severity);

ALTER TABLE public.institutional_feedback ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.institutional_feedback TO authenticated;

COMMENT ON TABLE public.institutional_feedback IS
  'Institutional pilot / GA feedback — ops owned; no patient cognition writes.';

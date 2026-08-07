-- CIDP extensions on institutional_feedback (additive).
-- Extends foundation migration 20260807184117_institutional_feedback_ga.
-- Never writes clinical_snapshot, case_memory, or patient cognition tables.

-- Widen role personas for CIDP IT + keep prior GA roles
ALTER TABLE public.institutional_feedback
  DROP CONSTRAINT IF EXISTS institutional_feedback_role_persona_check;

ALTER TABLE public.institutional_feedback
  ADD CONSTRAINT institutional_feedback_role_persona_check
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
        'institution',
        'it'
      ]
    )
  );

-- Widen categories for CIDP taxonomy (union with GA categories)
ALTER TABLE public.institutional_feedback
  DROP CONSTRAINT IF EXISTS institutional_feedback_category_check;

ALTER TABLE public.institutional_feedback
  ADD CONSTRAINT institutional_feedback_category_check
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
        'other',
        'clinical_simulation',
        'assessment',
        'curriculum',
        'supervisor',
        'analytics',
        'research_export',
        'authentication',
        'performance',
        'security',
        'deployment',
        'documentation',
        'usability'
      ]
    )
  );

ALTER TABLE public.institutional_feedback
  ADD COLUMN IF NOT EXISTS title text;

ALTER TABLE public.institutional_feedback
  ADD COLUMN IF NOT EXISTS institution_name text NOT NULL DEFAULT '';

ALTER TABLE public.institutional_feedback
  ADD COLUMN IF NOT EXISTS department text NOT NULL DEFAULT '';

ALTER TABLE public.institutional_feedback
  ADD COLUMN IF NOT EXISTS suggested_action text NOT NULL DEFAULT '';

ALTER TABLE public.institutional_feedback
  ADD COLUMN IF NOT EXISTS platform_version text NOT NULL DEFAULT '1.0.0-rc.1';

ALTER TABLE public.institutional_feedback
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'submitted';

ALTER TABLE public.institutional_feedback
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'p2';

ALTER TABLE public.institutional_feedback
  ADD COLUMN IF NOT EXISTS reproducibility text NOT NULL DEFAULT 'unknown';

ALTER TABLE public.institutional_feedback
  DROP CONSTRAINT IF EXISTS institutional_feedback_status_check;
ALTER TABLE public.institutional_feedback
  ADD CONSTRAINT institutional_feedback_status_check
  CHECK (
    status = ANY (
      ARRAY[
        'submitted',
        'triaged',
        'in_progress',
        'resolved',
        'wont_fix',
        'duplicate'
      ]
    )
  );

ALTER TABLE public.institutional_feedback
  DROP CONSTRAINT IF EXISTS institutional_feedback_priority_check;
ALTER TABLE public.institutional_feedback
  ADD CONSTRAINT institutional_feedback_priority_check
  CHECK (priority = ANY (ARRAY['p0', 'p1', 'p2', 'p3']));

ALTER TABLE public.institutional_feedback
  DROP CONSTRAINT IF EXISTS institutional_feedback_reproducibility_check;
ALTER TABLE public.institutional_feedback
  ADD CONSTRAINT institutional_feedback_reproducibility_check
  CHECK (
    reproducibility = ANY (
      ARRAY['always', 'often', 'sometimes', 'rare', 'unknown']
    )
  );

ALTER TABLE public.institutional_feedback
  DROP CONSTRAINT IF EXISTS institutional_feedback_title_len;
ALTER TABLE public.institutional_feedback
  ADD CONSTRAINT institutional_feedback_title_len
  CHECK (title IS NULL OR (char_length(title) >= 3 AND char_length(title) <= 200));

CREATE INDEX IF NOT EXISTS institutional_feedback_status_idx
  ON public.institutional_feedback (status, severity, created_at DESC);

-- RLS policies (foundation table had RLS on but no policies)
DROP POLICY IF EXISTS "Institutional feedback insert own" ON public.institutional_feedback;
CREATE POLICY "Institutional feedback insert own" ON public.institutional_feedback
  FOR INSERT TO authenticated
  WITH CHECK (
    submitter_id = (select auth.uid())
  );

DROP POLICY IF EXISTS "Institutional feedback select own or admin" ON public.institutional_feedback;
CREATE POLICY "Institutional feedback select own or admin" ON public.institutional_feedback
  FOR SELECT TO authenticated
  USING (
    submitter_id = (select auth.uid())
    OR (select public.is_admin())
    OR (select public.is_platform_admin())
    OR (
      institution_id IS NOT NULL
      AND public.can_manage_institution(institution_id)
    )
  );

DROP POLICY IF EXISTS "Institutional feedback update admin" ON public.institutional_feedback;
CREATE POLICY "Institutional feedback update admin" ON public.institutional_feedback
  FOR UPDATE TO authenticated
  USING (
    (select public.is_admin())
    OR (select public.is_platform_admin())
    OR (
      institution_id IS NOT NULL
      AND public.can_manage_institution(institution_id)
    )
  )
  WITH CHECK (
    (select public.is_admin())
    OR (select public.is_platform_admin())
    OR (
      institution_id IS NOT NULL
      AND public.can_manage_institution(institution_id)
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.institutional_feedback TO authenticated;

COMMENT ON TABLE public.institutional_feedback IS
  'CIDP institutional pilot feedback — ops/enterprise owned; no patient cognition writes; no PHI.';

-- CIDP execution: feedback owner, resolution, audit trail.
-- Additive. Never writes clinical_snapshot / case_memory / patient cognition.

ALTER TABLE public.institutional_feedback
  ADD COLUMN IF NOT EXISTS assigned_owner_id uuid
    REFERENCES public.profiles (id) ON DELETE SET NULL;

ALTER TABLE public.institutional_feedback
  ADD COLUMN IF NOT EXISTS resolution text NOT NULL DEFAULT '';

ALTER TABLE public.institutional_feedback
  ADD COLUMN IF NOT EXISTS audit_trail jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.institutional_feedback
  DROP CONSTRAINT IF EXISTS institutional_feedback_resolution_len;
ALTER TABLE public.institutional_feedback
  ADD CONSTRAINT institutional_feedback_resolution_len
  CHECK (char_length(resolution) <= 4000);

ALTER TABLE public.institutional_feedback
  DROP CONSTRAINT IF EXISTS institutional_feedback_audit_trail_is_array;
ALTER TABLE public.institutional_feedback
  ADD CONSTRAINT institutional_feedback_audit_trail_is_array
  CHECK (jsonb_typeof(audit_trail) = 'array');

-- Allow "suggestion" as severity alias (maps from app; stored as wishlist or suggestion)
ALTER TABLE public.institutional_feedback
  DROP CONSTRAINT IF EXISTS institutional_feedback_severity_check;
ALTER TABLE public.institutional_feedback
  ADD CONSTRAINT institutional_feedback_severity_check
  CHECK (
    severity = ANY (
      ARRAY[
        'critical',
        'high',
        'medium',
        'low',
        'wishlist',
        'suggestion'
      ]
    )
  );

CREATE INDEX IF NOT EXISTS institutional_feedback_owner_idx
  ON public.institutional_feedback (assigned_owner_id)
  WHERE assigned_owner_id IS NOT NULL;

COMMENT ON COLUMN public.institutional_feedback.assigned_owner_id IS
  'CIDP triage owner (profiles.id); ops/enterprise only';
COMMENT ON COLUMN public.institutional_feedback.audit_trail IS
  'Append-only JSON array of triage events; no PHI';

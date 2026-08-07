-- Mission 4 — Long-Term Patient Memory
-- Durable memory per therapist↔avatar dyad. Facts are append-only; compression
-- consolidates existing entries and never invents history.

CREATE TABLE IF NOT EXISTS public.patient_long_term_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  avatar_id uuid NOT NULL REFERENCES public.avatars (id) ON DELETE CASCADE,
  longitudinal_group_id uuid,
  memory jsonb NOT NULL DEFAULT '{}'::jsonb,
  entry_count integer NOT NULL DEFAULT 0,
  compressed_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT patient_ltm_therapist_avatar_unique UNIQUE (therapist_id, avatar_id)
);

CREATE INDEX IF NOT EXISTS patient_ltm_therapist_idx
  ON public.patient_long_term_memory (therapist_id);

CREATE INDEX IF NOT EXISTS patient_ltm_avatar_idx
  ON public.patient_long_term_memory (avatar_id);

CREATE INDEX IF NOT EXISTS patient_ltm_longitudinal_idx
  ON public.patient_long_term_memory (longitudinal_group_id)
  WHERE longitudinal_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS patient_ltm_updated_idx
  ON public.patient_long_term_memory (updated_at DESC);

COMMENT ON TABLE public.patient_long_term_memory IS
  'Mission 4: long-term patient memory store keyed by therapist↔avatar dyad. Persist facts; never regenerate history.';

ALTER TABLE public.patient_long_term_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Patient LTM owner select" ON public.patient_long_term_memory;
CREATE POLICY "Patient LTM owner select" ON public.patient_long_term_memory
  FOR SELECT TO authenticated
  USING (
    therapist_id = (select auth.uid())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Patient LTM owner insert" ON public.patient_long_term_memory;
CREATE POLICY "Patient LTM owner insert" ON public.patient_long_term_memory
  FOR INSERT TO authenticated
  WITH CHECK (
    therapist_id = (select auth.uid())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Patient LTM owner update" ON public.patient_long_term_memory;
CREATE POLICY "Patient LTM owner update" ON public.patient_long_term_memory
  FOR UPDATE TO authenticated
  USING (
    therapist_id = (select auth.uid())
    OR public.is_admin()
  )
  WITH CHECK (
    therapist_id = (select auth.uid())
    OR public.is_admin()
  );

-- No DELETE for therapists — memory must persist. Admins may purge for ops.
DROP POLICY IF EXISTS "Patient LTM admin delete" ON public.patient_long_term_memory;
CREATE POLICY "Patient LTM admin delete" ON public.patient_long_term_memory
  FOR DELETE TO authenticated
  USING (public.is_admin());

GRANT SELECT, INSERT, UPDATE ON public.patient_long_term_memory TO authenticated;
GRANT DELETE ON public.patient_long_term_memory TO authenticated;

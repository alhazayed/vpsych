-- Parity / hardening: wrap auth.uid() / is_admin() in (select …) for LTM RLS.
-- Remote version 20260807112000. Idempotent policy recreate.

DROP POLICY IF EXISTS "Patient LTM owner select" ON public.patient_long_term_memory;
CREATE POLICY "Patient LTM owner select" ON public.patient_long_term_memory
  FOR SELECT TO authenticated
  USING (
    therapist_id = (select auth.uid())
    OR (select public.is_admin())
  );

DROP POLICY IF EXISTS "Patient LTM owner insert" ON public.patient_long_term_memory;
CREATE POLICY "Patient LTM owner insert" ON public.patient_long_term_memory
  FOR INSERT TO authenticated
  WITH CHECK (
    therapist_id = (select auth.uid())
    OR (select public.is_admin())
  );

DROP POLICY IF EXISTS "Patient LTM owner update" ON public.patient_long_term_memory;
CREATE POLICY "Patient LTM owner update" ON public.patient_long_term_memory
  FOR UPDATE TO authenticated
  USING (
    therapist_id = (select auth.uid())
    OR (select public.is_admin())
  )
  WITH CHECK (
    therapist_id = (select auth.uid())
    OR (select public.is_admin())
  );

DROP POLICY IF EXISTS "Patient LTM admin delete" ON public.patient_long_term_memory;
CREATE POLICY "Patient LTM admin delete" ON public.patient_long_term_memory
  FOR DELETE TO authenticated
  USING ((select public.is_admin()));

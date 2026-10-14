-- Training ladder phase 3: a level's case stays sealed from the trainee.
--
-- A ladder session row keeps the level's full case only sealed
-- (sessions.sealed_case, AES-256-GCM, see src/lib/skill-tests/exam.ts); its
-- clinical_snapshot holds the primary presentation and level the program
-- already shows. Unlike a skill test, a ladder session keeps its
-- case_instances row, because the patient's in-session memory (case_memory)
-- is keyed on it. That row carries the same case in the clear
-- (comorbidity_disorder_ids, clinical_snapshot), so the trainee may no longer
-- read a case_instances row that a sealed session uses. Admins still can.
--
-- case_memory's ownership check read case_instances under its RLS, so it
-- moves to a SECURITY DEFINER helper with the same rule as before; the
-- patient's memory keeps working for the trainee's own sessions.
--
-- Additive and reversible: two helper functions, two replaced policies.
--
-- Rollback:
--   DROP POLICY IF EXISTS "Therapists read own case_instances" ON public.case_instances;
--   CREATE POLICY "Therapists read own case_instances" ON public.case_instances
--     FOR SELECT USING ((created_by = (select auth.uid())) OR (select public.is_admin())
--       OR EXISTS (SELECT 1 FROM public.sessions s WHERE s.case_instance_id = case_instances.id
--         AND s.therapist_id = (select auth.uid())));
--   DROP POLICY IF EXISTS "Case memory via ownership" ON public.case_memory;
--   CREATE POLICY "Case memory via ownership" ON public.case_memory
--     FOR ALL TO authenticated
--     USING (EXISTS (SELECT 1 FROM public.case_instances ci WHERE ci.id = case_memory.case_instance_id
--       AND (ci.created_by = auth.uid() OR (select public.is_admin()) OR EXISTS (
--         SELECT 1 FROM public.sessions s WHERE s.case_instance_id = ci.id AND s.therapist_id = auth.uid()))))
--     WITH CHECK (EXISTS (SELECT 1 FROM public.case_instances ci WHERE ci.id = case_memory.case_instance_id
--       AND (ci.created_by = auth.uid() OR (select public.is_admin()))));
--   DROP FUNCTION IF EXISTS public.case_instance_sealed(uuid);
--   DROP FUNCTION IF EXISTS public.owns_case_instance(uuid, boolean);

-- True when a session keeps this case sealed (a training ladder level).
CREATE OR REPLACE FUNCTION public.case_instance_sealed(p_case_instance_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1 from public.sessions s
    where s.case_instance_id = p_case_instance_id
      and s.sealed_case is not null
  );
$$;

-- The caller created the case, or (p_via_sessions) one of their sessions uses
-- it. Reads past RLS so case_memory keeps working for a sealed case.
CREATE OR REPLACE FUNCTION public.owns_case_instance(
  p_case_instance_id uuid,
  p_via_sessions boolean
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1 from public.case_instances ci
    where ci.id = p_case_instance_id
      and (
        ci.created_by = auth.uid()
        or (p_via_sessions and exists (
          select 1 from public.sessions s
          where s.case_instance_id = ci.id and s.therapist_id = auth.uid()
        ))
      )
  );
$$;

REVOKE ALL ON FUNCTION public.case_instance_sealed(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.owns_case_instance(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.case_instance_sealed(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_case_instance(uuid, boolean) TO authenticated;

DROP POLICY IF EXISTS "Therapists read own case_instances" ON public.case_instances;
CREATE POLICY "Therapists read own case_instances" ON public.case_instances
  FOR SELECT
  USING (
    (select public.is_admin())
    OR (
      (
        created_by = (select auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.sessions s
          WHERE s.case_instance_id = case_instances.id
            AND s.therapist_id = (select auth.uid())
        )
      )
      AND NOT public.case_instance_sealed(id)
    )
  );

DROP POLICY IF EXISTS "Case memory via ownership" ON public.case_memory;
CREATE POLICY "Case memory via ownership" ON public.case_memory
  FOR ALL TO authenticated
  USING (
    (select public.is_admin())
    OR public.owns_case_instance(case_instance_id, true)
  )
  WITH CHECK (
    (select public.is_admin())
    OR public.owns_case_instance(case_instance_id, false)
  );

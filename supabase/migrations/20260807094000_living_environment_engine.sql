-- Mission 6 — Living Environment Engine
-- Immutable living world per CaseInstance. Therapist may ask about any detail;
-- facts never regenerate or drift for that case.

CREATE TABLE IF NOT EXISTS public.living_environments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_instance_id uuid NOT NULL REFERENCES public.case_instances (id) ON DELETE CASCADE,
  world_id text NOT NULL,
  locale text NOT NULL DEFAULT 'en-US',
  seed text NOT NULL,
  world jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT living_environments_case_unique UNIQUE (case_instance_id),
  CONSTRAINT living_environments_world_id_unique UNIQUE (world_id)
);

CREATE INDEX IF NOT EXISTS living_environments_locale_idx
  ON public.living_environments (locale);

CREATE INDEX IF NOT EXISTS living_environments_created_idx
  ON public.living_environments (created_at DESC);

COMMENT ON TABLE public.living_environments IS
  'Mission 6: immutable living world (home/family/work/friends/finances/medical/routine/social/education) keyed by case_instance_id. Insert-once; never regenerate.';

ALTER TABLE public.living_environments ENABLE ROW LEVEL SECURITY;

-- Therapists read worlds for case instances they own (via sessions).
DROP POLICY IF EXISTS "Living world owner select" ON public.living_environments;
CREATE POLICY "Living world owner select" ON public.living_environments
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.sessions s
      WHERE s.case_instance_id = living_environments.case_instance_id
        AND s.therapist_id = (select auth.uid())
    )
  );

-- Authenticated insert (session start / case mint). Ownership enforced by
-- application + case_instances insert path; admin always allowed.
DROP POLICY IF EXISTS "Living world authenticated insert" ON public.living_environments;
CREATE POLICY "Living world authenticated insert" ON public.living_environments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.case_instances ci
      WHERE ci.id = living_environments.case_instance_id
        AND (
          ci.created_by = (select auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.sessions s
            WHERE s.case_instance_id = ci.id
              AND s.therapist_id = (select auth.uid())
          )
        )
    )
  );

-- No UPDATE for therapists — world is immutable. Admins may repair ops only.
DROP POLICY IF EXISTS "Living world admin update" ON public.living_environments;
CREATE POLICY "Living world admin update" ON public.living_environments
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Living world admin delete" ON public.living_environments;
CREATE POLICY "Living world admin delete" ON public.living_environments
  FOR DELETE TO authenticated
  USING (public.is_admin());

GRANT SELECT, INSERT ON public.living_environments TO authenticated;
GRANT UPDATE, DELETE ON public.living_environments TO authenticated;

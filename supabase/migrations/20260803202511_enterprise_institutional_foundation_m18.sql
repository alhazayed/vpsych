-- Canonical migration recovered for Release Configuration Board reconciliation.
-- Source: production supabase_migrations.schema_migrations statements
-- (enriched only when production statements were empty/placeholder).

-- =============================================================================
-- VPsych Enterprise Institutional Foundation (Mission 18)
-- Multi-institution org model, memberships, assignments, tenant helpers.
-- Additive / backward compatible with existing therapist|admin profiles.role.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.enterprise_membership_role AS ENUM (
    'student',
    'resident',
    'psychologist',
    'gp',
    'faculty',
    'instructor',
    'program_director',
    'institution_admin'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.assignment_status AS ENUM (
    'draft', 'published', 'closed', 'archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.assignment_completion_status AS ENUM (
    'assigned', 'in_progress', 'submitted', 'passed', 'failed', 'excused'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Org hierarchy
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  legal_name text,
  country_code text NOT NULL DEFAULT 'US',
  timezone text NOT NULL DEFAULT 'UTC',
  locale_default text NOT NULL DEFAULT 'en-US',
  sso_enabled boolean NOT NULL DEFAULT false,
  sso_provider text,
  sso_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions (id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, slug)
);

CREATE TABLE IF NOT EXISTS public.programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions (id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments (id) ON DELETE SET NULL,
  slug text NOT NULL,
  name text NOT NULL,
  degree_type text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, slug)
);

CREATE TABLE IF NOT EXISTS public.academic_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions (id) ON DELETE CASCADE,
  label text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on > starts_on)
);

CREATE TABLE IF NOT EXISTS public.terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions (id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL REFERENCES public.academic_years (id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, academic_year_id, slug),
  CHECK (ends_on > starts_on)
);

CREATE TABLE IF NOT EXISTS public.cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions (id) ON DELETE CASCADE,
  program_id uuid REFERENCES public.programs (id) ON DELETE SET NULL,
  academic_year_id uuid REFERENCES public.academic_years (id) ON DELETE SET NULL,
  slug text NOT NULL,
  name text NOT NULL,
  intake_label text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, slug)
);

CREATE TABLE IF NOT EXISTS public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions (id) ON DELETE CASCADE,
  cohort_id uuid REFERENCES public.cohorts (id) ON DELETE SET NULL,
  term_id uuid REFERENCES public.terms (id) ON DELETE SET NULL,
  program_id uuid REFERENCES public.programs (id) ON DELETE SET NULL,
  slug text NOT NULL,
  name text NOT NULL,
  group_label text,
  capacity int,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, slug)
);

-- ---------------------------------------------------------------------------
-- Memberships (enterprise RBAC scoped to institution)
-- Platform profiles.role remains therapist|admin (admin = super administrator).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.institution_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role public.enterprise_membership_role NOT NULL,
  department_id uuid REFERENCES public.departments (id) ON DELETE SET NULL,
  program_id uuid REFERENCES public.programs (id) ON DELETE SET NULL,
  cohort_id uuid REFERENCES public.cohorts (id) ON DELETE SET NULL,
  is_primary boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, user_id, role)
);

CREATE TABLE IF NOT EXISTS public.class_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role public.enterprise_membership_role NOT NULL DEFAULT 'student',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, user_id)
);

-- Link ACE learner profiles to institutions (keep text column for display)
ALTER TABLE public.learner_profiles
  ADD COLUMN IF NOT EXISTS institution_id uuid
    REFERENCES public.institutions (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS learner_profiles_institution_id_idx
  ON public.learner_profiles (institution_id);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS primary_institution_id uuid
    REFERENCES public.institutions (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Learning management — assignments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.learning_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions (id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes (id) ON DELETE SET NULL,
  cohort_id uuid REFERENCES public.cohorts (id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status public.assignment_status NOT NULL DEFAULT 'draft',
  is_required boolean NOT NULL DEFAULT true,
  is_elective boolean NOT NULL DEFAULT false,
  due_at timestamptz,
  opens_at timestamptz,
  scenario_template_slug text,
  instructor_preset_slug text,
  required_competency_ids text[] NOT NULL DEFAULT '{}',
  pass_threshold numeric NOT NULL DEFAULT 70,
  max_attempts int NOT NULL DEFAULT 3,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT (is_required AND is_elective))
);

CREATE TABLE IF NOT EXISTS public.assignment_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.learning_assignments (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.sessions (id) ON DELETE SET NULL,
  status public.assignment_completion_status NOT NULL DEFAULT 'assigned',
  attempt_number int NOT NULL DEFAULT 1,
  score numeric,
  submitted_at timestamptz,
  feedback text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, user_id, attempt_number)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS institutions_active_idx
  ON public.institutions (is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS departments_institution_idx
  ON public.departments (institution_id);
CREATE INDEX IF NOT EXISTS programs_institution_idx
  ON public.programs (institution_id);
CREATE INDEX IF NOT EXISTS cohorts_institution_idx
  ON public.cohorts (institution_id);
CREATE INDEX IF NOT EXISTS classes_institution_idx
  ON public.classes (institution_id);
CREATE INDEX IF NOT EXISTS institution_memberships_user_idx
  ON public.institution_memberships (user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS institution_memberships_institution_idx
  ON public.institution_memberships (institution_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS class_memberships_user_idx
  ON public.class_memberships (user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS learning_assignments_institution_idx
  ON public.learning_assignments (institution_id);
CREATE INDEX IF NOT EXISTS learning_assignments_due_idx
  ON public.learning_assignments (due_at) WHERE due_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS assignment_completions_user_idx
  ON public.assignment_completions (user_id);
CREATE INDEX IF NOT EXISTS academic_years_institution_idx
  ON public.academic_years (institution_id);
CREATE INDEX IF NOT EXISTS terms_institution_idx
  ON public.terms (institution_id);

-- ---------------------------------------------------------------------------
-- Tenant / RBAC helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role = 'admin'::public.user_role FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.user_institution_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(DISTINCT institution_id),
    '{}'::uuid[]
  )
  FROM public.institution_memberships
  WHERE user_id = auth.uid() AND is_active = true;
$$;

CREATE OR REPLACE FUNCTION public.has_institution_role(
  p_institution_id uuid,
  VARIADIC p_roles public.enterprise_membership_role[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.institution_memberships m
      WHERE m.user_id = auth.uid()
        AND m.institution_id = p_institution_id
        AND m.is_active = true
        AND m.role = ANY (p_roles)
    );
$$;

CREATE OR REPLACE FUNCTION public.is_institution_member(p_institution_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.institution_memberships m
      WHERE m.user_id = auth.uid()
        AND m.institution_id = p_institution_id
        AND m.is_active = true
    );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_institution(p_institution_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_institution_role(
    p_institution_id,
    'institution_admin',
    'program_director',
    'faculty',
    'instructor'
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_completions ENABLE ROW LEVEL SECURITY;

-- Institutions: members read; platform admin / institution_admin write
DROP POLICY IF EXISTS "Institutions member read" ON public.institutions;
CREATE POLICY "Institutions member read" ON public.institutions
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR id = ANY (public.user_institution_ids())
  );

DROP POLICY IF EXISTS "Institutions admin write" ON public.institutions;
CREATE POLICY "Institutions admin write" ON public.institutions
  FOR ALL TO authenticated
  USING (
    public.is_platform_admin()
    OR public.has_institution_role(id, 'institution_admin')
  )
  WITH CHECK (
    public.is_platform_admin()
    OR public.has_institution_role(id, 'institution_admin')
  );

-- Departments / programs / years / terms / cohorts / classes: member read, managers write
DROP POLICY IF EXISTS "Departments member read" ON public.departments;
CREATE POLICY "Departments member read" ON public.departments
  FOR SELECT TO authenticated
  USING (public.is_institution_member(institution_id));

DROP POLICY IF EXISTS "Departments manager write" ON public.departments;
CREATE POLICY "Departments manager write" ON public.departments
  FOR ALL TO authenticated
  USING (public.can_manage_institution(institution_id))
  WITH CHECK (public.can_manage_institution(institution_id));

DROP POLICY IF EXISTS "Programs member read" ON public.programs;
CREATE POLICY "Programs member read" ON public.programs
  FOR SELECT TO authenticated
  USING (public.is_institution_member(institution_id));

DROP POLICY IF EXISTS "Programs manager write" ON public.programs;
CREATE POLICY "Programs manager write" ON public.programs
  FOR ALL TO authenticated
  USING (public.can_manage_institution(institution_id))
  WITH CHECK (public.can_manage_institution(institution_id));

DROP POLICY IF EXISTS "Academic years member read" ON public.academic_years;
CREATE POLICY "Academic years member read" ON public.academic_years
  FOR SELECT TO authenticated
  USING (public.is_institution_member(institution_id));

DROP POLICY IF EXISTS "Academic years manager write" ON public.academic_years;
CREATE POLICY "Academic years manager write" ON public.academic_years
  FOR ALL TO authenticated
  USING (public.can_manage_institution(institution_id))
  WITH CHECK (public.can_manage_institution(institution_id));

DROP POLICY IF EXISTS "Terms member read" ON public.terms;
CREATE POLICY "Terms member read" ON public.terms
  FOR SELECT TO authenticated
  USING (public.is_institution_member(institution_id));

DROP POLICY IF EXISTS "Terms manager write" ON public.terms;
CREATE POLICY "Terms manager write" ON public.terms
  FOR ALL TO authenticated
  USING (public.can_manage_institution(institution_id))
  WITH CHECK (public.can_manage_institution(institution_id));

DROP POLICY IF EXISTS "Cohorts member read" ON public.cohorts;
CREATE POLICY "Cohorts member read" ON public.cohorts
  FOR SELECT TO authenticated
  USING (public.is_institution_member(institution_id));

DROP POLICY IF EXISTS "Cohorts manager write" ON public.cohorts;
CREATE POLICY "Cohorts manager write" ON public.cohorts
  FOR ALL TO authenticated
  USING (public.can_manage_institution(institution_id))
  WITH CHECK (public.can_manage_institution(institution_id));

DROP POLICY IF EXISTS "Classes member read" ON public.classes;
CREATE POLICY "Classes member read" ON public.classes
  FOR SELECT TO authenticated
  USING (public.is_institution_member(institution_id));

DROP POLICY IF EXISTS "Classes manager write" ON public.classes;
CREATE POLICY "Classes manager write" ON public.classes
  FOR ALL TO authenticated
  USING (public.can_manage_institution(institution_id))
  WITH CHECK (public.can_manage_institution(institution_id));

-- Memberships: own row or managers; platform admin all
DROP POLICY IF EXISTS "Memberships self or manager read" ON public.institution_memberships;
CREATE POLICY "Memberships self or manager read" ON public.institution_memberships
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR user_id = auth.uid()
    OR public.can_manage_institution(institution_id)
  );

DROP POLICY IF EXISTS "Memberships manager write" ON public.institution_memberships;
CREATE POLICY "Memberships manager write" ON public.institution_memberships
  FOR ALL TO authenticated
  USING (
    public.is_platform_admin()
    OR public.has_institution_role(institution_id, 'institution_admin', 'program_director')
  )
  WITH CHECK (
    public.is_platform_admin()
    OR public.has_institution_role(institution_id, 'institution_admin', 'program_director')
  );

DROP POLICY IF EXISTS "Class memberships self or manager read" ON public.class_memberships;
CREATE POLICY "Class memberships self or manager read" ON public.class_memberships
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_id AND public.can_manage_institution(c.institution_id)
    )
  );

DROP POLICY IF EXISTS "Class memberships manager write" ON public.class_memberships;
CREATE POLICY "Class memberships manager write" ON public.class_memberships
  FOR ALL TO authenticated
  USING (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_id AND public.can_manage_institution(c.institution_id)
    )
  )
  WITH CHECK (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_id AND public.can_manage_institution(c.institution_id)
    )
  );

-- Assignments
DROP POLICY IF EXISTS "Assignments member read" ON public.learning_assignments;
CREATE POLICY "Assignments member read" ON public.learning_assignments
  FOR SELECT TO authenticated
  USING (
    public.is_institution_member(institution_id)
    AND (
      status IN ('published', 'closed')
      OR public.can_manage_institution(institution_id)
    )
  );

DROP POLICY IF EXISTS "Assignments manager write" ON public.learning_assignments;
CREATE POLICY "Assignments manager write" ON public.learning_assignments
  FOR ALL TO authenticated
  USING (public.can_manage_institution(institution_id))
  WITH CHECK (public.can_manage_institution(institution_id));

DROP POLICY IF EXISTS "Assignment completions self or manager" ON public.assignment_completions;
CREATE POLICY "Assignment completions self or manager" ON public.assignment_completions
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.learning_assignments a
      WHERE a.id = assignment_id AND public.can_manage_institution(a.institution_id)
    )
  );

DROP POLICY IF EXISTS "Assignment completions learner insert update" ON public.assignment_completions;
CREATE POLICY "Assignment completions learner insert update" ON public.assignment_completions
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.learning_assignments a
      WHERE a.id = assignment_id AND public.can_manage_institution(a.institution_id)
    )
  );

DROP POLICY IF EXISTS "Assignment completions update" ON public.assignment_completions;
CREATE POLICY "Assignment completions update" ON public.assignment_completions
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.learning_assignments a
      WHERE a.id = assignment_id AND public.can_manage_institution(a.institution_id)
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.learning_assignments a
      WHERE a.id = assignment_id AND public.can_manage_institution(a.institution_id)
    )
  );

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.institutions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.programs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_years TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.terms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cohorts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.institution_memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_completions TO authenticated;

GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_institution_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_institution_role(uuid, public.enterprise_membership_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_institution_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_institution(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.user_institution_ids() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.has_institution_role(uuid, public.enterprise_membership_role[]) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.is_institution_member(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_institution(uuid) FROM public, anon;

-- ---------------------------------------------------------------------------
-- Seed demo institution (idempotent) for local/offline certification
-- ---------------------------------------------------------------------------
INSERT INTO public.institutions (id, slug, name, legal_name, country_code, timezone, locale_default, sso_enabled)
VALUES (
  'a1000000-0000-4000-8000-000000000001',
  'vpsych-demo-university',
  'VPsych Demo University',
  'VPsych Demo University LLC',
  'US',
  'America/New_York',
  'en-US',
  false
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.departments (id, institution_id, slug, name)
VALUES (
  'a1000000-0000-4000-8000-000000000010',
  'a1000000-0000-4000-8000-000000000001',
  'psychiatry',
  'Department of Psychiatry'
)
ON CONFLICT (institution_id, slug) DO NOTHING;

INSERT INTO public.programs (id, institution_id, department_id, slug, name, degree_type)
VALUES (
  'a1000000-0000-4000-8000-000000000020',
  'a1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000010',
  'psychiatry-residency',
  'Psychiatry Residency',
  'residency'
)
ON CONFLICT (institution_id, slug) DO NOTHING;

INSERT INTO public.academic_years (id, institution_id, label, starts_on, ends_on, is_current)
VALUES (
  'a1000000-0000-4000-8000-000000000030',
  'a1000000-0000-4000-8000-000000000001',
  '2025-2026',
  '2025-07-01',
  '2026-06-30',
  true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.terms (id, institution_id, academic_year_id, slug, name, starts_on, ends_on, is_current)
VALUES (
  'a1000000-0000-4000-8000-000000000040',
  'a1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000030',
  'fall-2025',
  'Fall 2025',
  '2025-08-15',
  '2025-12-20',
  true
)
ON CONFLICT (institution_id, academic_year_id, slug) DO NOTHING;

INSERT INTO public.cohorts (id, institution_id, program_id, academic_year_id, slug, name, intake_label)
VALUES (
  'a1000000-0000-4000-8000-000000000050',
  'a1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000020',
  'a1000000-0000-4000-8000-000000000030',
  'pg1-2025',
  'PGY-1 Class of 2025',
  '2025'
)
ON CONFLICT (institution_id, slug) DO NOTHING;

INSERT INTO public.classes (id, institution_id, cohort_id, term_id, program_id, slug, name, group_label, capacity)
VALUES (
  'a1000000-0000-4000-8000-000000000060',
  'a1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000050',
  'a1000000-0000-4000-8000-000000000040',
  'a1000000-0000-4000-8000-000000000020',
  'osce-station-a',
  'OSCE Station Group A',
  'Group A',
  24
)
ON CONFLICT (institution_id, slug) DO NOTHING;

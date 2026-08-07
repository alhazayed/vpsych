-- Stage 10 — Enterprise Platform extensions
-- Extends Mission 18/23 institutional foundation. Additive / backward compatible.
-- Never modifies patient clinical tables ownership (sessions clinical_snapshot,
-- case_memory, patient_long_term_memory remain owned by Stages 3–6 engines).

-- ---------------------------------------------------------------------------
-- Enum extensions (RBAC)
-- ---------------------------------------------------------------------------
ALTER TYPE public.enterprise_membership_role ADD VALUE IF NOT EXISTS 'supervisor';
ALTER TYPE public.enterprise_membership_role ADD VALUE IF NOT EXISTS 'observer';
ALTER TYPE public.enterprise_membership_role ADD VALUE IF NOT EXISTS 'research_coordinator';
ALTER TYPE public.enterprise_membership_role ADD VALUE IF NOT EXISTS 'guest';
ALTER TYPE public.enterprise_membership_role ADD VALUE IF NOT EXISTS 'support';
ALTER TYPE public.enterprise_membership_role ADD VALUE IF NOT EXISTS 'therapist';

DO $$ BEGIN
  CREATE TYPE public.enterprise_tenant_type AS ENUM (
    'university',
    'hospital',
    'clinic',
    'corporate',
    'government',
    'private_organization'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.enterprise_course_status AS ENUM (
    'draft', 'published', 'archived', 'retired'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.enterprise_library_visibility AS ENUM (
    'private', 'organization', 'shared', 'platform'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.enterprise_certificate_kind AS ENUM (
    'competency',
    'course',
    'university',
    'board_prep',
    'residency_milestone',
    'osce',
    'cme',
    'digital'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Institutions: tenant_type column
-- ---------------------------------------------------------------------------
ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS tenant_type public.enterprise_tenant_type;

UPDATE public.institutions
SET tenant_type = COALESCE(
  tenant_type,
  CASE
    WHEN settings->>'archetype' = 'teaching_hospital' THEN 'hospital'::public.enterprise_tenant_type
    WHEN settings->>'archetype' = 'private_institution' THEN 'private_organization'::public.enterprise_tenant_type
    WHEN settings->>'archetype' = 'government_program' THEN 'government'::public.enterprise_tenant_type
    WHEN settings->>'archetype' = 'university' THEN 'university'::public.enterprise_tenant_type
    ELSE 'university'::public.enterprise_tenant_type
  END
)
WHERE tenant_type IS NULL;

-- ---------------------------------------------------------------------------
-- Campuses
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.enterprise_campuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions (id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  city text,
  country_code text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, slug)
);

CREATE INDEX IF NOT EXISTS enterprise_campuses_institution_idx
  ON public.enterprise_campuses (institution_id);

ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS campus_id uuid
    REFERENCES public.enterprise_campuses (id) ON DELETE SET NULL;

ALTER TABLE public.institution_memberships
  ADD COLUMN IF NOT EXISTS campus_id uuid
    REFERENCES public.enterprise_campuses (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Courses / modules / lessons
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.enterprise_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions (id) ON DELETE CASCADE,
  program_id uuid REFERENCES public.programs (id) ON DELETE SET NULL,
  slug text NOT NULL,
  title text NOT NULL,
  description text,
  status public.enterprise_course_status NOT NULL DEFAULT 'draft',
  language text NOT NULL DEFAULT 'en',
  competency_ids text[] NOT NULL DEFAULT '{}',
  graduation_requirement_ids text[] NOT NULL DEFAULT '{}',
  version int NOT NULL DEFAULT 1,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, slug)
);

CREATE TABLE IF NOT EXISTS public.enterprise_course_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.enterprise_courses (id) ON DELETE CASCADE,
  institution_id uuid NOT NULL REFERENCES public.institutions (id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, slug)
);

CREATE TABLE IF NOT EXISTS public.enterprise_course_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.enterprise_course_modules (id) ON DELETE CASCADE,
  institution_id uuid NOT NULL REFERENCES public.institutions (id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  lesson_type text NOT NULL DEFAULT 'didactic',
  simulation_template_slug text,
  estimated_minutes int,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_id, slug)
);

CREATE TABLE IF NOT EXISTS public.enterprise_clinical_rotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions (id) ON DELETE CASCADE,
  program_id uuid REFERENCES public.programs (id) ON DELETE SET NULL,
  course_id uuid REFERENCES public.enterprise_courses (id) ON DELETE SET NULL,
  title text NOT NULL,
  site_label text,
  starts_on date,
  ends_on date,
  supervisor_user_ids uuid[] NOT NULL DEFAULT '{}',
  competency_ids text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.enterprise_learning_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions (id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  course_ids uuid[] NOT NULL DEFAULT '{}',
  required_certificate_kinds public.enterprise_certificate_kind[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, slug)
);

CREATE TABLE IF NOT EXISTS public.enterprise_graduation_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions (id) ON DELETE CASCADE,
  program_id uuid REFERENCES public.programs (id) ON DELETE SET NULL,
  label text NOT NULL,
  min_sessions int NOT NULL DEFAULT 10,
  min_overall_score numeric NOT NULL DEFAULT 70,
  required_competency_ids text[] NOT NULL DEFAULT '{}',
  required_certificate_kinds public.enterprise_certificate_kind[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Case libraries
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.enterprise_case_libraries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES public.institutions (id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'enterprise',
  visibility public.enterprise_library_visibility NOT NULL DEFAULT 'organization',
  version int NOT NULL DEFAULT 1,
  approval_status text NOT NULL DEFAULT 'draft',
  entry_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, slug)
);

CREATE TABLE IF NOT EXISTS public.enterprise_case_library_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id uuid NOT NULL REFERENCES public.enterprise_case_libraries (id) ON DELETE CASCADE,
  institution_id uuid REFERENCES public.institutions (id) ON DELETE CASCADE,
  scenario_template_slug text NOT NULL,
  title text NOT NULL,
  version int NOT NULL DEFAULT 1,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Certificates
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.enterprise_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  kind public.enterprise_certificate_kind NOT NULL,
  title text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  verification_code text NOT NULL UNIQUE,
  qr_payload text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS enterprise_certificates_institution_idx
  ON public.enterprise_certificates (institution_id);
CREATE INDEX IF NOT EXISTS enterprise_certificates_user_idx
  ON public.enterprise_certificates (user_id);
CREATE INDEX IF NOT EXISTS enterprise_certificates_code_idx
  ON public.enterprise_certificates (verification_code);

-- ---------------------------------------------------------------------------
-- Research studies
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.enterprise_research_studies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  lead_institution_id uuid NOT NULL REFERENCES public.institutions (id) ON DELETE CASCADE,
  participating_institution_ids uuid[] NOT NULL DEFAULT '{}',
  irb_tag text,
  status text NOT NULL DEFAULT 'draft',
  dataset_keys text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Webhooks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.enterprise_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions (id) ON DELETE CASCADE,
  url text NOT NULL,
  events text[] NOT NULL DEFAULT '{}',
  secret_ref text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Enterprise audit (tenant-scoped; complements security_audit_events)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.enterprise_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES public.institutions (id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  action text NOT NULL,
  outcome text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS enterprise_audit_events_institution_idx
  ON public.enterprise_audit_events (institution_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.enterprise_campuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_course_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_clinical_rotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_learning_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_graduation_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_case_libraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_case_library_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_research_studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_audit_events ENABLE ROW LEVEL SECURITY;

-- Campuses
DROP POLICY IF EXISTS "Enterprise campuses member read" ON public.enterprise_campuses;
CREATE POLICY "Enterprise campuses member read" ON public.enterprise_campuses
  FOR SELECT TO authenticated
  USING (public.is_institution_member(institution_id));

DROP POLICY IF EXISTS "Enterprise campuses manager write" ON public.enterprise_campuses;
CREATE POLICY "Enterprise campuses manager write" ON public.enterprise_campuses
  FOR ALL TO authenticated
  USING (public.can_manage_institution(institution_id))
  WITH CHECK (public.can_manage_institution(institution_id));

-- Courses family
DROP POLICY IF EXISTS "Enterprise courses member read" ON public.enterprise_courses;
CREATE POLICY "Enterprise courses member read" ON public.enterprise_courses
  FOR SELECT TO authenticated
  USING (
    public.is_institution_member(institution_id)
    AND (
      status = 'published'
      OR public.can_manage_institution(institution_id)
    )
  );

DROP POLICY IF EXISTS "Enterprise courses manager write" ON public.enterprise_courses;
CREATE POLICY "Enterprise courses manager write" ON public.enterprise_courses
  FOR ALL TO authenticated
  USING (public.can_manage_institution(institution_id))
  WITH CHECK (public.can_manage_institution(institution_id));

DROP POLICY IF EXISTS "Enterprise modules member read" ON public.enterprise_course_modules;
CREATE POLICY "Enterprise modules member read" ON public.enterprise_course_modules
  FOR SELECT TO authenticated
  USING (public.is_institution_member(institution_id));

DROP POLICY IF EXISTS "Enterprise modules manager write" ON public.enterprise_course_modules;
CREATE POLICY "Enterprise modules manager write" ON public.enterprise_course_modules
  FOR ALL TO authenticated
  USING (public.can_manage_institution(institution_id))
  WITH CHECK (public.can_manage_institution(institution_id));

DROP POLICY IF EXISTS "Enterprise lessons member read" ON public.enterprise_course_lessons;
CREATE POLICY "Enterprise lessons member read" ON public.enterprise_course_lessons
  FOR SELECT TO authenticated
  USING (public.is_institution_member(institution_id));

DROP POLICY IF EXISTS "Enterprise lessons manager write" ON public.enterprise_course_lessons;
CREATE POLICY "Enterprise lessons manager write" ON public.enterprise_course_lessons
  FOR ALL TO authenticated
  USING (public.can_manage_institution(institution_id))
  WITH CHECK (public.can_manage_institution(institution_id));

DROP POLICY IF EXISTS "Enterprise rotations member read" ON public.enterprise_clinical_rotations;
CREATE POLICY "Enterprise rotations member read" ON public.enterprise_clinical_rotations
  FOR SELECT TO authenticated
  USING (public.is_institution_member(institution_id));

DROP POLICY IF EXISTS "Enterprise rotations manager write" ON public.enterprise_clinical_rotations;
CREATE POLICY "Enterprise rotations manager write" ON public.enterprise_clinical_rotations
  FOR ALL TO authenticated
  USING (public.can_manage_institution(institution_id))
  WITH CHECK (public.can_manage_institution(institution_id));

DROP POLICY IF EXISTS "Enterprise paths member read" ON public.enterprise_learning_paths;
CREATE POLICY "Enterprise paths member read" ON public.enterprise_learning_paths
  FOR SELECT TO authenticated
  USING (public.is_institution_member(institution_id));

DROP POLICY IF EXISTS "Enterprise paths manager write" ON public.enterprise_learning_paths;
CREATE POLICY "Enterprise paths manager write" ON public.enterprise_learning_paths
  FOR ALL TO authenticated
  USING (public.can_manage_institution(institution_id))
  WITH CHECK (public.can_manage_institution(institution_id));

DROP POLICY IF EXISTS "Enterprise graduation member read" ON public.enterprise_graduation_requirements;
CREATE POLICY "Enterprise graduation member read" ON public.enterprise_graduation_requirements
  FOR SELECT TO authenticated
  USING (public.is_institution_member(institution_id));

DROP POLICY IF EXISTS "Enterprise graduation manager write" ON public.enterprise_graduation_requirements;
CREATE POLICY "Enterprise graduation manager write" ON public.enterprise_graduation_requirements
  FOR ALL TO authenticated
  USING (public.can_manage_institution(institution_id))
  WITH CHECK (public.can_manage_institution(institution_id));

-- Libraries: members of owning org OR approved shared/platform
DROP POLICY IF EXISTS "Enterprise libraries read" ON public.enterprise_case_libraries;
CREATE POLICY "Enterprise libraries read" ON public.enterprise_case_libraries
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR (
      institution_id IS NOT NULL
      AND public.is_institution_member(institution_id)
    )
    OR (
      visibility IN ('shared', 'platform')
      AND approval_status = 'approved'
    )
  );

DROP POLICY IF EXISTS "Enterprise libraries write" ON public.enterprise_case_libraries;
CREATE POLICY "Enterprise libraries write" ON public.enterprise_case_libraries
  FOR ALL TO authenticated
  USING (
    public.is_platform_admin()
    OR (
      institution_id IS NOT NULL
      AND public.can_manage_institution(institution_id)
    )
  )
  WITH CHECK (
    public.is_platform_admin()
    OR (
      institution_id IS NOT NULL
      AND public.can_manage_institution(institution_id)
    )
  );

DROP POLICY IF EXISTS "Enterprise library entries read" ON public.enterprise_case_library_entries;
CREATE POLICY "Enterprise library entries read" ON public.enterprise_case_library_entries
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR (
      institution_id IS NOT NULL
      AND public.is_institution_member(institution_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.enterprise_case_libraries l
      WHERE l.id = library_id
        AND l.visibility IN ('shared', 'platform')
        AND l.approval_status = 'approved'
    )
  );

DROP POLICY IF EXISTS "Enterprise library entries write" ON public.enterprise_case_library_entries;
CREATE POLICY "Enterprise library entries write" ON public.enterprise_case_library_entries
  FOR ALL TO authenticated
  USING (
    public.is_platform_admin()
    OR (
      institution_id IS NOT NULL
      AND public.can_manage_institution(institution_id)
    )
  )
  WITH CHECK (
    public.is_platform_admin()
    OR (
      institution_id IS NOT NULL
      AND public.can_manage_institution(institution_id)
    )
  );

-- Certificates: self or managers; verification_code readable by self/managers
DROP POLICY IF EXISTS "Enterprise certificates read" ON public.enterprise_certificates;
CREATE POLICY "Enterprise certificates read" ON public.enterprise_certificates
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR user_id = (select auth.uid())
    OR public.can_manage_institution(institution_id)
  );

DROP POLICY IF EXISTS "Enterprise certificates write" ON public.enterprise_certificates;
CREATE POLICY "Enterprise certificates write" ON public.enterprise_certificates
  FOR ALL TO authenticated
  USING (
    public.is_platform_admin()
    OR public.can_manage_institution(institution_id)
  )
  WITH CHECK (
    public.is_platform_admin()
    OR public.can_manage_institution(institution_id)
  );

-- Research: participating orgs
DROP POLICY IF EXISTS "Enterprise research read" ON public.enterprise_research_studies;
CREATE POLICY "Enterprise research read" ON public.enterprise_research_studies
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR public.is_institution_member(lead_institution_id)
    OR lead_institution_id = ANY (public.user_institution_ids())
    OR EXISTS (
      SELECT 1
      FROM unnest(participating_institution_ids) AS pid
      WHERE pid = ANY (public.user_institution_ids())
    )
  );

DROP POLICY IF EXISTS "Enterprise research write" ON public.enterprise_research_studies;
CREATE POLICY "Enterprise research write" ON public.enterprise_research_studies
  FOR ALL TO authenticated
  USING (
    public.is_platform_admin()
    OR public.can_manage_institution(lead_institution_id)
  )
  WITH CHECK (
    public.is_platform_admin()
    OR public.can_manage_institution(lead_institution_id)
  );

DROP POLICY IF EXISTS "Enterprise webhooks manage" ON public.enterprise_webhooks;
CREATE POLICY "Enterprise webhooks manage" ON public.enterprise_webhooks
  FOR ALL TO authenticated
  USING (
    public.is_platform_admin()
    OR public.can_manage_institution(institution_id)
  )
  WITH CHECK (
    public.is_platform_admin()
    OR public.can_manage_institution(institution_id)
  );

DROP POLICY IF EXISTS "Enterprise audit read" ON public.enterprise_audit_events;
CREATE POLICY "Enterprise audit read" ON public.enterprise_audit_events
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR (
      institution_id IS NOT NULL
      AND public.has_institution_role(
        institution_id,
        'institution_admin',
        'program_director'
      )
    )
    OR actor_user_id = (select auth.uid())
  );

DROP POLICY IF EXISTS "Enterprise audit insert" ON public.enterprise_audit_events;
CREATE POLICY "Enterprise audit insert" ON public.enterprise_audit_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin()
    OR actor_user_id = (select auth.uid())
    OR (
      institution_id IS NOT NULL
      AND public.can_manage_institution(institution_id)
    )
  );

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enterprise_campuses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enterprise_courses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enterprise_course_modules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enterprise_course_lessons TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enterprise_clinical_rotations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enterprise_learning_paths TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enterprise_graduation_requirements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enterprise_case_libraries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enterprise_case_library_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enterprise_certificates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enterprise_research_studies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enterprise_webhooks TO authenticated;
GRANT SELECT, INSERT ON public.enterprise_audit_events TO authenticated;

COMMENT ON TABLE public.enterprise_courses IS
  'Stage 10 course engine — tenant-scoped curriculum containers';
COMMENT ON TABLE public.enterprise_certificates IS
  'Stage 10 digital certificates with QR verification codes';
COMMENT ON TABLE public.enterprise_case_libraries IS
  'Stage 10 case libraries — references scenario templates; does not own Case Engine';

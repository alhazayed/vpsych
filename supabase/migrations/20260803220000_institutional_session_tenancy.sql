-- Mission 23: session tenancy + seed institution archetypes for certification.

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS institution_id uuid
    REFERENCES public.institutions (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS sessions_institution_id_idx
  ON public.sessions (institution_id)
  WHERE institution_id IS NOT NULL;

COMMENT ON COLUMN public.sessions.institution_id IS
  'Tenant scope for the training session (Mission 23 institutional isolation)';

-- Backfill from therapist primary institution when available.
UPDATE public.sessions s
SET institution_id = p.primary_institution_id
FROM public.profiles p
WHERE s.therapist_id = p.id
  AND s.institution_id IS NULL
  AND p.primary_institution_id IS NOT NULL;

-- Managers in the same institution can list peer sessions (not messages by default).
DROP POLICY IF EXISTS "Institution managers can view tenant sessions"
  ON public.sessions;
CREATE POLICY "Institution managers can view tenant sessions"
  ON public.sessions FOR SELECT
  TO authenticated
  USING (
    public.can_manage_institution(institution_id)
    OR therapist_id = auth.uid()
    OR public.is_platform_admin()
  );

-- Seed four institutional archetypes used by Mission 23 simulations.
INSERT INTO public.institutions (
  id, slug, name, legal_name, country_code, timezone, locale_default,
  sso_enabled, settings, is_active
) VALUES
  (
    'b1000000-0000-4000-8000-000000000001',
    'state-medical-university',
    'State Medical University',
    'State Medical University Board of Regents',
    'US', 'America/Chicago', 'en-US', true,
    '{"archetype":"university","mission23":true}'::jsonb, true
  ),
  (
    'b1000000-0000-4000-8000-000000000002',
    'metro-teaching-hospital',
    'Metro Teaching Hospital',
    'Metro Health System',
    'US', 'America/New_York', 'en-US', true,
    '{"archetype":"teaching_hospital","mission23":true}'::jsonb, true
  ),
  (
    'b1000000-0000-4000-8000-000000000003',
    'harbor-private-college',
    'Harbor Private College of Medicine',
    'Harbor Private College Inc.',
    'US', 'America/Los_Angeles', 'en-US', false,
    '{"archetype":"private_institution","mission23":true}'::jsonb, true
  ),
  (
    'b1000000-0000-4000-8000-000000000004',
    'national-moh-training',
    'National Ministry of Health Training Program',
    'Ministry of Health',
    'JO', 'Asia/Amman', 'ar-JO', true,
    '{"archetype":"government_program","mission23":true}'::jsonb, true
  )
ON CONFLICT (id) DO NOTHING;

-- Ensure unique slug conflict target exists (institutions.slug UNIQUE).
INSERT INTO public.departments (id, institution_id, slug, name, is_active) VALUES
  ('b1000000-0000-4000-8000-000000000011', 'b1000000-0000-4000-8000-000000000001', 'psychiatry', 'Department of Psychiatry', true),
  ('b1000000-0000-4000-8000-000000000012', 'b1000000-0000-4000-8000-000000000002', 'behavioral-health', 'Behavioral Health', true),
  ('b1000000-0000-4000-8000-000000000013', 'b1000000-0000-4000-8000-000000000003', 'clinical-skills', 'Clinical Skills Center', true),
  ('b1000000-0000-4000-8000-000000000014', 'b1000000-0000-4000-8000-000000000004', 'primary-care-training', 'Primary Care Training Directorate', true)
ON CONFLICT DO NOTHING;

INSERT INTO public.programs (id, institution_id, department_id, slug, name, degree_type, is_active) VALUES
  ('b1000000-0000-4000-8000-000000000021', 'b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000011', 'md-psychiatry-clerkship', 'Psychiatry Clerkship', 'md', true),
  ('b1000000-0000-4000-8000-000000000022', 'b1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000012', 'psychiatry-residency', 'Psychiatry Residency', 'residency', true),
  ('b1000000-0000-4000-8000-000000000023', 'b1000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000013', 'pa-behavioral', 'PA Behavioral Medicine', 'masters', true),
  ('b1000000-0000-4000-8000-000000000024', 'b1000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000014', 'gp-mental-health', 'GP Mental Health Certificate', 'certificate', true)
ON CONFLICT DO NOTHING;

INSERT INTO public.cohorts (id, institution_id, program_id, slug, name, intake_label, is_active) VALUES
  ('b1000000-0000-4000-8000-000000000051', 'b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000021', 'ms3-2026', 'MS3 Cohort 2026', '2026', true),
  ('b1000000-0000-4000-8000-000000000052', 'b1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000022', 'pgy1-2026', 'PGY-1 2026', '2026', true),
  ('b1000000-0000-4000-8000-000000000053', 'b1000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000023', 'pa2-2026', 'PA Year 2 2026', '2026', true),
  ('b1000000-0000-4000-8000-000000000054', 'b1000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000024', 'gp-batch-a', 'GP Batch A', '2026', true)
ON CONFLICT DO NOTHING;

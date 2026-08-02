-- =============================================================================
-- VPsych Instructor Preset Engine (v2.0)
-- Educators configure learning objectives; the engine selects diagnosis +
-- Clinical Scenario Template and generates a standardized patient.
-- Additive / backward compatible with Case Engine + Template Engine.
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE public.target_learner AS ENUM (
    'medical_student',
    'psychiatry_resident',
    'psychologist',
    'clinical_psychologist',
    'counselor',
    'general_practitioner',
    'family_physician',
    'emergency_physician',
    'internal_medicine_resident',
    'nurse_practitioner',
    'psychiatric_nurse',
    'social_worker',
    'occupational_therapist',
    'medical_educator',
    'osce_candidate'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.learning_level AS ENUM (
    'undergraduate', 'postgraduate', 'residency', 'fellowship', 'continuing_education'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.grading_mode AS ENUM (
    'practice', 'exam', 'certification', 'osce', 'supervisor_review', 'research'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.feedback_mode AS ENUM (
    'realtime_coaching', 'end_of_session', 'supervisor_only', 'none'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.learning_objective_key AS ENUM (
    'diagnostic_interview',
    'mental_status_examination',
    'risk_assessment',
    'suicide_assessment',
    'violence_risk_assessment',
    'differential_diagnosis',
    'medication_review',
    'medication_counseling',
    'medication_side_effects',
    'cbt_skills',
    'dbt_skills',
    'act_skills',
    'psychodynamic_interview',
    'motivational_interviewing',
    'supportive_psychotherapy',
    'trauma_assessment',
    'substance_use_assessment',
    'adhd_assessment',
    'autism_assessment',
    'personality_assessment',
    'family_assessment',
    'breaking_bad_news',
    'shared_decision_making',
    'psychoeducation',
    'treatment_planning',
    'termination_session',
    'relapse_prevention',
    'crisis_intervention',
    'emergency_psychiatry',
    'osce_examination'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Extend therapy_modality if needed
DO $$ BEGIN
  ALTER TYPE public.therapy_modality ADD VALUE IF NOT EXISTS 'medication_management';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Instructor presets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.instructor_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  specialty public.clinical_specialty NOT NULL DEFAULT 'general_adult_psychiatry',
  target_learner public.target_learner NOT NULL DEFAULT 'psychiatry_resident',
  learning_level public.learning_level NOT NULL DEFAULT 'residency',
  clinical_rotation text,
  assessment_type public.assessment_type NOT NULL DEFAULT 'initial_assessment',
  primary_objective public.learning_objective_key NOT NULL,
  difficulty public.case_difficulty NOT NULL DEFAULT 'intermediate',
  time_limit_minutes int NOT NULL DEFAULT 40
    CHECK (time_limit_minutes IN (10, 20, 30, 40, 45, 60, 90)),
  language text NOT NULL DEFAULT 'en-US',
  culture text,
  therapy_modality public.therapy_modality NOT NULL DEFAULT 'supportive',
  randomization_level public.randomization_level NOT NULL DEFAULT 'moderate',
  grading_mode public.grading_mode NOT NULL DEFAULT 'practice',
  feedback_mode public.feedback_mode NOT NULL DEFAULT 'end_of_session',
  voice_enabled boolean NOT NULL DEFAULT true,
  assessment_enabled boolean NOT NULL DEFAULT true,
  record_session boolean NOT NULL DEFAULT true,
  allow_hints boolean NOT NULL DEFAULT true,
  allow_pause boolean NOT NULL DEFAULT true,
  allow_restart boolean NOT NULL DEFAULT true,
  advanced_mode boolean NOT NULL DEFAULT false,
  -- Optional pinned template; null = engine auto-selects
  scenario_template_id uuid REFERENCES public.clinical_templates (id) ON DELETE SET NULL,
  clinical_constraints jsonb NOT NULL DEFAULT '{}'::jsonb,
  grading_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  version int NOT NULL DEFAULT 1,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE INDEX IF NOT EXISTS instructor_presets_enabled_idx
  ON public.instructor_presets (enabled) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS instructor_presets_specialty_idx
  ON public.instructor_presets (specialty);
CREATE INDEX IF NOT EXISTS instructor_presets_primary_objective_idx
  ON public.instructor_presets (primary_objective);

CREATE TABLE IF NOT EXISTS public.preset_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_id uuid NOT NULL REFERENCES public.instructor_presets (id) ON DELETE CASCADE,
  objective public.learning_objective_key NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  UNIQUE (preset_id, objective)
);

CREATE TABLE IF NOT EXISTS public.preset_competencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_id uuid NOT NULL REFERENCES public.instructor_presets (id) ON DELETE CASCADE,
  competency_id text NOT NULL,
  label text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  weight numeric NOT NULL DEFAULT 1,
  max_score numeric NOT NULL DEFAULT 5,
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.preset_constraints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_id uuid NOT NULL REFERENCES public.instructor_presets (id) ON DELETE CASCADE,
  constraint_type text NOT NULL
    CHECK (constraint_type IN (
      'allowed_disorder', 'excluded_disorder', 'min_age', 'max_age',
      'required_locale', 'forbidden_comorbidity', 'require_medical_sim'
    )),
  value text NOT NULL,
  UNIQUE (preset_id, constraint_type, value)
);

CREATE TABLE IF NOT EXISTS public.preset_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_id uuid NOT NULL REFERENCES public.instructor_presets (id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.clinical_templates (id) ON DELETE CASCADE,
  priority int NOT NULL DEFAULT 0,
  UNIQUE (preset_id, template_id)
);

CREATE TABLE IF NOT EXISTS public.preset_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_id uuid NOT NULL REFERENCES public.instructor_presets (id) ON DELETE CASCADE,
  version int NOT NULL,
  snapshot jsonb NOT NULL,
  change_notes text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (preset_id, version)
);

CREATE TABLE IF NOT EXISTS public.preset_grading (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_id uuid NOT NULL UNIQUE REFERENCES public.instructor_presets (id) ON DELETE CASCADE,
  pass_threshold numeric NOT NULL DEFAULT 60,
  outstanding_threshold numeric NOT NULL DEFAULT 85,
  critical_mistakes jsonb NOT NULL DEFAULT '[]'::jsonb,
  automatic_deductions jsonb NOT NULL DEFAULT '{}'::jsonb,
  dimensions jsonb NOT NULL DEFAULT '[]'::jsonb,
  report_sections jsonb NOT NULL DEFAULT '["score","strengths","weaknesses","missed_opportunities","recommendations"]'::jsonb
);

-- Link generated cases to presets
ALTER TABLE public.case_instances
  ADD COLUMN IF NOT EXISTS instructor_preset_id uuid
    REFERENCES public.instructor_presets (id) ON DELETE SET NULL;
ALTER TABLE public.case_instances
  ADD COLUMN IF NOT EXISTS instructor_preset_version int;

CREATE INDEX IF NOT EXISTS case_instances_instructor_preset_id_idx
  ON public.case_instances (instructor_preset_id);

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS instructor_preset_id uuid
    REFERENCES public.instructor_presets (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Seed presets
-- ---------------------------------------------------------------------------
INSERT INTO public.instructor_presets (
  id, slug, name, description, specialty, target_learner, learning_level,
  clinical_rotation, assessment_type, primary_objective, difficulty,
  time_limit_minutes, language, culture, therapy_modality, randomization_level,
  grading_mode, feedback_mode, voice_enabled, assessment_enabled,
  allow_hints, scenario_template_id, enabled, version
) VALUES
(
  'f1000000-0000-4000-8000-000000000001',
  'suicide-risk-resident-en',
  'Suicide Risk Assessment — Psychiatry Resident',
  'Practice calm, specific suicide risk assessment. Engine selects an appropriate diagnosis automatically.',
  'general_adult_psychiatry', 'psychiatry_resident', 'residency',
  'acute_care', 'risk_assessment', 'suicide_assessment', 'intermediate',
  30, 'en-US', 'north_american_urban', 'crisis_intervention', 'moderate',
  'practice', 'realtime_coaching', true, true,
  true, 'e1000000-0000-4000-8000-000000000003', true, 1
),
(
  'f1000000-0000-4000-8000-000000000002',
  'osce-diagnostic-interview-ar',
  'OSCE Diagnostic Interview — Arabic',
  'Timed OSCE station. Engine selects diagnosis from interview objectives; no hints.',
  'general_adult_psychiatry', 'osce_candidate', 'undergraduate',
  'osce', 'osce_examination', 'osce_examination', 'advanced',
  20, 'ar-JO', 'levantine_arabic', 'cbt', 'low',
  'osce', 'none', true, true,
  false, 'e1000000-0000-4000-8000-000000000002', true, 1
),
(
  'f1000000-0000-4000-8000-000000000003',
  'cbt-skills-gp-en',
  'CBT Skills — General Practitioner',
  'Primary-care mental health CBT skills practice with auto-selected mood/anxiety case.',
  'primary_care_mental_health', 'general_practitioner', 'continuing_education',
  'primary_care', 'cbt_session', 'cbt_skills', 'beginner',
  45, 'en-US', 'north_american_urban', 'cbt', 'moderate',
  'practice', 'end_of_session', true, true,
  true, 'e1000000-0000-4000-8000-000000000001', true, 1
)
ON CONFLICT (slug) DO UPDATE SET
  description = EXCLUDED.description,
  updated_at = now();

INSERT INTO public.preset_objectives (preset_id, objective, is_primary, sort_order) VALUES
  ('f1000000-0000-4000-8000-000000000001', 'suicide_assessment', true, 1),
  ('f1000000-0000-4000-8000-000000000001', 'risk_assessment', false, 2),
  ('f1000000-0000-4000-8000-000000000001', 'diagnostic_interview', false, 3),
  ('f1000000-0000-4000-8000-000000000001', 'crisis_intervention', false, 4),
  ('f1000000-0000-4000-8000-000000000002', 'osce_examination', true, 1),
  ('f1000000-0000-4000-8000-000000000002', 'diagnostic_interview', false, 2),
  ('f1000000-0000-4000-8000-000000000002', 'mental_status_examination', false, 3),
  ('f1000000-0000-4000-8000-000000000003', 'cbt_skills', true, 1),
  ('f1000000-0000-4000-8000-000000000003', 'psychoeducation', false, 2),
  ('f1000000-0000-4000-8000-000000000003', 'treatment_planning', false, 3)
ON CONFLICT DO NOTHING;

INSERT INTO public.preset_competencies (preset_id, competency_id, label, required, weight, max_score, sort_order) VALUES
  ('f1000000-0000-4000-8000-000000000001', 'safety', 'Safety assessment', true, 2, 5, 1),
  ('f1000000-0000-4000-8000-000000000001', 'alliance', 'Therapeutic alliance', true, 1.2, 5, 2),
  ('f1000000-0000-4000-8000-000000000001', 'empathy', 'Empathy', true, 1, 5, 3),
  ('f1000000-0000-4000-8000-000000000001', 'documentation', 'Documentation', false, 0.8, 5, 4),
  ('f1000000-0000-4000-8000-000000000002', 'communication', 'Communication', true, 1.5, 5, 1),
  ('f1000000-0000-4000-8000-000000000002', 'mse', 'Mental status exam', true, 1.2, 5, 2),
  ('f1000000-0000-4000-8000-000000000002', 'time', 'Time management', true, 1, 5, 3),
  ('f1000000-0000-4000-8000-000000000003', 'cbt_structure', 'CBT structure', true, 1.5, 5, 1),
  ('f1000000-0000-4000-8000-000000000003', 'alliance', 'Alliance', true, 1, 5, 2)
ON CONFLICT DO NOTHING;

INSERT INTO public.preset_templates (preset_id, template_id, priority) VALUES
  ('f1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000003', 10),
  ('f1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 5),
  ('f1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000002', 10),
  ('f1000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000001', 10)
ON CONFLICT DO NOTHING;

INSERT INTO public.preset_grading (preset_id, pass_threshold, outstanding_threshold, critical_mistakes, dimensions) VALUES
  (
    'f1000000-0000-4000-8000-000000000001', 70, 90,
    '["missed_si","forced_trauma_disclosure","no_safety_plan"]'::jsonb,
    '["diagnostic_accuracy","dsm_reasoning","communication","empathy","therapeutic_alliance","risk_assessment","safety_planning","documentation","professionalism","time_management"]'::jsonb
  ),
  (
    'f1000000-0000-4000-8000-000000000002', 65, 90,
    '["locale_leakage","incomplete_mse"]'::jsonb,
    '["communication","diagnostic_accuracy","mental_status","time_management","professionalism"]'::jsonb
  ),
  (
    'f1000000-0000-4000-8000-000000000003', 60, 85,
    '["advice_before_agenda","ignored_homework_barriers"]'::jsonb,
    '["cbt_skills","communication","treatment_planning","psychoeducation","alliance"]'::jsonb
  )
ON CONFLICT (preset_id) DO NOTHING;

INSERT INTO public.preset_versions (preset_id, version, snapshot, change_notes)
SELECT id, version, to_jsonb(instructor_presets.*) || jsonb_build_object('seed', true), 'Initial seeded preset'
FROM public.instructor_presets
WHERE slug IN (
  'suicide-risk-resident-en',
  'osce-diagnostic-interview-ar',
  'cbt-skills-gp-en'
)
ON CONFLICT (preset_id, version) DO NOTHING;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.instructor_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preset_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preset_competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preset_constraints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preset_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preset_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preset_grading ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read enabled presets" ON public.instructor_presets;
CREATE POLICY "Authenticated read enabled presets" ON public.instructor_presets
  FOR SELECT TO authenticated
  USING (enabled = true OR EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
  ));

DROP POLICY IF EXISTS "Admin write presets" ON public.instructor_presets;
CREATE POLICY "Admin write presets" ON public.instructor_presets
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Authenticated read preset_objectives" ON public.preset_objectives;
CREATE POLICY "Authenticated read preset_objectives" ON public.preset_objectives
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin write preset_objectives" ON public.preset_objectives;
CREATE POLICY "Admin write preset_objectives" ON public.preset_objectives
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Authenticated read preset_competencies" ON public.preset_competencies;
CREATE POLICY "Authenticated read preset_competencies" ON public.preset_competencies
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin write preset_competencies" ON public.preset_competencies;
CREATE POLICY "Admin write preset_competencies" ON public.preset_competencies
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Authenticated read preset_constraints" ON public.preset_constraints;
CREATE POLICY "Authenticated read preset_constraints" ON public.preset_constraints
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin write preset_constraints" ON public.preset_constraints;
CREATE POLICY "Admin write preset_constraints" ON public.preset_constraints
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Authenticated read preset_templates" ON public.preset_templates;
CREATE POLICY "Authenticated read preset_templates" ON public.preset_templates
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin write preset_templates" ON public.preset_templates;
CREATE POLICY "Admin write preset_templates" ON public.preset_templates
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Authenticated read preset_versions" ON public.preset_versions;
CREATE POLICY "Authenticated read preset_versions" ON public.preset_versions
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin write preset_versions" ON public.preset_versions;
CREATE POLICY "Admin write preset_versions" ON public.preset_versions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Authenticated read preset_grading" ON public.preset_grading;
CREATE POLICY "Authenticated read preset_grading" ON public.preset_grading
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin write preset_grading" ON public.preset_grading;
CREATE POLICY "Admin write preset_grading" ON public.preset_grading
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

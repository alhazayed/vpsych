-- Canonical migration recovered for Release Configuration Board reconciliation.
-- Source: production supabase_migrations.schema_migrations statements
-- (enriched only when production statements were empty/placeholder).

DO $$ BEGIN
  CREATE TYPE public.ace_training_level AS ENUM (
    'undergraduate', 'postgraduate', 'residency', 'fellowship',
    'continuing_education', 'certification_track'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.ace_profession AS ENUM (
    'medical_student', 'psychiatry_resident', 'psychologist',
    'clinical_psychologist', 'counselor', 'general_practitioner',
    'family_physician', 'emergency_physician', 'internal_medicine_resident',
    'nurse_practitioner', 'psychiatric_nurse', 'social_worker',
    'occupational_therapist', 'medical_educator', 'osce_candidate', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.ace_curriculum_mode AS ENUM (
    'automatic', 'manual', 'hybrid'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.ace_certification_status AS ENUM (
    'not_started', 'in_progress', 'eligible', 'certified', 'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.competency_domains (
  id text PRIMARY KEY,
  label text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'clinical',
  sort_order int NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.adaptive_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  trigger_competency_id text NOT NULL REFERENCES public.competency_domains (id),
  trigger_operator text NOT NULL DEFAULT 'lt'
    CHECK (trigger_operator IN ('lt', 'lte', 'gt', 'gte', 'between')),
  trigger_threshold numeric NOT NULL DEFAULT 70,
  trigger_threshold_high numeric,
  adaptation jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority int NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.learner_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles (id) ON DELETE CASCADE,
  training_level public.ace_training_level NOT NULL DEFAULT 'residency',
  profession public.ace_profession NOT NULL DEFAULT 'psychiatry_resident',
  institution text,
  language text NOT NULL DEFAULT 'en-US',
  preferred_therapy_models text[] NOT NULL DEFAULT '{}',
  adaptive_mode boolean NOT NULL DEFAULT true,
  curriculum_mode public.ace_curriculum_mode NOT NULL DEFAULT 'automatic',
  min_competency_threshold numeric NOT NULL DEFAULT 70,
  max_difficulty text NOT NULL DEFAULT 'expert'
    CHECK (max_difficulty IN ('beginner', 'intermediate', 'advanced', 'expert')),
  locked_diagnoses text[] NOT NULL DEFAULT '{}',
  locked_objectives text[] NOT NULL DEFAULT '{}',
  required_competencies text[] NOT NULL DEFAULT '{}',
  optional_competencies text[] NOT NULL DEFAULT '{}',
  completed_case_count int NOT NULL DEFAULT 0,
  learning_velocity numeric NOT NULL DEFAULT 0,
  confidence_score numeric NOT NULL DEFAULT 50,
  certification_status public.ace_certification_status NOT NULL DEFAULT 'not_started',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS learner_profiles_institution_idx ON public.learner_profiles (institution);
CREATE INDEX IF NOT EXISTS learner_profiles_adaptive_mode_idx ON public.learner_profiles (adaptive_mode) WHERE adaptive_mode = true;

CREATE TABLE IF NOT EXISTS public.learner_competencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES public.learner_profiles (id) ON DELETE CASCADE,
  competency_id text NOT NULL REFERENCES public.competency_domains (id),
  score numeric NOT NULL DEFAULT 50 CHECK (score >= 0 AND score <= 100),
  samples int NOT NULL DEFAULT 0,
  trend numeric NOT NULL DEFAULT 0,
  last_assessed_at timestamptz,
  mastered_at timestamptz,
  UNIQUE (learner_id, competency_id)
);

CREATE INDEX IF NOT EXISTS learner_competencies_score_idx ON public.learner_competencies (learner_id, score);

CREATE TABLE IF NOT EXISTS public.competency_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES public.learner_profiles (id) ON DELETE CASCADE,
  competency_id text NOT NULL REFERENCES public.competency_domains (id),
  session_id uuid REFERENCES public.sessions (id) ON DELETE SET NULL,
  score numeric NOT NULL CHECK (score >= 0 AND score <= 100),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS competency_scores_learner_created_idx ON public.competency_scores (learner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.learning_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES public.learner_profiles (id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  focus_competency_id text REFERENCES public.competency_domains (id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'archived')),
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  current_step int NOT NULL DEFAULT 0,
  instructor_preset_id uuid REFERENCES public.instructor_presets (id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS learning_paths_learner_status_idx ON public.learning_paths (learner_id, status);

CREATE TABLE IF NOT EXISTS public.curriculum_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_path_id uuid NOT NULL REFERENCES public.learning_paths (id) ON DELETE CASCADE,
  step_index int NOT NULL,
  session_id uuid REFERENCES public.sessions (id) ON DELETE SET NULL,
  case_instance_id uuid REFERENCES public.case_instances (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  outcome jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  UNIQUE (learning_path_id, step_index)
);

CREATE TABLE IF NOT EXISTS public.adaptive_case_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES public.learner_profiles (id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.sessions (id) ON DELETE SET NULL,
  case_instance_id uuid REFERENCES public.case_instances (id) ON DELETE SET NULL,
  focus_competencies text[] NOT NULL DEFAULT '{}',
  adaptation jsonb NOT NULL DEFAULT '{}'::jsonb,
  diagnosis_slug text,
  difficulty text,
  fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS adaptive_case_history_fingerprint_idx ON public.adaptive_case_history (learner_id, fingerprint);
CREATE INDEX IF NOT EXISTS adaptive_case_history_learner_idx ON public.adaptive_case_history (learner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.performance_trends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES public.learner_profiles (id) ON DELETE CASCADE,
  window_label text NOT NULL DEFAULT 'rolling_10',
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (learner_id, window_label)
);

CREATE TABLE IF NOT EXISTS public.certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES public.learner_profiles (id) ON DELETE CASCADE,
  badge_slug text NOT NULL,
  title text NOT NULL,
  competency_id text REFERENCES public.competency_domains (id),
  status public.ace_certification_status NOT NULL DEFAULT 'in_progress',
  awarded_at timestamptz,
  expires_at timestamptz,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (learner_id, badge_slug)
);

CREATE TABLE IF NOT EXISTS public.coach_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES public.learner_profiles (id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.sessions (id) ON DELETE SET NULL,
  supervisor_feedback text NOT NULL,
  reflective_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  missed_opportunities jsonb NOT NULL DEFAULT '[]'::jsonb,
  suggested_reading jsonb NOT NULL DEFAULT '[]'::jsonb,
  suggested_next_cases jsonb NOT NULL DEFAULT '[]'::jsonb,
  learning_goals jsonb NOT NULL DEFAULT '[]'::jsonb,
  improvement_plan text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coach_feedback_learner_idx ON public.coach_feedback (learner_id, created_at DESC);

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS learner_profile_id uuid REFERENCES public.learner_profiles (id) ON DELETE SET NULL;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS adaptive_focus text[];

-- Restored seed data omitted from production statements but present in live DB
-- (was part of the consolidated ACE migration applied out-of-band / split incompletely).
-- Required for greenfield parity; idempotent ON CONFLICT.

INSERT INTO public.competency_domains (id, label, description, category, sort_order) VALUES
  ('diagnostic_interview', 'Diagnostic Interview', 'Structured psychiatric interview', 'assessment', 10),
  ('mental_status_examination', 'Mental Status Examination', 'MSE completeness and accuracy', 'assessment', 20),
  ('dsm5_reasoning', 'DSM-5 Diagnostic Reasoning', 'Apply DSM-5 criteria', 'diagnosis', 30),
  ('icd11_reasoning', 'ICD-11 Diagnostic Reasoning', 'Apply ICD-11 criteria', 'diagnosis', 40),
  ('differential_diagnosis', 'Differential Diagnosis', 'Generate and rule out differentials', 'diagnosis', 50),
  ('risk_assessment', 'Risk Assessment', 'General risk formulation', 'safety', 60),
  ('suicide_assessment', 'Suicide Assessment', 'SI inquiry and safety planning', 'safety', 70),
  ('violence_assessment', 'Violence Assessment', 'Violence / harm-to-others assessment', 'safety', 80),
  ('medication_management', 'Medication Management', 'Psychopharmacology decisions', 'treatment', 90),
  ('cbt_skills', 'CBT Skills', 'Cognitive behavioural interventions', 'therapy', 100),
  ('dbt_skills', 'DBT Skills', 'Dialectical behaviour skills', 'therapy', 110),
  ('act_skills', 'ACT Skills', 'Acceptance and commitment therapy', 'therapy', 120),
  ('motivational_interviewing', 'Motivational Interviewing', 'MI spirit and techniques', 'therapy', 130),
  ('psychodynamic_interviewing', 'Psychodynamic Interviewing', 'Psychodynamic formulation skills', 'therapy', 140),
  ('supportive_therapy', 'Supportive Therapy', 'Supportive psychotherapy skills', 'therapy', 150),
  ('therapeutic_alliance', 'Therapeutic Alliance', 'Collaborative working alliance', 'alliance', 160),
  ('empathy', 'Empathy', 'Empathic communication', 'alliance', 170),
  ('psychoeducation', 'Psychoeducation', 'Patient education', 'treatment', 180),
  ('treatment_planning', 'Treatment Planning', 'Collaborative treatment plans', 'treatment', 190),
  ('documentation', 'Documentation', 'Clinical documentation quality', 'professional', 200),
  ('professional_communication', 'Professional Communication', 'Clear professional communication', 'professional', 210),
  ('time_management', 'Time Management', 'Station / session time use', 'professional', 220),
  ('ethical_decision_making', 'Ethical Decision Making', 'Ethics and professionalism', 'professional', 230),
  ('cultural_competence', 'Cultural Competence', 'Culturally responsive care', 'professional', 240),
  ('family_interviewing', 'Family Interviewing', 'Family / systems assessment', 'assessment', 250),
  ('emergency_psychiatry', 'Emergency Psychiatry', 'Acute / emergency psychiatry', 'safety', 260)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.adaptive_rules (slug, name, description, trigger_competency_id, trigger_operator, trigger_threshold, adaptation, priority) VALUES
(
  'remediate-suicide-assessment',
  'Remediate suicide assessment',
  'When suicide assessment is weak, generate subtle SI / risk-focused cases',
  'suicide_assessment', 'lt', 70,
  '{"focus":["suicide_assessment","risk_assessment"],"diagnosis_pool":["mdd-recurrent-moderate","bpd","ptsd","alcohol-use-disorder"],"si_styles":["passive","indirect_hopelessness","hidden_protective","variable_risk"],"difficulty_delta":0,"reduce_unrelated_complexity":true,"preset_slugs":["suicide-risk-resident-en"]}'::jsonb,
  100
),
(
  'remediate-differential',
  'Remediate differential diagnosis',
  'When differential is weak but CBT strong, increase diagnostic ambiguity only',
  'differential_diagnosis', 'lt', 60,
  '{"focus":["differential_diagnosis","dsm5_reasoning"],"require_high":[{"competency":"cbt_skills","min":90}],"diagnosis_pool":["mdd-recurrent-moderate","gad-with-panic","bipolar-mania","adult-adhd"],"adaptations":["diagnostic_ambiguity","mixed_presentation","comorbidity","medical_mimic"],"hold_therapy_complexity":true,"difficulty_delta":0}'::jsonb,
  90
),
(
  'accelerate-on-improvement',
  'Accelerate on sustained improvement',
  'Raise resistance, uncertainty, comorbidity, masking, time pressure when improving',
  'diagnostic_interview', 'gte', 75,
  '{"require_velocity_min":0.5,"increase":["resistance","diagnostic_uncertainty","comorbidity","masking","time_pressure","limited_disclosure"],"difficulty_delta":1}'::jsonb,
  40
),
(
  'scaffold-on-failure',
  'Scaffold on repeated failure',
  'Reduce complexity and increase educational feedback when failing',
  'diagnostic_interview', 'lt', 50,
  '{"reduce":["complexity","comorbidity","resistance","time_pressure"],"feedback_mode":"realtime_coaching","difficulty_delta":-1,"allow_hints":true}'::jsonb,
  80
)
ON CONFLICT (slug) DO UPDATE SET
  adaptation = EXCLUDED.adaptation,
  trigger_threshold = EXCLUDED.trigger_threshold,
  enabled = true;

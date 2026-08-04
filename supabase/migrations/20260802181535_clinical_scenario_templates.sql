-- Canonical migration recovered for Release Configuration Board reconciliation.
-- Source: production supabase_migrations.schema_migrations statements
-- (enriched only when production statements were empty/placeholder).

-- =============================================================================
-- VPsych Clinical Scenario Template Engine (v2.0)
-- Additive layer on Dynamic Clinical Case Engine.
-- Instructors author templates; the engine generates standardized patients.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.clinical_specialty AS ENUM (
    'general_adult_psychiatry',
    'child_psychiatry',
    'addiction_psychiatry',
    'consultation_liaison_psychiatry',
    'geriatric_psychiatry',
    'forensic_psychiatry',
    'primary_care_mental_health',
    'clinical_psychology',
    'counselling',
    'social_work',
    'emergency_psychiatry'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.assessment_type AS ENUM (
    'initial_assessment',
    'follow_up',
    'risk_assessment',
    'medication_review',
    'cbt_session',
    'dbt_session',
    'psychodynamic_session',
    'crisis_intervention',
    'family_session',
    'termination_session',
    'osce_examination'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.template_severity AS ENUM (
    'minimal', 'mild', 'moderate', 'severe', 'very_severe'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.risk_level AS ENUM (
    'none', 'low', 'moderate', 'high', 'imminent'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.randomization_level AS ENUM (
    'none', 'low', 'moderate', 'high'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.memory_mode AS ENUM (
    'case_isolated', 'longitudinal'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.comorbidity_tier AS ENUM (
    'compatible', 'possible', 'rare', 'impossible'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Extend therapy_modality with exposure_therapy if missing
DO $$ BEGIN
  ALTER TYPE public.therapy_modality ADD VALUE IF NOT EXISTS 'exposure_therapy';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Comorbidity tier on existing rules
ALTER TABLE public.comorbidity_rules
  ADD COLUMN IF NOT EXISTS tier public.comorbidity_tier NOT NULL DEFAULT 'compatible';

UPDATE public.comorbidity_rules
SET tier = CASE WHEN compatible THEN 'compatible'::public.comorbidity_tier
                ELSE 'impossible'::public.comorbidity_tier END
WHERE tier IS DISTINCT FROM CASE WHEN compatible THEN 'compatible'::public.comorbidity_tier
                                 ELSE 'impossible'::public.comorbidity_tier END;

-- ---------------------------------------------------------------------------
-- Expand disorder catalog (unlimited future disorders via inserts)
-- ---------------------------------------------------------------------------
INSERT INTO public.disorders (
  id, slug, name, dsm5_code, icd10_code, icd11_code, category,
  min_age, max_age, allowed_genders, package, is_active
) VALUES
(
  'd1000000-0000-4000-8000-000000000006', 'pdd',
  'Persistent Depressive Disorder (Dysthymia)',
  '300.4', 'F34.1', '6A71.0', 'mood', 14, 90,
  ARRAY['female','male','non-binary','unspecified']::text[],
  '{"severity_default":"mild","session_goals":["Map chronic course","Differentiate from MDD episode"],"ideal_approach":"Supportive CBT; validate chronicity.","risk_defaults":{"suicidal_ideation":"none"},"symptom_profile":[{"id":"chronic_low_mood","description":"Depressed mood for most of the day for ≥2 years","domain":"mood","salience":"presenting"}],"disclosure_rules":[{"topic":"chronic low mood","condition":"volunteered"}]}'::jsonb, true
),
(
  'd1000000-0000-4000-8000-000000000007', 'panic-disorder',
  'Panic Disorder',
  '300.01', 'F41.0', '6B01', 'anxiety', 16, 90,
  ARRAY['female','male','non-binary','unspecified']::text[],
  '{"severity_default":"moderate","session_goals":["Map panic phenomenology","Identify avoidance"],"ideal_approach":"CBT with interoceptive exposure readiness.","risk_defaults":{"suicidal_ideation":"none"},"symptom_profile":[{"id":"panic_attacks","description":"Recurrent unexpected panic attacks","domain":"anxiety","salience":"presenting"}],"disclosure_rules":[{"topic":"panic attack details","condition":"on_direct_question"}]}'::jsonb, true
),
(
  'd1000000-0000-4000-8000-000000000008', 'social-anxiety',
  'Social Anxiety Disorder',
  '300.23', 'F40.10', '6B04', 'anxiety', 12, 90,
  ARRAY['female','male','non-binary','unspecified']::text[],
  '{"severity_default":"moderate","session_goals":["Map feared situations","Assess avoidance"],"ideal_approach":"Collaborative CBT; graded exposure framing.","risk_defaults":{"suicidal_ideation":"none"},"symptom_profile":[{"id":"social_fear","description":"Fear of negative evaluation in social situations","domain":"anxiety","salience":"presenting"}],"disclosure_rules":[{"topic":"social avoidance","condition":"on_empathic_rapport"}]}'::jsonb, true
),
(
  'd1000000-0000-4000-8000-000000000009', 'ocd',
  'Obsessive-Compulsive Disorder',
  '300.3', 'F42', '6B20', 'anxiety', 10, 90,
  ARRAY['female','male','non-binary','unspecified']::text[],
  '{"severity_default":"moderate","session_goals":["Map obsessions/compulsions","Assess insight"],"ideal_approach":"ERP-informed assessment; avoid reassurance loops.","risk_defaults":{"suicidal_ideation":"none"},"symptom_profile":[{"id":"obsessions","description":"Intrusive unwanted thoughts","domain":"cognition","salience":"hidden"},{"id":"compulsions","description":"Repetitive behaviours to reduce distress","domain":"behavioral","salience":"elicited"}],"disclosure_rules":[{"topic":"content of obsessions","condition":"on_empathic_rapport"}]}'::jsonb, true
),
(
  'd1000000-0000-4000-8000-00000000000a', 'complex-ptsd',
  'Complex PTSD',
  '309.81', 'F43.1', '6B41', 'trauma', 16, 90,
  ARRAY['female','male','non-binary','unspecified']::text[],
  '{"severity_default":"severe","session_goals":["Safety first","Map affect dysregulation"],"ideal_approach":"Trauma-informed; phase-based; no flooding.","risk_defaults":{"suicidal_ideation":"passive"},"symptom_profile":[{"id":"affect_dysregulation","description":"Persistent affect dysregulation","domain":"mood","salience":"elicited"},{"id":"negative_self","description":"Persistent negative self-concept","domain":"cognition","salience":"hidden"}],"disclosure_rules":[{"topic":"trauma narrative","condition":"on_empathic_rapport"}]}'::jsonb, true
),
(
  'd1000000-0000-4000-8000-00000000000b', 'bpd',
  'Borderline Personality Disorder',
  '301.83', 'F60.3', '6D10.0', 'personality', 18, 65,
  ARRAY['female','male','non-binary','unspecified']::text[],
  '{"severity_default":"moderate","session_goals":["Assess identity disturbance","Safety plan","Validate then structure"],"ideal_approach":"DBT-informed; validation before change.","risk_defaults":{"suicidal_ideation":"passive","self_harm":true},"symptom_profile":[{"id":"affective_instability","description":"Marked affective instability","domain":"mood","salience":"presenting"},{"id":"fear_abandonment","description":"Frantic efforts to avoid abandonment","domain":"social","salience":"hidden"}],"disclosure_rules":[{"topic":"self-harm","condition":"on_safety_assessment"}]}'::jsonb, true
),
(
  'd1000000-0000-4000-8000-00000000000c', 'asd',
  'Autism Spectrum Disorder',
  '299.00', 'F84.0', '6A02', 'neurodevelopmental', 5, 90,
  ARRAY['female','male','non-binary','unspecified']::text[],
  '{"severity_default":"moderate","session_goals":["Developmental history","Sensory/social profile"],"ideal_approach":"Concrete language; reduce figurative overload.","risk_defaults":{"suicidal_ideation":"none"},"symptom_profile":[{"id":"social_communication","description":"Social communication differences","domain":"social","salience":"presenting"}],"disclosure_rules":[{"topic":"sensory overload","condition":"on_direct_question"}]}'::jsonb, true
),
(
  'd1000000-0000-4000-8000-00000000000d', 'schizophrenia',
  'Schizophrenia',
  '295.90', 'F20.9', '6A20', 'psychotic', 16, 65,
  ARRAY['female','male','non-binary','unspecified']::text[],
  '{"severity_default":"moderate","session_goals":["Assess psychosis","Risk","Function"],"ideal_approach":"Supportive; reality-testing without confrontation.","risk_defaults":{"suicidal_ideation":"passive"},"symptom_profile":[{"id":"delusions","description":"Delusional beliefs","domain":"psychotic","salience":"elicited"},{"id":"hallucinations","description":"Perceptual disturbances","domain":"psychotic","salience":"hidden"}],"disclosure_rules":[{"topic":"voices/content","condition":"on_direct_question"}]}'::jsonb, true
),
(
  'd1000000-0000-4000-8000-00000000000e', 'schizoaffective',
  'Schizoaffective Disorder',
  '295.70', 'F25.9', '6A21', 'psychotic', 16, 65,
  ARRAY['female','male','non-binary','unspecified']::text[],
  '{"severity_default":"moderate","session_goals":["Map mood vs psychosis timeline","Risk"],"ideal_approach":"Supportive structured assessment.","risk_defaults":{"suicidal_ideation":"passive"},"symptom_profile":[{"id":"mood_episode_with_psychosis","description":"Major mood episode concurrent with psychotic symptoms","domain":"mood","salience":"presenting"}],"disclosure_rules":[{"topic":"mood episode timing","condition":"on_direct_question"}]}'::jsonb, true
),
(
  'd1000000-0000-4000-8000-00000000000f', 'bipolar-mania',
  'Bipolar I Disorder, current manic episode',
  '296.44', 'F31.2', '6A60.1', 'mood', 16, 70,
  ARRAY['female','male','non-binary','unspecified']::text[],
  '{"severity_default":"severe","session_goals":["Assess mania","Risk to self/others","Sleep"],"ideal_approach":"Containment; brief questions; safety first.","risk_defaults":{"suicidal_ideation":"none","harm_to_others":false},"symptom_profile":[{"id":"elevated_mood","description":"Elevated/irritable mood with increased energy","domain":"mood","salience":"presenting"},{"id":"decreased_sleep_need","description":"Decreased need for sleep","domain":"sleep","salience":"elicited"}],"disclosure_rules":[{"topic":"spending/impulsivity","condition":"on_direct_question"}]}'::jsonb, true
),
(
  'd1000000-0000-4000-8000-000000000010', 'eating-disorders',
  'Anorexia Nervosa / Eating Disorder spectrum',
  '307.1', 'F50.0', '6B80', 'eating', 12, 60,
  ARRAY['female','male','non-binary','unspecified']::text[],
  '{"severity_default":"moderate","session_goals":["Medical safety screen","Map eating behaviours"],"ideal_approach":"Non-collusive; collaborative; medical risk aware.","risk_defaults":{"suicidal_ideation":"none"},"symptom_profile":[{"id":"restriction","description":"Energy intake restriction / body image disturbance","domain":"somatic","salience":"hidden"}],"disclosure_rules":[{"topic":"weight/shape concerns","condition":"on_empathic_rapport"}]}'::jsonb, true
),
(
  'd1000000-0000-4000-8000-000000000011', 'delirium',
  'Delirium',
  '293.0', 'F05', '6D70', 'medical', 18, 120,
  ARRAY['female','male','non-binary','unspecified']::text[],
  '{"severity_default":"severe","session_goals":["Medical workup framing","Fluctuating cognition"],"ideal_approach":"Medical simulation only when template allows.","risk_defaults":{"suicidal_ideation":"none"},"symptom_profile":[{"id":"fluctuating_attention","description":"Acute fluctuating disturbance of attention","domain":"cognition","salience":"presenting"}],"disclosure_rules":[{"topic":"orientation","condition":"volunteered"}]}'::jsonb, true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  dsm5_code = EXCLUDED.dsm5_code,
  icd11_code = EXCLUDED.icd11_code,
  package = EXCLUDED.package,
  is_active = EXCLUDED.is_active;

-- Comorbidity rules with tiers
INSERT INTO public.comorbidity_rules (
  primary_disorder_id, comorbid_disorder_id, compatible, tier, notes
) VALUES
  -- MDD pairs
  ('d1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000007', true, 'compatible', 'MDD + Panic'),
  ('d1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000008', true, 'compatible', 'MDD + Social Anxiety'),
  ('d1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000009', true, 'possible', 'MDD + OCD'),
  ('d1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-00000000000b', true, 'possible', 'MDD + BPD'),
  ('d1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-00000000000f', false, 'impossible', 'MDD × Bipolar mania — reject unless bipolar primary'),
  -- Schizophrenia
  ('d1000000-0000-4000-8000-00000000000d','d1000000-0000-4000-8000-000000000002', true, 'compatible', 'Schizophrenia + GAD allowed'),
  ('d1000000-0000-4000-8000-00000000000d','d1000000-0000-4000-8000-000000000011', false, 'impossible', 'Schizophrenia × Delirium — only medical simulation templates'),
  ('d1000000-0000-4000-8000-00000000000d','d1000000-0000-4000-8000-000000000001', true, 'possible', 'Schizophrenia + depressive features'),
  -- PTSD / Complex PTSD
  ('d1000000-0000-4000-8000-000000000003','d1000000-0000-4000-8000-00000000000b', true, 'possible', 'PTSD + BPD'),
  ('d1000000-0000-4000-8000-00000000000a','d1000000-0000-4000-8000-000000000001', true, 'compatible', 'Complex PTSD + MDD'),
  ('d1000000-0000-4000-8000-00000000000a','d1000000-0000-4000-8000-000000000005', true, 'possible', 'Complex PTSD + AUD'),
  -- ADHD
  ('d1000000-0000-4000-8000-000000000004','d1000000-0000-4000-8000-000000000001', true, 'compatible', 'ADHD + MDD'),
  ('d1000000-0000-4000-8000-000000000004','d1000000-0000-4000-8000-000000000008', true, 'possible', 'ADHD + Social Anxiety'),
  -- BPD
  ('d1000000-0000-4000-8000-00000000000b','d1000000-0000-4000-8000-000000000001', true, 'compatible', 'BPD + MDD'),
  ('d1000000-0000-4000-8000-00000000000b','d1000000-0000-4000-8000-000000000003', true, 'possible', 'BPD + PTSD'),
  ('d1000000-0000-4000-8000-00000000000b','d1000000-0000-4000-8000-000000000005', true, 'possible', 'BPD + AUD'),
  -- Eating
  ('d1000000-0000-4000-8000-000000000010','d1000000-0000-4000-8000-000000000001', true, 'compatible', 'Eating disorder + MDD'),
  ('d1000000-0000-4000-8000-000000000010','d1000000-0000-4000-8000-000000000002', true, 'possible', 'Eating disorder + GAD'),
  -- Bipolar mania cannot pair with unipolar MDD as comorbidity framing
  ('d1000000-0000-4000-8000-00000000000f','d1000000-0000-4000-8000-000000000001', false, 'impossible', 'Mania × unipolar MDD comorbidity framing rejected')
ON CONFLICT (primary_disorder_id, comorbid_disorder_id) DO UPDATE SET
  compatible = EXCLUDED.compatible,
  tier = EXCLUDED.tier,
  notes = EXCLUDED.notes;

-- ---------------------------------------------------------------------------
-- Clinical Scenario Templates
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clinical_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  specialty public.clinical_specialty NOT NULL DEFAULT 'general_adult_psychiatry',
  target_learners text[] NOT NULL DEFAULT '{}'::text[],
  estimated_duration_minutes int NOT NULL DEFAULT 40,
  difficulty public.case_difficulty NOT NULL DEFAULT 'intermediate',
  language text NOT NULL DEFAULT 'en-US',
  culture text,
  therapy_modality public.therapy_modality NOT NULL DEFAULT 'supportive',
  primary_diagnosis_id uuid NOT NULL REFERENCES public.disorders (id) ON DELETE RESTRICT,
  severity public.template_severity NOT NULL DEFAULT 'moderate',
  risk_level public.risk_level NOT NULL DEFAULT 'low',
  assessment_type public.assessment_type NOT NULL DEFAULT 'initial_assessment',
  voice_profile_id uuid REFERENCES public.voice_profiles (id) ON DELETE SET NULL,
  default_persona_id uuid REFERENCES public.personas (id) ON DELETE SET NULL,
  randomization_level public.randomization_level NOT NULL DEFAULT 'moderate',
  memory_mode public.memory_mode NOT NULL DEFAULT 'case_isolated',
  grading_rubric jsonb NOT NULL DEFAULT '{}'::jsonb,
  report_template jsonb NOT NULL DEFAULT '{}'::jsonb,
  excluded_diagnosis_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  allow_medical_simulation boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  version int NOT NULL DEFAULT 1,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE INDEX IF NOT EXISTS clinical_templates_specialty_idx
  ON public.clinical_templates (specialty);
CREATE INDEX IF NOT EXISTS clinical_templates_enabled_idx
  ON public.clinical_templates (enabled) WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS public.template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.clinical_templates (id) ON DELETE CASCADE,
  version int NOT NULL,
  snapshot jsonb NOT NULL,
  change_notes text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, version)
);

CREATE TABLE IF NOT EXISTS public.template_diagnoses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.clinical_templates (id) ON DELETE CASCADE,
  disorder_id uuid NOT NULL REFERENCES public.disorders (id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'primary'
    CHECK (role IN ('primary', 'allowed_comorbidity', 'excluded')),
  UNIQUE (template_id, disorder_id, role)
);

CREATE TABLE IF NOT EXISTS public.template_comorbidities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.clinical_templates (id) ON DELETE CASCADE,
  disorder_id uuid NOT NULL REFERENCES public.disorders (id) ON DELETE CASCADE,
  tier public.comorbidity_tier NOT NULL DEFAULT 'compatible',
  UNIQUE (template_id, disorder_id)
);

CREATE TABLE IF NOT EXISTS public.template_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.clinical_templates (id) ON DELETE CASCADE,
  category text NOT NULL
    CHECK (category IN (
      'skills','knowledge','clinical_competency','communication',
      'risk','documentation','dsm_reasoning','icd_reasoning',
      'differential_diagnosis','therapeutic_alliance'
    )),
  statement text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.template_competencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.clinical_templates (id) ON DELETE CASCADE,
  competency_id text NOT NULL,
  label text NOT NULL,
  weight numeric NOT NULL DEFAULT 1,
  max_score numeric NOT NULL DEFAULT 5,
  critical boolean NOT NULL DEFAULT false,
  auto_deduction numeric NOT NULL DEFAULT 0,
  excellent_marker text,
  sort_order int NOT NULL DEFAULT 0
);

-- Link generated cases back to templates
ALTER TABLE public.case_instances
  ADD COLUMN IF NOT EXISTS template_id uuid
    REFERENCES public.clinical_templates (id) ON DELETE SET NULL;
ALTER TABLE public.case_instances
  ADD COLUMN IF NOT EXISTS template_version int;

CREATE INDEX IF NOT EXISTS case_instances_template_id_idx
  ON public.case_instances (template_id);

-- Convenience view matching product language
CREATE OR REPLACE VIEW public.generated_case_instances
  WITH (security_invoker = true)
AS
SELECT
  ci.*,
  ct.name AS template_name,
  ct.slug AS template_slug,
  ct.specialty AS template_specialty,
  ct.assessment_type AS template_assessment_type
FROM public.case_instances ci
LEFT JOIN public.clinical_templates ct ON ct.id = ci.template_id;

COMMENT ON VIEW public.generated_case_instances IS
  'Case instances with optional Clinical Scenario Template provenance.';

-- ---------------------------------------------------------------------------
-- Seed starter templates
-- ---------------------------------------------------------------------------
INSERT INTO public.clinical_templates (
  id, slug, name, description, specialty, target_learners,
  estimated_duration_minutes, difficulty, language, culture,
  therapy_modality, primary_diagnosis_id, severity, risk_level,
  assessment_type, default_persona_id, randomization_level, memory_mode,
  grading_rubric, report_template, enabled, version
)
SELECT
  'e1000000-0000-4000-8000-000000000001'::uuid,
  'adult-mdd-initial-en',
  'Adult MDD — Initial Assessment (English)',
  'Standardized initial assessment for moderate recurrent MDD with optional GAD comorbidity.',
  'general_adult_psychiatry',
  ARRAY['psychiatry_resident','gp','counsellor','clinical_psychology']::text[],
  40, 'intermediate', 'en-US', 'north_american_urban',
  'cbt',
  'd1000000-0000-4000-8000-000000000001'::uuid,
  'moderate', 'moderate', 'initial_assessment',
  p.id, 'moderate', 'case_isolated',
  '{"pass_threshold":60,"outstanding_threshold":85,"critical_mistakes":["ignoring passive SI","prescribing without bipolar screen"],"automatic_deductions":{"missed_safety_assessment":15}}'::jsonb,
  '{"sections":["summary","risk","formulation","plan"]}'::jsonb,
  true, 1
FROM public.personas p WHERE p.slug = 'maya-chen'
ON CONFLICT (slug) DO UPDATE SET
  description = EXCLUDED.description,
  updated_at = now();

INSERT INTO public.clinical_templates (
  id, slug, name, description, specialty, target_learners,
  estimated_duration_minutes, difficulty, language, culture,
  therapy_modality, primary_diagnosis_id, severity, risk_level,
  assessment_type, default_persona_id, randomization_level, memory_mode,
  grading_rubric, report_template, enabled, version
)
SELECT
  'e1000000-0000-4000-8000-000000000002'::uuid,
  'adult-gad-osce-ar',
  'Adult GAD — OSCE (Arabic)',
  'OSCE-style GAD with panic features for Arabic Levantine simulation.',
  'general_adult_psychiatry',
  ARRAY['psychiatry_resident','medical_student']::text[],
  20, 'advanced', 'ar-JO', 'levantine_arabic',
  'cbt',
  'd1000000-0000-4000-8000-000000000002'::uuid,
  'moderate', 'low', 'osce_examination',
  p.id, 'low', 'case_isolated',
  '{"pass_threshold":65,"outstanding_threshold":90,"critical_mistakes":["reassurance-seeking loop","missing panic assessment"]}'::jsonb,
  '{"sections":["osce_checklist","risk","communication"]}'::jsonb,
  true, 1
FROM public.personas p WHERE p.slug = 'jordan-hale'
ON CONFLICT (slug) DO UPDATE SET
  description = EXCLUDED.description,
  updated_at = now();

INSERT INTO public.clinical_templates (
  id, slug, name, description, specialty, target_learners,
  estimated_duration_minutes, difficulty, language, culture,
  therapy_modality, primary_diagnosis_id, severity, risk_level,
  assessment_type, default_persona_id, randomization_level, memory_mode,
  grading_rubric, report_template, enabled, version
)
SELECT
  'e1000000-0000-4000-8000-000000000003'::uuid,
  'ptsd-risk-assessment-en',
  'PTSD — Risk Assessment (English)',
  'Trauma-informed risk assessment with MDD comorbidity allowed.',
  'emergency_psychiatry',
  ARRAY['psychiatry_resident','emergency_physician','crisis_worker']::text[],
  30, 'advanced', 'en-US', 'north_american_urban',
  'crisis_intervention',
  'd1000000-0000-4000-8000-000000000003'::uuid,
  'severe', 'high', 'risk_assessment',
  p.id, 'moderate', 'case_isolated',
  '{"pass_threshold":70,"outstanding_threshold":90,"critical_mistakes":["forced trauma disclosure","missed SI"]}'::jsonb,
  '{"sections":["risk","safety_plan","disposition"]}'::jsonb,
  true, 1
FROM public.personas p WHERE p.slug = 'maya-chen'
ON CONFLICT (slug) DO UPDATE SET
  description = EXCLUDED.description,
  updated_at = now();

-- Template diagnoses / comorbidities / objectives / competencies for template 1
INSERT INTO public.template_diagnoses (template_id, disorder_id, role) VALUES
  ('e1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','primary'),
  ('e1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000002','allowed_comorbidity'),
  ('e1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-00000000000f','excluded')
ON CONFLICT DO NOTHING;

INSERT INTO public.template_comorbidities (template_id, disorder_id, tier) VALUES
  ('e1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000002','compatible'),
  ('e1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000005','possible')
ON CONFLICT DO NOTHING;

INSERT INTO public.template_objectives (template_id, category, statement, sort_order) VALUES
  ('e1000000-0000-4000-8000-000000000001','skills','Conduct a structured mood and risk assessment',1),
  ('e1000000-0000-4000-8000-000000000001','risk','Elicit passive SI with calm specific questioning',2),
  ('e1000000-0000-4000-8000-000000000001','dsm_reasoning','Defend MDD severity and anxious distress specifier',3),
  ('e1000000-0000-4000-8000-000000000001','differential_diagnosis','Screen for bipolarity before antidepressant discussion',4),
  ('e1000000-0000-4000-8000-000000000001','therapeutic_alliance','Validate affect before behavioural activation',5)
ON CONFLICT DO NOTHING;

INSERT INTO public.template_competencies (template_id, competency_id, label, weight, max_score, critical, auto_deduction, excellent_marker, sort_order) VALUES
  ('e1000000-0000-4000-8000-000000000001','alliance','Therapeutic alliance',1.2,5,false,0,'Accurate reflection before advice',1),
  ('e1000000-0000-4000-8000-000000000001','safety','Safety assessment',1.5,5,true,15,'Specific SI questions without alarm',2),
  ('e1000000-0000-4000-8000-000000000001','formulation','Clinical formulation',1.0,5,false,0,'Links grief + role transition',3),
  ('e1000000-0000-4000-8000-000000000001','dsm','DSM reasoning',1.0,5,false,0,'Correct severity defence',4)
ON CONFLICT DO NOTHING;

-- Version snapshot for template 1
INSERT INTO public.template_versions (template_id, version, snapshot, change_notes)
SELECT
  t.id, t.version,
  to_jsonb(t) || jsonb_build_object('seed','v1'),
  'Initial seeded template'
FROM public.clinical_templates t
WHERE t.slug = 'adult-mdd-initial-en'
ON CONFLICT (template_id, version) DO NOTHING;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.clinical_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_comorbidities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_competencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read enabled templates" ON public.clinical_templates;
CREATE POLICY "Authenticated read enabled templates" ON public.clinical_templates
  FOR SELECT TO authenticated
  USING (enabled = true OR EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
  ));

DROP POLICY IF EXISTS "Admin write templates" ON public.clinical_templates;
CREATE POLICY "Admin write templates" ON public.clinical_templates
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Authenticated read template_versions" ON public.template_versions;
CREATE POLICY "Authenticated read template_versions" ON public.template_versions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin write template_versions" ON public.template_versions;
CREATE POLICY "Admin write template_versions" ON public.template_versions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Authenticated read template_diagnoses" ON public.template_diagnoses;
CREATE POLICY "Authenticated read template_diagnoses" ON public.template_diagnoses
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin write template_diagnoses" ON public.template_diagnoses;
CREATE POLICY "Admin write template_diagnoses" ON public.template_diagnoses
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Authenticated read template_comorbidities" ON public.template_comorbidities;
CREATE POLICY "Authenticated read template_comorbidities" ON public.template_comorbidities
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin write template_comorbidities" ON public.template_comorbidities;
CREATE POLICY "Admin write template_comorbidities" ON public.template_comorbidities
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Authenticated read template_objectives" ON public.template_objectives;
CREATE POLICY "Authenticated read template_objectives" ON public.template_objectives
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin write template_objectives" ON public.template_objectives;
CREATE POLICY "Admin write template_objectives" ON public.template_objectives
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Authenticated read template_competencies" ON public.template_competencies;
CREATE POLICY "Authenticated read template_competencies" ON public.template_competencies
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin write template_competencies" ON public.template_competencies;
CREATE POLICY "Admin write template_competencies" ON public.template_competencies
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Canonical migration recovered for Release Configuration Board reconciliation.
-- Source: production supabase_migrations.schema_migrations statements
-- (enriched only when production statements were empty/placeholder).

-- =============================================================================
-- VPsych Dynamic Clinical Case Engine (v2.0)
-- Additive, backward-compatible schema.
-- Avatars remain the identity / personality store; disorders and case instances
-- separate diagnosis from persona. Existing sessions continue to work without
-- case_instance_id (legacy resolve path).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.case_difficulty AS ENUM (
    'beginner', 'intermediate', 'advanced', 'expert'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.therapy_modality AS ENUM (
    'cbt', 'dbt', 'act', 'psychodynamic', 'supportive',
    'motivational_interviewing', 'family_therapy', 'crisis_intervention'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Module 1 — Personas (identity linked to existing avatars for BC)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avatar_id uuid UNIQUE REFERENCES public.avatars (id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  -- Locale-neutral identity baseline (age/gender/traits). Locale specifics stay
  -- on avatars.personalities for backward compatibility.
  identity jsonb NOT NULL DEFAULT '{}'::jsonb,
  traits jsonb NOT NULL DEFAULT '{}'::jsonb,
  baseline_history jsonb NOT NULL DEFAULT '{}'::jsonb,
  default_disorder_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.personas IS
  'Module 1 — stable identity. Psychiatric presentation lives on case_instances, not here.';

-- ---------------------------------------------------------------------------
-- Module 2 — Disorder packages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.disorders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  dsm5_code text,
  icd10_code text,
  icd11_code text,
  category text,
  min_age int,
  max_age int,
  allowed_genders text[] NOT NULL DEFAULT ARRAY['female','male','non-binary','unspecified']::text[],
  -- Full diagnosis-specific package (criteria, MSE, HPI templates, risk, teaching…)
  package jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.disorders IS
  'Module 2 — diagnosis packages. Never permanently owned by a persona.';

ALTER TABLE public.personas
  DROP CONSTRAINT IF EXISTS personas_default_disorder_id_fkey;
ALTER TABLE public.personas
  ADD CONSTRAINT personas_default_disorder_id_fkey
  FOREIGN KEY (default_disorder_id) REFERENCES public.disorders (id)
  ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Module 3 — Comorbidity rules
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comorbidity_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_disorder_id uuid NOT NULL REFERENCES public.disorders (id) ON DELETE CASCADE,
  comorbid_disorder_id uuid NOT NULL REFERENCES public.disorders (id) ON DELETE CASCADE,
  compatible boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comorbidity_rules_distinct CHECK (primary_disorder_id <> comorbid_disorder_id),
  CONSTRAINT comorbidity_rules_unique UNIQUE (primary_disorder_id, comorbid_disorder_id)
);

-- ---------------------------------------------------------------------------
-- Module 4 — Difficulty profiles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.difficulty_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  level public.case_difficulty NOT NULL UNIQUE,
  label text NOT NULL,
  modifiers jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Module 6 — Therapy modality profiles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.therapy_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  modality public.therapy_modality NOT NULL UNIQUE,
  label text NOT NULL,
  patient_reaction_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Module 7 — Case instances (immutable clinical presentation per assessment)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.case_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id text NOT NULL UNIQUE,
  persona_id uuid REFERENCES public.personas (id) ON DELETE SET NULL,
  avatar_id uuid NOT NULL REFERENCES public.avatars (id) ON DELETE RESTRICT,
  primary_disorder_id uuid NOT NULL REFERENCES public.disorders (id) ON DELETE RESTRICT,
  comorbidity_disorder_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  difficulty public.case_difficulty NOT NULL DEFAULT 'intermediate',
  therapy_modality public.therapy_modality NOT NULL DEFAULT 'supportive',
  locale text NOT NULL DEFAULT 'en-US',
  severity text,
  -- Frozen, immutable snapshot used at runtime (clinical_core + meta).
  clinical_snapshot jsonb NOT NULL,
  randomized_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  voice_profile_id uuid REFERENCES public.voice_profiles (id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Immutability: no updated_at — rows are insert-only.
  CONSTRAINT case_instances_severity_check
    CHECK (severity IS NULL OR severity IN ('subclinical','mild','moderate','severe'))
);

CREATE INDEX IF NOT EXISTS case_instances_avatar_id_idx
  ON public.case_instances (avatar_id);
CREATE INDEX IF NOT EXISTS case_instances_persona_id_idx
  ON public.case_instances (persona_id);
CREATE INDEX IF NOT EXISTS case_instances_primary_disorder_id_idx
  ON public.case_instances (primary_disorder_id);
CREATE INDEX IF NOT EXISTS case_instances_created_at_idx
  ON public.case_instances (created_at DESC);

COMMENT ON TABLE public.case_instances IS
  'Immutable CaseInstance generated at assessment start. Memory belongs here, not on persona.';

-- ---------------------------------------------------------------------------
-- Case memory (isolated per case instance; longitudinal mode may share later)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.case_memory (
  case_instance_id uuid PRIMARY KEY REFERENCES public.case_instances (id) ON DELETE CASCADE,
  memory jsonb NOT NULL DEFAULT '{}'::jsonb,
  longitudinal_group_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Sessions — additive Case Engine columns (nullable for legacy sessions)
-- ---------------------------------------------------------------------------
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS case_instance_id uuid
    REFERENCES public.case_instances (id) ON DELETE SET NULL;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS clinical_snapshot jsonb;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS difficulty public.case_difficulty;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS therapy_modality public.therapy_modality;

CREATE INDEX IF NOT EXISTS sessions_case_instance_id_idx
  ON public.sessions (case_instance_id);

COMMENT ON COLUMN public.sessions.clinical_snapshot IS
  'Frozen CaseInstance snapshot for this assessment. Null = legacy avatar-bound diagnosis path.';
COMMENT ON COLUMN public.sessions.case_instance_id IS
  'FK to case_instances. Null for pre-engine sessions.';

-- ---------------------------------------------------------------------------
-- Seed difficulty profiles
-- ---------------------------------------------------------------------------
INSERT INTO public.difficulty_profiles (id, slug, level, label, modifiers) VALUES
  (
    'b1000000-0000-4000-8000-000000000001',
    'beginner', 'beginner', 'Beginner',
    '{"insight":"high","resistance":"low","disclosure":"high","diagnostic_ambiguity":"low","alliance":"warm","masking":"low","comorbidity_weight":0}'::jsonb
  ),
  (
    'b1000000-0000-4000-8000-000000000002',
    'intermediate', 'intermediate', 'Intermediate',
    '{"insight":"moderate","resistance":"moderate","disclosure":"mixed","diagnostic_ambiguity":"moderate","alliance":"neutral","masking":"moderate","comorbidity_weight":1}'::jsonb
  ),
  (
    'b1000000-0000-4000-8000-000000000003',
    'advanced', 'advanced', 'Advanced',
    '{"insight":"low","resistance":"high","disclosure":"guarded","diagnostic_ambiguity":"high","alliance":"fragile","masking":"high","comorbidity_weight":1}'::jsonb
  ),
  (
    'b1000000-0000-4000-8000-000000000004',
    'expert', 'expert', 'Expert',
    '{"insight":"very_low","resistance":"very_high","disclosure":"minimal","diagnostic_ambiguity":"very_high","alliance":"testing","masking":"very_high","comorbidity_weight":2}'::jsonb
  )
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  modifiers = EXCLUDED.modifiers,
  level = EXCLUDED.level;

-- ---------------------------------------------------------------------------
-- Seed therapy profiles
-- ---------------------------------------------------------------------------
INSERT INTO public.therapy_profiles (id, slug, modality, label, patient_reaction_rules) VALUES
  ('c1000000-0000-4000-8000-000000000001','cbt','cbt','CBT',
   '{"engages_with":["structured questions","thought records","behavioural experiments"],"resists":["premature homework","invalidating positivity"],"alliance_cue":"Responds to collaborative agenda-setting."}'::jsonb),
  ('c1000000-0000-4000-8000-000000000002','dbt','dbt','DBT',
   '{"engages_with":["validation","skills framing","dialectics"],"resists":["pure problem-solving without validation"],"alliance_cue":"Needs feeling understood before skills."}'::jsonb),
  ('c1000000-0000-4000-8000-000000000003','act','act','ACT',
   '{"engages_with":["values","acceptance metaphors"],"resists":["thought challenging as primary tool"],"alliance_cue":"Curious about meaning and willingness."}'::jsonb),
  ('c1000000-0000-4000-8000-000000000004','psychodynamic','psychodynamic','Psychodynamic',
   '{"engages_with":["pattern linking","relationship themes"],"resists":["purely symptom checklists"],"alliance_cue":"Tests whether therapist notices affect shifts."}'::jsonb),
  ('c1000000-0000-4000-8000-000000000005','supportive','supportive','Supportive',
   '{"engages_with":["empathy","containment","pacing"],"resists":["heavy confrontation early"],"alliance_cue":"Stabilises with warmth and clarity."}'::jsonb),
  ('c1000000-0000-4000-8000-000000000006','motivational_interviewing','motivational_interviewing','Motivational Interviewing',
   '{"engages_with":["open questions","reflections","change talk"],"resists":["advice-giving","arguing for change"],"alliance_cue":"Ambivalence is expected and respected."}'::jsonb),
  ('c1000000-0000-4000-8000-000000000007','family_therapy','family_therapy','Family Therapy',
   '{"engages_with":["systemic framing","role exploration"],"resists":["blaming the identified patient alone"],"alliance_cue":"Family loyalty conflicts may surface."}'::jsonb),
  ('c1000000-0000-4000-8000-000000000008','crisis_intervention','crisis_intervention','Crisis Intervention',
   '{"engages_with":["safety focus","clear structure","grounding"],"resists":["deep trauma processing mid-crisis"],"alliance_cue":"Prioritises stabilisation and safety."}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  patient_reaction_rules = EXCLUDED.patient_reaction_rules,
  modality = EXCLUDED.modality;

-- ---------------------------------------------------------------------------
-- Seed core disorders (deterministic IDs)
-- ---------------------------------------------------------------------------
INSERT INTO public.disorders (
  id, slug, name, dsm5_code, icd10_code, icd11_code, category,
  min_age, max_age, allowed_genders, package, is_active
) VALUES
(
  'd1000000-0000-4000-8000-000000000001',
  'mdd-recurrent-moderate',
  'Major Depressive Disorder, recurrent episode, moderate',
  '296.32', 'F33.1', '6A71.1', 'mood',
  14, 90, ARRAY['female','male','non-binary','unspecified']::text[],
  '{
    "severity_default": "moderate",
    "symptom_domains": ["mood","sleep","appetite","cognition","somatic","social"],
    "risk_defaults": {"suicidal_ideation":"passive","self_harm":false,"harm_to_others":false},
    "differentials": ["Bipolar disorder","Adjustment disorder with depressed mood","Prolonged grief","Hypothyroidism"],
    "rule_outs": ["Active mania/hypomania","Psychotic features requiring separate coding"],
    "teaching_points": ["Screen bipolarity before antidepressant discussion","Grief may be subthreshold but clinically central"],
    "common_therapist_mistakes": ["Premature behavioural activation before grief is heard","Ignoring family bipolar history"],
    "session_goals": ["Build alliance","Assess mood/sleep/appetite/anhedonia","Explore passive SI safely","Identify 1–2 treatment targets"],
    "ideal_approach": "Warm, collaborative CBT/IPT-informed interview. Validate affect; check safety without interrogation."
  }'::jsonb,
  true
),
(
  'd1000000-0000-4000-8000-000000000002',
  'gad-with-panic',
  'Generalized Anxiety Disorder, with panic attacks',
  '300.02', 'F41.1', '6B00', 'anxiety',
  16, 90, ARRAY['female','male','non-binary','unspecified']::text[],
  '{
    "severity_default": "moderate",
    "symptom_domains": ["anxiety","sleep","cognition","somatic","behavioral"],
    "risk_defaults": {"suicidal_ideation":"none","self_harm":false,"harm_to_others":false},
    "differentials": ["Panic disorder","Social anxiety","OCD","ADHD","Substance-induced anxiety"],
    "rule_outs": ["Medical causes of autonomic arousal","Acute intoxication/withdrawal"],
    "teaching_points": ["Worry is multi-domain and hard to control","Panic attacks may be situational or unexpected"],
    "common_therapist_mistakes": ["Reassurance-seeking loops","Missing ADHD comorbidity"],
    "session_goals": ["Map worry domains","Assess panic phenomenology","Identify safety behaviours","Collaborative formulation"],
    "ideal_approach": "Collaborative CBT for GAD; gentle pacing; avoid premature exposure without alliance."
  }'::jsonb,
  true
),
(
  'd1000000-0000-4000-8000-000000000003',
  'ptsd',
  'Posttraumatic Stress Disorder',
  '309.81', 'F43.10', '6B40', 'trauma',
  16, 90, ARRAY['female','male','non-binary','unspecified']::text[],
  '{
    "severity_default": "moderate",
    "symptom_domains": ["trauma","anxiety","sleep","mood","cognition","behavioral"],
    "risk_defaults": {"suicidal_ideation":"passive","self_harm":false,"harm_to_others":false},
    "differentials": ["Acute stress disorder","Adjustment disorder","MDD","Panic disorder"],
    "rule_outs": ["No criterion-A trauma","Dissociative identity as primary explanation"],
    "teaching_points": ["Pace trauma narrative","Assess avoidance and hyperarousal","Safety before processing"],
    "common_therapist_mistakes": ["Forced disclosure of trauma details","Ignoring grounding needs"],
    "session_goals": ["Establish safety","Gently map trauma impact","Assess SI","Agree pacing"],
    "ideal_approach": "Trauma-informed supportive/CBT hybrid; titration; no flooding."
  }'::jsonb,
  true
),
(
  'd1000000-0000-4000-8000-000000000004',
  'adult-adhd',
  'Attention-Deficit/Hyperactivity Disorder, predominantly inattentive, adult',
  '314.00', 'F90.0', '6A05.0', 'neurodevelopmental',
  17, 65, ARRAY['female','male','non-binary','unspecified']::text[],
  '{
    "severity_default": "moderate",
    "symptom_domains": ["cognition","behavioral","social","mood"],
    "risk_defaults": {"suicidal_ideation":"none","self_harm":false,"harm_to_others":false,"substance_use":false},
    "differentials": ["GAD","MDD with concentration loss","Sleep disorder","Substance use"],
    "rule_outs": ["Symptoms starting only in adulthood without childhood history"],
    "teaching_points": ["Childhood onset required","Anxiety may mask ADHD","Functional impairment across settings"],
    "common_therapist_mistakes": ["Treating only anxiety","Ignoring organisational impairment"],
    "session_goals": ["Developmental history","Map impairment domains","Screen comorbidity","Psychoeducation"],
    "ideal_approach": "Structured, collaborative assessment; concrete examples; avoid moralising."
  }'::jsonb,
  true
),
(
  'd1000000-0000-4000-8000-000000000005',
  'alcohol-use-disorder',
  'Alcohol Use Disorder',
  '305.00', 'F10.10', '6C40.1', 'substance',
  18, 90, ARRAY['female','male','non-binary','unspecified']::text[],
  '{
    "severity_default": "mild",
    "symptom_domains": ["behavioral","social","mood","somatic"],
    "risk_defaults": {"suicidal_ideation":"none","self_harm":false,"harm_to_others":false,"substance_use":true},
    "differentials": ["Primary mood/anxiety disorder with secondary drinking"],
    "rule_outs": ["Acute intoxication preventing interview"],
    "teaching_points": ["Use non-judgemental MI stance","Assess withdrawal risk"],
    "common_therapist_mistakes": ["Confrontational abstinence push early"],
    "session_goals": ["Assess use pattern","Explore ambivalence","Safety/withdrawal screen"],
    "ideal_approach": "Motivational interviewing; curiosity over confrontation."
  }'::jsonb,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  dsm5_code = EXCLUDED.dsm5_code,
  icd10_code = EXCLUDED.icd10_code,
  icd11_code = EXCLUDED.icd11_code,
  package = EXCLUDED.package,
  is_active = EXCLUDED.is_active;

-- Compatible comorbidity rules (and one explicit incompatible pair)
INSERT INTO public.comorbidity_rules (
  primary_disorder_id, comorbid_disorder_id, compatible, notes
) VALUES
  ('d1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000002', true, 'MDD + GAD is clinically common'),
  ('d1000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000001', true, 'GAD + MDD is clinically common'),
  ('d1000000-0000-4000-8000-000000000003','d1000000-0000-4000-8000-000000000001', true, 'PTSD + MDD common'),
  ('d1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000003', true, 'MDD + PTSD common'),
  ('d1000000-0000-4000-8000-000000000004','d1000000-0000-4000-8000-000000000002', true, 'Adult ADHD + GAD common'),
  ('d1000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000004', true, 'GAD + Adult ADHD common'),
  ('d1000000-0000-4000-8000-000000000003','d1000000-0000-4000-8000-000000000005', true, 'PTSD + AUD possible'),
  ('d1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000005', true, 'MDD + AUD possible'),
  -- Same-spectrum duplicate rejected at app layer; mark self-pairs via distinct check already.
  ('d1000000-0000-4000-8000-000000000004','d1000000-0000-4000-8000-000000000003', false, 'ADHD primary with PTSD requires trauma-first packaging — blocked as primary/comorbid pair for v1 generator')
ON CONFLICT (primary_disorder_id, comorbid_disorder_id) DO UPDATE SET
  compatible = EXCLUDED.compatible,
  notes = EXCLUDED.notes;

-- ---------------------------------------------------------------------------
-- Migrate existing avatars → personas (identity only) + default disorders
-- ---------------------------------------------------------------------------
INSERT INTO public.personas (
  id, avatar_id, slug, display_name, identity, traits, baseline_history,
  default_disorder_id, is_active
)
SELECT
  gen_random_uuid(),
  a.id,
  COALESCE(NULLIF(a.slug, ''), lower(regexp_replace(a.name, '\s+', '-', 'g'))),
  a.name,
  jsonb_build_object(
    'age', COALESCE(a.clinical_core->>'age', a.age::text)::int,
    'gender', COALESCE(a.clinical_core->>'gender', a.gender, 'unspecified'),
    'source', 'migrated_from_avatar'
  ),
  jsonb_build_object(
    'communication_style', 'from_personality',
    'attachment_style', 'unspecified'
  ),
  jsonb_build_object(
    'note', 'Baseline medical/family history remains in legacy clinical_core.case_file until authored into disorder packages.'
  ),
  CASE
    WHEN a.slug = 'maya-chen' OR lower(a.name) LIKE '%maya%'
      THEN 'd1000000-0000-4000-8000-000000000001'::uuid
    WHEN a.slug = 'jordan-hale' OR lower(a.name) LIKE '%jordan%'
      THEN 'd1000000-0000-4000-8000-000000000002'::uuid
    ELSE NULL
  END,
  a.is_active
FROM public.avatars a
ON CONFLICT (slug) DO UPDATE SET
  avatar_id = EXCLUDED.avatar_id,
  display_name = EXCLUDED.display_name,
  default_disorder_id = COALESCE(public.personas.default_disorder_id, EXCLUDED.default_disorder_id),
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disorders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comorbidity_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.difficulty_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapy_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_memory ENABLE ROW LEVEL SECURITY;

-- Catalogs: authenticated read; admin write
DROP POLICY IF EXISTS "Authenticated read personas" ON public.personas;
CREATE POLICY "Authenticated read personas" ON public.personas
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin write personas" ON public.personas;
CREATE POLICY "Admin write personas" ON public.personas
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Authenticated read disorders" ON public.disorders;
CREATE POLICY "Authenticated read disorders" ON public.disorders
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin write disorders" ON public.disorders;
CREATE POLICY "Admin write disorders" ON public.disorders
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Authenticated read comorbidity_rules" ON public.comorbidity_rules;
CREATE POLICY "Authenticated read comorbidity_rules" ON public.comorbidity_rules
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin write comorbidity_rules" ON public.comorbidity_rules;
CREATE POLICY "Admin write comorbidity_rules" ON public.comorbidity_rules
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Authenticated read difficulty_profiles" ON public.difficulty_profiles;
CREATE POLICY "Authenticated read difficulty_profiles" ON public.difficulty_profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin write difficulty_profiles" ON public.difficulty_profiles;
CREATE POLICY "Admin write difficulty_profiles" ON public.difficulty_profiles
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Authenticated read therapy_profiles" ON public.therapy_profiles;
CREATE POLICY "Authenticated read therapy_profiles" ON public.therapy_profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin write therapy_profiles" ON public.therapy_profiles;
CREATE POLICY "Admin write therapy_profiles" ON public.therapy_profiles
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Case instances: therapists see own; admins see all; insert by authenticated (session start)
DROP POLICY IF EXISTS "Therapists read own case_instances" ON public.case_instances;
CREATE POLICY "Therapists read own case_instances" ON public.case_instances
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.case_instance_id = case_instances.id AND s.therapist_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated insert case_instances" ON public.case_instances;
CREATE POLICY "Authenticated insert case_instances" ON public.case_instances
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() OR created_by IS NULL);

DROP POLICY IF EXISTS "Admin all case_instances" ON public.case_instances;
CREATE POLICY "Admin all case_instances" ON public.case_instances
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Case memory via ownership" ON public.case_memory;
CREATE POLICY "Case memory via ownership" ON public.case_memory
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.case_instances ci
      WHERE ci.id = case_memory.case_instance_id
        AND (
          ci.created_by = auth.uid()
          OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
          OR EXISTS (
            SELECT 1 FROM public.sessions s
            WHERE s.case_instance_id = ci.id AND s.therapist_id = auth.uid()
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.case_instances ci
      WHERE ci.id = case_memory.case_instance_id
        AND (
          ci.created_by = auth.uid()
          OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
        )
    )
  );

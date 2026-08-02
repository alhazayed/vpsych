-- =============================================================================
-- VPsych Competency Graph Engine (CGE) v3.0
-- CBME DAG: prerequisites, mastery stages, RCA, remediation, decay.
-- Additive / backward compatible with ACE competency_domains + learner_competencies.
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE public.cge_mastery_stage AS ENUM (
    'not_attempted', 'novice', 'developing', 'competent', 'proficient', 'expert'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.cge_edge_kind AS ENUM (
    'required', 'recommended', 'optional', 'depends_on'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.cge_node_difficulty AS ENUM (
    'foundation', 'intermediate', 'advanced', 'expert'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Graph definition (nodes enrich ACE competency_domains)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cge_nodes (
  id text PRIMARY KEY REFERENCES public.competency_domains (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  domain text NOT NULL DEFAULT 'clinical',
  difficulty public.cge_node_difficulty NOT NULL DEFAULT 'intermediate',
  clinical_importance int NOT NULL DEFAULT 5 CHECK (clinical_importance BETWEEN 1 AND 10),
  learning_objectives jsonb NOT NULL DEFAULT '[]'::jsonb,
  assessment_methods jsonb NOT NULL DEFAULT '[]'::jsonb,
  mastery_threshold numeric NOT NULL DEFAULT 70,
  mastery_min_samples int NOT NULL DEFAULT 3,
  recommended_resources jsonb NOT NULL DEFAULT '[]'::jsonb,
  estimated_training_hours numeric NOT NULL DEFAULT 2,
  version int NOT NULL DEFAULT 1,
  enabled boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cge_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_competency_id text NOT NULL REFERENCES public.cge_nodes (id) ON DELETE CASCADE,
  to_competency_id text NOT NULL REFERENCES public.cge_nodes (id) ON DELETE CASCADE,
  edge_kind public.cge_edge_kind NOT NULL DEFAULT 'required',
  weight numeric NOT NULL DEFAULT 1,
  notes text,
  UNIQUE (from_competency_id, to_competency_id, edge_kind),
  CHECK (from_competency_id <> to_competency_id)
);

CREATE INDEX IF NOT EXISTS cge_edges_from_idx ON public.cge_edges (from_competency_id);
CREATE INDEX IF NOT EXISTS cge_edges_to_idx ON public.cge_edges (to_competency_id);

-- Alias view names requested in spec
CREATE OR REPLACE VIEW public.competency_nodes
  WITH (security_invoker = true) AS
  SELECT * FROM public.cge_nodes;

CREATE OR REPLACE VIEW public.competency_edges
  WITH (security_invoker = true) AS
  SELECT * FROM public.cge_edges;

CREATE OR REPLACE VIEW public.competency_prerequisites
  WITH (security_invoker = true) AS
  SELECT
    to_competency_id AS competency_id,
    from_competency_id AS prerequisite_id,
    edge_kind,
    weight,
    notes
  FROM public.cge_edges
  WHERE edge_kind IN ('required', 'recommended', 'optional');

CREATE TABLE IF NOT EXISTS public.cge_graph_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version int NOT NULL UNIQUE,
  snapshot jsonb NOT NULL,
  change_notes text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Extend ACE learner_competencies with mastery / graph fields
ALTER TABLE public.learner_competencies
  ADD COLUMN IF NOT EXISTS mastery_stage public.cge_mastery_stage
    NOT NULL DEFAULT 'not_attempted';
ALTER TABLE public.learner_competencies
  ADD COLUMN IF NOT EXISTS confidence numeric NOT NULL DEFAULT 50
    CHECK (confidence >= 0 AND confidence <= 100);
ALTER TABLE public.learner_competencies
  ADD COLUMN IF NOT EXISTS last_practiced_at timestamptz;
ALTER TABLE public.learner_competencies
  ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false;
ALTER TABLE public.learner_competencies
  ADD COLUMN IF NOT EXISTS instructor_approved boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.cge_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES public.learner_profiles (id) ON DELETE CASCADE,
  competency_id text NOT NULL REFERENCES public.cge_nodes (id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.sessions (id) ON DELETE SET NULL,
  score numeric NOT NULL CHECK (score >= 0 AND score <= 100),
  stage_before public.cge_mastery_stage,
  stage_after public.cge_mastery_stage,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cge_attempts_learner_comp_idx
  ON public.cge_attempts (learner_id, competency_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.cge_mastery_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES public.learner_profiles (id) ON DELETE CASCADE,
  competency_id text NOT NULL REFERENCES public.cge_nodes (id) ON DELETE CASCADE,
  from_stage public.cge_mastery_stage NOT NULL,
  to_stage public.cge_mastery_stage NOT NULL,
  score numeric,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cge_decay (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES public.learner_profiles (id) ON DELETE CASCADE,
  competency_id text NOT NULL REFERENCES public.cge_nodes (id) ON DELETE CASCADE,
  previous_confidence numeric NOT NULL,
  new_confidence numeric NOT NULL,
  days_idle int NOT NULL,
  recommended_refresher jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cge_remediation_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES public.learner_profiles (id) ON DELETE CASCADE,
  observed_failure text NOT NULL,
  root_cause_id text REFERENCES public.cge_nodes (id) ON DELETE SET NULL,
  pathway jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_cases jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'superseded', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS cge_remediation_learner_idx
  ON public.cge_remediation_plans (learner_id, status);

-- Spec alias
CREATE OR REPLACE VIEW public.remediation_plans
  WITH (security_invoker = true) AS
  SELECT * FROM public.cge_remediation_plans;

CREATE OR REPLACE VIEW public.competency_attempts
  WITH (security_invoker = true) AS
  SELECT * FROM public.cge_attempts;

CREATE OR REPLACE VIEW public.mastery_history
  WITH (security_invoker = true) AS
  SELECT * FROM public.cge_mastery_history;

CREATE OR REPLACE VIEW public.competency_decay
  WITH (security_invoker = true) AS
  SELECT * FROM public.cge_decay;

CREATE OR REPLACE VIEW public.graph_versions
  WITH (security_invoker = true) AS
  SELECT * FROM public.cge_graph_versions;

-- ---------------------------------------------------------------------------
-- Ensure foundation domains exist (ACE seeds + CGE extensions)
-- ---------------------------------------------------------------------------
INSERT INTO public.competency_domains (id, label, description, category, sort_order) VALUES
  ('clinical_communication', 'Clinical Communication', 'Foundational clinical communication', 'alliance', 5),
  ('risk_screening', 'Risk Screening', 'Initial risk screening', 'safety', 55),
  ('safety_planning', 'Safety Planning', 'Collaborative safety planning', 'safety', 75),
  ('case_formulation', 'Case Formulation', 'Integrative case formulation', 'diagnosis', 55),
  ('follow_up_planning', 'Follow-up Planning', 'Disposition and follow-up', 'treatment', 195),
  ('case_summary', 'Case Summary', 'Concise case summary', 'professional', 205),
  ('diagnostic_formulation', 'Diagnostic Formulation', 'Written diagnostic formulation', 'professional', 215),
  ('treatment_documentation', 'Treatment Documentation', 'Treatment plan documentation', 'professional', 225)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Seed CGE nodes
-- ---------------------------------------------------------------------------
INSERT INTO public.cge_nodes (
  id, name, description, domain, difficulty, clinical_importance,
  learning_objectives, assessment_methods, mastery_threshold, mastery_min_samples,
  recommended_resources, estimated_training_hours, sort_order
) VALUES
  ('clinical_communication', 'Clinical Communication', 'Foundational clinical communication', 'alliance', 'foundation', 9,
   '["Establish rapport","Use clear language","Manage silence"]'::jsonb,
   '["observed_interview","osce"]'::jsonb, 70, 3,
   '["Clinical interviewing basics"]'::jsonb, 2, 5),
  ('diagnostic_interview', 'Diagnostic Interview', 'Structured psychiatric interview', 'assessment', 'foundation', 10,
   '["Structure interview","Elicit HPI","Cover psychiatric ROS"]'::jsonb,
   '["simulated_patient","checklist"]'::jsonb, 70, 3,
   '["Shea psychiatric interview"]'::jsonb, 3, 10),
  ('mental_status_examination', 'Mental Status Examination', 'MSE completeness and accuracy', 'assessment', 'foundation', 10,
   '["Cover MSE domains","Document accurately"]'::jsonb,
   '["mse_checklist"]'::jsonb, 70, 3,
   '["MSE pocket card"]'::jsonb, 2, 20),
  ('dsm5_reasoning', 'DSM-5 Diagnostic Reasoning', 'Apply DSM-5 criteria', 'diagnosis', 'intermediate', 9,
   '["Map symptoms to criteria","Identify specifiers"]'::jsonb,
   '["case_formulation"]'::jsonb, 70, 3,
   '["DSM-5-TR"]'::jsonb, 4, 30),
  ('icd11_reasoning', 'ICD-11 Diagnostic Reasoning', 'Apply ICD-11 criteria', 'diagnosis', 'intermediate', 8,
   '["Map to ICD-11","Crosswalk DSM"]'::jsonb,
   '["case_formulation"]'::jsonb, 70, 3,
   '["ICD-11 CDDR"]'::jsonb, 3, 40),
  ('differential_diagnosis', 'Differential Diagnosis', 'Generate and rule out differentials', 'diagnosis', 'advanced', 10,
   '["Generate differentials","Rule-out systematically"]'::jsonb,
   '["ambiguity_cases"]'::jsonb, 70, 4,
   '["DSM differential trees"]'::jsonb, 4, 50),
  ('case_formulation', 'Case Formulation', 'Integrative case formulation', 'diagnosis', 'advanced', 9,
   '["Integrate biopsychosocial factors"]'::jsonb,
   '["written_formulation"]'::jsonb, 70, 3,
   '["Formulation worksheets"]'::jsonb, 3, 55),
  ('treatment_planning', 'Treatment Planning', 'Collaborative treatment plans', 'treatment', 'advanced', 10,
   '["Prioritize problems","Match interventions"]'::jsonb,
   '["plan_rubric"]'::jsonb, 70, 3,
   '["APA treatment guidelines"]'::jsonb, 3, 60),
  ('medication_management', 'Medication Management', 'Psychopharmacology decisions', 'treatment', 'advanced', 9,
   '["Choose agents","Counsel side effects"]'::jsonb,
   '["med_cases"]'::jsonb, 75, 4,
   '["Stahl essential psychopharmacology"]'::jsonb, 5, 70),
  ('follow_up_planning', 'Follow-up Planning', 'Disposition and follow-up', 'treatment', 'intermediate', 7,
   '["Set follow-up","Safety net"]'::jsonb,
   '["disposition_checklist"]'::jsonb, 70, 2,
   '["Care coordination primer"]'::jsonb, 1.5, 80),
  ('risk_screening', 'Risk Screening', 'Initial risk screening', 'safety', 'foundation', 10,
   '["Screen SI/HI","Screen substances"]'::jsonb,
   '["screening_checklist"]'::jsonb, 70, 3,
   '["SAFE-T"]'::jsonb, 2, 90),
  ('risk_assessment', 'Risk Assessment', 'General risk formulation', 'safety', 'intermediate', 10,
   '["Formulate risk","Protective factors"]'::jsonb,
   '["risk_cases"]'::jsonb, 70, 3,
   '["Structured risk formulation"]'::jsonb, 3, 100),
  ('suicide_assessment', 'Suicide Assessment', 'SI inquiry and safety planning', 'safety', 'advanced', 10,
   '["Ask about SI specifically","Assess plan/means/intent"]'::jsonb,
   '["si_stations"]'::jsonb, 75, 4,
   '["C-SSRS","SAFE-T"]'::jsonb, 4, 110),
  ('violence_assessment', 'Violence Assessment', 'Violence / harm-to-others', 'safety', 'advanced', 9,
   '["Assess HI","Identify targets"]'::jsonb,
   '["violence_stations"]'::jsonb, 75, 3,
   '["HCR-20 overview"]'::jsonb, 3, 120),
  ('safety_planning', 'Safety Planning', 'Collaborative safety planning', 'safety', 'advanced', 10,
   '["Build safety plan","Means restriction"]'::jsonb,
   '["safety_plan_rubric"]'::jsonb, 75, 3,
   '["Stanley-Brown safety plan"]'::jsonb, 2, 130),
  ('emergency_psychiatry', 'Emergency Psychiatry', 'Acute / emergency psychiatry', 'safety', 'expert', 10,
   '["Stabilize","Disposition"]'::jsonb,
   '["crisis_cases"]'::jsonb, 80, 4,
   '["Emergency psychiatry handbook"]'::jsonb, 5, 140),
  ('therapeutic_alliance', 'Therapeutic Alliance', 'Collaborative working alliance', 'alliance', 'foundation', 9,
   '["Build collaboration","Repair ruptures"]'::jsonb,
   '["alliance_markers"]'::jsonb, 70, 3,
   '["Alliance literature summary"]'::jsonb, 2, 150),
  ('empathy', 'Empathy', 'Empathic communication', 'alliance', 'foundation', 8,
   '["Reflect affect","Validate"]'::jsonb,
   '["empathy_rubric"]'::jsonb, 70, 2,
   '["MI OARS"]'::jsonb, 1.5, 160),
  ('cbt_skills', 'CBT Skills', 'Cognitive behavioural interventions', 'therapy', 'intermediate', 8,
   '["Agenda","Thought records","Homework"]'::jsonb,
   '["cbt_session"]'::jsonb, 70, 3,
   '["Beck CT basics"]'::jsonb, 4, 170),
  ('dbt_skills', 'DBT Skills', 'Dialectical behaviour skills', 'therapy', 'advanced', 8,
   '["Validation","Skills coaching"]'::jsonb,
   '["dbt_session"]'::jsonb, 70, 3,
   '["DBT skills manual"]'::jsonb, 4, 180),
  ('act_skills', 'ACT Skills', 'Acceptance and commitment therapy', 'therapy', 'advanced', 7,
   '["Values","Defusion"]'::jsonb,
   '["act_session"]'::jsonb, 70, 3,
   '["ACT made simple"]'::jsonb, 3, 190),
  ('psychodynamic_interviewing', 'Psychodynamic Skills', 'Psychodynamic therapy skills', 'therapy', 'advanced', 7,
   '["Transference awareness","Interpretation timing"]'::jsonb,
   '["psychodynamic_session"]'::jsonb, 70, 3,
   '["Psychodynamic psychotherapy primer"]'::jsonb, 4, 200),
  ('supportive_therapy', 'Supportive Therapy', 'Supportive psychotherapy skills', 'therapy', 'intermediate', 7,
   '["Support ego function","Problem-solve"]'::jsonb,
   '["supportive_session"]'::jsonb, 70, 2,
   '["Supportive psychotherapy guide"]'::jsonb, 2, 210),
  ('motivational_interviewing', 'Motivational Interviewing', 'MI spirit and techniques', 'therapy', 'intermediate', 8,
   '["OARS","Rolling with resistance"]'::jsonb,
   '["mi_session"]'::jsonb, 70, 3,
   '["MI pocket guide"]'::jsonb, 3, 220),
  ('documentation', 'Clinical Documentation', 'Clinical documentation quality', 'professional', 'intermediate', 8,
   '["Accurate notes","Timely documentation"]'::jsonb,
   '["note_rubric"]'::jsonb, 70, 3,
   '["Documentation standards"]'::jsonb, 2, 230),
  ('case_summary', 'Case Summary', 'Concise case summary', 'professional', 'intermediate', 7,
   '["Synthesize key data"]'::jsonb,
   '["summary_rubric"]'::jsonb, 70, 2,
   '["Oral presentation guide"]'::jsonb, 1.5, 240),
  ('diagnostic_formulation', 'Diagnostic Formulation', 'Written diagnostic formulation', 'professional', 'advanced', 8,
   '["Write DSM/ICD formulation"]'::jsonb,
   '["formulation_rubric"]'::jsonb, 70, 3,
   '["Formulation templates"]'::jsonb, 2, 250),
  ('treatment_documentation', 'Treatment Documentation', 'Treatment plan documentation', 'professional', 'advanced', 7,
   '["Document plan and rationale"]'::jsonb,
   '["plan_doc_rubric"]'::jsonb, 70, 2,
   '["Treatment plan templates"]'::jsonb, 1.5, 260),
  ('psychoeducation', 'Psychoeducation', 'Patient education', 'treatment', 'intermediate', 7,
   '["Explain illness","Teach coping"]'::jsonb,
   '["edu_checklist"]'::jsonb, 70, 2,
   '["Psychoeducation scripts"]'::jsonb, 1.5, 270),
  ('professional_communication', 'Professional Communication', 'Clear professional communication', 'professional', 'foundation', 8,
   '["Handoffs","Collegial language"]'::jsonb,
   '["communication_rubric"]'::jsonb, 70, 2,
   '["SBAR"]'::jsonb, 1, 280),
  ('time_management', 'Time Management', 'Station / session time use', 'professional', 'foundation', 7,
   '["Prioritize","Close on time"]'::jsonb,
   '["timer_stations"]'::jsonb, 70, 2,
   '["OSCE time strategies"]'::jsonb, 1, 290),
  ('ethical_decision_making', 'Ethical Decision Making', 'Ethics and professionalism', 'professional', 'intermediate', 9,
   '["Consent","Confidentiality limits"]'::jsonb,
   '["ethics_cases"]'::jsonb, 75, 2,
   '["APA ethics code"]'::jsonb, 2, 300),
  ('cultural_competence', 'Cultural Competence', 'Culturally responsive care', 'professional', 'intermediate', 8,
   '["Elicit explanatory model","Adapt care"]'::jsonb,
   '["culture_cases"]'::jsonb, 70, 2,
   '["Cultural formulation interview"]'::jsonb, 2, 310),
  ('family_interviewing', 'Family Interviewing', 'Family / systems assessment', 'assessment', 'advanced', 7,
   '["Engage family","Map systems"]'::jsonb,
   '["family_session"]'::jsonb, 70, 2,
   '["Family assessment primer"]'::jsonb, 2, 320)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  domain = EXCLUDED.domain,
  difficulty = EXCLUDED.difficulty,
  clinical_importance = EXCLUDED.clinical_importance,
  mastery_threshold = EXCLUDED.mastery_threshold,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Seed edges: from = prerequisite → to = dependent (DAG)
-- ---------------------------------------------------------------------------
INSERT INTO public.cge_edges (from_competency_id, to_competency_id, edge_kind, weight) VALUES
  -- Foundation diagnostic chain
  ('clinical_communication', 'diagnostic_interview', 'required', 1),
  ('diagnostic_interview', 'mental_status_examination', 'required', 1),
  ('mental_status_examination', 'dsm5_reasoning', 'required', 1),
  ('dsm5_reasoning', 'icd11_reasoning', 'recommended', 0.7),
  ('mental_status_examination', 'differential_diagnosis', 'required', 1),
  ('dsm5_reasoning', 'differential_diagnosis', 'required', 1),
  ('differential_diagnosis', 'case_formulation', 'required', 1),
  ('dsm5_reasoning', 'case_formulation', 'required', 1),
  ('case_formulation', 'treatment_planning', 'required', 1),
  ('differential_diagnosis', 'treatment_planning', 'required', 1),
  ('risk_assessment', 'treatment_planning', 'required', 1),
  ('treatment_planning', 'medication_management', 'recommended', 0.8),
  ('treatment_planning', 'follow_up_planning', 'required', 1),
  -- Risk branch
  ('diagnostic_interview', 'risk_screening', 'required', 1),
  ('risk_screening', 'risk_assessment', 'required', 1),
  ('risk_assessment', 'suicide_assessment', 'required', 1),
  ('risk_assessment', 'violence_assessment', 'required', 1),
  ('suicide_assessment', 'safety_planning', 'required', 1),
  ('violence_assessment', 'safety_planning', 'recommended', 0.6),
  ('safety_planning', 'emergency_psychiatry', 'required', 1),
  ('risk_assessment', 'emergency_psychiatry', 'required', 1),
  -- Psychotherapy branch
  ('clinical_communication', 'therapeutic_alliance', 'required', 1),
  ('clinical_communication', 'empathy', 'required', 1),
  ('therapeutic_alliance', 'cbt_skills', 'required', 1),
  ('therapeutic_alliance', 'dbt_skills', 'required', 1),
  ('therapeutic_alliance', 'act_skills', 'required', 1),
  ('therapeutic_alliance', 'psychodynamic_interviewing', 'required', 1),
  ('therapeutic_alliance', 'supportive_therapy', 'required', 1),
  ('therapeutic_alliance', 'motivational_interviewing', 'recommended', 0.7),
  ('empathy', 'therapeutic_alliance', 'recommended', 0.5),
  -- Documentation branch
  ('mental_status_examination', 'documentation', 'required', 1),
  ('documentation', 'case_summary', 'required', 1),
  ('case_summary', 'diagnostic_formulation', 'required', 1),
  ('dsm5_reasoning', 'diagnostic_formulation', 'required', 1),
  ('diagnostic_formulation', 'treatment_documentation', 'required', 1),
  ('treatment_planning', 'treatment_documentation', 'required', 1),
  -- Cross-links
  ('diagnostic_interview', 'psychoeducation', 'recommended', 0.5),
  ('clinical_communication', 'professional_communication', 'recommended', 0.5),
  ('diagnostic_interview', 'time_management', 'optional', 0.3),
  ('clinical_communication', 'cultural_competence', 'recommended', 0.6),
  ('diagnostic_interview', 'family_interviewing', 'recommended', 0.5),
  ('ethical_decision_making', 'suicide_assessment', 'recommended', 0.4)
ON CONFLICT (from_competency_id, to_competency_id, edge_kind) DO NOTHING;

INSERT INTO public.cge_graph_versions (version, snapshot, change_notes)
VALUES (
  1,
  jsonb_build_object(
    'engine', 'cge',
    'version', 1,
    'nodes', (SELECT count(*) FROM public.cge_nodes),
    'edges', (SELECT count(*) FROM public.cge_edges)
  ),
  'Initial Competency Graph Engine seed'
)
ON CONFLICT (version) DO NOTHING;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.cge_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cge_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cge_graph_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cge_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cge_mastery_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cge_decay ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cge_remediation_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read cge_nodes" ON public.cge_nodes;
CREATE POLICY "Read cge_nodes" ON public.cge_nodes
  FOR SELECT TO authenticated USING (enabled = true OR EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
  ));
DROP POLICY IF EXISTS "Admin write cge_nodes" ON public.cge_nodes;
CREATE POLICY "Admin write cge_nodes" ON public.cge_nodes
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Read cge_edges" ON public.cge_edges;
CREATE POLICY "Read cge_edges" ON public.cge_edges
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin write cge_edges" ON public.cge_edges;
CREATE POLICY "Admin write cge_edges" ON public.cge_edges
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Read cge_graph_versions" ON public.cge_graph_versions;
CREATE POLICY "Read cge_graph_versions" ON public.cge_graph_versions
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin write cge_graph_versions" ON public.cge_graph_versions;
CREATE POLICY "Admin write cge_graph_versions" ON public.cge_graph_versions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Learner own cge_attempts" ON public.cge_attempts;
CREATE POLICY "Learner own cge_attempts" ON public.cge_attempts
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.learner_profiles lp
    WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    ))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.learner_profiles lp
    WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    ))
  ));

DROP POLICY IF EXISTS "Learner own cge_mastery_history" ON public.cge_mastery_history;
CREATE POLICY "Learner own cge_mastery_history" ON public.cge_mastery_history
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.learner_profiles lp
    WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    ))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.learner_profiles lp
    WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    ))
  ));

DROP POLICY IF EXISTS "Learner own cge_decay" ON public.cge_decay;
CREATE POLICY "Learner own cge_decay" ON public.cge_decay
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.learner_profiles lp
    WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    ))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.learner_profiles lp
    WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    ))
  ));

DROP POLICY IF EXISTS "Learner own cge_remediation_plans" ON public.cge_remediation_plans;
CREATE POLICY "Learner own cge_remediation_plans" ON public.cge_remediation_plans
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.learner_profiles lp
    WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    ))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.learner_profiles lp
    WHERE lp.id = learner_id AND (lp.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    ))
  ));

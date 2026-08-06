-- Clinical Validation Laboratory (CVL) — Mission 100
-- Scientific validation vault. No fabricated evidence.

CREATE TABLE IF NOT EXISTS public.cvl_studies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL
    CHECK (kind IN (
      'blind_psychiatrist_challenge',
      'blind_therapy_challenge',
      'resident_education_study',
      'longitudinal_study',
      'human_conversation_fidelity',
      'assessment_accuracy'
    )),
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'irb_pending', 'recruiting', 'active',
      'analysis', 'completed', 'archived'
    )),
  protocol_version text NOT NULL DEFAULT '1.0.0',
  irb_reference text,
  arms text[] NOT NULL DEFAULT '{real_patient,standardized_patient,vpsych_avatar}',
  target_reviewer_types text[] NOT NULL DEFAULT '{}',
  disorder_slugs text[] NOT NULL DEFAULT '{}',
  preregistration jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.cvl_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  study_id uuid NOT NULL REFERENCES public.cvl_studies (id) ON DELETE CASCADE,
  reviewer_token text NOT NULL,
  reviewer_type text NOT NULL,
  arm text NOT NULL
    CHECK (arm IN ('real_patient', 'standardized_patient', 'vpsych_avatar')),
  case_ref text NOT NULL,
  disorder_slug text,
  modality text NOT NULL DEFAULT 'transcript',
  block_id text,
  UNIQUE (study_id, reviewer_token, case_ref)
);

CREATE INDEX IF NOT EXISTS cvl_assignments_study_idx
  ON public.cvl_assignments (study_id);

CREATE TABLE IF NOT EXISTS public.cvl_bpc_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  study_id uuid NOT NULL REFERENCES public.cvl_studies (id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES public.cvl_assignments (id) ON DELETE CASCADE,
  reviewer_token text NOT NULL,
  reviewer_type text NOT NULL,
  modality text NOT NULL DEFAULT 'transcript',
  ratings jsonb NOT NULL,
  would_teach_with_case boolean,
  believed_arm text,
  confidence_pct numeric(5,2) NOT NULL
    CHECK (confidence_pct >= 0 AND confidence_pct <= 100),
  free_comments text,
  teaching_opportunities text,
  quality_concerns text,
  rated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cvl_btc_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  study_id uuid NOT NULL REFERENCES public.cvl_studies (id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES public.cvl_assignments (id) ON DELETE CASCADE,
  reviewer_token text NOT NULL,
  reviewer_type text NOT NULL,
  ratings jsonb NOT NULL,
  final_diagnosis_guess text,
  believed_is_ai boolean,
  confidence_pct numeric(5,2) NOT NULL
    CHECK (confidence_pct >= 0 AND confidence_pct <= 100),
  free_comments text,
  rated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cvl_education_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  study_id uuid NOT NULL REFERENCES public.cvl_studies (id) ON DELETE CASCADE,
  learner_token text NOT NULL,
  group_name text NOT NULL CHECK (group_name IN ('traditional', 'vpsych')),
  osce numeric,
  mse numeric,
  dsm_diagnosis numeric,
  icd_diagnosis numeric,
  risk_assessment numeric,
  empathy numeric,
  documentation numeric,
  retention numeric,
  supervisor_rating numeric,
  time_to_competency_days numeric,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cvl_longitudinal_measures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  study_id uuid NOT NULL REFERENCES public.cvl_studies (id) ON DELETE CASCADE,
  case_instance_id text NOT NULL,
  session_index integer NOT NULL CHECK (session_index BETWEEN 1 AND 50),
  memory numeric,
  life_events numeric,
  alliance numeric,
  treatment_response numeric,
  trust numeric,
  disclosure numeric,
  clinical_progression numeric,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cvl_hcf_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  study_id uuid NOT NULL REFERENCES public.cvl_studies (id) ON DELETE CASCADE,
  case_ref text NOT NULL,
  disorder_slug text NOT NULL,
  locale text NOT NULL DEFAULT 'en',
  facets jsonb NOT NULL,
  overall numeric NOT NULL,
  rater_token text NOT NULL,
  rated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cvl_cfl_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  case_ref text NOT NULL UNIQUE,
  disorder_slug text,
  level text NOT NULL
    CHECK (level IN ('CFL-1', 'CFL-2', 'CFL-3', 'CFL-4', 'CFL-5')),
  rationale jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  ledger_ref text,
  human_approved boolean NOT NULL DEFAULT false
);

COMMENT ON TABLE public.cvl_studies IS
  'CVL study registry — scientific validation protocols';
COMMENT ON TABLE public.cvl_cfl_records IS
  'Clinical Fidelity Levels — human-approved before publication claims';

ALTER TABLE public.cvl_studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cvl_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cvl_bpc_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cvl_btc_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cvl_education_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cvl_longitudinal_measures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cvl_hcf_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cvl_cfl_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY cvl_studies_admin_all
  ON public.cvl_studies FOR ALL TO authenticated
  USING ((select public.is_admin()))
  WITH CHECK ((select public.is_admin()));

CREATE POLICY cvl_assignments_admin_all
  ON public.cvl_assignments FOR ALL TO authenticated
  USING ((select public.is_admin()))
  WITH CHECK ((select public.is_admin()));

CREATE POLICY cvl_bpc_admin_all
  ON public.cvl_bpc_ratings FOR ALL TO authenticated
  USING ((select public.is_admin()))
  WITH CHECK ((select public.is_admin()));

CREATE POLICY cvl_btc_admin_all
  ON public.cvl_btc_ratings FOR ALL TO authenticated
  USING ((select public.is_admin()))
  WITH CHECK ((select public.is_admin()));

CREATE POLICY cvl_edu_admin_all
  ON public.cvl_education_outcomes FOR ALL TO authenticated
  USING ((select public.is_admin()))
  WITH CHECK ((select public.is_admin()));

CREATE POLICY cvl_long_admin_all
  ON public.cvl_longitudinal_measures FOR ALL TO authenticated
  USING ((select public.is_admin()))
  WITH CHECK ((select public.is_admin()));

CREATE POLICY cvl_hcf_admin_all
  ON public.cvl_hcf_evaluations FOR ALL TO authenticated
  USING ((select public.is_admin()))
  WITH CHECK ((select public.is_admin()));

CREATE POLICY cvl_cfl_admin_all
  ON public.cvl_cfl_records FOR ALL TO authenticated
  USING ((select public.is_admin()))
  WITH CHECK ((select public.is_admin()));

CREATE TABLE IF NOT EXISTS public.cvl_assessment_accuracy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  study_id uuid NOT NULL REFERENCES public.cvl_studies (id) ON DELETE CASCADE,
  case_ref text NOT NULL,
  disorder_slug text NOT NULL,
  expert_scores jsonb NOT NULL,
  platform_scores jsonb NOT NULL,
  absolute_error numeric,
  correlation numeric,
  rater_token text NOT NULL,
  notes text,
  rated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cvl_assessment_accuracy ENABLE ROW LEVEL SECURITY;

CREATE POLICY cvl_assessment_accuracy_admin_all
  ON public.cvl_assessment_accuracy FOR ALL TO authenticated
  USING ((select public.is_admin()))
  WITH CHECK ((select public.is_admin()));

-- Allow Quality Ledger to record CVL Clinical Fidelity Level seals.
ALTER TABLE public.quality_ledgers
  DROP CONSTRAINT IF EXISTS quality_ledgers_event_type_check;

ALTER TABLE public.quality_ledgers
  ADD CONSTRAINT quality_ledgers_event_type_check
  CHECK (event_type IN (
    'assessment_completed',
    'report_generated',
    'competency_updated',
    'adaptive_curriculum_updated',
    'clinical_template_updated',
    'instructor_preset_updated',
    'ai_model_changed',
    'platform_upgraded',
    'correction',
    'cvl_cfl_assigned'
  ));

COMMENT ON TABLE public.cvl_assessment_accuracy IS
  'Expert vs platform score pairs for assessment accuracy studies — human expert scores only.';

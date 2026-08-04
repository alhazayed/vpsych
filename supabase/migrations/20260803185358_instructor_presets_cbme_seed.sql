-- Mission 11: seed missing CBME learner presets + remap competencies to CGE ids.

-- Remap legacy non-CGE competency ids on existing presets
UPDATE public.preset_competencies
SET competency_id = CASE competency_id
  WHEN 'safety' THEN 'suicide_assessment'
  WHEN 'alliance' THEN 'therapeutic_alliance'
  WHEN 'mse' THEN 'mental_status_examination'
  WHEN 'time' THEN 'time_management'
  WHEN 'cbt_structure' THEN 'cbt_skills'
  WHEN 'communication' THEN 'clinical_communication'
  ELSE competency_id
END
WHERE competency_id IN (
  'safety', 'alliance', 'mse', 'time', 'cbt_structure', 'communication'
);

-- Point suicide preset pin at MDD template (compatible default);
-- PTSD remains a preferred secondary via preset_templates.
UPDATE public.instructor_presets
SET
  scenario_template_id = 'e1000000-0000-4000-8000-000000000001',
  updated_at = now()
WHERE slug = 'suicide-risk-resident-en'
  AND scenario_template_id IS DISTINCT FROM 'e1000000-0000-4000-8000-000000000001';

INSERT INTO public.instructor_presets (
  id, slug, name, description, specialty, target_learner, learning_level,
  clinical_rotation, assessment_type, primary_objective, difficulty,
  time_limit_minutes, language, culture, therapy_modality, randomization_level,
  grading_mode, feedback_mode, voice_enabled, assessment_enabled,
  allow_hints, allow_pause, allow_restart, advanced_mode,
  scenario_template_id, enabled, version
) VALUES
(
  'f1000000-0000-4000-8000-000000000004',
  'foundation-interview-medstudent-en',
  'Foundation Diagnostic Interview — Medical Student',
  'Undergraduate CBME station: alliance, MSE basics, and structured history.',
  'general_adult_psychiatry', 'medical_student', 'undergraduate',
  'clerkship', 'initial_assessment', 'diagnostic_interview', 'beginner',
  30, 'en-US', 'north_american_urban', 'supportive', 'low',
  'practice', 'realtime_coaching', true, true,
  true, true, true, false,
  'e1000000-0000-4000-8000-000000000001', true, 1
),
(
  'f1000000-0000-4000-8000-000000000005',
  'mi-counselor-en',
  'Motivational Interviewing — Counselor',
  'Counseling CBME: MI spirit, alliance, and psychoeducation on substance/mood overlap.',
  'counselling', 'counselor', 'postgraduate',
  'outpatient', 'initial_assessment', 'motivational_interviewing', 'intermediate',
  40, 'en-US', 'north_american_urban', 'motivational_interviewing', 'moderate',
  'practice', 'end_of_session', true, true,
  true, true, true, false,
  'e1000000-0000-4000-8000-000000000001', true, 1
),
(
  'f1000000-0000-4000-8000-000000000006',
  'cbt-psychologist-en',
  'CBT Formulation — Psychologist',
  'Psychology CBME: CBT skills, formulation, and collaborative treatment planning.',
  'clinical_psychology', 'psychologist', 'postgraduate',
  'outpatient', 'cbt_session', 'cbt_skills', 'intermediate',
  45, 'en-US', 'north_american_urban', 'cbt', 'moderate',
  'practice', 'end_of_session', true, true,
  true, true, true, false,
  'e1000000-0000-4000-8000-000000000001', true, 1
),
(
  'f1000000-0000-4000-8000-000000000007',
  'complex-formulation-consultant-en',
  'Complex Formulation — Consultant Psychiatrist',
  'Fellowship-level formulation and differential for complex mood/psychosis presentations.',
  'general_adult_psychiatry', 'consultant_psychiatrist', 'fellowship',
  'consultation_liaison', 'initial_assessment', 'differential_diagnosis', 'expert',
  45, 'en-US', 'north_american_urban', 'psychodynamic', 'high',
  'supervisor_review', 'supervisor_only', true, true,
  false, true, false, true,
  'e1000000-0000-4000-8000-000000000001', true, 1
)
ON CONFLICT (slug) DO UPDATE SET
  description = EXCLUDED.description,
  target_learner = EXCLUDED.target_learner,
  primary_objective = EXCLUDED.primary_objective,
  difficulty = EXCLUDED.difficulty,
  time_limit_minutes = EXCLUDED.time_limit_minutes,
  therapy_modality = EXCLUDED.therapy_modality,
  grading_mode = EXCLUDED.grading_mode,
  feedback_mode = EXCLUDED.feedback_mode,
  allow_hints = EXCLUDED.allow_hints,
  advanced_mode = EXCLUDED.advanced_mode,
  scenario_template_id = EXCLUDED.scenario_template_id,
  enabled = EXCLUDED.enabled,
  updated_at = now();

INSERT INTO public.preset_objectives (preset_id, objective, is_primary, sort_order) VALUES
  ('f1000000-0000-4000-8000-000000000004', 'diagnostic_interview', true, 1),
  ('f1000000-0000-4000-8000-000000000004', 'mental_status_examination', false, 2),
  ('f1000000-0000-4000-8000-000000000004', 'psychoeducation', false, 3),
  ('f1000000-0000-4000-8000-000000000004', 'shared_decision_making', false, 4),
  ('f1000000-0000-4000-8000-000000000005', 'motivational_interviewing', true, 1),
  ('f1000000-0000-4000-8000-000000000005', 'psychoeducation', false, 2),
  ('f1000000-0000-4000-8000-000000000005', 'substance_use_assessment', false, 3),
  ('f1000000-0000-4000-8000-000000000006', 'cbt_skills', true, 1),
  ('f1000000-0000-4000-8000-000000000006', 'treatment_planning', false, 2),
  ('f1000000-0000-4000-8000-000000000006', 'differential_diagnosis', false, 3),
  ('f1000000-0000-4000-8000-000000000006', 'psychoeducation', false, 4),
  ('f1000000-0000-4000-8000-000000000007', 'differential_diagnosis', true, 1),
  ('f1000000-0000-4000-8000-000000000007', 'treatment_planning', false, 2),
  ('f1000000-0000-4000-8000-000000000007', 'diagnostic_interview', false, 3),
  ('f1000000-0000-4000-8000-000000000007', 'risk_assessment', false, 4)
ON CONFLICT DO NOTHING;

INSERT INTO public.preset_competencies (preset_id, competency_id, label, required, weight, max_score, sort_order) VALUES
  ('f1000000-0000-4000-8000-000000000004', 'therapeutic_alliance', 'Therapeutic alliance', true, 1.5, 5, 1),
  ('f1000000-0000-4000-8000-000000000004', 'diagnostic_interview', 'Diagnostic interview', true, 1.5, 5, 2),
  ('f1000000-0000-4000-8000-000000000004', 'empathy', 'Empathy', true, 1, 5, 3),
  ('f1000000-0000-4000-8000-000000000005', 'therapeutic_alliance', 'Alliance', true, 1.5, 5, 1),
  ('f1000000-0000-4000-8000-000000000005', 'empathy', 'Empathy', true, 1.5, 5, 2),
  ('f1000000-0000-4000-8000-000000000006', 'cbt_skills', 'CBT skills', true, 1.5, 5, 1),
  ('f1000000-0000-4000-8000-000000000006', 'therapeutic_alliance', 'Alliance', true, 1, 5, 2),
  ('f1000000-0000-4000-8000-000000000007', 'differential_diagnosis', 'Differential diagnosis', true, 2, 5, 1),
  ('f1000000-0000-4000-8000-000000000007', 'case_formulation', 'Case formulation', true, 1.8, 5, 2),
  ('f1000000-0000-4000-8000-000000000007', 'therapeutic_alliance', 'Therapeutic alliance', true, 1.2, 5, 3),
  ('f1000000-0000-4000-8000-000000000007', 'dsm5_reasoning', 'DSM-5 diagnostic reasoning', false, 1, 5, 4)
ON CONFLICT DO NOTHING;

INSERT INTO public.preset_templates (preset_id, template_id, priority) VALUES
  ('f1000000-0000-4000-8000-000000000004', 'e1000000-0000-4000-8000-000000000001', 10),
  ('f1000000-0000-4000-8000-000000000004', 'e1000000-0000-4000-8000-000000000002', 5),
  ('f1000000-0000-4000-8000-000000000005', 'e1000000-0000-4000-8000-000000000001', 10),
  ('f1000000-0000-4000-8000-000000000006', 'e1000000-0000-4000-8000-000000000001', 10),
  ('f1000000-0000-4000-8000-000000000007', 'e1000000-0000-4000-8000-000000000001', 10),
  ('f1000000-0000-4000-8000-000000000007', 'e1000000-0000-4000-8000-000000000003', 5)
ON CONFLICT DO NOTHING;

INSERT INTO public.preset_grading (preset_id, pass_threshold, outstanding_threshold, critical_mistakes, dimensions) VALUES
  (
    'f1000000-0000-4000-8000-000000000004', 60, 85,
    '["hostile_stance","no_agenda"]'::jsonb,
    '["communication","empathy","therapeutic_alliance","dsm_reasoning"]'::jsonb
  ),
  (
    'f1000000-0000-4000-8000-000000000005', 65, 88,
    '["advice_before_agenda"]'::jsonb,
    '["communication","empathy","therapeutic_alliance","psychoeducation"]'::jsonb
  ),
  (
    'f1000000-0000-4000-8000-000000000006', 70, 90,
    '["advice_before_agenda"]'::jsonb,
    '["cbt_skills","treatment_planning","communication","alliance"]'::jsonb
  ),
  (
    'f1000000-0000-4000-8000-000000000007', 80, 95,
    '["missed_si","unsafe_medication_combination","premature_closure"]'::jsonb,
    '["diagnostic_accuracy","dsm_reasoning","differential","formulation","communication","empathy","therapeutic_alliance","risk_assessment","treatment_planning","documentation","professionalism","time_management"]'::jsonb
  )
ON CONFLICT (preset_id) DO NOTHING;

INSERT INTO public.preset_versions (preset_id, version, snapshot, change_notes)
SELECT id, version, to_jsonb(instructor_presets.*) || jsonb_build_object('seed', true), 'Mission 11 CBME learner coverage'
FROM public.instructor_presets
WHERE slug IN (
  'foundation-interview-medstudent-en',
  'mi-counselor-en',
  'cbt-psychologist-en',
  'complex-formulation-consultant-en'
)
ON CONFLICT (preset_id, version) DO NOTHING;

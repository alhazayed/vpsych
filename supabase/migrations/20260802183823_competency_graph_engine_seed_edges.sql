-- Canonical migration recovered for Release Configuration Board reconciliation.
-- Source: production supabase_migrations.schema_migrations statements
-- (enriched only when production statements were empty/placeholder).

INSERT INTO public.cge_edges (from_competency_id, to_competency_id, edge_kind, weight) VALUES
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
  ('diagnostic_interview', 'risk_screening', 'required', 1),
  ('risk_screening', 'risk_assessment', 'required', 1),
  ('risk_assessment', 'suicide_assessment', 'required', 1),
  ('risk_assessment', 'violence_assessment', 'required', 1),
  ('suicide_assessment', 'safety_planning', 'required', 1),
  ('violence_assessment', 'safety_planning', 'recommended', 0.6),
  ('safety_planning', 'emergency_psychiatry', 'required', 1),
  ('risk_assessment', 'emergency_psychiatry', 'required', 1),
  ('clinical_communication', 'therapeutic_alliance', 'required', 1),
  ('clinical_communication', 'empathy', 'required', 1),
  ('therapeutic_alliance', 'cbt_skills', 'required', 1),
  ('therapeutic_alliance', 'dbt_skills', 'required', 1),
  ('therapeutic_alliance', 'act_skills', 'required', 1),
  ('therapeutic_alliance', 'psychodynamic_interviewing', 'required', 1),
  ('therapeutic_alliance', 'supportive_therapy', 'required', 1),
  ('therapeutic_alliance', 'motivational_interviewing', 'recommended', 0.7),
  ('empathy', 'therapeutic_alliance', 'recommended', 0.5),
  ('mental_status_examination', 'documentation', 'required', 1),
  ('documentation', 'case_summary', 'required', 1),
  ('case_summary', 'diagnostic_formulation', 'required', 1),
  ('dsm5_reasoning', 'diagnostic_formulation', 'required', 1),
  ('diagnostic_formulation', 'treatment_documentation', 'required', 1),
  ('treatment_planning', 'treatment_documentation', 'required', 1),
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

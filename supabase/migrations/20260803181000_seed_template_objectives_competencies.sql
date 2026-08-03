-- Clinical Templates certification: seed missing objectives/competencies for
-- production templates that only had parent rows (preview/generation failed
-- validateTemplate with objectives_missing / competencies_missing).

-- Adult GAD OSCE (Arabic)
INSERT INTO public.template_objectives (template_id, category, statement, sort_order)
SELECT ct.id, v.category, v.statement, v.sort_order
FROM public.clinical_templates ct
CROSS JOIN (
  VALUES
    ('skills', 'Elicit worry domains and panic features in Arabic', 1),
    ('risk', 'Screen for SI without cultural stigma escalation', 2),
    ('dsm_reasoning', 'Defend GAD vs panic disorder differential', 3)
) AS v(category, statement, sort_order)
WHERE ct.slug = 'adult-gad-osce-ar'
  AND NOT EXISTS (
    SELECT 1 FROM public.template_objectives o WHERE o.template_id = ct.id
  );

INSERT INTO public.template_competencies (
  template_id, competency_id, label, weight, max_score, critical, sort_order
)
SELECT ct.id, v.competency_id, v.label, v.weight, v.max_score, v.critical, v.sort_order
FROM public.clinical_templates ct
CROSS JOIN (
  VALUES
    ('alliance', 'Therapeutic alliance', 1.2, 5, false, 1),
    ('safety', 'Safety assessment', 1.5, 5, true, 2),
    ('dsm', 'DSM reasoning', 1.0, 5, false, 3)
) AS v(competency_id, label, weight, max_score, critical, sort_order)
WHERE ct.slug = 'adult-gad-osce-ar'
  AND NOT EXISTS (
    SELECT 1 FROM public.template_competencies c WHERE c.template_id = ct.id
  );

-- PTSD risk assessment (English)
INSERT INTO public.template_objectives (template_id, category, statement, sort_order)
SELECT ct.id, v.category, v.statement, v.sort_order
FROM public.clinical_templates ct
CROSS JOIN (
  VALUES
    ('risk', 'Complete trauma-informed risk assessment', 1),
    ('skills', 'Titrate trauma content; avoid flooding', 2),
    ('documentation', 'Document disposition and safety plan', 3)
) AS v(category, statement, sort_order)
WHERE ct.slug = 'ptsd-risk-assessment-en'
  AND NOT EXISTS (
    SELECT 1 FROM public.template_objectives o WHERE o.template_id = ct.id
  );

INSERT INTO public.template_competencies (
  template_id, competency_id, label, weight, max_score, critical, auto_deduction, sort_order
)
SELECT ct.id, v.competency_id, v.label, v.weight, v.max_score, v.critical, v.auto_deduction, v.sort_order
FROM public.clinical_templates ct
CROSS JOIN (
  VALUES
    ('safety', 'Safety assessment', 2.0, 5, true, 20, 1),
    ('trauma_pacing', 'Trauma pacing', 1.5, 5, false, 0, 2)
) AS v(competency_id, label, weight, max_score, critical, auto_deduction, sort_order)
WHERE ct.slug = 'ptsd-risk-assessment-en'
  AND NOT EXISTS (
    SELECT 1 FROM public.template_competencies c WHERE c.template_id = ct.id
  );

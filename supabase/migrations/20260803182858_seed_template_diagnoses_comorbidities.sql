-- Canonical migration recovered for Release Configuration Board reconciliation.
-- Source: production supabase_migrations.schema_migrations statements
-- (enriched only when production statements were empty/placeholder).

-- Scenario Engine certification: seed diagnosis/comorbidity child rows for GAD and PTSD
INSERT INTO public.template_diagnoses (template_id, disorder_id, role)
SELECT ct.id, d.id, v.role
FROM public.clinical_templates ct
CROSS JOIN (
  VALUES
    ('gad-with-panic', 'primary'),
    ('mdd-recurrent-moderate', 'allowed_comorbidity'),
    ('adult-adhd', 'allowed_comorbidity'),
    ('bipolar-mania', 'excluded'),
    ('delirium', 'excluded')
) AS v(disorder_slug, role)
JOIN public.disorders d ON d.slug = v.disorder_slug
WHERE ct.slug = 'adult-gad-osce-ar'
ON CONFLICT (template_id, disorder_id, role) DO NOTHING;

INSERT INTO public.template_comorbidities (template_id, disorder_id, tier)
SELECT ct.id, d.id, 'compatible'::public.comorbidity_tier
FROM public.clinical_templates ct
JOIN public.disorders d ON d.slug IN ('mdd-recurrent-moderate', 'adult-adhd')
WHERE ct.slug = 'adult-gad-osce-ar'
ON CONFLICT (template_id, disorder_id) DO NOTHING;

INSERT INTO public.template_diagnoses (template_id, disorder_id, role)
SELECT ct.id, d.id, v.role
FROM public.clinical_templates ct
CROSS JOIN (
  VALUES
    ('ptsd', 'primary'),
    ('mdd-recurrent-moderate', 'allowed_comorbidity'),
    ('alcohol-use-disorder', 'allowed_comorbidity'),
    ('delirium', 'excluded')
) AS v(disorder_slug, role)
JOIN public.disorders d ON d.slug = v.disorder_slug
WHERE ct.slug = 'ptsd-risk-assessment-en'
ON CONFLICT (template_id, disorder_id, role) DO NOTHING;

INSERT INTO public.template_comorbidities (template_id, disorder_id, tier)
SELECT ct.id, d.id, 'compatible'::public.comorbidity_tier
FROM public.clinical_templates ct
JOIN public.disorders d ON d.slug IN ('mdd-recurrent-moderate', 'alcohol-use-disorder')
WHERE ct.slug = 'ptsd-risk-assessment-en'
ON CONFLICT (template_id, disorder_id) DO NOTHING;

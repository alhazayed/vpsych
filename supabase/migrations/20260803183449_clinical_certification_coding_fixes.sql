-- Canonical migration recovered for Release Configuration Board reconciliation.
-- Source: production supabase_migrations.schema_migrations statements
-- (enriched only when production statements were empty/placeholder).

-- Mission DSM-5/ICD-11: idempotent coding alignment (safe if already applied)
UPDATE public.disorders
SET
  dsm5_code = NULL,
  icd10_code = NULL,
  icd11_code = '6B41',
  package = COALESCE(package, '{}'::jsonb)
    || jsonb_build_object('dsm5_optional', true),
  updated_at = now()
WHERE slug = 'complex-ptsd';

UPDATE public.disorders
SET icd11_code = '6A72', updated_at = now()
WHERE slug = 'pdd';

UPDATE public.disorders
SET icd11_code = '6D10.1/6D11.5', updated_at = now()
WHERE slug = 'bpd';

UPDATE public.disorders
SET icd11_code = '6A60.2', updated_at = now()
WHERE slug = 'bipolar-mania';

UPDATE public.disorders
SET category = 'obsessive-compulsive', updated_at = now()
WHERE slug = 'ocd';

UPDATE public.disorders
SET name = 'Anorexia Nervosa', updated_at = now()
WHERE slug = 'eating-disorders' AND name ILIKE '%spectrum%';

UPDATE public.clinical_templates
SET default_persona_id = NULL, updated_at = now()
WHERE slug = 'ptsd-risk-assessment-en';

UPDATE public.avatars
SET
  clinical_core = clinical_core
    || jsonb_build_object(
      'disorder', 'Major Depressive Disorder, recurrent episode, with anxious distress',
      'dsm5_code', '296.32',
      'icd10_code', 'F33.1',
      'icd11_code', '6A71.1'
    ),
  updated_at = now()
WHERE slug = 'maya-chen'
  AND (
    clinical_core->>'dsm5_code' IS DISTINCT FROM '296.32'
    OR clinical_core->>'icd11_code' IS DISTINCT FROM '6A71.1'
  );

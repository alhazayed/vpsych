-- Mission 10 — Clinical Certification coding & persona binding fixes.
-- Verified defects: CPTSD DSM/ICD-10 misuse, bipolar ICD-11 psychosis mismatch,
-- PDD ICD-11 wrong code, BPD missing borderline pattern, OCD category, PTSD
-- template bound to MDD persona, Maya seed single-episode codes on fresh installs.

-- ---------------------------------------------------------------------------
-- Complex PTSD: ICD-11 6B41 only (no DSM-5 / ICD-10 CPTSD code)
-- ---------------------------------------------------------------------------
UPDATE public.disorders
SET
  dsm5_code = NULL,
  icd10_code = NULL,
  icd11_code = '6B41',
  package = COALESCE(package, '{}'::jsonb)
    || jsonb_build_object('dsm5_optional', true)
    || jsonb_build_object(
      'teaching_points',
      COALESCE(package->'teaching_points', '[]'::jsonb) ||
        '["ICD-11 6B41 only; DSM-5-TR has no CPTSD code — do not substitute 309.81"]'::jsonb
    ),
  updated_at = now()
WHERE slug = 'complex-ptsd';

-- ---------------------------------------------------------------------------
-- PDD / dysthymia: ICD-11 6A72 (not 6A71.0 single-episode MDD mild)
-- ---------------------------------------------------------------------------
UPDATE public.disorders
SET
  icd11_code = '6A72',
  package = COALESCE(package, '{}'::jsonb) || jsonb_build_object(
    'teaching_points',
    COALESCE(package->'teaching_points', '[]'::jsonb) ||
      '["ICD-11 dysthymic disorder is 6A72"]'::jsonb
  ),
  updated_at = now()
WHERE slug = 'pdd';

-- ---------------------------------------------------------------------------
-- BPD: severity 6D10.1 (moderate) + borderline pattern 6D11.5
-- ---------------------------------------------------------------------------
UPDATE public.disorders
SET
  icd11_code = '6D10.1/6D11.5',
  package = COALESCE(package, '{}'::jsonb) || jsonb_build_object(
    'teaching_points',
    COALESCE(package->'teaching_points', '[]'::jsonb) ||
      '["ICD-11: code severity 6D10.x plus borderline pattern 6D11.5"]'::jsonb
  ),
  updated_at = now()
WHERE slug = 'bpd';

-- ---------------------------------------------------------------------------
-- Bipolar mania with psychotic features: align ICD-11 to 6A60.2
-- ---------------------------------------------------------------------------
UPDATE public.disorders
SET
  icd11_code = '6A60.2',
  package = COALESCE(package, '{}'::jsonb) || jsonb_build_object(
    'teaching_points',
    COALESCE(package->'teaching_points', '[]'::jsonb) ||
      '["296.44 / F31.2 / 6A60.2 = manic episode with psychotic features"]'::jsonb
  ),
  updated_at = now()
WHERE slug = 'bipolar-mania';

-- ---------------------------------------------------------------------------
-- OCD: DSM-5 / ICD-11 obsessive-compulsive chapter (not anxiety)
-- ---------------------------------------------------------------------------
UPDATE public.disorders
SET
  category = 'obsessive-compulsive',
  updated_at = now()
WHERE slug = 'ocd';

-- ---------------------------------------------------------------------------
-- Eating disorder label: codes are AN-specific
-- ---------------------------------------------------------------------------
UPDATE public.disorders
SET
  name = 'Anorexia Nervosa',
  updated_at = now()
WHERE slug = 'eating-disorders'
  AND name ILIKE '%spectrum%';

-- ---------------------------------------------------------------------------
-- PTSD risk template must not bind MDD persona biography
-- ---------------------------------------------------------------------------
UPDATE public.clinical_templates
SET
  default_persona_id = NULL,
  updated_at = now()
WHERE slug = 'ptsd-risk-assessment-en';

-- ---------------------------------------------------------------------------
-- Maya Chen: ensure recurrent MDD codes (296.32 / 6A71.1) on clinical_core
-- ---------------------------------------------------------------------------
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

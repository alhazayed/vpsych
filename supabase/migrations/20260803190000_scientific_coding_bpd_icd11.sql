-- Mission 19 — Scientific coding corrections
-- BPD: ICD-11 severity + borderline pattern (not 6D10.0 alone)
-- Bipolar psychotic mania: ICD-11 6A60.2 (not 6A60.1 without psychosis)

UPDATE public.disorders
SET icd11_code = '6D10.1/6D11.5',
    updated_at = now()
WHERE slug = 'bpd'
  AND (icd11_code IS DISTINCT FROM '6D10.1/6D11.5');

UPDATE public.disorders
SET icd11_code = '6A60.2',
    updated_at = now()
WHERE slug = 'bipolar-mania'
  AND (icd11_code IS DISTINCT FROM '6A60.2');

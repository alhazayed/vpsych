-- Mission 11: Instructor Presets Certification
-- Add consultant_psychiatrist learner for CBME coverage.

ALTER TYPE public.target_learner ADD VALUE IF NOT EXISTS 'consultant_psychiatrist';

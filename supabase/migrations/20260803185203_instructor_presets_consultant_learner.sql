-- Canonical migration recovered for Release Configuration Board reconciliation.
-- Source: production supabase_migrations.schema_migrations statements
-- (enriched only when production statements were empty/placeholder).

-- Mission 11: Instructor Presets Certification
-- Add consultant_psychiatrist learner for CBME coverage.

ALTER TYPE public.target_learner ADD VALUE IF NOT EXISTS 'consultant_psychiatrist';

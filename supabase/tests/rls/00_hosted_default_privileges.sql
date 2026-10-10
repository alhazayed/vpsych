-- Recreate the default privileges the production project was created with.
--
-- Hosted Supabase projects made before 2026 grant SELECT/INSERT/UPDATE/DELETE
-- on new public tables to anon, authenticated and service_role by default, and
-- the migrations in supabase/migrations rely on that (they REVOKE from anon
-- but never GRANT to authenticated). Newer Supabase images no longer grant
-- those by default, so a fresh local database must be given them before the
-- migrations run, or every table reads as "permission denied" and the RLS
-- tests would pass for the wrong reason.
--
-- Test-only. Never run against a real project.
alter default privileges for role postgres in schema public
  grant select, insert, update, delete, truncate, references, trigger
  on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant usage, select, update on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant execute on functions to anon, authenticated, service_role;

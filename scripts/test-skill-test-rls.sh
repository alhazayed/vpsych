#!/usr/bin/env bash
# Exercises the skill test RLS policies and triggers on a throwaway Postgres
# database: stub Supabase schema -> migration -> assertions.
#
# Usage: PGHOST=... PGPORT=... PGUSER=postgres scripts/test-skill-test-rls.sh
# Requires psql and a superuser connection. Creates and drops a temporary
# database named vpsych_skill_test_rls; never point it at the real project.
set -euo pipefail
cd "$(dirname "$0")/.."
DB=vpsych_skill_test_rls
psql -v ON_ERROR_STOP=1 -q -d postgres -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB"
trap 'psql -q -d postgres -c "DROP DATABASE IF EXISTS $DB" >/dev/null' EXIT
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f supabase/tests/skill-tests/00_stub_schema.sql
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f supabase/migrations/20261005110000_supervisor_skill_tests.sql
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f supabase/tests/skill-tests/10_assertions.sql

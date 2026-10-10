#!/usr/bin/env bash
# Builds a throwaway Supabase database from every migration in git and runs the
# database security tests in supabase/tests/rls against it.
#
# Usage: scripts/test-db-rls.sh            (needs Docker, psql and npx)
#        KEEP_DB=1 scripts/test-db-rls.sh  (leave the database running)
#
# The database lives in a local Docker container started by the Supabase CLI
# from a temporary project directory; nothing here reads a real project's
# credentials or connects anywhere but 127.0.0.1.
set -euo pipefail
cd "$(dirname "$0")/.."
REPO="$PWD"
# shellcheck source=scripts/lib/local-supabase.sh
. "$REPO/scripts/lib/local-supabase.sh"

WORKDIR="$(mktemp -d)"
DB_PORT="${RLS_DB_PORT:-54422}"

cleanup() {
  if [[ "${KEEP_DB:-}" != "1" ]]; then
    (cd "$WORKDIR" && $SUPABASE_CLI stop --no-backup >/dev/null 2>&1) || true
    rm -rf "$WORKDIR"
  else
    echo "Database left running on 127.0.0.1:$DB_PORT (stop: cd $WORKDIR && $SUPABASE_CLI stop --no-backup)"
  fi
}
trap cleanup EXIT

init_local_project "$WORKDIR" vpsych-rls-test
sed -i.bak \
  -e "/^\[db\]/,/^\[/ s/^port = .*/port = $DB_PORT/" \
  -e "/^\[db\]/,/^\[/ s/^shadow_port = .*/shadow_port = $((DB_PORT + 1))/" \
  "$WORKDIR/supabase/config.toml"
(cd "$WORKDIR" && $SUPABASE_CLI db start)

export PGHOST=127.0.0.1 PGPORT="$DB_PORT" PGUSER=postgres PGPASSWORD=postgres PGDATABASE=postgres
apply_schema

status=0
for t in "$REPO"/supabase/tests/rls/[1-9]*.sql; do
  echo "== $(basename "$t")"
  if ! psql -X -q -v ON_ERROR_STOP=1 -o /dev/null -f "$t" 2>&1 | sed -e 's/^psql:[^ ]* //' -e 's/^NOTICE:  //'; then
    status=1
  fi
done
exit "$status"

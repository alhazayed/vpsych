# Shared helpers for tests that run against a throwaway local Supabase stack.
# Source this file; it expects REPO to point at the repository root.

SUPABASE_CLI="${SUPABASE_CLI:-npx --yes supabase@2.110.0}"

# Creates a Supabase CLI project in $1 with an empty migrations dir: the CLI
# must not apply anything itself, because the hosted default privileges have
# to be in place before the first migration.
init_local_project() {
  local dir="$1" project_id="$2"
  (cd "$dir" && $SUPABASE_CLI init --force >/dev/null)
  sed -i.bak -e "s/^project_id = .*/project_id = \"$project_id\"/" "$dir/supabase/config.toml"
}

# Recreates production's default privileges, then applies every migration in
# git order. Uses the PG* environment for the connection.
apply_schema() {
  local err
  err="$(mktemp)"
  psql -X -q -v ON_ERROR_STOP=1 -o /dev/null -f "$REPO/supabase/tests/rls/00_hosted_default_privileges.sql"
  local count=0 f
  for f in "$REPO"/supabase/migrations/*.sql; do
    if ! psql -X -q -v ON_ERROR_STOP=1 -o /dev/null -f "$f" 2>"$err"; then
      echo "Migration failed: $(basename "$f")" >&2
      cat "$err" >&2
      rm -f "$err"
      return 1
    fi
    count=$((count + 1))
  done
  rm -f "$err"
  echo "Applied $count migrations."
}

#!/usr/bin/env bash
# Browser end-to-end test: a throwaway local Supabase stack (auth + database +
# REST) built from every migration, the production build of the app pointed at
# it, two fresh accounts, then the Playwright specs in e2e/.
#
# Usage: scripts/test-e2e.sh                (needs Docker, psql, npx, a browser)
#        SKIP_BUILD=1 scripts/test-e2e.sh   (reuse an existing .next built for this stack)
#        KEEP_STACK=1 scripts/test-e2e.sh   (leave Supabase running afterwards)
#
# Nothing here reads a real project's credentials: the keys are the CLI's local
# demo keys, read from `supabase status`, and everything binds to 127.0.0.1.
# There is no OpenAI or ElevenLabs key, so patient replies are persona
# fallbacks, reports use the heuristic assessment, and voice calls return 501.
set -euo pipefail
cd "$(dirname "$0")/.."
REPO="$PWD"
# shellcheck source=scripts/lib/local-supabase.sh
. "$REPO/scripts/lib/local-supabase.sh"

WORKDIR="$(mktemp -d)"
API_PORT="${E2E_API_PORT:-54521}"
DB_PORT="${E2E_DB_PORT:-54522}"
APP_PORT="${E2E_APP_PORT:-3100}"
APP_PID=""

cleanup() {
  [[ -n "$APP_PID" ]] && kill "$APP_PID" 2>/dev/null || true
  if [[ "${KEEP_STACK:-}" != "1" ]]; then
    (cd "$WORKDIR" && $SUPABASE_CLI stop --no-backup >/dev/null 2>&1) || true
    rm -rf "$WORKDIR"
  else
    echo "Supabase left running (stop: cd $WORKDIR && $SUPABASE_CLI stop --no-backup)"
  fi
}
trap cleanup EXIT

init_local_project "$WORKDIR" vpsych-e2e
# Admin pages require a TOTP second factor, so the local auth server must allow
# enrolling one.
sed -i.bak \
  -e "/^\[api\]/,/^\[/ s/^port = .*/port = $API_PORT/" \
  -e "/^\[db\]/,/^\[/ s/^port = .*/port = $DB_PORT/" \
  -e "/^\[db\]/,/^\[/ s/^shadow_port = .*/shadow_port = $((DB_PORT + 1))/" \
  -e '/^\[auth.mfa.totp\]/,/^\[/ s/^\(enroll_enabled\|verify_enabled\) = false/\1 = true/' \
  "$WORKDIR/supabase/config.toml"
(cd "$WORKDIR" && $SUPABASE_CLI start \
  -x studio,imgproxy,storage-api,realtime,edge-runtime,logflare,vector,supavisor,postgres-meta,mailpit)

status_env="$(cd "$WORKDIR" && $SUPABASE_CLI status -o env)"
read_status() { sed -n "s/^$1=\"\{0,1\}\([^\"]*\)\"\{0,1\}$/\1/p" <<<"$status_env"; }
API_URL="$(read_status API_URL)"
ANON_KEY="$(read_status ANON_KEY)"
SERVICE_ROLE_KEY="$(read_status SERVICE_ROLE_KEY)"

export PGHOST=127.0.0.1 PGPORT="$DB_PORT" PGUSER=postgres PGPASSWORD=postgres PGDATABASE=postgres
apply_schema
psql -X -q -c "notify pgrst, 'reload schema'"

# Fresh accounts: a trainee and an admin, both approved.
E2E_PASSWORD="E2e-$(openssl rand -hex 12)-Pw!"
E2E_TRAINEE_EMAIL="trainee-$RANDOM@e2e.invalid"
E2E_ADMIN_EMAIL="admin-$RANDOM@e2e.invalid"
for email in "$E2E_TRAINEE_EMAIL" "$E2E_ADMIN_EMAIL"; do
  curl -fsS -o /dev/null -X POST "$API_URL/auth/v1/admin/users" \
    -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$E2E_PASSWORD\",\"email_confirm\":true}"
done
# The approval and role guards only let an admin change these; fixtures
# bypass triggers instead.
psql -X -q -v ON_ERROR_STOP=1 \
  -v trainee="$E2E_TRAINEE_EMAIL" -v admin="$E2E_ADMIN_EMAIL" <<'SQL'
begin;
set local session_replication_role = replica;
update public.profiles p set approval_status = 'approved'
  from auth.users u where u.id = p.id and u.email in (:'trainee', :'admin');
update public.profiles p set role = 'admin'
  from auth.users u where u.id = p.id and u.email = :'admin';
commit;
SQL

export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
if [[ "${SKIP_BUILD:-}" != "1" ]]; then
  npm run build
fi
npx next start -H 127.0.0.1 -p "$APP_PORT" >"$WORKDIR/app.log" 2>&1 &
APP_PID=$!
for _ in $(seq 1 60); do
  curl -fs -o /dev/null "http://127.0.0.1:$APP_PORT/login" && break
  sleep 1
done

export E2E_BASE_URL="http://127.0.0.1:$APP_PORT" E2E_PASSWORD E2E_TRAINEE_EMAIL E2E_ADMIN_EMAIL
if ! npx playwright test "$@"; then
  echo "---- app log (tail) ----" >&2
  tail -50 "$WORKDIR/app.log" >&2
  exit 1
fi

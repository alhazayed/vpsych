# Operations Runbook — Version 1.0 RC1 (Stage 12)

**Audience:** Release Manager / on-call  
**Production:** `https://vpsych.vercel.app`  
**Supabase ref:** `rrzudbkxigeavfdnidnm`  
**Vercel project:** `prj_qiJ1mQvX0s5lJZ9KJnpWAx4EXjNm`  
**Package:** `1.0.0-rc.1` · Cert `VPSYCH-1.0-RC1-STAGE12`  
**Companions:** `DEPLOYMENT_GUIDE.md` · `DISASTER_RECOVERY.md` · `INCIDENT_RESPONSE.md`

---

## 1. Health checks

```bash
curl -sS https://vpsych.vercel.app/api/health
# expect: {"ok":true,"service":"vpsych","version":"1.0.0-rc.1",...}

curl -sS -o /dev/null -w '%{http_code}\n' https://vpsych.vercel.app/login
# expect: 200

curl -sS -X POST https://vpsych.vercel.app/api/sessions -H 'content-type: application/json' -d '{}'
# expect: 401 {"error":"Unauthorized"}

# Admin ops dashboard (requires admin auth): GET /api/admin/ops/metrics
```

Authenticated checks require vault `VPSYCH_AUDIT_*` after Credential Verification Gate (see `RELEASE_DECISION_LOG` RDL-009/011).

---

## 2. Deployment

- Production tracks `main` auto-deploy on Vercel.
- After merge: confirm deploy READY and SHA matches `git rev-parse origin/main`.
- Do **not** merge experimental excellence PRs during Professional Preview without Board unlock.

---

## 3. Migrations

- Git `supabase/migrations/` is canonical.
- Never edit applied migrations; add new timestamped files.
- After applying via MCP/CLI, ensure filename version ≡ `schema_migrations.version`.
- Local: `npm run test:migrations` (remote parity when `SUPABASE_DB_URL` set).

**Recovery from drift:** restore missing SQL files from the branch that applied them; apply missing git migrations to prod; rename files only when aligning to an already-recorded remote version.

---

## 4. Secrets checklist

| Secret | Required for |
|--------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` | App boot |
| `SUPABASE_SERVICE_ROLE_KEY` and/or `REPORT_WRITE_KEY` | Report write + cron batch expiry |
| `OPENAI_API_KEY` or `AI_GATEWAY_API_KEY` | Patient + assessment |
| `ELEVENLABS_API_KEY` (`sk_…`) | TTS |
| `UPSTASH_REDIS_*` | Horizontal rate limits |
| `CRON_SECRET` | Bearer auth for `GET /api/cron/expire-sessions` (fail-closed if unset) |
| `VPSYCH_AUDIT_*` | Certification agents only |

Never commit secrets. Rotate if leaked. Never put secrets in `NEXT_PUBLIC_*`, client bundles, UI, or logs.

---

## 5. Feature flags

| Flag | Safe default |
|------|----------------|
| `NEXT_PUBLIC_THERAPY_ROOM_MODE` | unset / false |

---

## 6. Incident: session create 500

1. Check `/api/health`.  
2. Check RPC grants on `insert_system_message` / `insert_assistant_message` (authenticated + ownership).  
3. Check service role / report key.  
4. Check provider keys / `aiSource`.  
5. Check recent migrations vs git.

Historical: W1-C1 / V1-C1 grant and body restores.

---

## 7. Incident: TTS 502/503

1. Verify Production `ELEVENLABS_API_KEY` format `sk_…`.  
2. Redeploy after env change.  
3. Auth smoke `POST /api/voice/tts` → `audio/mpeg`.  
Historical: W3-H5 (RDL-023→024).

---

## 8. Rollback

- Vercel instant rollback to prior READY production deploy.  
- Tag `rc1-pp-1.0-baseline` → `d4c4fae` (pre-#139 lineage) — use only with Board approval (schema may have moved forward).  
- Prefer forward fix for migration-applied changes.

---

## 9. Session expiry cron (Phase 5)

Application support is **READY**. Scheduler configuration is a **deployment responsibility**.
`vercel.json` does **not** declare crons (Hobby rejects them). Use Vercel Pro Cron or an external scheduler.

**Phase 6 status:**
- `CRON_SECRET` is configured in Vercel (production + preview) as a sensitive env var.
- External scheduler workflow prepared: `.github/workflows/expire-sessions.yml` (every 15 min).
- Production `main` does **not** yet include the expire-sessions route — merge Phase 4+ first.
- Repository Actions secret `CRON_SECRET` must be set by an operator (matches Vercel value) before the workflow succeeds.

| Item | Value |
|------|--------|
| Endpoint | `GET /api/cron/expire-sessions` |
| Auth | `Authorization: Bearer $CRON_SECRET` |
| Required env | `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` |
| Recommended schedule | every 15 minutes |
| Success | `200` `{ ok, scanned, expired, saturated }` |
| Failures | `401` unauthorized · `503` secret/service-role missing · `429` rate limit · `500` batch failure |
| Idempotency | CAS update `status=active` only; safe to retry |
| Side effects | Marks timed-out active sessions `expired`; **does not** assess or create reports |

**Verify execution**

```bash
# Expect 401 or 503 without a valid bearer (never 200)
curl -sS -o /tmp/cron.json -w '%{http_code}\n' \
  https://vpsych.vercel.app/api/cron/expire-sessions

# With secret from vault (do not echo the secret):
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  https://vpsych.vercel.app/api/cron/expire-sessions
# expect: {"ok":true,"scanned":N,"expired":M,"saturated":bool}
```

Check Vercel/runtime logs for `[cron/expire-sessions] start|complete|failed` with `scanned` / `expired` / `durationMs`.

**Rotate `CRON_SECRET`:** set a new value in Vercel Production → update scheduler → redeploy if needed → revoke old secret.  
**Disable:** remove/pause the scheduler job; endpoint remains fail-closed without a caller.

Companions: `docs/PHASE5_GOVERNANCE.md`, route comment on `src/app/api/cron/expire-sessions/route.ts`.

---

## 10. Certification unlock

1. Credential Verification Gate PASS.  
2. Migration parity PASS.  
3. SHA ≡ main PASS.  
4. Append RDL row.  
5. Only then start a wave agent.

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
| `SUPABASE_SERVICE_ROLE_KEY` and/or `REPORT_WRITE_KEY` | Report write |
| `OPENAI_API_KEY` or `AI_GATEWAY_API_KEY` | Patient + assessment |
| `ELEVENLABS_API_KEY` (`sk_…`) | TTS |
| `UPSTASH_REDIS_*` | Horizontal rate limits |
| `VPSYCH_AUDIT_*` | Certification agents only |

Never commit secrets. Rotate if leaked.

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

## 9. Certification unlock

1. Credential Verification Gate PASS.  
2. Migration parity PASS.  
3. SHA ≡ main PASS.  
4. Append RDL row.  
5. Only then start a wave agent.

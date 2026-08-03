# VPsych Operations Runbook

**Mission:** 24 — Disaster Recovery & Operational Excellence  
**Audience:** DevOps / SRE / on-call

---

## Deploy

1. Merge to `main` (CI must be green: lint, typecheck, test, migrations, build).
2. Vercel auto-deploys production from `main`.
3. Smoke after deploy:
   - `GET https://<host>/api/health` → `{ "status": "ok" }`
   - `GET https://<host>/api/health/ready` → `status` is `ok` or `degraded` (not `down`)
   - Login → start session → one message → end session

## Rollback

1. **Preferred:** Vercel Dashboard → Project → Deployments → previous Production → **Promote to Production** (or `vercel rollback` if CLI configured).
2. **Git:** revert the bad commit on `main` and push (triggers new deploy).
3. **Do not** run irreversible DB migrations forward during an incident unless required for restore.
4. Re-run smoke checks above.

## Secrets rotation

Rotate in this order; update Vercel env + Supabase secrets; redeploy:

| Secret | Where |
|---|---|
| `OPENAI_API_KEY` | Vercel |
| `ELEVENLABS_API_KEY` | Vercel |
| `SUPABASE_SERVICE_ROLE_KEY` / anon keys | Vercel + regenerate in Supabase |
| `REPORT_WRITE_KEY` | Vercel (invalidate old signed report writers) |
| `UPSTASH_REDIS_REST_URL` / `TOKEN` | Vercel |
| Auth email hook secrets | Supabase |

After rotation: hit `/api/health/ready` and admin `/api/health/openai`.

## Rate limits

Production **must** set Upstash. Without it, memory fallback is per-isolate only.

## Preview protection

Enable Vercel Deployment Protection (password or SSO) on Preview deployments.

## Observability

- Runtime: Vercel logs + `security_audit_events`
- Recommended: enable Vercel Observability / external APM (Sentry) for SEV1 paging

# IT Operations Guide — Controlled Institutional Deployment

**Audience:** Institutional IT · platform DevOps · security engineering  
**Version:** `1.0.0-rc.1`

## Infrastructure

| Component | Provider | Notes |
|-----------|----------|-------|
| App | Vercel (Next.js 16, Node 22) | Production tracks `main` |
| Auth + DB | Supabase (Postgres + RLS) | us-east-1 project |
| AI | OpenAI and/or Vercel AI Gateway | Patient + assessment |
| TTS | ElevenLabs | `sk_…` key; AbortSignal timeout |
| Rate limit | Upstash Redis | Required for multi-instance fairness |
| CDN / DNS | Vercel ± Cloudflare | Bypass cache for `/api/*` |

## Scaling

- Design envelope (Stage 10): 100 orgs · 10k users · 1k concurrent sessions.  
- Scale Vercel concurrency; watch DB connection pool and `session_messages` growth.  
- Enterprise/realtime in-process stores are **not** multi-instance authoritative — plan Redis/Postgres before mega-tenants (ENT-08, RT-S11-02).  
- Voice provider quotas dominate practical concurrency.

## Monitoring

| Surface | Purpose |
|---------|---------|
| `GET /api/health` | Public liveness + version |
| `GET /api/admin/ops/metrics` | Env posture, latency budgets |
| `GET /api/admin/ops/cidp` | CIDP system/clinical/institution/research/security/executive |
| `/admin/cidp` | Human dashboard |
| Vercel / Supabase logs | Vendor drains |
| `security_audit_events` | Authz denials |

Alert thresholds: see `monitoring/ALERTS.json` and `../INCIDENT_RESPONSE.md`.

## Alerts (minimum)

1. `/api/health` not ok for > 2 minutes.  
2. Deploy FAILED on `main`.  
3. Migration parity drift.  
4. TTS/STT error rate spike.  
5. Open Critical institutional feedback > 0 for > 24h without owner.  
6. Auth failure burst / RBAC denial burst.

## Disaster recovery

Follow `DISASTER_RECOVERY_REPORT.md` and `../DISASTER_RECOVERY.md`:

- Application rollback (Vercel promote).  
- Database PITR / backup restore (staging drill preferred).  
- Secrets recovery from vault (never git).  
- Evidence forms for audit.

## Security

- Secrets only in Vercel / Supabase Vault / password manager.  
- `.env.example` is the annotated inventory — values never committed.  
- Platform admin gate + RLS + rate limits + security headers.  
- Dependency audit in CI (`npm run audit:deps`).  
- See `SECURITY_REPORT.md`.

## Environment variables

Critical production set (names only):

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `REPORT_WRITE_KEY` and/or `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` or `AI_GATEWAY_API_KEY`, `ELEVENLABS_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `NEXT_PUBLIC_APP_URL`.

Feature flags default off: `NEXT_PUBLIC_THERAPY_ROOM_MODE`, `FEATURE_REALTIME_SIMULATION`.

Full list: `../../.env.example`.

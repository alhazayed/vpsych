# Operations Manual — Controlled Institutional Deployment

**Audience:** Release Manager · on-call · institutional IT liaison  
**Version:** `1.0.0-rc.1`  
**Supersedes for CIDP day-2 ops:** complements `../OPERATIONS_RUNBOOK.md` (does not replace it)

## 1. Daily

- Check `GET /api/health` → `ok: true`, version `1.0.0-rc.1`.  
- Skim Vercel production deploy status.  
- Review open Critical items in `/admin/feedback`.  
- Glance `/admin/cidp` for abandoned simulation spikes / auth anomalies.

## 2. Weekly

- Export CIDP executive metrics snapshot (JSON from `/api/admin/ops/cidp`) to pilot folder.  
- Confirm Upstash + provider quotas.  
- Review security audit denials sample.  
- Sync with faculty lead on training completion.

## 3. Per deploy

1. CI green: audit → lint → typecheck → test → migrations → perf-smoke → build.  
2. Production SHA ≡ `main`.  
3. Migration parity if schema changed.  
4. Smoke: login page 200; unauthenticated POST `/api/sessions` → 401 JSON.  
5. Authenticated smoke when Credential Gate available.  
6. Append RDL row for material decisions.

## 4. Incident classes

| Class | Examples | Runbook |
|-------|----------|---------|
| Sev-1 | Total auth outage, data leak suspicion | `../INCIDENT_RESPONSE.md` |
| Sev-2 | TTS total failure, session create 500 | Ops runbook §§6–7 |
| Sev-3 | Elevated latency, partial locale issues | CIDP dashboards + provider status |
| Pilot | Feedback Critical clinical distortion | Triage queue + faculty notify |

## 5. Support request taxonomy (pilot)

Track in pilot report:

- Deployment success / failure  
- Configuration issues  
- Support requests  
- Critical incidents  
- Feature requests (wishlist — do not block Critical)  
- Training completion  
- Operational metrics

## 6. Ownership reminder

Ops may restart, roll back, rotate secrets, and triage feedback. Ops **must not** patch patient prompts, clinical_snapshot writers, or assessment formulas without Clinical Safety + Board authorization.

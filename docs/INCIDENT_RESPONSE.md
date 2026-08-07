# Incident Response — VPsych Version 1.0

**Cert:** Stage 12 · Companion to `OPERATIONS_RUNBOOK.md` and `DISASTER_RECOVERY.md`

## Severity

| Sev | Definition | Response |
|-----|------------|----------|
| SEV-1 | Total outage / data exposure / auth bypass | Page immediately; war room; exec notify |
| SEV-2 | Session create/message/end or TTS broken for all users | Page on-call; fix/rollback < 2h |
| SEV-3 | Degraded (elevated latency, single provider) | Business hours; track |
| SEV-4 | Cosmetic / docs | Backlog |

## Roles

| Role | Duty |
|------|------|
| On-call engineer | Triage, mitigate, communicate |
| Release Manager | Vault/credentials, Board notices |
| Security lead | Suspected breach / audit events |
| Clinical lead | Messaging if training integrity impacted (no score validation claims) |

## First 15 minutes

1. Declare severity.  
2. `curl -sS https://vpsych.vercel.app/api/health`  
3. Check Vercel deploy status + recent commits.  
4. Check Supabase project health + logs.  
5. Check provider status (OpenAI, ElevenLabs, Upstash).  
6. Capture `X-Request-Id` from failing client reports.  
7. If SEV-1/2: freeze merges to `main`.

## Playbooks

### Session create / message 500

1. Health OK?  
2. RPC grants for message insert.  
3. Service role / `REPORT_WRITE_KEY`.  
4. Migration drift.  
5. Historical refs: V1-C1 / W1-C1.

### TTS 502/503/504

1. `ELEVENLABS_API_KEY` format `sk_…`.  
2. Timeout (`TTS_TIMEOUT` / `ELEVENLABS_TIMEOUT_MS`).  
3. Voice plan / library voice fallbacks.  
4. Historical: W3-H5.

### Auth / login failures

1. Supabase Auth status.  
2. Credential Verification Gate if audit accounts.  
3. Password recovery route (prior blank-page fix).  

### Suspected data exposure

1. Revoke impacted sessions/keys.  
2. Query `security_audit_events` / `enterprise_audit_events`.  
3. Rotate `REPORT_WRITE_KEY`, service role, provider keys as needed.  
4. Legal/compliance notify per institutional contracts.  
5. Do **not** discuss PHI in public tickets.

### Rate-limit / abuse

1. Confirm Upstash.  
2. Tighten limits if needed (code change + deploy).  
3. Block abusive IPs at Cloudflare/Vercel Firewall if available.

## Communications

- Internal: status in eng channel every 30 min for SEV-1/2.  
- External institutions: factual availability only; no speculative clinical claims.  
- Postmortem within 5 business days for SEV-1/2; append RDL pointer.

## Evidence pack

- Deploy id, git SHA, health JSON, sample sanitized logs, request ids, migration parity output, decision (rollback vs forward fix).

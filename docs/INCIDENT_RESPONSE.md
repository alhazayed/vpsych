# VPsych Incident Response

**Mission:** 24

---

## Severity

| Severity | Definition | Example |
|---|---|---|
| SEV1 | Platform unusable; data risk | Supabase/DB down; mass auth failure |
| SEV2 | Major feature down or bad deploy | Production rollback; full OpenAI outage with weak fallbacks |
| SEV3 | Degraded non-critical path | ElevenLabs down (browser TTS OK); Upstash down |
| SEV4 | Minor / informational | Single-region latency spike |

Helpers: `createIncidentStub`, `severityForDependency` in `src/lib/ops/targets.ts`.

---

## Response checklist (all SEVs)

1. Acknowledge alert / page on-call  
2. Check `/api/health` and `/api/health/ready`  
3. Confirm blast radius (auth, sessions, voice, assessment)  
4. Verify graceful degradation (circuits, persona, browser TTS)  
5. Communicate status to stakeholders  
6. Capture timeline for postmortem  

## Comms stub

```
INCIDENT <id> | SEV<n> | <title>
Impact: <who/what>
Status: investigating | mitigating | resolved
Next update: <time>
```

## Postmortem template

- Summary  
- Timeline (UTC)  
- Root cause  
- Impact (users, duration, RPO)  
- What went well / poorly  
- Action items (owner, due date)  

## Tracking

Until an external pager (PagerDuty/Opsgenie) is wired, track incidents in the team tracker and retain `security_audit_events` for access anomalies. Outage sims assert alert/checklist generation in CI.

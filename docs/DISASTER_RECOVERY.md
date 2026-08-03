# VPsych Disaster Recovery Plan

**Mission:** 24  
**Product:** Educational clinical simulation (not a medical device)

---

## Objectives

| Metric | Target | Notes |
|---|---|---|
| **RPO** | ≤ **24 hours** | Supabase automated backups / PITR (verify in project settings) |
| **RTO** | ≤ **4 hours** | Restore DB + promote known-good Vercel deployment + smoke |
| Vendor degrade | ≤ **30 seconds** | Circuit open → persona / heuristic / browser TTS |

Defined in code: `src/lib/ops/targets.ts` → `RECOVERY_OBJECTIVES`.

---

## Failure modes

| Failure | Impact | Recovery |
|---|---|---|
| OpenAI outage | Chat/STT/assessment degraded | Circuit + persona/heuristic fallback |
| ElevenLabs outage | TTS degraded | Circuit + browser speechSynthesis |
| Supabase Auth/API outage | Login/sessions down (SEV1) | Wait / failover region if offered; status page |
| Postgres corruption / loss | Data loss risk (SEV1) | PITR restore to last good timestamp |
| Bad production deploy | App broken (SEV2) | Vercel rollback / promote previous |
| Network partition | Partial checks fail | Retry; readiness shows `down`/`degraded` |

---

## Database recovery (Supabase)

1. Declare incident (SEV1) — freeze schema changes.
2. Identify RPO: last known-good backup / PITR point.
3. Restore via Supabase Dashboard (Backups / PITR) to a new project or in-place per vendor docs.
4. Point `NEXT_PUBLIC_SUPABASE_URL` / keys at restored project if needed; redeploy.
5. Re-apply any migrations missing after restore (`supabase/migrations`).
6. Smoke: health → login → session create/message/end.
7. Rotate service role if compromise suspected.

## Application recovery (Vercel)

1. Promote last green production deployment.
2. Confirm env vars present.
3. `GET /api/health` and `/api/health/ready`.

## Business continuity

- Training may continue in **degraded** mode (persona text, no TTS) during AI vendor outages.
- Auth/DB outages block sessions — communicate ETA using RTO budget.
- Institutions should keep offline OSCE contingency plans for SEV1 platform outages.

## Testing

In-process drills: `src/lib/ops/outage-sim.ts` (vitest).  
Live PITR drills: schedule quarterly in staging project (ops-owned).

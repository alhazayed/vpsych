# VPsych Production Activation Certificate — Phase 6

| Field | Value |
|-------|-------|
| Certificate | `VPSYCH-PHASE6-ACTIVATION` |
| Commit | `ae25092` |
| Branch | `cursor/admin-production-activation-fc9c` |
| Environment | Vercel project `prj_qiJ1mQvX0s5lJZ9KJnpWAx4EXjNm` · Production URL `https://vpsych.vercel.app` · Supabase `rrzudbkxigeavfdnidnm` |
| Platform model | **Platform-admin educational console** (not institution-scoped) |

## Operational

```text
Scheduler:              NOT VERIFIED   (workflow prepared; Actions secret + main merge required)
CRON_SECRET (Vercel):   VERIFIED       (sensitive; production + preview)
Service role (Vercel):  VERIFIED       (present; not logged)
Passive expiry (app):   VERIFIED       (local controlled fixture)
Passive expiry (prod automation): NOT VERIFIED
```

## Tenancy

```text
New session stamping:     VERIFIED
Membership population:    NOT READY   (0 memberships; 0 primaries)
Historical 603 rows:      DECISION DOCUMENTED — remain NULL
```

## Data lifecycle

```text
Retention policy:   DEFERRED   (PRODUCT DECISION)
Automatic purge:    DISABLED
```

## Security

```text
Admin auth:         VERIFIED
API auth:           VERIFIED
RLS:                VERIFIED
IDOR:               VERIFIED (focused)
Secret isolation:   VERIFIED (no NEXT_PUBLIC_CRON; sensitive type)
```

## Release

```text
Build:              VERIFIED
Tests:              VERIFIED
CI (GitHub verify): NOT VERIFIED until PR targets main
Production smoke (full Admin Phase 1–5 UI): NOT VERIFIED on production main
Preview/local smoke: VERIFIED (Phase 5+ surfaces)
```

## Remaining blockers

1. Merge Phase 1–6 chain to `main` so production serves expire-sessions + Admin Console.
2. Operator sets GitHub Actions secret `CRON_SECRET` (= Vercel value) **or** enables Vercel Pro Cron.
3. Provision real `institution_memberships` / `primary_institution_id` before claiming institutional readiness.
4. Retention product decision before any scheduled purge.

**Do not call this platform institution-ready.** Institutional prerequisites remain unmet.

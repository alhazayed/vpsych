# RC4 — Bugfix Freeze

**Trigger:** Starts only after RC3 Wave 1 re-run **PASS** and Executive Board acceptance recorded in `docs/RC3_PRODUCTION_VALIDATION.md`.

**Status:** NOT STARTED (RC3 not passed as of 2026-08-04)

## Allowed changes

| Allowed | Examples |
|---|---|
| Critical bug fixes | Session/RPC outages, auth bypasses, data loss |
| High-severity bug fixes | Broken clinical flows, severe UX blockers |
| Security fixes | HIBP enablement, grant hardening, header gaps |
| Regression fixes | Reverts of RC3-proven regressions |
| Documentation corrections | Cert reports, runbooks, RELEASE_MANIFEST edits |

## Forbidden

- Feature work
- New engines / ledgers / metrics
- Opportunistic refactors
- v1.1 backlog merges (`docs/V1_1_BACKLOG.md`)

## Process

1. Every PR labeled `rc4-freeze` with severity + linked RC3 defect ID.  
2. CI: lint → typecheck → test → migrations → build (all green).  
3. Production validation note appended to `docs/rc3/` for each fix.  
4. No `package.json` version bump to `1.0.0` in RC4 (that is RC5).

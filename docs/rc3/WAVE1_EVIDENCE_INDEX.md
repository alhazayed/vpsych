# RC3 Wave 1 — Evidence Index

**Master evidence ID:** `RC3-W1-EV-20260805T1305Z`  
**Prior gate:** `RC3-C2-EV-20260805T1245Z` (RDL-011) · PR #109

## Production identity

| Item | Value |
|---|---|
| URL | https://vpsych.vercel.app |
| SHA | `5bf66c07f11d286c305f59398a015614d22b723b` |
| Deployment | `dpl_5F6pBTi21VrYWaxmWSRcNnCcxTA4` |
| Supabase | `rrzudbkxigeavfdnidnm` |
| Migrations | 55 ≡ 55 (latest `20260805130453`) |
| Agent | `bc-633ebfe4-f64d-4ded-a27d-101fecb90594` |

## Documents

| Path | Role |
|---|---|
| `docs/rc3/MISSION01_REPORT.md` | Mission 1 |
| `docs/rc3/MISSION02_REPORT.md` | Mission 2 |
| `docs/rc3/MISSION03_REPORT.md` | Mission 3 |
| `docs/rc3/MISSION04_REPORT.md` | Mission 4 + W1-C1 |
| `docs/rc3/MISSION05_REPORT.md` | Mission 5 |
| `docs/rc3/WAVE1_SUMMARY.md` | Wave summary |
| `docs/rc3/WAVE1_EXECUTIVE_SUMMARY.md` | Board one-pager |
| `docs/rc3/WAVE1_RISK_MATRIX.md` | Risks |
| `docs/RELEASE_DECISION_LOG.md` | RDL-012 |
| `supabase/migrations/20260805130453_restore_session_message_rpc_owner_auth.sql` | W1-C1 fix |
| `scripts/rc3-credential-gate-preflight.mjs` | Preflight |

## Machine evidence (repo)

| Path | Contents |
|---|---|
| `docs/rc3/evidence/wave1_pack_2026-08-05T1305Z.json` | Pack index |
| `docs/rc3/evidence/wave1_public_probes.json` | Public HTTP/security |
| `docs/rc3/evidence/wave1_session_pipeline.json` | Create/message/end |
| `docs/rc3/evidence/wave1_browser_evidence.json` | Browser login/UI |
| `docs/rc3/evidence/wave1_browser_retest_after_w1c1.json` | Post-fix create |
| `docs/rc3/evidence/rc3_c2_gate_pass_2026-08-05T1245Z.json` | Prior gate |

## Artifacts (agent VM)

| Path | Contents |
|---|---|
| `/opt/cursor/artifacts/rc3/wave1/screenshots/` | M01/M02/M04 PNGs |
| `/opt/cursor/artifacts/rc3/wave1/*.json` | Raw probes |

## Correction traceability

| Mission | Finding | Evidence | RDL |
|---|---|---|---|
| 04 | W1-C1 | Runtime logs + 500 body + post-fix 200 pipeline | RDL-012 |

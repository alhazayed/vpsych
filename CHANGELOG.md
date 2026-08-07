# Changelog

All notable changes to VPsych are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/). Versioning follows semver.

## [1.0.0-rc.1] — 2026-08-07

### Added

- **Wave-1 Simulated Patient Library** — 10 new bilingual (en-US / ar-JO) standardized patients covering trauma, OCD, psychosis, personality, substance, eating, ADHD, bipolar, perinatal, and adolescent pathways (`personas/*.case.json`, seed migration, therapy cues, personality catalog, scenario templates). Library grows from 2 → 12 examination-ready SPs without changing clinical cognition engines.
- **Wave-2 Simulated Patient Library** — 38 additional bilingual SPs with faculty/debrief/scoring packs, difficulty lanes (beginner→expert/OSCE/emergency/longitudinal), and broader diagnostic/demographic coverage. Library total **50** examination-ready patients. Catalog packages added for PDD, ASD, and schizoaffective.
- Stage 12 Production Release Certification package (`docs/PRODUCTION_READINESS.md`, `SECURITY_AUDIT.md`, `DEPLOYMENT_GUIDE.md`, `DISASTER_RECOVERY.md`, `INCIDENT_RESPONSE.md`, `PERFORMANCE_REPORT.md`, `RELEASE_CERTIFICATION.md`, `VERSION_1_0_RELEASE_REPORT.md`).
- Production ops metrics admin API: `GET /api/admin/ops/metrics`.
- Environment presence validation (`src/lib/env.ts`).
- Request correlation IDs (`X-Request-Id`) on STT, session message, and TTS routes.
- CI dependency audit gate (`npm run audit:deps`) and performance smoke (`npm run test:perf-smoke`).
- Public `/api/health` now reports `version` and `certId`.
- **CIDP (Controlled Institutional Deployment)** package under `docs/cidp/` — executive report, institutional checklist, role manuals (Administrator / Faculty / Resident / Research / IT), operations manual, security & DR reports, pilot template, GA readiness, Release Board package.
- Institutional feedback system: `institutional_feedback` migration, `POST/GET /api/feedback`, admin triage APIs/UI, PHI heuristics.
- CIDP operational dashboards: `GET /api/admin/ops/cidp`, `/admin/cidp`, monitoring configs under `docs/cidp/monitoring/`.
- Restored `docs/RELEASE_GOVERNANCE.md` and `docs/RELEASE_OPERATIONS_CHECKLIST.md`.
- CIDP execution: feedback `assigned_owner_id` / `resolution` / `audit_trail`; auto-classification Critical→Suggestion; educational/feedback/pilot dashboard panels; success metrics; pilot portfolio summary; weekly reports at `GET /api/admin/ops/cidp/weekly`; governance attestations + security/DR evidence logs; executive leadership + hospital administration guides.

### Changed

- Package version `0.1.0` → `1.0.0-rc.1`.
- ElevenLabs TTS uses `AbortSignal.timeout` (default 30s; `ELEVENLABS_TIMEOUT_MS`).
- Scientific admin dashboards (ALE/AVI/CFI/CGE/ERI/RRS/VQI/quality-ledger/ACE learners) and OpenAI health probe are rate-limited.
- Enterprise ownership rule documents institutional pilot feedback (CIDP) without patient-state writes.

### Security

- Closed ARCH-S2-05 rate-limit gaps on scientific admin routes.
- Documented OWASP mapping and penetration checklist in `SECURITY_AUDIT.md`.
- Feedback + CIDP admin routes rate-limited; RLS on `institutional_feedback`.

### Notes

- Stages 1–11 remain canonical; Stage 12 / CIDP do not add patient or supervisor cognition.
- Competency scores remain **unvalidated** — see `KNOWN_LIMITATIONS.md`.
- CIDP is **not** General Availability — see `docs/cidp/GA_READINESS_REPORT.md` and RDL-029.

## [0.1.0] — 2026-08-06

Mission Omega Limited Professional Preview baseline through Stage 11 (Enterprise + Realtime) on `main`. See `docs/RELEASE_NOTES_RC1.md` and `docs/FINAL_RELEASE_CERTIFICATION.md`.

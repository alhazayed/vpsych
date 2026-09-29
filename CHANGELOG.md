# Changelog

All notable changes to VPsych are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/). Versioning follows semver.

## [1.0.0-rc.1] — 2026-08-07

### Added

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
- **Phase 14** Global Institutional Pilot / GA readiness (`docs/stage14/`): ten-gate `evaluateGaReadiness()`, risk register, lessons learned, clinical/educational/research evidence aggregators, longitudinal trends, `GET /api/admin/ops/phase14`, Phase 14 panel on `/admin/cidp`, expanded weekly report kinds (research · educational · operations), living evidence logs under `docs/cidp/evidence/`.
- **Phase 15** Final GA Authorization & Global Clinical Validation (`docs/stage15/`): `evaluatePhase15Authorization()` Board gates, pilot completion reporting, security/DR/infra/clinical/educational/research/operational certification aggregators, `GET /api/admin/ops/phase15`, Phase 15 panel, Board package with **NO-GO for `v1.0.0`** (RDL-032). Version remains `1.0.0-rc.1`.
- **Phase 16** Institutional Pilot Execution & Evidence Collection (`docs/stage16/`): Evidence-Pending-first dashboards/registry/reports, `evaluatePhase16GaGates()` (incl. pen-test), weekly/monthly executive reports, `GET /api/admin/ops/phase16`, Phase 16 panel. **No fabricated pilots/drills/outcomes.** GA remains NO-GO (RDL-033).
- **Arabic Speech Preparation Engine (ASPE)** (`src/lib/arabic-speech/`, `docs/ARABIC_SPEECH_PREPARATION_ENGINE.md`): deterministic TTS orthography for Arabic — selective clinical tashkeel, number/abbreviation expansion; wired into `/api/voice/tts` without mutating stored transcripts. Production validation: `docs/ARABIC_SPEECH_PRODUCTION_VALIDATION.md` (**GO WITH CONDITIONS**; ElevenLabs audio QA EVIDENCE PENDING). CI `nanoid` audit failure is pre-existing and unrelated.

### Changed

- Package version `0.1.0` → `1.0.0-rc.1`.
- ElevenLabs TTS uses `AbortSignal.timeout` (default 30s; `ELEVENLABS_TIMEOUT_MS`).
- Scientific admin dashboards (ALE/AVI/CFI/CGE/ERI/RRS/VQI/quality-ledger/ACE learners) and OpenAI health probe are rate-limited.
- Enterprise ownership rule documents institutional pilot feedback (CIDP) without patient-state writes.
- Weekly CIDP reports now include research, educational, and operations packs (Phase 14).

### Security

- Closed ARCH-S2-05 rate-limit gaps on scientific admin routes.
- Documented OWASP mapping and penetration checklist in `SECURITY_AUDIT.md`.
- Feedback + CIDP admin routes rate-limited; RLS on `institutional_feedback`.

### Notes

- Stages 1–11 remain canonical; Stage 12 / CIDP / Phase 14 do not add patient or supervisor cognition.
- Competency scores remain **unvalidated** — see `KNOWN_LIMITATIONS.md`.
- CIDP is **not** General Availability — see `docs/stage16/GA_READINESS_DASHBOARD.md`, RDL-029…033. Version `1.0.0` is **not** authorized. Missing evidence displays **Evidence Pending**.

## [0.1.0] — 2026-08-06

Mission Omega Limited Professional Preview baseline through Stage 11 (Enterprise + Realtime) on `main`. See `docs/RELEASE_NOTES_RC1.md` and `docs/FINAL_RELEASE_CERTIFICATION.md`.

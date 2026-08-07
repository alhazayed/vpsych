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

### Changed

- Package version `0.1.0` → `1.0.0-rc.1`.
- ElevenLabs TTS uses `AbortSignal.timeout` (default 30s; `ELEVENLABS_TIMEOUT_MS`).
- Scientific admin dashboards (ALE/AVI/CFI/CGE/ERI/RRS/VQI/quality-ledger/ACE learners) and OpenAI health probe are rate-limited.

### Security

- Closed ARCH-S2-05 rate-limit gaps on scientific admin routes.
- Documented OWASP mapping and penetration checklist in `SECURITY_AUDIT.md`.

### Notes

- Stages 1–11 remain canonical; Stage 12 does not add patient or supervisor cognition.
- Competency scores remain **unvalidated** — see `KNOWN_LIMITATIONS.md`.

## [0.1.0] — 2026-08-06

Mission Omega Limited Professional Preview baseline through Stage 11 (Enterprise + Realtime) on `main`. See `docs/RELEASE_NOTES_RC1.md` and `docs/FINAL_RELEASE_CERTIFICATION.md`.

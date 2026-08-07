# Technical Debt — Mission Omega

**Date:** 2026-08-06  
**Rule:** Debt is inventoried here for v1.1 — not fixed unless it blocks production integrity.

## Documentation drift

| Item | Severity | Notes |
|------|----------|-------|
| `CLAUDE.md` references `weightedOverallScore` / `reliability.ts` / `test:reliability` / `calibration/` | High | Files/scripts absent; canonical score is private `weightedOverall` in `assessment.ts` |
| `CLAUDE.md` migration/test/table counts stale | Medium | Git has **66** migrations (was documented as 61); refresh with Stage 2 baseline |
| `docs/CANONICAL_MIGRATION_LEDGER.md` frozen at 54 files | Medium | Post-ledger migrations (QL, CQG, TRM, personality, LTM, CVP) not in ledger |
| `docs/V1_RELEASE_CERTIFICATION.md` says scientific ledgers absent | High | Stale — Wave 3 shipped QL + indices on main |
| `docs/V1_1_BACKLOG.md` still lists #62–#68 as deferred scientific | Medium | Engines largely on main; PRs are historical forks |

## Architecture hardening (Stage 2 findings)

| ID | Severity | Item | Suggested remediation |
|----|----------|------|------------------------|
| ARCH-S2-01 | High | `scientific` ↔ metric/case/ACE import cycles | Split `versions` + psychometrics into cycle-free `scientific-core` |
| ARCH-S2-02 | Medium | Emotion + Adaptation both upsert `case_memory` | Atomic namespaced patch helper |
| ARCH-S2-03 | Medium | Dual TRM flags (`THERAPY_ROOM_MODE` vs `FEATURE_THERAPY_ROOM`) | Single flag matrix in `features.ts` |
| ARCH-S2-04 | Medium | Case ↔ Template ↔ Preset mutual imports | Extract `lib/case-contracts` |
| ARCH-S2-05 | Low | Some admin scientific routes lack rate limits | Align to 30–60/h |
| ARCH-S2-06 | Low | Message route is composition root inline | Optional `lib/session-turn` orchestrator (no behaviour change) |
| ARCH-S2-07 | Medium | Migration ledger / CLAUDE counts vs 66 files | Refresh ledger after next DB parity run |

## Clinical model gaps (Stage 3)

Full catalogue: `docs/clinical/CLINICAL_GAP_ANALYSIS.md` + roadmap in `CLINICAL_ROADMAP.md`.

| ID | Severity | Item |
|----|----------|------|
| CLIN-S3-01 | Critical | Dual model: authored persona case_file (MSE, protectives) vs slim runtime ClinicalCore |
| CLIN-S3-02 | Critical | Protective factors not on ClinicalCore (CFI notes gap) |
| CLIN-S3-03 | Critical | No runtime MSE object / Module 1 MSE injection |
| CLIN-S3-04 | High | No structured medication / substance-pattern models |
| CLIN-S3-05 | Medium | Emotion vs Adaptation overlapping trust/rapport variables |
| CLIN-S3-06 | Medium | Living environment is prose only (no engine) |

## Runtime orchestration debt (Stage 4)

Full catalogue: `docs/runtime/RUNTIME_DEBT.md`.

| ID | Severity | Item |
|----|----------|------|
| RT-01 | High | Dual `case_memory` writers + void adaptation save |
| RT-03 | High | ElevenLabs fetch without timeout/AbortSignal |
| RT-04 | Medium | Message god-route (no `lib/session-turn` yet) |
| RT-05 | High | Unbounded prompt token growth |
| RT-06 | Medium | `therapistInterrupted` not sent by clients |
| RT-12 | Medium | No APM / trace correlation across STT→message→TTS |

## Code residue

| Item | Severity | Notes |
|------|----------|-------|
| `hasAzureSpeech()` unused | Low | Dead export |
| Azure/Deepgram `.env.example` comments | Low | Documented unused |
| Case-engine “placeholder clinical safety pairs” comment | Low | Formulary completeness |
| ACE “manual curriculum placeholder” string | Low | When adaptive_mode off |
| Landing marketing stats | Medium | Honesty risk for preview |
| ESLint unused-var warnings (12) | Low | No errors |

## Operational / security debt

| Item | Severity |
|------|----------|
| Leaked-password protection disabled | Medium |
| In-memory rate limit without Upstash (multi-instance) | Medium |
| No Sentry/APM baseline | Medium |
| DR drill not certified | Medium |
| Audit credential vault churn | High for certification velocity |
| Open PR sprawl (33) | Medium hygiene |

## Product / clinical debt

| Item | Severity |
|------|----------|
| Competency scores unvalidated | High (claims) |
| Scientific score tables mostly empty | Medium |
| Institutional memberships unused | Medium |
| Certifications table empty / no learner badges | Low |
| Excellence engines only on draft PRs | Intentional |

## Duplicate logic

| Item | Notes |
|------|-------|
| Instructor preset heuristic grader vs assessment `weightedOverall` | Different purposes — keep separate; do not merge |
| Historical cert docs vs Omega package | Prefer Omega + RC1 for current truth |

## v1.1 roadmap pointer

Excellence/HCE/enterprise/SEO deferred work remains in open `[v1.1]` / experimental PRs. Do not activate in production during Professional Preview.

# Technical Debt — Mission Omega

**Date:** 2026-08-06  
**Rule:** Debt is inventoried here for v1.1 — not fixed unless it blocks production integrity.

## Documentation drift

| Item | Severity | Notes |
|------|----------|-------|
| `CLAUDE.md` references `weightedOverallScore` / `reliability.ts` / `test:reliability` / `calibration/` | High | Files/scripts absent; canonical score is private `weightedOverall` in `assessment.ts` |
| `CLAUDE.md` migration/test/table counts stale | Medium | Now 61 migrations; 55 test files / 317 tests |
| `docs/V1_RELEASE_CERTIFICATION.md` says scientific ledgers absent | High | Stale — Wave 3 shipped QL + indices on main |
| `docs/V1_1_BACKLOG.md` still lists #62–#68 as deferred scientific | Medium | Engines largely on main; PRs are historical forks |

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

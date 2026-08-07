# Technical Debt — Version 1.0 RC1 (Stage 12)

**Date:** 2026-08-07  
**Rule:** Debt is inventoried here for v1.1 — not fixed unless it blocks production integrity.  
**Stage 12 delta:** see [`stage12/TECHNICAL_DEBT.md`](./stage12/TECHNICAL_DEBT.md).

> **Stage 5 clinical-intelligence gaps** are catalogued under  
> [`clinical-intelligence/`](./clinical-intelligence/) (IDs `CI-*`) and sequenced in  
> [`clinical/CLINICAL_ROADMAP.md`](./clinical/CLINICAL_ROADMAP.md).  
> **Stage 6** closed the critical runtime gaps in code (`src/lib/clinical-intelligence/`);  
> remaining items are listed below with status.

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
| ARCH-S2-05 | Low | Some admin scientific routes lack rate limits | **Closed (Stage 12)** — 60/h on ALE/AVI/CFI/CGE/ERI/RRS/VQI/QL/ACE learners; 30/h OpenAI health |
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
| RT-03 | High | ~~ElevenLabs fetch without timeout/AbortSignal~~ **Closed (Stage 12)** — `AbortSignal.timeout` / `ELEVENLABS_TIMEOUT_MS` |
| RT-04 | Medium | Message god-route (no `lib/session-turn` yet) |
| RT-05 | High | Unbounded prompt token growth |
| RT-06 | Medium | `therapistInterrupted` not sent by clients |
| RT-12 | Medium | APM / trace correlation across STT→message→TTS — **Partial (Stage 12)** `X-Request-Id` shipped; vendor APM still open |

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

| Item | Severity | Stage 12 notes |
|------|----------|----------------|
| Leaked-password protection disabled | Medium | Ops residual (SEC-S12-01) |
| In-memory rate limit without Upstash (multi-instance) | Medium | Confirm Upstash in prod |
| No Sentry/APM baseline | Medium | In-app `/api/admin/ops/metrics` shipped; vendor APM still open |
| DR drill not certified | Medium | Procedures in `DISASTER_RECOVERY.md`; drill evidence open |
| Audit credential vault churn | High for certification velocity | Credential Verification Gate still binding |
| Open PR sprawl | Medium hygiene | Do not merge experimental engines during RC |

## Product / clinical debt

| Item | Severity |
|------|----------|
| Competency scores unvalidated | High (claims) |
| Scientific score tables mostly empty | Medium |
| Institutional memberships unused | Medium | Stage 10 product layer now consumes memberships; seed memberships still sparse in live DB |
| Certifications table empty / no learner badges | Low |
| Excellence engines only on draft PRs | Intentional |

## Clinical intelligence debt (Stage 5 audit → Stage 6 status)

| Item | Severity | Status | Pointer |
|------|----------|--------|---------|
| No structured beliefs / schemas / automatic thoughts | High | **Closed (runtime)** | `lib/clinical-intelligence` formulation on ClinicalCore |
| Therapy modality reaction rules are thin strings | High | **Closed (typed profiles)** · FSMs still thin | CI-T01/T02 · TherapyResponseProfile v1 |
| Adaptation cross-session carry not production-wired | Critical | **Closed (wired)** | `loadDyadClinicalCarry` on create + message |
| Protective factors missing on ClinicalCore | Critical | **Closed** | R-C1 · promoteProtectiveFactors |
| Runtime MSE subset missing | Critical | **Closed** | R-C2 · ClinicalCore.mse |
| Dual persona case_file vs snapshot model | Critical | **Partial** | Package seeds promote; authored persona JSON MSE still not fully ingested |
| Emotion ↔ Adaptation trust/rapport duplication | Medium | Open (by design OWN-02) | G-17 / CI-E06 |
| Reserved disorders without packages (6) | High | Open | G-16 / CI-D01 |
| Treatment adherence / homework state missing | Medium | **Closed (types + mind state)** | CI-B01 · case_memory.clinical_intelligence |
| Dissociation not in Decision stack | Medium | **Closed (bias)** | DecisionPlan.dissociation |
| Assessment reliability harness absent on main | High | Open | CI-S05 · `[v1.1]` |
| No 10/25/50/100 evolution scheduler | High | **Partial** | Helpers + tests; preset/ACE horizon wiring remain |
| Soft-fail ★ engines can omit affect blocks | Medium | Open | CI-R02 |
| Emotion crisis_band mode | Medium | Open | R-I10 |
| Assessor DecisionPlan telemetry | Medium | Open | R-I8 |
| Turn-level realism auditor | Medium | Open | R-I11 |
| Atomic case_memory merge helper | Medium | Open | ARCH-S2-02 / OWN-01 |

## Education debt (Stage 7 remainder)

| ID | Severity | Item | Notes |
|----|----------|------|-------|
| EDU-01 | Low | Persist education session bundles | Ephemeral today; see `docs/education/MIGRATION.md` |
| EDU-02 | Medium | Arabic interview-process heuristics | EN-biased transcript markers |
| EDU-03 | Medium | Difficulty biases → next case mint modifiers | Recommendations only today |
| EDU-04 | Medium | Learning UI radar on `/api/education/summary` | API ready; UI pending |
| EDU-05 | High (claims) | Validated competency instruments | Unchanged product debt — do not claim validation |
| EDU-06 | Medium | Assessor missed-disclosure telemetry | R-I8 / assessment side |

## Scientific validation debt (Stage 8)

| ID | Severity | Item | Notes |
|----|----------|------|-------|
| VAL-01 | Medium | DB persist best-effort vs memory SSOT | Migration shipped; apply remotely |
| VAL-02 | Medium | Keyword transcript realism heuristics | See `docs/stage8/TECHNICAL_DEBT.md` |
| VAL-03 | High | Criterion validity / OSCE co-validation absent | Intentional null until study |
| CI-S05 | High | Assessment reliability harness still `[v1.1]` | Stage 8 inter-rater store is complementary, not a full calibration harness |

## Supervisor debt (Stage 9)

| ID | Severity | Item | Notes |
|----|----------|------|-------|
| SUP-01 | Low | Persist supervisor bundles | Ephemeral memory; see `docs/stage9/TECHNICAL_DEBT.md` |
| SUP-02 | Medium | Arabic therapist-process heuristics | EN-biased markers |
| SUP-03 | Medium | Durable multi-instance portfolio | Process memory today |
| SUP-04 | High (claims) | Validated competency instruments | Do not claim validation |
| SUP-05 | Low | Admin cross-trainee supervision picker | Catalogue-only admin UI today |

## Enterprise debt (Stage 10)

| ID | Severity | Item | Notes |
|----|----------|------|-------|
| ENT-01 | Medium | Persist enterprise bundles to Postgres | Memory façade + durable tables; see `docs/stage10/TECHNICAL_DEBT.md` |
| ENT-02 | Medium | Live SAML/OIDC IdP binding | Policy abstractions ready |
| ENT-03 | Medium | Vault-backed webhook HMAC | Stub signer in tests |
| ENT-04 | Low | Course builder UI beyond admin overview | Product |
| ENT-05 | Medium | LMS/SCORM/LTI vendor adapters | Descriptors only |
| ENT-07 | Medium | Stamp `sessions.institution_id` on create | Bridge reads; create path optional |
| ENT-08 | Medium | Multi-instance enterprise store | Same pattern as Stage 8/9 |

## Realtime debt (Stage 11)

| ID | Severity | Item | Notes |
|----|----------|------|-------|
| RT-S11-01 | Medium | Mid-generation token streaming in shared session-turn | SSE adapter progressive-reveals after classic cognition; see `docs/stage11/TECHNICAL_DEBT.md` |
| RT-S11-02 | Medium | In-memory realtime metrics not multi-instance | Pair with Upstash/APM |
| RT-S11-03 | Low | Amplitude lip-sync vs phoneme visemes | CSS avatar approximation |
| RT-S11-05 | Low | Waiting-room chrome not default-mounted | Flag-gated component shipped |
| RT-S11-06 | Medium | No WebRTC/SFU media plane | Intentional HTTPS v1 path |
| RT-06 | Medium | therapistInterrupted client wiring | Partially closed — conversation pipeline now sends flag |

## Duplicate logic

| Item | Notes |
|------|-------|
| Instructor preset heuristic grader vs assessment `weightedOverall` | Different purposes — keep separate; do not merge |
| Education domain scores vs ACE CompetencyId EMAs | Education aggregates ACE — ACE remains SSOT for persistence |
| Supervisor therapist skills vs Education domains | Supervisor evaluates process skills; Education owns curriculum domains — do not merge |
| Enterprise org certificates vs Education/Supervisor milestones | Enterprise issues org credentials; Stages 7/9 own formative milestones — do not merge |
| Realtime gateway vs Therapy Room VAD | Complementary; do not merge ownership |
| Historical cert docs vs Omega package | Prefer Omega + RC1 for current truth |

## v1.1 roadmap pointer

Excellence/HCE/SEO deferred work remains in open `[v1.1]` / experimental PRs. Stage 11 realtime foundation ships on this branch — remaining RT-S11-* items stay non-blocking. Do not claim validated competency instruments during Professional Preview.

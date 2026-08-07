# Production Readiness — VPsych Version 1.0 RC1 (Stage 12)

**Certification ID:** `VPSYCH-1.0-RC1-STAGE12`  
**Package version:** `1.0.0-rc.1`  
**Date (UTC):** 2026-08-07  
**Baseline SHA (pre-RC):** `f915ff4` (Stages 1–11 on `main`)  
**Authority:** Stage 12 Production Release Certification Board

> Stages 1–11 are **canonical**. This document certifies production readiness; it does **not** redesign patient, supervisor, education, validation, enterprise, or realtime cognition.

---

## Verdict

# ⚠ READY FOR VERSION 1.0 RELEASE CANDIDATE (LIMITED INSTITUTIONAL PRODUCTION)

Suitable for universities, residency programs, hospitals, mental health centers, research institutions, and enterprise pilots **under published limitations** (`KNOWN_LIMITATIONS.md`).

**Not claimed:** validated clinical competency instruments, unlimited public GA without ops residuals (Sentry vendor APM, HIBP toggle, DR drill evidence), or activation of experimental excellence engines.

---

## Layer certification matrix

| Layer | Stage home | Status | Notes |
|-------|------------|--------|-------|
| Patient Engines | 2–6 · case/CI/emotion/adaptation/CBE/humanization | **PASS** | Ownership preserved; no Stage 12 cognition changes |
| Assessment | `lib/ai/assessment.ts` | **PASS** | Canonical `weightedOverall`; reports admin-only |
| Education | Stage 7 | **PASS** | Soft-fail after assessment |
| Validation | Stage 8 | **PASS** | Observational only |
| Supervisor | Stage 9 | **PASS** | Therapist-only; never patient mind |
| Enterprise | Stage 10 | **PASS** | Tenancy/RBAC/courses; soft-fail |
| Realtime | Stage 11 | **PASS** | Presentation layer; soft-fail |
| Ownership | `runtime/ENGINE_OWNERSHIP.md` | **PASS** | Architecture tests guard barrels |
| Pipeline | Session lifecycle + voice | **PASS** | STT → message → TTS + correlation IDs |
| Documentation | Stages 1–12 docs | **PASS** | This package |
| Migration history | `supabase/migrations/` (68 files) | **PASS** | Structure gate in CI; remote parity when `SUPABASE_DB_URL` set |

---

## Production checklist (Stage 12)

| # | Item | Result |
|---|------|--------|
| 1 | Lint / typecheck / test / migrations / build | Required green before merge |
| 2 | `npm run audit:deps` (high+) | Required green in CI |
| 3 | Admin scientific routes rate-limited | **PASS** (Stage 12 harden) |
| 4 | ElevenLabs AbortSignal timeout | **PASS** (RT-03 closed in code) |
| 5 | Request correlation `X-Request-Id` on STT/message/TTS | **PASS** |
| 6 | Env presence validation (`lib/env.ts`) + admin ops metrics | **PASS** |
| 7 | Public `/api/health` exposes version + cert id | **PASS** |
| 8 | Upstash configured in production | **Ops verify** (recommended) |
| 9 | Supabase leaked-password protection | **Ops residual** (advisor) |
| 10 | External APM (Sentry) wired | **Deferred** — CSP ready; vendor key ops |
| 11 | DR drill executed & signed | **Documented** — see `DISASTER_RECOVERY.md` |
| 12 | Competency scores scientifically validated | **FAIL (claims)** — do not claim |
| 13 | Zero duplicated patient cognition | **PASS** |
| 14 | Zero ownership violations (architecture tests) | **PASS** |
| 15 | Package version `1.0.0-rc.1` | **PASS** |

---

## Related evidence

| Doc | Role |
|-----|------|
| `PRODUCTION_READINESS_REPORT.md` | Mission Omega checklist (historical) |
| `RELEASE_CERTIFICATION.md` | Stage 12 Go/No-Go board |
| `SECURITY_AUDIT.md` | Security certification |
| `PERFORMANCE_REPORT.md` | Perf + stress methodology |
| `DEPLOYMENT_GUIDE.md` | Vercel / Supabase / CDN |
| `OPERATIONS_RUNBOOK.md` | On-call |
| `DISASTER_RECOVERY.md` / `INCIDENT_RESPONSE.md` | DR / IR |
| `stage10/*` · `stage11/*` | Enterprise / Realtime reports |

---

## Go criteria for promoting RC → 1.0.0

1. This RC merged to `main` with CI green.  
2. Production deploy SHA ≡ `main`.  
3. Migration remote parity PASS.  
4. Credential Verification Gate PASS (RDL policy).  
5. Board appends RDL row authorizing `1.0.0` tag.

# Architecture State — Version 1.0 RC1 (Stage 12)

**As of:** 2026-08-07 · Stages 1–11 canonical on main · Stage 12 Production Release Certification (`1.0.0-rc.1`)

> **Canonical architecture (Stage 2):** see [`SOFTWARE_ARCHITECTURE.md`](./SOFTWARE_ARCHITECTURE.md)  
> for ownership matrix, dependency graph, runtime pipeline, API map, DB map, and engine contracts.  
> **Canonical clinical model (Stage 3):** see [`clinical/CLINICAL_DATA_MODEL.md`](./clinical/CLINICAL_DATA_MODEL.md).  
> **Canonical runtime orchestration (Stage 4):** see [`runtime/COGNITIVE_ARCHITECTURE.md`](./runtime/COGNITIVE_ARCHITECTURE.md).  
> **Canonical clinical intelligence (Stage 5):** see [`clinical-intelligence/README.md`](./clinical-intelligence/README.md) — SP mind design (docs).  
> **Stage 6 implementation:** [`clinical-intelligence/IMPLEMENTATION.md`](./clinical-intelligence/IMPLEMENTATION.md) · code `src/lib/clinical-intelligence/` · blueprint [`STAGE_6_IMPLEMENTATION_BLUEPRINT.md`](./clinical-intelligence/STAGE_6_IMPLEMENTATION_BLUEPRINT.md).  
> **Stage 7 education:** [`education/README.md`](./education/README.md) · code `src/lib/education/` · [`education/IMPLEMENTATION.md`](./education/IMPLEMENTATION.md).  
> **Stage 8 validation:** [`RESEARCH_ARCHITECTURE.md`](./RESEARCH_ARCHITECTURE.md) · [`VALIDATION_PIPELINE.md`](./VALIDATION_PIPELINE.md) · code `src/lib/validation/`.  
> **Stage 9 supervisor:** [`SUPERVISOR_ARCHITECTURE.md`](./SUPERVISOR_ARCHITECTURE.md) · code `src/lib/supervisor/`.  
> **Stage 10 enterprise:** [`ENTERPRISE_ARCHITECTURE.md`](./ENTERPRISE_ARCHITECTURE.md) · code `src/lib/enterprise/`.  
> **Stage 11 realtime:** [`REALTIME_ARCHITECTURE.md`](./REALTIME_ARCHITECTURE.md) · code `src/lib/realtime/`.  
> **Stage 12 production certification:** [`RELEASE_CERTIFICATION.md`](./RELEASE_CERTIFICATION.md) · [`PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md) · [`VERSION_1_0_RELEASE_REPORT.md`](./VERSION_1_0_RELEASE_REPORT.md).  
> This file remains a short ops/topology snapshot; prefer those docs for system / clinical / runtime / intelligence boundaries.

## Runtime topology

```
Browser (EN/AR, cookie locale)
  → Vercel Edge middleware (auth refresh, /admin gate, locale)
  → Next.js 16 App Router (React 19)
  → Route Handlers (rate-limited JSON APIs)
  → Supabase Auth + Postgres RLS (us-east-1)
  → OpenAI / AI Gateway (patient + assessment)
  → ElevenLabs (TTS)
```

## Engine stack (production)

| Layer | Module | Coupling rule |
|-------|--------|---------------|
| 1 | Dynamic Clinical Case Engine | Fresh CaseInstance per session; Stage 6 promotes formulation/MSE/protectives onto ClinicalCore |
| 2 | Clinical Scenario Template Engine | Templates → diagnoses → cases |
| 3 | Instructor Preset Engine | Presets constrain templates/cases |
| 4 | ACE | Best-effort after assessment (wrapped by Education) |
| 5 | CGE | Best-effort; no ace-bridge barrel export |
| 6 | Quality Ledger + scientific indices | Admin/research; seal on end |
| CI | Clinical Intelligence (`lib/clinical-intelligence`) | Composition layer — DecisionPlan façade; does not own Emotion/Adaptation/CBE stores |
| EDU | Education (`lib/education`) | Trainee observe/evaluate/teach; never writes patient mind |
| VAL | Validation (`lib/validation`) | Observational realism / research; never writes patient mind |
| SUP | Supervisor (`lib/supervisor`) | Therapist supervision only; never writes patient mind |
| ENT | Enterprise (`lib/enterprise`) | Tenancy / RBAC / courses / org certs / analytics; never writes patient mind |
| RT | Realtime (`lib/realtime`) | Voice gateway / streaming / avatar presentation; never writes patient mind |
| OPS | Ops (`lib/ops`, `lib/env`, `lib/request-id`) | Production metrics / env posture / correlation — never owns cognition |

## Session lifecycle (canonical)

`POST /api/sessions` → case mint (+ CI promotion) → dyad Adaptation/CI carry seed → messages via ownership RPC (Adaptation → resolve → LTM → Emotion → CBE → DecisionPlan → Humanization → reply) → `POST …/end` → assess → signed report → Education (wraps ACE) → Validation → Supervisor → Enterprise → Realtime — all best-effort soft-fail.

Voice: STT → message API → TTS. Optional SSE `/message/stream` (flag-gated) progressive-reveals the classic turn. Text skips STT/TTS.

## Intentionally not in production architecture

PME, TRE, HCTF, CQI, EOI, CVL, HFTE, VMHC — open PRs only.

Therapy Room Mode: code present, **flag-gated off** by default; classic VoiceSession remains the default interaction mode.

## Data facts (live)

| Entity | Approx rows |
|--------|------------:|
| profiles | 11 |
| avatars | 2 |
| sessions | 546 |
| session_messages | 3730 |
| session_reports | 440 |
| case_instances | 401 |
| disorders | 17 |
| quality_ledgers | 6 |
| institutions (seed) | 5 |
| institution_memberships | 0 |

## Documentation map

| Audience | Start here |
|----------|------------|
| Executive | `FINAL_EXECUTIVE_SUMMARY.md` |
| Reviewer / clinician | `REVIEWER_GUIDE.md`, `KNOWN_LIMITATIONS.md`, `/validation` |
| Architect | `SOFTWARE_ARCHITECTURE.md` (Stage 2) + this snapshot + engine docs in `docs/*_ENGINE.md` |
| Clinical data / ontology | `clinical/CLINICAL_DATA_MODEL.md`, `clinical/PATIENT_ONTOLOGY.md` |
| Clinical intelligence (SP mind) | `clinical-intelligence/README.md` (Stage 5) + `IMPLEMENTATION.md` (Stage 6) |
| Education / trainee training | `education/README.md` (Stage 7) |
| Scientific validation / research | `RESEARCH_ARCHITECTURE.md` · `VALIDATION_PIPELINE.md` (Stage 8) |
| Supervisor AI | `SUPERVISOR_ARCHITECTURE.md` · `COMPETENCY_FRAMEWORK.md` (Stage 9) |
| Enterprise / multi-tenant | `ENTERPRISE_ARCHITECTURE.md` · `TENANT_MODEL.md` · `RBAC_MODEL.md` (Stage 10) |
| Realtime simulation | `REALTIME_ARCHITECTURE.md` · `VOICE_PIPELINE.md` · `AVATAR_ARCHITECTURE.md` (Stage 11) |
| Production / Version 1.0 RC | `RELEASE_CERTIFICATION.md` · `PRODUCTION_READINESS.md` · `VERSION_1_0_RELEASE_REPORT.md` (Stage 12) |
| Runtime mind composition | `runtime/COGNITIVE_ARCHITECTURE.md` (Stage 4) |
| Security | `SECURITY_AUDIT.md` · `SECURITY_CERTIFICATION.md` |
| Ops | `OPERATIONS_RUNBOOK.md` · `DEPLOYMENT_GUIDE.md` · `DISASTER_RECOVERY.md` · `INCIDENT_RESPONSE.md` |
| Developer | `CLAUDE.md` (note: some reliability sections are stale — see TECHNICAL_DEBT) |
| Release governance | `RELEASE_DECISION_LOG.md`, `CHANGELOG.md` |

## Stage map (canonical — do not redesign closed stages)

| Stage | Status | Home |
|-------|--------|------|
| 1 Governance | Complete | Release / security certification package |
| 2 Software Architecture | Complete | `SOFTWARE_ARCHITECTURE.md` |
| 3 Clinical Data Model | Complete | `clinical/` |
| 4 Runtime Architecture | Complete | `runtime/` |
| 5 Clinical Intelligence Framework | Complete (docs) · Needs Human Review | `clinical-intelligence/` |
| 6 Clinical Intelligence Implementation | Implemented · Needs Human Review | `src/lib/clinical-intelligence/` + `clinical-intelligence/IMPLEMENTATION.md` |
| 7 Curriculum & Expert Training Engine | Implemented · Needs Human Review | `src/lib/education/` + `docs/education/` |
| 8 Scientific Validation Platform | Implemented · Needs Human Review | `src/lib/validation/` + `docs/RESEARCH_ARCHITECTURE.md` |
| 9 Supervisor AI · Expert Review · Competency | Implemented · Needs Human Review | `src/lib/supervisor/` + `docs/SUPERVISOR_ARCHITECTURE.md` |
| 10 Enterprise Platform · Multi-Tenant | Implemented · Needs Human Review | `src/lib/enterprise/` + `docs/ENTERPRISE_ARCHITECTURE.md` |
| 11 Real-Time Clinical Simulation | Implemented · Needs Human Review | `src/lib/realtime/` + `docs/REALTIME_ARCHITECTURE.md` |
| 12 Production Release Certification | **RC1 `1.0.0-rc.1`** · Needs Board soak | `docs/RELEASE_CERTIFICATION.md` · `docs/VERSION_1_0_RELEASE_REPORT.md` · harden in `lib/ops`, CI, voice timeout, admin RL |

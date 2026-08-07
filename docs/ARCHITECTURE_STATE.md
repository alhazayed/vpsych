# Architecture State — Mission Omega

**As of:** 2026-08-07 · Stage 6 Clinical Intelligence runtime on branch; production snapshot still Mission Omega era

> **Canonical architecture (Stage 2):** see [`SOFTWARE_ARCHITECTURE.md`](./SOFTWARE_ARCHITECTURE.md)  
> for ownership matrix, dependency graph, runtime pipeline, API map, DB map, and engine contracts.  
> **Canonical clinical model (Stage 3):** see [`clinical/CLINICAL_DATA_MODEL.md`](./clinical/CLINICAL_DATA_MODEL.md).  
> **Canonical runtime orchestration (Stage 4):** see [`runtime/COGNITIVE_ARCHITECTURE.md`](./runtime/COGNITIVE_ARCHITECTURE.md).  
> **Canonical clinical intelligence (Stage 5):** see [`clinical-intelligence/README.md`](./clinical-intelligence/README.md) — SP mind design (docs).  
> **Stage 6 implementation:** [`clinical-intelligence/IMPLEMENTATION.md`](./clinical-intelligence/IMPLEMENTATION.md) · code `src/lib/clinical-intelligence/` · blueprint [`STAGE_6_IMPLEMENTATION_BLUEPRINT.md`](./clinical-intelligence/STAGE_6_IMPLEMENTATION_BLUEPRINT.md).  
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
| 4 | ACE | Best-effort after assessment |
| 5 | CGE | Best-effort; no ace-bridge barrel export |
| 6 | Quality Ledger + scientific indices | Admin/research; seal on end |
| CI | Clinical Intelligence (`lib/clinical-intelligence`) | Composition layer — DecisionPlan façade; does not own Emotion/Adaptation/CBE stores |

## Session lifecycle (canonical)

`POST /api/sessions` → case mint (+ CI promotion) → dyad Adaptation/CI carry seed → messages via ownership RPC (Adaptation → resolve → LTM → Emotion → CBE → DecisionPlan → Humanization → reply) → `POST …/end` → assess → signed report → ACE best-effort.

Voice: STT → message API → TTS. Text skips STT/TTS.

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
| Runtime mind composition | `runtime/COGNITIVE_ARCHITECTURE.md` (Stage 4) |
| Security | `SECURITY_CERTIFICATION.md` |
| Ops | `OPERATIONS_RUNBOOK.md` |
| Developer | `CLAUDE.md` (note: some reliability sections are stale — see TECHNICAL_DEBT) |
| Release governance | `RELEASE_DECISION_LOG.md`, `RELEASE_GOVERNANCE.md` (if present) |

## Stage map (canonical — do not redesign closed stages)

| Stage | Status | Home |
|-------|--------|------|
| 1 Governance | Complete | Release / security certification package |
| 2 Software Architecture | Complete | `SOFTWARE_ARCHITECTURE.md` |
| 3 Clinical Data Model | Complete | `clinical/` |
| 4 Runtime Architecture | Complete | `runtime/` |
| 5 Clinical Intelligence Framework | Complete (docs) · Needs Human Review | `clinical-intelligence/` |
| 6 Clinical Intelligence Implementation | Implemented · Needs Human Review | `src/lib/clinical-intelligence/` + `clinical-intelligence/IMPLEMENTATION.md` |

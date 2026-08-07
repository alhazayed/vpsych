# Architecture State — Mission Omega

**As of:** 2026-08-06 · production `7dc9a35`

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
| 1 | Dynamic Clinical Case Engine | Fresh CaseInstance per session |
| 2 | Clinical Scenario Template Engine | Templates → diagnoses → cases |
| 3 | Instructor Preset Engine | Presets constrain templates/cases |
| 4 | ACE | Best-effort after assessment |
| 5 | CGE | Best-effort; no ace-bridge barrel export |
| 6 | Quality Ledger + scientific indices | Admin/research; seal on end |

## Session lifecycle (canonical)

`POST /api/sessions` → case mint → messages via ownership RPC → `POST …/end` → assess → signed report → ACE best-effort.

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
| Architect | This file + engine docs in `docs/*_ENGINE.md` |
| Security | `SECURITY_CERTIFICATION.md` |
| Ops | `OPERATIONS_RUNBOOK.md` |
| Developer | `CLAUDE.md` (note: some reliability sections are stale — see TECHNICAL_DEBT) |
| Release governance | `RELEASE_DECISION_LOG.md`, `RELEASE_GOVERNANCE.md` (if present) |

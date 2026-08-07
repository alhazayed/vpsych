# VPsych Staging Certification & Production Readiness Report

**Branch:** `cursor/staging-certification-3c89`  
**Integration base:** PR #163 (`cursor/safe-sequential-engine-merge-3c89`)  
**Date:** 2026-08-07  
**Project:** vpsych (`rrzudbkxigeavfdnidnm`)

---

## Certification Status

# 🟡 READY FOR STAGING ONLY

**Not** 🟢 Production Ready — required live gates remain incomplete (remote migration apply, live EN/AR therapy/voice E2E, live latency/token cost, residual Supabase advisor WARNs including leaked-password protection).

**Not** ❌ NOT READY — offline architecture, regression, clinical simulation, humanization debt remediation, and local migration structure all **PASS**.

---

## Executive Summary

The eight-engine clinical realism stack is correctly wired, modular, and covered by an expanded automated certification harness (496 tests). Humanization was refactored to **presentation-only** so it no longer invents affect, extracts memories, or owns therapist-influence decisions. Adaptation now soft-fails on the message path.

Staging is the correct next step: apply four pending migrations on the vpsych Supabase project, run live smoke sessions, then re-certify for production.

---

## Architecture Validation

### Engine dependency graph

```
Personality
    ↓
Adaptation
    ↓
Memory
    ↓
Emotion
    ↓
Conversation Behaviour
    ↓
LLM Prompt Assembly
    ↓
Humanization (presentation only)
    ├→ Clinical Voice (TTS)
    └→ NBE / Avatar Animation
         ↓
Final Patient Response
```

Full matrix: `/opt/cursor/artifacts/staging-cert/phase1-dependency-graph.md`

### Wiring verification

| Engine | Wired | Soft-fail | Domain ownership |
|--------|-------|-----------|------------------|
| Personality | Module 2b via `resolveAvatar` | N/A (deterministic) | ✅ |
| Adaptation | message route + fidelity block | ✅ try/catch | ✅ |
| Patient Memory | message + end hooks | ✅ | ✅ |
| Emotion | message + `/emotion` API | ✅ | ✅ |
| CBE | message + `behaviourReinforcement` | ✅ | ✅ |
| Clinical Voice | TTS live emotion switch | N/A | ✅ |
| NBE | Therapy Room presence | N/A | ✅ |
| Humanization | presentation cues + voiceHints | ✅ | ✅ presentation-only |

Cross-engine package imports (non-test): **none** — composition only at route/UI boundaries.

---

## Technical Debt Remediation (Phase 2)

**Done:** Humanization no longer:

- extracts transcript facts or injects prior-session memory content into prompts  
- invents affect from therapist free-text triggers  
- selects defenses / cooperation (Adaptation/CBE ownership)

**Now does:** hesitation, pauses, fillers, false starts, cadence, TTS pause/stability overlays; maps Mission 2 expression for gating/timing only.

Architecture tests enforce `presentation only` cue language and forbid memory extraction in `engines/memory.ts`.

---

## Database Validation / Migration Report

Local: **PASS** (`npm run test:migrations`) — 66 files, unique versions, naming OK.

Remote (MCP `list_migrations` on `rrzudbkxigeavfdnidnm`): **62 applied**. Pending vs git:

1. `20260806140000_therapy_room_vmhc`
2. `20260807093000_human_personality_engine`
3. `20260807094500_long_term_patient_memory`
4. `20260807120000_clinical_voice_profiles`

**Schema parity:** NOT achieved until these four are applied on staging/production.

Detail: `/opt/cursor/artifacts/staging-cert/phase3-migration-report.md`

Flag: LTM admin RLS uses bare `is_admin()` (prefer `(select is_admin())`).

---

## Clinical Validation Results

Harness: `src/lib/integration/clinical-certification.integration.test.ts`  
Artifact: `/opt/cursor/artifacts/staging-cert/phase4-clinical-results.json`

| Scenario | Slug | Pass |
|----------|------|------|
| MDD | `mdd-recurrent-moderate` | ✅ |
| GAD | `gad-with-panic` | ✅ |
| Panic | `panic-disorder` | ✅ |
| PTSD | `ptsd` | ✅ |
| OCD | `ocd` (speech→generic) | ✅ |
| Bipolar Mania | `bipolar-mania` | ✅ |
| Schizophrenia | `schizophrenia` (psychosis alias) | ✅ |
| BPD | `bpd` | ✅ |
| Adjustment | `adjustment-disorder` (default baseline) | ✅ |
| Healthy Control | `healthy-control` (default baseline) | ✅ |

**10/10 PASS.** Verified per scenario: baseline_mood frozen, validation↑trust, hostility→withdrawal, adaptation warm/judgment/interrupt, durable memory + trauma survives compress, CBE variation, humanization recalled_facts empty / no invented meds, NBE + clinical voice callable.

**Live browser/voice therapy sessions:** ❌ not executed (no OpenAI/ElevenLabs/session DB in this agent).

---

## Longitudinal Testing

10 carried sessions: **PASS**

- Personality freeze equal across sessions  
- Rapport never hard-reset (min after carry 42.5; final 77.9)  
- Memory after compress: 43 entries (hard-cap OK); no duplicate facts  
- Max humanization prompt chars: 774 (bounded)

---

## Performance Metrics

Offline smoke (`phase6-performance.json`) — **PASS**

| Metric | Value |
|--------|------:|
| 100 emotion ticks | 6.83 ms |
| 50 humanization plans | 8.53 ms |
| 20 memory extract/retrieve/compress cycles | 16.53 ms |
| Humanization cue size avg / max | 575 / 758 chars |

**Not measured (blocks Production Ready):** cold start, p95 live message latency, real prompt/completion tokens, LLM $/session, ElevenLabs TTS latency, avatar render latency, DB query counts under load.

---

## Security Assessment

Unit suite: architecture, headers, audit, api-auth, redirect, password, safe-client-error, rate-limit — **PASS** (46 tests).

Detail: `/opt/cursor/artifacts/staging-cert/phase7-security-assessment.md`

Supabase advisors (remote) — pre-existing **WARN**s:

- `anon` can execute `quality_ledger_reject_mutation` (SECURITY DEFINER)  
- Multiple authenticated SECURITY DEFINER RPCs exposed (many intentional with internal auth; still warrant grant audit)  
- **Leaked password protection disabled**

These are not introduced by the engine stack but prevent a Production Ready stamp until reviewed/remediated.

---

## Clinical Consistency

- Same persona freeze → same traits across sessions (Maya/Jordan)  
- Same diagnosis, different people: Maya ≠ Jordan personality under MDD context  
- Emotion evolves from interventions; Adaptation/CBE react to therapist behaviour  
- Voice modulation consumes clinical emotion; NBE consumes emotion snapshots  
- Humanization only improves delivery realism  

Gaps: dedicated emotion baselines thinner for OCD / adjustment / healthy-control (fall back to defaults) — acceptable for staging, improve before formal clinical validation.

---

## Regression Results

| Gate | Result |
|------|--------|
| Typecheck | ✅ PASS (0 errors) |
| Lint | ✅ 0 errors (15 warnings, pre-existing + minor) |
| Unit + integration tests | ✅ **496** / 68 files |
| Migrations (local) | ✅ PASS |
| Build | ✅ PASS |
| Architecture | ✅ 19 |
| Security unit pack | ✅ 46 |
| Clinical cert harness | ✅ 10/10 + longitudinal |
| Performance smoke | ✅ PASS |

No skipped failures. Typecheck errors found in harness were fixed before continuing.

---

## Known Technical Debt

1. Remote missing 4 migrations (blocking staging feature activation)  
2. Thinner disorder baselines for OCD / adjustment / healthy-control  
3. Message route still a large composition hub (~420 lines) — extract pipeline helper later  
4. Pre-existing Supabase advisor WARNs + leaked-password protection off  
5. Live E2E / cost / p95 latency not measured  
6. Assessment scores still unvalidated (`[v1.1]`) — unchanged  

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Deploy without applying LTM/personality/voice migrations | High | Apply pending migrations before staging QA |
| Live prompt size growth under full stack | Medium | Measure tokens on staging; cue budgets already bounded offline |
| Residual SECURITY DEFINER exposure | Medium | Grant audit before production |
| Over-trust in offline clinical harness | Medium | Require human clinician smoke on staging |

---

## Production Recommendation

1. Merge integration PR #163 + this certification branch (or stack them).  
2. Apply pending migrations on staging Supabase.  
3. Enable leaked-password protection; triage advisor WARNs.  
4. Run live EN/AR therapy sessions (text + voice + Therapy Room if flagged).  
5. Capture p50/p95 latency and token cost.  
6. Re-run this certification checklist → only then consider 🟢 Production Ready.

---

## Artifacts

- `/opt/cursor/artifacts/staging-cert/phase1-dependency-graph.md`
- `/opt/cursor/artifacts/staging-cert/phase3-migration-report.md`
- `/opt/cursor/artifacts/staging-cert/phase4-clinical-results.json`
- `/opt/cursor/artifacts/staging-cert/phase6-performance.json`
- `/opt/cursor/artifacts/staging-cert/phase7-security-assessment.md`
- `/opt/cursor/artifacts/staging-cert/phase9-*.txt`
- `docs/STAGING_CERTIFICATION_REPORT.md` (this document)

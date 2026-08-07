# Clinical Intelligence Framework

**Stage:** 5 — Canonical Clinical Intelligence Framework  
**Status:** Phase Complete · Needs Human Review  
**Rule:** Documentation only. Reflects live implementation first; recommendations second. **No implementation in this stage.**

Respects Stages 1–4 (canonical — do not redesign):

| Stage | Canonical home |
|-------|----------------|
| 1 Governance | Release / security certification package |
| 2 Software Architecture | [`../SOFTWARE_ARCHITECTURE.md`](../SOFTWARE_ARCHITECTURE.md) |
| 3 Clinical Data Model | [`../clinical/CLINICAL_DATA_MODEL.md`](../clinical/CLINICAL_DATA_MODEL.md) · [`../clinical/PATIENT_ONTOLOGY.md`](../clinical/PATIENT_ONTOLOGY.md) |
| 4 Runtime Architecture | [`../runtime/COGNITIVE_ARCHITECTURE.md`](../runtime/COGNITIVE_ARCHITECTURE.md) |

---

## Mission

Define how every **fictional educational** synthetic patient reasons, behaves, evolves, and responds — as a consistent fictional person, not as an LLM.

This package is the **single source of truth** for future clinical-intelligence implementation. It does not replace Stages 1–4; it governs *patient mind behaviour* on top of them.

**Hard boundary:** Training patients are fictional. No document here describes, stores, or implies real patient data.

---

## Package index

| # | Document | Role |
|---|----------|------|
| 01 | [`PATIENT_COGNITIVE_MODEL.md`](./PATIENT_COGNITIVE_MODEL.md) | Beliefs, goals, values, identity, coping, schemas, cognition |
| 02 | [`EMOTION_MODEL.md`](./EMOTION_MODEL.md) | Affect dimensions, decay, triggers, crisis, recovery |
| 03 | [`BEHAVIOR_MODEL.md`](./BEHAVIOR_MODEL.md) | Speech, nonverbal, silence, avoidance, engagement |
| 04 | [`THERAPY_RESPONSE_MODEL.md`](./THERAPY_RESPONSE_MODEL.md) | Modality & intervention response |
| 05 | [`LONGITUDINAL_CHANGE_MODEL.md`](./LONGITUDINAL_CHANGE_MODEL.md) | Session-to-session trust, symptoms, adherence, dropout |
| 06 | [`DSM_MAPPING.md`](./DSM_MAPPING.md) | Diagnosis → symptoms, risk, cognition, therapy challenges |
| 07 | [`PATIENT_DECISION_ENGINE.md`](./PATIENT_DECISION_ENGINE.md) | Answer / refuse / avoid / dissociate / lie / improve |
| 08 | [`THERAPIST_SCORING_FRAMEWORK.md`](./THERAPIST_SCORING_FRAMEWORK.md) | Excellent / poor / unsafe interviewing |
| 09 | [`CLINICAL_REALISM.md`](./CLINICAL_REALISM.md) | Measurable consistency & realism metrics |
| 10 | [`PATIENT_EVOLUTION_MODEL.md`](./PATIENT_EVOLUTION_MODEL.md) | 10 / 25 / 50 / 100 session arcs |
| 11 | [`STAGE_6_IMPLEMENTATION_BLUEPRINT.md`](./STAGE_6_IMPLEMENTATION_BLUEPRINT.md) | Stage 6 implementation blueprint (architecture-first) |

---

## Framework stack (conceptual)

```
Stage 3 Clinical Ontology (what the patient IS this session)
        │
        ▼
Stage 5 Clinical Intelligence (how the patient THINKS / FEELS / ACTS / CHANGES)
        │
        ├── Cognition (01)
        ├── Emotion (02)
        ├── Behaviour (03)
        ├── Therapy response (04)
        ├── Longitudinal change (05)
        ├── DSM behavioural mapping (06)
        ├── Decision engine (07)
        └── Evolution arcs (10)
                │
                ▼
Stage 4 Runtime Orchestration (how engines compose each turn)
                │
                ▼
Therapist scoring (08) + Realism metrics (09)  ← assess the TRAINEE / platform
```

---

## Implementation-first summary

| Layer | Live today? | Primary owners |
|-------|-------------|----------------|
| Affect (dimensional) | Yes | Emotion Engine |
| Alliance (rapport/trust/stance) | Yes (case-scoped) | Adaptation Engine |
| Turn behaviour / disclosure | Yes | CBE |
| Traits / coping / attachment | Yes | Personality Engine |
| Symptoms / diagnosis / risk | Yes | Case Engine |
| Longitudinal facts | Yes (dyad LTM) | Patient Memory |
| Structured beliefs / schemas / AT | **No** | Gap |
| Modality-specific therapy state machines | **Thin strings only** | Gap |
| Cross-session recovery arc enforcement | **No** | Gap |
| Patient instrument trajectories | **No** | Gap |

See each document’s **Existing implementation** then **Gaps** then **Canonical design (future)**.

---

## Certification (Stage 5)

| Criterion | Met? |
|-----------|------|
| One clinical intelligence framework | Yes — this package |
| One patient cognition model | Yes — 01 |
| One emotion model | Yes — 02 |
| One behaviour model | Yes — 03 |
| One longitudinal treatment model | Yes — 05 (+ 10) |
| One therapist scoring framework | Yes — 08 |
| One DSM mapping framework | Yes — 06 (extends Stage 3 coding map) |
| One realism framework | Yes — 09 |
| All gaps documented | Yes — every doc + roadmap update |
| No implementation yet | Yes — docs only |
| Implementation first, recommendations second | Yes |

**Release status:** Phase Complete · Needs Human Review  
**Rollback:** docs-only.

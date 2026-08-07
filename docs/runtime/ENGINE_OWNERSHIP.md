# Engine Ownership

**Rule:** Every runtime capability has exactly one owner. Conflicts are documented, not silently “shared.”

Aligns with Stage 2 ownership matrix and Stage 3 patient ontology. This file is the **runtime** ownership view.

---

## Ownership table

| Capability | Owner | Persist | Others may |
|------------|-------|---------|------------|
| Clinical snapshot / diagnosis | Case Engine | `clinical_snapshot` | Read only |
| Formulation / MSE / protective factors | Case Engine (+ CI promote) | `clinical_snapshot.clinical_core` | Read / Module 1 fidelity |
| TherapyResponseProfile | Case Engine | `therapy_reaction_rules` | DecisionPlan biases |
| Prompt Modules 1–4 template | Prompt Engine | code | Contribute fidelity *blocks* via resolve |
| Module 2b traits | Personality Engine | snapshot freeze | Read |
| Adaptation / rapport / trust / stance | Adaptation | `case_memory…patient_adaptation` | Read expression block |
| Treatment / homework / medication adherence | Adaptation (+ CI mind state) | `case_memory…clinical_intelligence` | Read |
| Emotion variables / expression | Emotion | `case_memory…emotion` | Read expression |
| Longitudinal facts | Patient Memory | `patient_long_term_memory` | — |
| Turn behaviour plan / cbe_direct | CBE | ephemeral | — |
| PatientDecisionPlan / BehaviorProfile | Clinical Intelligence façade | ephemeral (+ optional traces) | Observability headers |
| Recovery / relapse / chronic stress | CI longitudinal helpers | `case_memory…clinical_intelligence` | Case/Adaptation read |
| Micro-realism / voiceHints | Humanization | ephemeral | Read case_memory |
| Patient reply text | Patient Agent | via message RPC | — |
| `aiSource` truth | Patient Agent / CBE direct | response | Clients must surface |
| STT / TTS / registry | Voice | voice_profiles | — |
| Clinical delivery params | CVP | voice_profiles columns | — |
| Nonverbal timeline | NBE | client memory | — |
| TRM FSM / clinic day | Therapy Room | client + clinic tables | — |
| Private notes | Notes API | `session_private_notes` | **Never** patient agent |
| Assessment scores | Assessment | `session_reports` | Admin read |
| Learner trajectory | ACE | ACE tables | CGE via bridge |
| Competency graph | CGE | cge_* (writes via ACE hook/admin) | — |
| Quality seal | Quality Ledger | `quality_ledgers` | — |
| Authz role | profiles.role | profiles | — |
| Rate limit counters | rate-limit | Redis/memory | — |

---

## Documented ownership conflicts

| ID | Conflict | Evidence | Severity | Recommendation (do not implement here) |
|----|----------|----------|----------|----------------------------------------|
| OWN-01 | Dual writers on `case_memory` jsonb | Adaptation upsert + Emotion RMW; Adaptation `void` save | High | Atomic namespaced patch helper |
| OWN-02 | Trust/rapport in Emotion **and** Adaptation | Parallel variables | Medium | Contract: Emotion=affect, Adaptation=alliance |
| OWN-03 | CBE vs Humanization silence/hesitation | Both inject cues; CBE may short-circuit | Medium | Precedence: CBE gate > Humanization micro |
| OWN-04 | Message route is god-orchestrator | Inline composition | Low (intentional v1) | Optional `lib/session-turn` extract |
| OWN-05 | `therapistInterrupted` API without client senders | Route accepts; UI never sends | Medium | Wire TRM barge-in or remove dead input |
| OWN-06 | Dual TRM flags | Stage 2 ARCH-S2-03 | Medium | Unify flag matrix |
| OWN-07 | ACE↔CGE import cycle | Managed by barrel exclusion | Medium | Extract bridge package |

---

## Forbidden ownership claims

- Emotion must not write `patient_adaptation`.  
- Adaptation must not write `emotion`.  
- Humanization must not write `case_memory`.  
- Voice/NBE must not mutate ClinicalCore.  
- ACE must not rewrite clinical_snapshot.  
- Assessment must not invent patient diagnosis.  
- No engine may define a second Patient type (Stage 3).

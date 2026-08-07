# Stage 6 — Clinical Intelligence Implementation Blueprint

**Stage:** 6 — Implement Stage 5 Clinical Intelligence Framework  
**Status:** Blueprint (architecture-first; no production code in this document)  
**Authority:** Stage 5 package under [`README.md`](./README.md) · Stages 1–4 remain canonical and must not be redesigned  
**Hard boundary:** Fictional educational synthetic patients only. No real patient data. Competency scores remain **unvalidated**.

This blueprint translates Stage 5 **Canonical design (future)** sections into an ordered, ownership-safe implementation plan. It cites Stage 5 section names and Stage 3/4 ownership contracts.

---

## 0. Mission framing

### 0.1 What Stage 6 ships

Make every Stage 5 intelligence construct a **first-class runtime object** (typed, owned, evolvable, serializable) composed by Stage 4 orchestration — without forking a second Patient type (Stage 3 invariant; [`CLINICAL_DATA_MODEL.md`](../clinical/CLINICAL_DATA_MODEL.md) § Two layers).

### 0.2 Stack position (from Stage 5 README § Framework stack)

```
Stage 3 Clinical Ontology (what the patient IS this session)
        │
        ▼
Stage 5 Clinical Intelligence (how the patient THINKS / FEELS / ACTS / CHANGES)
        │  ← Stage 6 implements these objects
        ▼
Stage 4 Runtime Orchestration (how engines compose each turn)
```

### 0.3 Non-goals

- Redesign Stages 1–4 roots (`CLINICAL_ROADMAP.md` § Out of scope).
- Merge Emotion.trust with Adaptation.trust (`EMOTION_MODEL.md` § Ownership conflict; `ENGINE_OWNERSHIP.md` OWN-02).
- Put Big Five / attachment / coping on Case Engine (`PATIENT_COGNITIVE_MODEL.md` § 5 Recommendations).
- Bind permanent diagnosis to avatars (`PATIENT_EVOLUTION_MODEL.md` § Consistency rules).
- Claim validated trainee scores (`THERAPIST_SCORING_FRAMEWORK.md` § Hard claim rule).
- Implement modality FSMs by rewriting Modules 2–4.

---

## 1. Runtime object catalogue

For each Stage 6 mission object: definition, owner, evolution/determinism, integration, persistence, and anti-duplication.

Legend for **Live today:** Present / Partial / Missing (Stage 5 evidence matrices).

---

### 1.1 BeliefSystem

| Axis | Spec |
|------|------|
| **Canonical definition** | Structured core beliefs (stable absolute beliefs). Concept ID `ci.cognition.core_beliefs[]` — `PATIENT_COGNITIVE_MODEL.md` § 3.2 Concept definitions. Part of future **Patient Formulation Object** (5P / biopsychosocial + beliefs) — § 5 Recommendations. |
| **Fields (proposed)** | `id`, `statement`, `domain` (`self`\|`others`\|`world`\|`future`), `strength` 0–100, `salience` (`presenting`\|`elicited`\|`hidden`), `source` (`authored`\|`package_seed`\|`session_derived`), `linked_schema_ids[]`, `linked_symptom_ids[]?` |
| **Ownership** | **Case Engine** formulation / teaching package (R-I2, G-06). Not HPE. Not Emotion. |
| **Evolution / determinism** | Frozen at CaseInstance mint onto snapshot. Mid-session: optional `strength` drift only via Decision Engine cognitive_move + curriculum flags — never LLM rewrite of statements. Across sessions: curriculum overlay or Adaptation insight path may soften strength; statements stay identity-stable unless evolution fork remints package. |
| **Integration** | Seeds DecisionPlan `cognitive_move` (`PATIENT_DECISION_ENGINE.md` § 3.2); biases CBE avoidance/minimization; feeds assessment gold-standard formulation (trainee scoring only). Module 1: patient-language paraphrases only — never DSM criterion recitation (`DSM_MAPPING.md` § Purpose invariant). |
| **Serialization** | `clinical_snapshot.formulation.belief_system` (additive JSON). Optional teaching-only mirror for graders. |
| **Do not duplicate** | Authored persona criterion prose as a second runtime store; HPE temperament strings; `session_goals` (trainee targets — CI-C02). |

---

### 1.2 CoreValues

| Axis | Spec |
|------|------|
| **Canonical definition** | `ci.cognition.values[]` — enduring valued directions — `PATIENT_COGNITIVE_MODEL.md` § 3.2. Seed from persona `values?` / HPE `treatment_expectations` (evidence § 2.1). |
| **Fields** | `id`, `label`, `narrative?`, `weight` 0–100, `locale_notes?` |
| **Ownership** | Case teaching package + cultural seed; HPE remains owner of treatment_expectations string. Do not move Big Five onto values. |
| **Evolution** | Frozen per mint; longitudinal curricula may re-weight, not invent contradictory values (`PATIENT_EVOLUTION_MODEL.md` § Consistency rules — identity continuity). |
| **Integration** | ACT modality path (`THERAPY_RESPONSE_MODEL.md` § 3.2 Modality-congruent responses — Defusion/values); Decision Engine problem_solve bias when values-congruent. |
| **Persistence** | Snapshot `formulation.values[]`. |
| **Do not duplicate** | `ClinicalCore.session_goals`; ACE competency goals; Module 2 identity hobbies as “values engine”. |

---

### 1.3 IdentityModel

| Axis | Spec |
|------|------|
| **Canonical definition** | `ci.cognition.identity` — who the person is (already Stage 3) — § 3.2. Live: name/city/occupation via Avatar Personality Module 2; demographics on ClinicalCore; culture on CulturalContext (`PATIENT_COGNITIVE_MODEL.md` § 2.1). |
| **Fields** | Reuse existing: `PersonalityIdentity` + ClinicalCore age/gender + HPE occupation/education/culture. Optional Stage 6 overlay: `identity_disturbance_band?` for BPD packages (`DSM_MAPPING.md` § 4.7). |
| **Ownership** | **Avatar Personality** (locale identity) + **HPE** (temperament colouring). Case Engine may add disturbance *band* only as package symptom/formulation field — never rewrite name. |
| **Evolution** | Stable across horizons (`PATIENT_EVOLUTION_MODEL.md` § Consistency rules #1). RandomizedContext may vary life details per mint without renaming person. |
| **Integration** | Module 2 / 2b; LTM occupation/relationship facts; realism `RM-identity` (`CLINICAL_REALISM.md` § 3.2). |
| **Persistence** | Existing tables + snapshot freeze. No new identity table. |
| **Do not duplicate** | Second Patient type; persona identity conflicting with avatar slug; diagnosis-as-identity. |

---

### 1.4 AttachmentStyle

| Axis | Spec |
|------|------|
| **Canonical definition** | Live HPE enum: `secure` · `anxious_preoccupied` · `dismissive_avoidant` · `fearful_avoidant` · `disorganized` — `PATIENT_COGNITIVE_MODEL.md` § 2.4 Attachment. |
| **Ownership** | **Personality Engine only** (`ENGINE_OWNERSHIP.md`; cognitive model § 5 #2). |
| **Evolution** | Frozen with HPE freeze each mint; do not drift mid-session. Longitudinal: same avatar re-freeze — style stable unless authored profile change. |
| **Integration** | Module 2b; Adaptation alliance sensitivity via HPE `memory_of_therapist.alliance_sensitivity`; CBE guardedness bias. |
| **Persistence** | `avatars.human_personality` + snapshot `human_personality`. |
| **Do not duplicate** | Persona `therapy_behaviour` attachment prose as runtime owner (`CLINICAL_GAP_ANALYSIS.md` conflicting definitions); Adaptation stance enums as attachment. |

---

### 1.5 ProtectiveFactors

| Axis | Spec |
|------|------|
| **Canonical definition** | Structured protective list for risk teaching / Emotion priors. Authored only today (G-01). `DSM_MAPPING.md` § 6 Protective & risk factors; `EMOTION_MODEL.md` § 2.8; CFI `protective_factors` (`CLINICAL_REALISM.md` § 2.2). Roadmap R-C1. |
| **Fields** | `id`, `label`, `category` (`social`\|`personal`\|`clinical`\|`cultural`\|`other`), `strength` 0–100?, `narrative?` |
| **Ownership** | **Case Engine** → `ClinicalCore.protective_factors[]` (or package → mint). |
| **Evolution** | Frozen at mint; optional slow strength↑ with RecoveryTrajectory (design). Never invented by LLM mid-turn. |
| **Integration** | Emotion baseline hope/trust priors (`EMOTION_MODEL.md` § 8 #3); Module 4 risk teaching; CFI dimension; CrisisRisk attenuation. |
| **Persistence** | Snapshot ClinicalCore (additive migration of type + package seeds). Promotion pipeline R-C3 from persona history. |
| **Do not duplicate** | Authored MSE risk prose as parallel runtime; SafetyModule crisis_resources (different — communication assets). |

---

### 1.6 RiskFactors

| Axis | Spec |
|------|------|
| **Canonical definition** | Runtime `RiskProfile` + package `risk_defaults` live; static/dynamic formulation authored MSE only (`DSM_MAPPING.md` § 6; `RISK_MODEL.md`). Extend with static/dynamic bands + self-neglect / dependents (G-08). |
| **Fields (extend RiskProfile)** | Existing SI/self_harm/HTO/substance + `escalation_rules?`; add `self_neglect?`, `risk_to_dependents?`, `static_factors[]?`, `dynamic_factors[]?` (educational tags, not validated tools). |
| **Ownership** | **Case Engine** ClinicalCore.risk_profile. Safety communication: Avatar SafetyModule. |
| **Evolution** | Frozen mid-session. Longitudinal: curriculum remint or progressive overlay — no silent SI escalation without package. |
| **Integration** | Module 4; Humanization clinical gates; Emotion CrisisBand gating (`EMOTION_MODEL.md` § 4.2); assessment `risk_formulation` / `safety`. |
| **Persistence** | Snapshot; package `risk_defaults`. |
| **Do not duplicate** | Emotion.stress as “risk score”; trainee risk_formulation item as patient risk; CrisisRisk state as RiskProfile (CrisisRisk is turn/session band — see § 1.23). |

---

### 1.7 SelfEsteem

| Axis | Spec |
|------|------|
| **Canonical definition** | `ci.cognition.self_esteem` — global / domain self-worth 0–100 + narrative — § 3.2. Gap CI-C03. |
| **Fields** | `global` 0–100, `domains?: { id, score }[]`, `narrative?` |
| **Ownership** | Formulation object (Case Engine teaching package), seeded from authored MSE/history. |
| **Evolution** | Slow drift with alliance + recovery stage; not per-turn RNG. Deterministic updates from intervention classes (validation↑, hostility↓). |
| **Integration** | BeliefSystem / CoreSchemas activation; Emotion hope coupling (appraisal path CI-C07 / CI-E02 — later phase). |
| **Persistence** | Snapshot formulation; optional case_memory overlay for within-arc drift when longitudinal carry wired. |
| **Do not duplicate** | Emotion.current_mood; HPE neuroticism; BPD identity_disturbance symptom text alone. |

---

### 1.8 Insight

| Axis | Spec |
|------|------|
| **Canonical definition** | Awareness of illness/impact. Live proxy: `DifficultyModifiers.insight` frozen (`LONGITUDINAL_CHANGE_MODEL.md` § 3 Canonical longitudinal constructs; `MENTAL_STATUS_MODEL.md` runtime proxies). Evolution design: gradual insight↑ (`PATIENT_EVOLUTION_MODEL.md` § 3 Evolution dimensions). |
| **Fields** | `band`: `absent`\|`poor`\|`partial`\|`good`\|`intellectual_only`; `mse_narrative?`; `mutable: boolean` (curriculum). |
| **Ownership** | **MSE subset / Case overlay** for clinical insight; DifficultyModifiers remain difficulty *behaviour* bias until migrated. Long-term: single source with difficulty reading insight band (close G-18 insight dual). |
| **Evolution** | Session N→N+1: drift with alliance + psychoeducation (`LONGITUDINAL_CHANGE_MODEL.md` § 5). Within session: rare; DecisionPlan `improvement_signal: insight`. |
| **Integration** | Module 1 difficulty behaviour lines → migrate to MSE fidelity; Decision Engine; trainee MSE competency remains trainee-side. |
| **Persistence** | Snapshot MSE + optional Adaptation carry field for mutable band. |
| **Do not duplicate** | Announce “Insight: partial” in patient voice (`rc3` bug hunter invariant); ACE mental_status_examination competency as patient insight. |

---

### 1.9 Hope

| Axis | Spec |
|------|------|
| **Canonical definition** | Emotion variable `hope` 0–100 — `EMOTION_MODEL.md` § 2.2. Decay: slow pull toward baseline mood (§ 2.5). Interventions: empathy/validation/psychoeducation↑; hostility↓. |
| **Ownership** | **Emotion Engine** only. |
| **Evolution** | Per-turn decay + intervention deltas; cross-session: re-seed unless recovery stage shifts baseline (§ 5 Recovery trajectory). |
| **Integration** | Mode selection (collapsed when hope≤30 with fatigue/mood); DropoutRisk priors; RecoveryTrajectory signals. |
| **Persistence** | `case_memory.memory.emotion`. |
| **Do not duplicate** | SelfEsteem; Adaptation engagement; LTM `future_plan` facts as hope meter. |

---

### 1.10 Motivation

| Axis | Spec |
|------|------|
| **Canonical definition** | Dual: Emotion.state `motivation` 0–100 + HPE trait readiness (`treatment_expectations`) — `ci.cognition.motivation` § 3.2; `BEHAVIOR_MODEL.md` § 2.6 Motivation proxy. |
| **Fields** | Keep Emotion.motivation; optional formulation `readiness_band` from HPE expectations. |
| **Ownership** | State → Emotion; trait colouring → HPE. |
| **Evolution** | Sticky pull 0.02 (`EMOTION_MODEL.md` § 2.5); advice↓; psychoeducation↑ trust-gated. |
| **Integration** | Behaviour engagement; MI change talk (`THERAPY_RESPONSE_MODEL.md` § 3.2); HomeworkAdherence probability. |
| **Persistence** | Emotion state + HPE freeze. |
| **Do not duplicate** | CBE rapport_disclosure as motivation; ACE learner motivation. |

---

### 1.11 ExecutiveFunction

| Axis | Spec |
|------|------|
| **Canonical definition** | `ci.cognition.executive` — planning / inhibition / flexibility bands — § 3.2. Live: ADHD/cognition symptom ids only (CI-C04). |
| **Fields** | `planning`, `inhibition`, `flexibility`, `working_memory?` each `intact`\|`mild`\|`moderate`\|`severe`; `linked_symptom_ids[]` |
| **Ownership** | Case Engine MSE cognition subset / ADHD package (R-C2 / G-11 cognition). |
| **Evolution** | Frozen per mint unless delirium fluctuating package marks `fluctuating: true` (educational). |
| **Integration** | Decision blank/ruminate biases; Humanization fatigue; speech length; realism for adult-adhd (`DSM_MAPPING.md` § 4.4). |
| **Persistence** | Snapshot MSE / formulation cognition. |
| **Do not duplicate** | Full neuropsych battery; IntelligenceProfile.band as EF; symptom text-only without typed bands once promoted. |

---

### 1.12 CognitiveDistortions

| Axis | Spec |
|------|------|
| **Canonical definition** | Educational CBT distortion tags (catastrophizing, all-or-nothing, …) — under cognitive patterns / formulation (CI-C01; `DSM_MAPPING.md` cognitive patterns Partial). |
| **Fields** | `id`, `distortion_kind`, `example_thought?`, `activation_topics[]`, `salience` |
| **Ownership** | Case formulation / package `cognitive_pattern_tags[]` (R-I5). |
| **Evolution** | Seed frozen; turn activation via DecisionPlan `activate_schema` / AT engine — ephemeral activation flags in case_memory optional. |
| **Integration** | CBT TherapyResponseProfile thought-record path; AutomaticThoughts generation; never recited as DSM criteria. |
| **Persistence** | Snapshot seeds; ephemeral activations in `case_memory.memory.clinical_intelligence?` namespace (new, owned by formulation runtime helper — not Emotion/Adaptation). |
| **Do not duplicate** | Trainee `cbt_skills` ACE competency; CoreSchemas (schemas are if–then; distortions are labeling of thought errors). |

---

### 1.13 AutomaticThoughts

| Axis | Spec |
|------|------|
| **Canonical definition** | `ci.cognition.automatic_thoughts[]` — situation-triggered thoughts — § 3.2. Recommendation: `automatic_thoughts_seed[]` on disorder packages — § 5 #3. Memory gap: Thought records / AT store — § 3.4. |
| **Fields** | `id`, `content`, `trigger_topics[]`, `linked_belief_id?`, `linked_distortion_ids[]`, `hotness` 0–100, `disclosed: boolean` |
| **Ownership** | Case package seeds + Decision Engine enactment; persist AT store under clinical_intelligence case_memory or LTM category extension (see memory extensions). |
| **Evolution** | Seeds at mint; per-turn activation deterministic from topic + Emotion + disclosure gate; disclosed flag flips only when gate allows. |
| **Integration** | Behaviour generation path step 2 (`PATIENT_COGNITIVE_MODEL.md` § 3.3); CBT thought-record invitation (`THERAPY_RESPONSE_MODEL.md` § 3.2). |
| **Persistence** | Seeds on snapshot; working set in case_memory; optional LTM fact if patient “kept a thought record” (curriculum). |
| **Do not duplicate** | Symptom descriptions as ATs; LLM free invention of clinical infrastructure when lying (CBE lying rule). |

---

### 1.14 CoreSchemas

| Axis | Spec |
|------|------|
| **Canonical definition** | `ci.cognition.schemas[]` — conditional if–then patterns — § 3.2. Seed from authored therapy_behaviour. |
| **Fields** | `id`, `if_condition`, `then_pattern`, `linked_belief_ids[]`, `defence_bias?`, `coping_bias?` |
| **Ownership** | Formulation artifact (Case Engine). |
| **Evolution** | Frozen statements; activation ephemeral. |
| **Integration** | DecisionPlan `cognitive_move`; TherapyResponse psychodynamic interpretation → defence (`THERAPY_RESPONSE_MODEL.md` § 3.2); CI-P04 gap close. |
| **Persistence** | Snapshot formulation. |
| **Do not duplicate** | BeliefSystem absolute beliefs; HPE coping_style (trait coping owner remains HPE — schemas may *bias* toward coping enactment). |

---

### 1.15 DefenseMechanisms

| Axis | Spec |
|------|------|
| **Canonical definition** | Authored lists today; no engine (G-15, CI-T04). Roadmap: Defence catalog → CBE enactable kinds (R-M5 / therapy model § 6 #4). |
| **Fields** | `id`, `mechanism` (e.g. denial, projection, intellectualization, splitting, …), `intensity` 0–100, `topics[]`, `cbe_kind_bias?` |
| **Ownership** | Case teaching cues; **enactment via CBE** (interpersonal act owner). Future thin `defence` helper may select bias — must not peer-call CBE (Stage 4: composition root owns order). |
| **Evolution** | Package seed frozen; activation by interpretation / confrontation / low trust — deterministic given seed inputs like CBE. |
| **Integration** | Psychodynamic modality path; DecisionPlan act; never announce label in patient voice (`BEHAVIOR_MODEL.md` § 6 #5). |
| **Persistence** | Snapshot catalog; ephemeral activation on DecisionPlan. |
| **Do not duplicate** | CBE `denial`/`minimization` as a second catalog without mapping; HPE intellectualizing coping as sole defence model. |

---

### 1.16 CopingStrategies

| Axis | Spec |
|------|------|
| **Canonical definition** | Live `CopingStyle` enum — `PATIENT_COGNITIVE_MODEL.md` § 2.3. Concept `ci.cognition.coping` — HPE keep. |
| **Ownership** | **Personality Engine**. |
| **Evolution** | Frozen traits; situation selection among style notes may vary by DecisionPlan but enum owner stays HPE. |
| **Integration** | Module 2b; Behaviour generation colouring § 3.3; EmotionRegulation style sibling. |
| **Persistence** | HPE freeze. |
| **Do not duplicate** | New Case Engine coping enum; DBT skills list as HPE coping (DBT skills = TherapyResponse patient state — separate). |

---

### 1.17 TherapyAlliance

| Axis | Spec |
|------|------|
| **Canonical definition** | Behavioural alliance: Adaptation rapport/trust/stance/disclosure_readiness (`THERAPY_STATE_MODEL.md` § 1; `LONGITUDINAL_CHANGE_MODEL.md` § 3). Affective felt-safety remains Emotion.trust/rapport (`EMOTION_MODEL.md` § 6). |
| **Fields** | Existing `PatientAdaptationState` (+ optional `alliance_quality` derived read-only metric for realism RM-alliance). |
| **Ownership** | **Adaptation Engine** for alliance; Emotion for affect. Decision Engine reads **both** — no silent merge. |
| **Evolution** | Within session: live. Across sessions: wire `beginNextSession` / `carryTrustToNextSession` (CI-L01, R-I1). Decay on carry per Adaptation design. |
| **Integration** | CBE disclosure; Emotion trust gating; TherapyResponse modality gates; DropoutRisk. |
| **Persistence** | `case_memory.memory.patient_adaptation`; carry into next case_memory when longitudinal. |
| **Do not duplicate** | Emotion.trust as alliance score for disclosure_readiness; HPE trust_level (trait prior only). |

---

### 1.18 TreatmentAdherence

| Axis | Spec |
|------|------|
| **Canonical definition** | Meds / homework / attendance — Missing (CI-L03, G-10). Canonical owner: Adaptation or therapy-process (`LONGITUDINAL_CHANGE_MODEL.md` § 3). |
| **Fields** | `attendance_band`, `overall` 0–100, nested HomeworkAdherence + MedicationAdherence, `last_updated_session_id?` |
| **Ownership** | Prefer **Adaptation treatment_arc extension** or Case `therapy_process` state — single owner; document choice in ENGINE_OWNERSHIP before code. Recommendation lean: Adaptation for behavioural adherence; Case snapshot for prescribed regimen facts. |
| **Evolution** | Session-to-session; influenced by alliance, conscientiousness (HPE), Motivation, hostility streaks. |
| **Integration** | RecoveryTrajectory; RelapseRisk; Evolution forks (`PATIENT_EVOLUTION_MODEL.md` § 5); scoring interventions/structure (trainee). |
| **Persistence** | case_memory and/or dyad longitudinal clinical_intelligence store (not LTM autobiography conflation — LTM may hold “forgot meds Tuesday” facts separately). |
| **Do not duplicate** | Trainee homework assignment quality as patient adherence; chart placeholder strings without type. |

---

### 1.19 HomeworkAdherence

| Axis | Spec |
|------|------|
| **Canonical definition** | Compliance depends on alliance + conscientiousness — `THERAPY_RESPONSE_MODEL.md` § 3.1 Homework Design; CI-B01 / CI-T03. |
| **Fields** | `assigned: boolean`, `completed_band`: `none`\|`partial`\|`full`, `barriers[]?`, `last_assignment_summary?` |
| **Ownership** | Under TreatmentAdherence owner. |
| **Evolution** | Updated on session create/end when curriculum expects homework review (10-session arc S8 — `PATIENT_EVOLUTION_MODEL.md` § 4.1). |
| **Integration** | CBT/DBT skill practice; DecisionPlan improvement_signal adherence; Emotion motivation. |
| **Persistence** | Adherence state blob. |
| **Do not duplicate** | ACE cbt_skills mastery. |

---

### 1.20 MedicationAdherence

| Axis | Spec |
|------|------|
| **Canonical definition** | Missing structured meds (G-03) + adherence (G-10). LTM category `medication` exists for autobiographical facts. |
| **Fields** | `regimen_summary?` (from promoted med model), `adherence_band`, `side_effect_complaint?` |
| **Ownership** | Regimen facts → Case Engine package; adherence behaviour → TreatmentAdherence owner; recall colouring → LTM. |
| **Evolution** | Longitudinal storylines at 25–100 sessions (`PATIENT_EVOLUTION_MODEL.md` § 3). |
| **Integration** | RelapseRisk; MI packages; Module 2 substance_and_medication_context only until full med model. |
| **Persistence** | Snapshot med list (when G-03 ships) + adherence state. |
| **Do not duplicate** | RiskProfile.substance_use boolean as adherence; private therapist notes. |

---

### 1.21 RecoveryTrajectory

| Axis | Spec |
|------|------|
| **Canonical definition** | Recovery stage enum (G-09); state machine Intake→…→Maintenance (`LONGITUDINAL_CHANGE_MODEL.md` § 4); horizons 10/25/50/100 (`PATIENT_EVOLUTION_MODEL.md` § 4). Emotion recovery binds to these docs (`EMOTION_MODEL.md` § 5). |
| **Fields** | `stage`: enum matching state machine; `horizon`: `10`\|`25`\|`50`\|`100`\|`none`; `sessions_completed`; `fork?`; `progressive_severity?` |
| **Ownership** | Case Engine + ACE curriculum bridge (R-I13); Adaptation `TreatmentArc.sessions_completed` already shaped — wire, don’t fork. |
| **Evolution** | Curriculum-driven only — **No silent cure** (`PATIENT_EVOLUTION_MODEL.md` § Consistency rules #5). Symptom change via package overlay or trajectory object. |
| **Integration** | Emotion baseline shift optional; Insight drift; Evolution scheduler (CI-V01); pin_disorder presets (CI-L05). |
| **Persistence** | Instructor preset + Adaptation arc + optional `case_instances` longitudinal_group metadata. |
| **Do not duplicate** | Trainee ACE mastery as recovery; authored `session_arc` without enforcement as second runtime stage. |

---

### 1.22 RelapseRisk

| Axis | Spec |
|------|------|
| **Canonical definition** | State machine node RelapseRisk (`LONGITUDINAL_CHANGE_MODEL.md` § 4); evolution fork Relapse (`PATIENT_EVOLUTION_MODEL.md` § 5); DSM progression maintenance/relapse drill (`DSM_MAPPING.md` § 7). |
| **Fields** | `level` 0–100 or `none`\|`elevated`\|`high`; `triggers[]`; `linked_stressor_event_id?` |
| **Ownership** | Evolution / longitudinal overlay (Case + Adaptation signals); not Emotion.stress alone. |
| **Evolution** | Stressor / nonadherence raise risk; re-engagement returns to EngagedWork. |
| **Integration** | RecoveryTrajectory; StressReservoir; curriculum remint higher severity **or** overlay. |
| **Persistence** | Longitudinal clinical state (group-scoped), not frozen ClinicalCore symptoms (those remint). |
| **Do not duplicate** | RiskProfile SI fields; CrisisRisk (acute turn band). |

---

### 1.23 CrisisRisk

| Axis | Spec |
|------|------|
| **Canonical definition** | Design CrisisBand on Emotion escalation ladder (`EMOTION_MODEL.md` § 4.2); live: RiskProfile + Module 4 + Humanization gates — no typed crisis mode (CI-E04). |
| **Fields** | Optional EmotionMode extension `crisis_band` **or** parallel `crisis_band: boolean` + intensity; never bypasses Module 4. |
| **Ownership** | Emotion mode selection + Case RiskProfile gates; SafetyModule owns resources/boundaries. |
| **Evolution** | Within-session; resets with new case unless carry explicitly designed (usually not). |
| **Integration** | Humanization gates; CBE silence/numbing; DecisionPlan; assessment safety. |
| **Persistence** | Emotion state (+ RiskProfile frozen). |
| **Do not duplicate** | RelapseRisk; real-world crisis prediction claims. |

---

### 1.24 StressReservoir

| Axis | Spec |
|------|------|
| **Canonical definition** | Emotion `stress` accumulation (`EMOTION_MODEL.md` § 4.1); environmental stressors via RandomizedContext / LTM life_events (not Emotion today — § 3.2 trigger taxonomy). Stage 6: optional reservoir aggregating acute stress + life-event load for RelapseRisk. |
| **Fields** | Emotion.stress (live) + optional `chronic_load` 0–100 on longitudinal state fed by LTM life_event salience. |
| **Ownership** | Acute → Emotion; chronic_load → longitudinal clinical_intelligence helper reading LTM (must not write Emotion namespace from Adaptation). |
| **Evolution** | Acute decays per Emotion rules; chronic_load slow. |
| **Integration** | Mode activated; RelapseRisk; Evolution year-2 stressors. |
| **Persistence** | Emotion + longitudinal blob. |
| **Do not duplicate** | Fatigue; anger; RiskProfile. |

---

### 1.25 EmotionRegulation

| Axis | Spec |
|------|------|
| **Canonical definition** | HPE `EmotionalRegulationStyle` enum live (`PATIENT_COGNITIVE_MODEL.md` § 2.1). DBT skill enactment missing (`THERAPY_RESPONSE_MODEL.md` § 2.5). |
| **Fields** | Keep HPE style; optional therapy-process `dbt_skills_in_repertoire[]` for patient state (not trainee ACE). |
| **Ownership** | Trait style → HPE; skill enactment state → TherapyResponseProfile / therapy-process. |
| **Evolution** | Traits frozen; skills may unlock across curriculum sessions. |
| **Integration** | Emotion expression; CBE crying/anger; BPD validation-before-change. |
| **Persistence** | HPE + therapy-process state. |
| **Do not duplicate** | EmotionMode; NBE tearfulness as regulation model. |

---

### 1.26 BehaviorProfile

| Axis | Spec |
|------|------|
| **Canonical definition** | Unified reading of verbal / nonverbal / relational channels (`BEHAVIOR_MODEL.md` § 3.1–3.2). Live stack: CBE + Humanization + Adaptation + Emotion expression + NBE + CVP (§ 2.1). Package `behaviour_pattern_tags[]` (R-I5). |
| **Fields** | `pattern_tags[]` (snapshot); runtime view DTO aggregating gate, kind, stance, mode, engagement — **computed**, not a second store. |
| **Ownership** | Tags → Case catalog; turn acts → CBE; micro → Humanization; alliance behaviour → Adaptation. Precedence OWN-03: CBE > Humanization. |
| **Evolution** | Tags frozen; turn plan ephemeral with seeded RNG (`BEHAVIOR_MODEL.md` § 2.3). |
| **Integration** | DecisionPlan; realism RM-disclose / behavior_realism; DSM behaviour patterns. |
| **Persistence** | Tags on snapshot; plans ephemeral (optional trace for assessor CI-S02). |
| **Do not duplicate** | Parallel Behaviour Engine rewriting CBE; TRM PatientBehaviorState as clinical SoT when TRM off. |

---

### 1.27 DecisionState (PatientDecisionPlan)

| Axis | Spec |
|------|------|
| **Canonical definition** | Logical Decision Engine façade — `PATIENT_DECISION_ENGINE.md` § 3.1–3.2. Schema: disclosure, act, affect_mode, stance, cognitive_move?, dissociation?, improvement_signal?, speak. |
| **Ownership** | Orchestration façade (`lib/session-turn` future RT-04 / R-I4). Physical owners remain Adaptation, Emotion, CBE, Humanization — façade **aggregates**, does not merge stores. |
| **Evolution** | Per turn; deterministic CBE selection given seed inputs (§ 3.3 #5). Soft-fail degrade to Modules only (§ 3.3 #6). |
| **Integration** | Message route composition order § 2.1; policy rules § 3.3; observability headers § 6 #3. |
| **Persistence** | Ephemeral by default; optional `case_memory` decision_trace[] for scoring telemetry (CI-S02) — append-only, size-capped. |
| **Do not duplicate** | Peer engine calls; announcing labels in patient voice; second RNG unseeded path. |

---

### 1.28 MSE (MentalStatusExam subset)

| Axis | Spec |
|------|------|
| **Canonical definition** | Runtime MSE object missing (G-02). Authored domains listed in `MENTAL_STATUS_MODEL.md`. Roadmap R-C2: speech/mood/affect/insight/judgement/risk first; thought/perception next (R-H6). |
| **Fields (phase subset)** | `speech?`, `mood?`, `affect?`, `insight`, `judgement?`, `risk_summary?`; later `thought_process`, `thought_content`, `perception`, `cognition` (links ExecutiveFunction). |
| **Ownership** | **Case Engine** package / ClinicalCore extension. Affect display still Emotion at turn time — MSE.affect is presentation phenotype at mint, not EmotionState. |
| **Evolution** | Frozen snapshot; Insight may be marked mutable for longitudinal. |
| **Integration** | Module 1 fidelity optional; CFI mse_realism; promotion pipeline R-C3; closes dual-model drift G-18. |
| **Persistence** | `clinical_snapshot.mse` or ClinicalCore fields. |
| **Do not duplicate** | Engines inventing private MSE schemas (`MENTAL_STATUS_MODEL.md` § Gap); parsing persona JSON ad hoc; trainee MSE competency as patient object. |

---

### 1.29 Memory extensions

| Axis | Spec |
|------|------|
| **Canonical definition** | Live: case_memory (Emotion/Adaptation) + LTM dyad (`MEMORY_MODEL.md`; cognitive § 3.4). Gaps: Thought records / AT store; Adaptation carry; LTM compression at 100-session scale (CI-V05). |
| **Extensions** | (a) `case_memory.memory.clinical_intelligence` namespace for AT activations / adherence working set / decision traces; (b) LTM categories add `automatic_thought` \| `homework` \| `alliance_event` \| `recovery_milestone` (additive); (c) wire Adaptation beginNextSession; (d) imperfect recall cues remain prompt policy (HPE). |
| **Ownership** | Namespaces: Emotion / Adaptation / new CI namespace each patch own keys only (`ENGINE_OWNERSHIP.md` OWN-01). LTM → Patient Memory. |
| **Evolution** | LTM compress over time (live); CI working set cleared or carried per curriculum. |
| **Integration** | Decision Engine memory hits; Evolution arcs; RM-memory. |
| **Persistence** | Existing tables + additive jsonb keys; migration only if new LTM category check constraints exist. |
| **Do not duplicate** | Trainee scores in patient memory (`LONGITUDINAL_CHANGE_MODEL.md` § 7 #4); Emotion state inside LTM; second dyad key scheme. |

---

### 1.30 Therapy effect profiles (TherapyResponseProfile)

| Axis | Spec |
|------|------|
| **Canonical definition** | Replace thin `engages_with` / `resists` / `alliance_cue` bags — `THERAPY_RESPONSE_MODEL.md` § 2.2, § 3.2, CI-T01/T02, R-I3. |
| **Fields** | Per `TherapyModality`: `engages_with[]`, `resists[]`, `alliance_cue`, plus typed `response_biases` (trust_gate, validation_required, advice_sensitivity, exposure_readiness, defence_on_interpretation, homework_sensitivity), optional state machine id. |
| **Ownership** | Case Engine therapy-process / `BUILTIN_THERAPY_PROFILES` additive schema. |
| **Evolution** | Frozen on snapshot `therapy_reaction_rules` evolved shape (backward compatible readers). |
| **Integration** | Emotion interventions + CBE moves (§ 4 Decision tree); Assessment interventions grading; DecisionPlan. |
| **Persistence** | Snapshot therapy_reaction_rules JSON (version field). |
| **Do not duplicate** | ACE modality skills; ideal_approach prose as FSM; Family therapy blank profile forever (CI-T06 — fill when packaging). |

---

### 1.31 Decision pipeline

| Axis | Spec |
|------|------|
| **Canonical definition** | Live composition order `PATIENT_DECISION_ENGINE.md` § 2.1; tree § 2.5; interaction graph § 4. Stage 4 `COGNITIVE_ARCHITECTURE.md` / `RUNTIME_PIPELINE.md` / `ENGINE_CONTRACTS.md`. |
| **Stage 6 shape** | Extract `decidePatientTurn()` returning `PatientDecisionPlan` after Adaptation → (resolve) → LTM → user persist → Emotion → CBE → Humanization **planning**, before LLM — preserving order. Optional cognitive activation step after Emotion using formulation seeds. |
| **Ownership** | Message route or `lib/session-turn` (OWN-04 / RT-04). Engines stay non-peer. |
| **Determinism** | CBE seeded RNG; Emotion expression deterministic; soft-fail ★ preserved. |
| **Integration** | All objects above feed plan inputs; Patient Agent speaks; cbe_direct stall path unchanged. |
| **Persistence** | Plan ephemeral (+ optional traces). |
| **Do not duplicate** | New mind that bypasses frozen snapshot; blocking ★ failures on hard path. |

---

## 2. Proposed module layout under `src/lib/`

Respect existing barrels; prefer **extend existing engines** over a monolith `lib/clinical-intelligence` that re-owns Emotion/CBE.

```
src/lib/
  types.ts                          # ClinicalCore / RiskProfile / MSE / formulation field additions
  case-engine/
    formulation/                    # NEW — BeliefSystem, CoreValues, Schemas, ATs seeds, SelfEsteem
      types.ts
      seed-from-package.ts
      format-for-prompt.ts          # patient-language only
      validation.ts
      index.ts
    mse/                            # NEW — runtime MSE subset promote/validate/format
      types.ts
      promote.ts                    # R-C3 persona → snapshot
      format-for-prompt.ts
      index.ts
    protectives.ts                  # NEW or catalog fields — ProtectiveFactors on packages
    therapy-process.ts              # EXTEND → TherapyResponseProfile
    catalog.ts                      # EXTEND — cognitive/behaviour tags, AT seeds, protectives
    types.ts                        # EXTEND
  personality-engine/               # UNCHANGED ownership — Attachment, Coping, EmotionRegulation traits
  emotion/
    types.ts                        # EXTEND — optional crisis_band mode
    baselines.ts                    # EXTEND — protective priors
    state-machine.ts                # EXTEND — CrisisBand ladder
  adaptation/
    types.ts                        # EXTEND — adherence, insight carry, recovery stage hooks
    engine.ts                       # EXTEND — beginNextSession wiring consumers
    longitudinal.ts                 # NEW — carryTrust helpers used by session create
  conversation-behaviour/
    types.ts                        # EXTEND — defence/dissociation biases mapping
  patient-memory/
    types.ts                        # EXTEND — optional categories
  session-turn/                     # NEW (phase when extracting RT-04)
    decide-patient-turn.ts          # PatientDecisionPlan façade
    types.ts
    index.ts
  clinical-intelligence/            # NEW thin façade ONLY — re-exports + cross-cutting types
    types.ts                        # DecisionState, BehaviorProfile DTO, RecoveryTrajectory, RelapseRisk
    behavior-profile.ts             # pure aggregator DTO
    recovery.ts                     # stage enum + transitions (curriculum)
    stress-reservoir.ts             # chronic_load helper
    index.ts                        # must NOT import ace-bridge cycles; no peer engine writes
  architecture.test.ts              # EXTEND — ownership invariants
```

**Import rules**

- Engines import formulation/MSE types from case-engine barrels.
- `clinical-intelligence` may read engine types and produce DTOs; it must not write `case_memory.emotion` / `patient_adaptation`.
- Assessment may read DecisionPlan traces; must not write patient ontology (`ENGINE_OWNERSHIP.md` Forbidden).

---

## 3. Ordered implementation phases

Architecture first; small safe commits; each phase green on lint → typecheck → test → migrations → build where touched.

### Phase 0 — Contracts & guardrails (docs + tests only)

1. Land this blueprint; update `ARCHITECTURE_STATE.md` stage map row for Stage 6 In Progress.
2. Architecture tests: assert no second Patient type; HPE independent of diagnosis; Emotion vs Adaptation trust namespaces documented; CBE soft-fail; `clinical-intelligence` barrel does not write emotion/adaptation keys.
3. Ontology IDs registered in `PATIENT_ONTOLOGY.md` for every new field **before** code (Stage 3 rule).

### Phase 1 — Promotion pipeline & ClinicalCore additive fields (R-C3 → R-C1)

1. Define promotion contract persona case_file → snapshot (no behaviour change if fields absent).
2. Add `protective_factors[]` to packages + ClinicalCore (G-01 / R-C1).
3. CFI protective_factors dimension starts receiving data.
4. Migration: none if snapshot jsonb already schemaless; add package JSON validation tests.

### Phase 2 — Runtime MSE subset (R-C2)

1. Types for MSE subset; mint promote from persona when present else package defaults.
2. Optional Module 1 fidelity lines (feature-flagged).
3. Insight: dual-write DifficultyModifiers from MSE.insight temporarily; architecture test for single-reader migration plan.
4. Do not enable thought/perception until Phase 2b (R-H6).

### Phase 3 — Patient Formulation Object (R-I2)

1. BeliefSystem, CoreSchemas, CoreValues, SelfEsteem, patient.goals (≠ session_goals), AT seeds, CognitiveDistortions tags.
2. Snapshot `formulation` additive; formatters patient-language.
3. Package seeds for MDD/GAD/PTSD/BPD first (`DSM_MAPPING.md` § 4).
4. Assessment may attach gold-standard formulation for admin grading later — not therapist-visible.

### Phase 4 — TherapyResponseProfile (R-I3)

1. Versioned therapy_reaction_rules; backward compatible with 3-field bags.
2. Wire MI advice resist + CBT thought-record + DBT validation-required biases into Emotion/CBE inputs via route (not peer calls).
3. Homework intervention class on Emotion classifier (additive).

### Phase 5 — DecisionPlan façade (R-I4) + cognitive activation

1. Introduce `PatientDecisionPlan` type + builder aggregating Adaptation/Emotion/CBE.
2. Optional `lib/session-turn` extract without behaviour change.
3. Hook formulation schema/AT activation into plan `cognitive_move`.
4. Dissociation bias tags for trauma/CPTSD (R-I7).
5. Observability headers for gate/stance/mode.

### Phase 6 — Longitudinal wire-up (R-I1, R-I9, R-I13)

1. Session create: `beginNextSession` when preset `longitudinal` / same dyad continuum.
2. TreatmentAdherence / HomeworkAdherence / MedicationAdherence types on Adaptation or therapy-process.
3. RecoveryTrajectory enum + pin_disorder + horizon presets (R-I6 partial).
4. RelapseRisk + StressReservoir chronic_load.
5. Memory extensions categories + CI case_memory namespace.
6. Emotion baseline shift only when recovery stage says so.

### Phase 7 — Emotion CrisisBand & protectives priors (R-I10)

1. After RiskProfile extensions; crisis_band mode; Module 4 still hard.
2. ProtectiveFactors → baseline hope/trust priors.

### Phase 8 — Evolution curricula & realism (R-I6, R-I11)

1. Horizon 10 playbook enforced for one avatar (Maya/Jordan) before 25/50/100.
2. BehaviorProfile DTO + RM metrics hooks.
3. Optional turn-level realism auditor (expression vs reply) — off by default.
4. Assessor telemetry optional features (R-I8) — admin only.

### Phase 9 — Hardening

1. Architecture + migration parity; CFI gates for curriculum packages.
2. Update Stage 5 gap tables to Closed with commit refs.
3. Certification checklist vs `clinical-intelligence/README.md` § Certification.

---

## 4. Types / interfaces needed

Centralize durable clinical shapes in `src/lib/types.ts` or case-engine types; keep engine state in engine folders.

```ts
// --- Formulation (Case Engine) ---
type BeliefId = string;
type SchemaId = string;

type BeliefSystem = {
  version: 1;
  core_beliefs: Array<{
    id: BeliefId;
    statement: string;
    domain: "self" | "others" | "world" | "future";
    strength: number; // 0–100
    salience: "presenting" | "elicited" | "hidden";
    source: "authored" | "package_seed" | "session_derived";
    linked_schema_ids?: SchemaId[];
  }>;
};

type CoreValues = Array<{
  id: string;
  label: string;
  narrative?: string;
  weight: number;
}>;

type CoreSchemas = Array<{
  id: SchemaId;
  if_condition: string;
  then_pattern: string;
  linked_belief_ids: BeliefId[];
  defence_bias?: string;
  coping_bias?: CopingStyle; // reference HPE enum — do not redefine
}>;

type CognitiveDistortion = {
  id: string;
  distortion_kind: string;
  example_thought?: string;
  activation_topics: string[];
  salience: "presenting" | "elicited" | "hidden";
};

type AutomaticThought = {
  id: string;
  content: string;
  trigger_topics: string[];
  linked_belief_id?: BeliefId;
  linked_distortion_ids?: string[];
  hotness: number;
  disclosed: boolean;
};

type SelfEsteem = {
  global: number;
  domains?: Array<{ id: string; score: number }>;
  narrative?: string;
};

type PatientGoals = string[]; // ≠ ClinicalCore.session_goals

type PatientFormulation = {
  version: 1;
  belief_system: BeliefSystem;
  values: CoreValues;
  schemas: CoreSchemas;
  distortions: CognitiveDistortion[];
  automatic_thoughts_seed: AutomaticThought[];
  self_esteem?: SelfEsteem;
  patient_goals?: PatientGoals;
  executive?: ExecutiveFunction;
};

type ExecutiveFunction = {
  planning: ImpairmentBand;
  inhibition: ImpairmentBand;
  flexibility: ImpairmentBand;
  working_memory?: ImpairmentBand;
  fluctuating?: boolean;
  linked_symptom_ids?: string[];
};

type ImpairmentBand = "intact" | "mild" | "moderate" | "severe";

// --- Identity / HPE (existing — do not fork) ---
// AttachmentStyle, CopingStyle, EmotionalRegulationStyle from personality-engine/types.ts
type IdentityModel = {
  // projection only — composed at read time from PersonalityIdentity + ClinicalCore + HPE
};

// --- Protectives / Risk ---
type ProtectiveFactor = {
  id: string;
  label: string;
  category: "social" | "personal" | "clinical" | "cultural" | "other";
  strength?: number;
  narrative?: string;
};

type RiskProfile = {
  // existing fields…
  self_neglect?: boolean;
  risk_to_dependents?: boolean;
  static_factors?: string[];
  dynamic_factors?: string[];
};

// --- MSE ---
type MentalStatusExam = {
  version: 1;
  speech?: string;
  mood?: string;
  affect?: string;
  insight: InsightBand;
  judgement?: string;
  risk_summary?: string;
  thought_process?: string;
  thought_content?: string;
  perception?: string;
  cognition?: string;
};

type InsightBand =
  | "absent"
  | "poor"
  | "partial"
  | "good"
  | "intellectual_only";

// --- Alliance / Adherence / Recovery ---
type TherapyAlliance = {
  // read model from PatientAdaptationState (+ optional derived)
};

type HomeworkAdherence = {
  assigned: boolean;
  completed_band: "none" | "partial" | "full";
  barriers?: string[];
  last_assignment_summary?: string;
};

type MedicationAdherence = {
  regimen_summary?: string;
  adherence_band: "none" | "partial" | "full" | "unknown";
  side_effect_complaint?: string;
};

type TreatmentAdherence = {
  attendance_band: "regular" | "intermittent" | "dropout_risk" | "unknown";
  overall: number;
  homework: HomeworkAdherence;
  medication: MedicationAdherence;
};

type RecoveryStage =
  | "intake"
  | "early_alliance"
  | "engaged_work"
  | "partial_response"
  | "plateau"
  | "relapse_risk"
  | "relapse"
  | "dropout_risk"
  | "dropped_out"
  | "re_intake"
  | "recovery"
  | "maintenance";

type RecoveryTrajectory = {
  stage: RecoveryStage;
  horizon: 10 | 25 | 50 | 100 | "none";
  sessions_completed: number;
  fork?: string;
  progressive_severity?: boolean;
};

type RelapseRisk = {
  level: "none" | "elevated" | "high";
  score?: number;
  triggers: string[];
};

type CrisisRisk = {
  band: boolean;
  mode?: "crisis_band";
};

type StressReservoir = {
  acute: number; // Emotion.stress mirror read
  chronic_load: number;
};

// --- Therapy response ---
type TherapyResponseProfile = {
  version: 1;
  modality: TherapyModality;
  engages_with: string[];
  resists: string[];
  alliance_cue: string;
  response_biases: {
    trust_gate?: boolean;
    validation_required?: boolean;
    advice_sensitivity?: "low" | "medium" | "high";
    exposure_readiness?: "none" | "low" | "moderate";
    defence_on_interpretation?: boolean;
    homework_sensitivity?: "low" | "medium" | "high";
  };
};

// --- Behaviour / Decision ---
type BehaviorProfile = {
  // computed DTO
  pattern_tags: string[];
  disclosure: "withhold" | "deflect" | "partial" | "open";
  act: string;
  stance: string;
  affect_mode: string;
  engagement?: number;
};

type PatientDecisionPlan = {
  disclosure: "withhold" | "deflect" | "partial" | "open";
  act: string; // ConversationBehaviourKind | cooperate | refuse_explicit
  affect_mode: string;
  stance: string;
  cognitive_move?: "activate_schema" | "ruminate" | "problem_solve" | "blank";
  dissociation?: "none" | "mild_detachment" | "marked";
  improvement_signal?: "none" | "alliance" | "insight" | "adherence";
  speak: "llm" | "direct" | "silence_hold";
};

type DefenseMechanism = {
  id: string;
  mechanism: string;
  intensity: number;
  topics: string[];
  cbe_kind_bias?: string;
};
```

Extend `ClinicalCore`:

```ts
protective_factors?: ProtectiveFactor[];
mse?: MentalStatusExam;
formulation?: PatientFormulation;
```

---

## 5. Migration strategy

| Step | Action |
|------|--------|
| 1 | Prefer **additive jsonb** on existing `clinical_snapshot` / `case_memory.memory` / disorder `package` — no destructive rewrites. |
| 2 | New migration only when DB constraints needed (e.g. LTM category check constraint, generated columns, or indexed longitudinal_group flags). Filename `YYYYMMDDHHMMSS_snake_case.sql`; never edit applied migrations (`CLAUDE.md`). |
| 3 | Package catalog TypeScript is source for offline builtins; DB `disorders.package` updated via migration or admin seed script matching catalog. |
| 4 | Promotion pipeline: authored persona fields → snapshot at mint; personas remain authoring assets (`CLINICAL_DATA_MODEL.md` § Two layers). |
| 5 | Backfill: old sessions keep slim snapshots; readers must default-absent. Architecture tests for optional fields. |
| 6 | Longitudinal carry: use `case_memory.longitudinal_group_id` / preset flags; do not mutate prior session snapshots (immutability). |
| 7 | `npm run test:migrations` in CI; remote parity when `SUPABASE_DB_URL` set. |
| 8 | RLS: no therapist read of formulation gold standards if stored on reports; patient-facing APIs never expose admin grading artifacts (`THERAPIST_SCORING_FRAMEWORK.md`). |

---

## 6. Test strategy (matching Stage 6 targets)

Align with Stage 5 certification criteria + roadmap success criteria + existing colocated vitest pattern.

| Target | Test type | Assert |
|--------|-----------|--------|
| One cognition model | unit + architecture | Formulation types validate; Module 1 never dumps DSM criteria; patient_goals ≠ session_goals |
| Protective factors | unit + CFI | Package without protectives fails CFI dim or warns; with protectives Emotion priors shift deterministically |
| MSE subset | unit + mint integration | Promote → snapshot; engines don’t read persona JSON directly |
| Beliefs / schemas / ATs | unit | Seeds activate DecisionPlan cognitive_move given fixed topics; undisclosed ATs withheld when gate withhold |
| HPE independence | architecture (existing) | Attachment/coping not on Case Engine diagnosis path |
| TherapyResponseProfile | unit | MI+advice → resist bias; BPD validation_required; backward compat old 3-field JSON |
| DecisionPlan | unit + route soft-fail | Façade aggregates; CBE error still returns reply; precedence CBE > Humanization |
| Dual trust | contract tests (R-M6 / CI-E06) | Emotion affect vs Adaptation alliance both present; no silent overwrite |
| Adherence | unit | Homework bands update from alliance + conscientiousness fixtures |
| Longitudinal carry | integration | beginNextSession called when preset longitudinal; trust decays not resets to virgin defaults |
| Recovery / relapse | unit state machine | Illegal transitions rejected; no silent cure of symptom_profile |
| CrisisBand | unit | Requires RiskProfile active; Module 4 boundaries unchanged; Humanization humor still gated |
| Evolution horizons | unit | horizon 10 playbook stages; pin_disorder stable across sessions |
| Memory extensions | unit | CI namespace patch doesn’t clobber emotion keys; LTM categories accept new enums |
| Realism | CFI + optional RM | RM-identity / RM-disclose fixtures; soft-fail documented |
| Scoring boundary | architecture | Assessment doesn’t write ClinicalCore; reports admin-only; single weightedOverall |
| Determinism | Emotion/CBE existing | Same inputs → same expression/plan |
| Fiction | certification tests | No PHI paths |

**Do not** add exploit PoCs. Prefer fixtures over live OpenAI in unit tests.

---

## 7. Explicit do-not-touch / do-not-duplicate list

### 7.1 Do not touch (without separate Stage decision)

- Stage 1–4 canonical docs as redesign targets.
- `weightedOverall` fork (`THERAPIST_SCORING_FRAMEWORK.md` § 7 #1).
- Prompt Modules 2–4 rewrite for convenience.
- Permanent diagnosis on avatars.
- ACE ↔ CGE barrel re-export of `ace-bridge` (`architecture.test.ts`).
- Service-role hard-fail regression on message RPCs.
- Demo `*.vpsych.test` accounts re-enable.
- Marketing language claiming validated scores or real clinical accuracy of VQI (`CLINICAL_REALISM.md` § 6 #5).
- Applied Supabase migrations (edit in place).

### 7.2 Do not duplicate

| Forbidden second copy | Canonical owner |
|-----------------------|-----------------|
| Patient / ClinicalCore type | `lib/types.ts` + Case Engine |
| Attachment / Big Five / Coping / EmotionRegulation traits | Personality Engine |
| Emotion variables / expression | Emotion Engine |
| Alliance trust/rapport/stance | Adaptation Engine |
| Disclosure gate / interpersonal acts | CBE |
| Micro hesitation texture | Humanization |
| Longitudinal autobiography facts | Patient Memory LTM |
| Risk flags / Module 4 safety | RiskProfile + SafetyModule |
| Trainee competencies / reports | Assessment + ACE/CGE |
| DSM/ICD code tables | Stage 3 `clinical/DSM_MAPPING.md` + disorders |
| Authored persona MSE as runtime SoT without promotion | Case Engine MSE after R-C2 |
| session_goals as patient goals | Trainee targets only |
| Emotion.trust merged into Adaptation.trust | Keep split OWN-02 |
| Parallel Behaviour Engine | CBE + BehaviorProfile DTO |
| Defence engine writing case_memory emotion | CBE enactment via route |
| Instructor preset grader merged into weightedOverall | TECHNICAL_DEBT |
| Realism indices as trainee skill scores | CFI/AVI/ERI ≠ assessment rubric |

---

## 8. Ownership summary matrix (Stage 6)

| Object | Owner | Persist |
|--------|-------|---------|
| BeliefSystem / CoreSchemas / ATs / Distortions / Values / SelfEsteem / PatientGoals | Case Engine formulation | snapshot |
| IdentityModel | Avatar + HPE | personalities + freeze |
| AttachmentStyle / CopingStrategies / EmotionRegulation (trait) | HPE | freeze |
| ProtectiveFactors / RiskFactors / MSE / ExecutiveFunction | Case Engine | snapshot |
| Hope / Motivation (state) / Stress acute / CrisisRisk mode | Emotion | case_memory.emotion |
| TherapyAlliance / TreatmentAdherence* / Insight carry* | Adaptation | case_memory.patient_adaptation |
| Homework / Medication adherence* | Adaptation or therapy-process (pick one; document) | case_memory |
| RecoveryTrajectory / RelapseRisk / Stress chronic | CI longitudinal helpers + Case/Adaptation | group-scoped state |
| DefenseMechanisms enactment | CBE (+ catalog on Case) | ephemeral + snapshot catalog |
| BehaviorProfile | DTO over CBE/Adp/Emo | ephemeral |
| DecisionState | session-turn façade | ephemeral (+ optional traces) |
| Therapy effect profiles | Case therapy-process | snapshot |
| Memory extensions | Patient Memory + CI namespace | LTM + case_memory |
| Therapist scoring | Assessment | session_reports |

\*Final single owner for adherence must be recorded in `ENGINE_OWNERSHIP.md` before merge.

---

## 9. Integration contracts with existing engines

| Engine | Stage 6 may | Stage 6 must not |
|--------|-------------|------------------|
| Case Engine | Own formulation/MSE/protectives/therapy profiles; mint freeze | Own HPE traits; mutate mid-session snapshot |
| Personality Engine | Supply attachment/coping/regulation/expectations | Own diagnosis, beliefs store |
| Emotion | Consume protectives priors; crisis_band; hope/motivation | Write adaptation; bypass Module 4 |
| Adaptation | Carry alliance; adherence; recovery hooks | Write emotion; redefine RiskProfile |
| CBE | Enact defence/dissociation/cognitive biases | Persist parallel clinical truth |
| Humanization | Read risk + emotion; micro only | Override CBE silence; write case_memory |
| Patient Memory | New categories; retrieve AT/homework facts | Store trainee scores; own Emotion |
| Assessment | Read traces/formulation gold for admin | Expose reports to therapist; invent dx |
| ACE/CGE | Curriculum horizons bridge | Block reports; own patient recovery |
| Voice/CVP/NBE | Express Emotion | Mutate ClinicalCore |
| Prompt / resolve | Inject fidelity blocks for MSE/formulation | Invent clinical fields not on snapshot |

Composition order remains Stage 4 / Decision Engine § 2.1 unless `ORCHESTRATION.md` updated in the same PR as `session-turn` extract.

---

## 10. Serialization / persistence expectations

| Store | Content |
|-------|---------|
| `case_instances.clinical_snapshot` / `sessions.clinical_snapshot` | ClinicalCore (+ protectives, mse, formulation), therapy_reaction_rules v1+, human_personality freeze, difficulty_modifiers |
| `case_memory.memory.emotion` | EmotionState only |
| `case_memory.memory.patient_adaptation` | Adaptation + adherence/arc extensions |
| `case_memory.memory.clinical_intelligence` | AT working set, decision traces, chronic stress — **new namespace** |
| `patient_long_term_memory` | Autobiography + optional new categories |
| `disorders.package` | Seeds: protectives, AT seeds, pattern tags, therapy profiles |
| `session_reports` | Trainee scores only |
| Ephemeral | PatientDecisionPlan, CBE plan, Humanization plan, BehaviorProfile DTO |

Version every new blob (`version: 1`). Readers default missing fields. Deterministic engines: no wall-clock in hashes except recorded timestamps.

---

## 11. Gap ID → Phase map

| Gap / Roadmap | Phase |
|---------------|-------|
| G-18 / R-C3 | 1 |
| G-01 / R-C1 / CI-D02 / CI-R01 / CI-E03 | 1 |
| G-02 / R-C2 / CI related MSE | 2 |
| G-06 / R-I2 / CI-C01–C07 | 3 |
| CI-T01–T02 / R-I3 | 4 |
| CI-P01–P05 / R-I4 / R-I7 | 5 |
| CI-L01–L06 / CI-B01 / G-09 / G-10 / R-I1 / R-I9 / R-I13 / CI-V* | 6 |
| CI-E04 / R-I10 | 7 |
| CI-V01 / R-I6 / CI-R03 / R-I8 / R-I11 | 8 |

---

## 12. Success criteria (Stage 6 exit)

From Stage 5 README certification + `CLINICAL_ROADMAP.md` § Success criteria, implemented:

- [ ] Runtime objects above exist as typed owners (or explicit deferral with owner).
- [ ] Protective factors + MSE subset on ClinicalCore/snapshot; architecture tests assert presence when feature shipped.
- [ ] Formulation optional without breaking Module 1.
- [ ] DecisionPlan façade; CBE soft-fail preserved; OWN-02 split preserved.
- [ ] Longitudinal Adaptation carry works for pin_disorder curricula.
- [ ] TherapyResponseProfile additive; old snapshots still load.
- [ ] No parallel patient-brain docs outside `clinical-intelligence/`.
- [ ] Scores still labeled unvalidated; fiction boundary intact.
- [ ] CI: lint, typecheck, test, migrations, build green.

---

## 13. Document control

| Item | Value |
|------|-------|
| Inputs | All Stage 5 docs listed in package index; skim Stage 3 `CLINICAL_DATA_MODEL.md`; Stage 4 `ENGINE_OWNERSHIP.md`, `COGNITIVE_ARCHITECTURE.md`, `ENGINE_CONTRACTS.md` |
| Outputs | This blueprint only (implementation follows phases on feature branches) |
| Rollback | Docs-only until Phase 1+ code merges |

**Release status:** Blueprint ready for human review before Phase 0 architecture-test PR.

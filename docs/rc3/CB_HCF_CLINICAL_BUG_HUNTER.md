# Clinical Bug Hunter — Human Conversation Fidelity (Wave CB-HCF)

**Branch:** `cursor/clinical-bug-hunter-hcf-3f28`  
**Stance:** Consultant-facing authenticity — make experienced psychiatrists unable to confidently tag the avatar as AI during structured interviews.  
**Scope of this pass:** Prompt / behaviour enactment (Module 1 + per-turn). Not HCE directors (deferred v1.1 #91/#96). Not TTS prosody.

---

## Scoring baseline (pre-fix, engine-level)

| Dimension | Pre | Post (target) | Notes |
|---|---|---|---|
| Human Authenticity | 5/10 | 7–8/10 | Universal human-patient block + process lines |
| Conversation Naturalness | 5/10 | 7/10 | Forbidden patient tells; per-turn layer reminder |
| Emotional Realism | 6/10 | 7/10 | Still prompt-guided; no emotion director |
| Psychotherapy Fidelity | 4/10 | 7/10 | Defences, alliance, modality reaction enacted |
| DSM / ICD Fidelity | 7/10 | 7/10 | Unchanged packages; process supports phenotype |
| Voice Authenticity | 4/10 | 4/10 | Static ElevenLabs settings — open |
| Arabic / English Naturalness | 6/10 | 7/10 | Stronger anti-MSA / anti-essay cues |
| Educational Value | 6/10 | 8/10 | Trainees must earn disclosure layers |
| Therapeutic Alliance | 4/10 | 7/10 | Fragile/testing alliance scripts |
| Patient Believability | 5/10 | 7–8/10 | |
| **Overall Clinical Realism** | **5/10** | **7/10** | Blind sessions still required for PASS |

---

## Bugs found and fixed

### CB-HCF-001 — Difficulty modifiers were bare labels  
**Severity:** Critical (conversation / psychotherapy realism)  
**Clinical explanation:** Module 1 received `Insight: partial` / `Resistance: high` as metadata. Models treat labels as decoration and continue as cooperative vignette narrators — the opposite of advanced/expert SPs.  
**Educational impact:** Trainees never encounter invisible resistance, false compliance, or fragile alliance; they practice on an unrealistically ready patient.  
**Psychiatric reasoning:** Insight, resistance, masking, and alliance are behavioural phenotypes, not adjectives. A high-resistance depressed patient minimises and over-agrees; she does not announce "I have high resistance."  
**Recommended behavioural change:** Expand each label into enactable directives (minimise, false compliance, repair-after-rupture, facade cracks).  
**Implementation:** `therapy-process.ts` → `formatDifficultyBehaviorForPrompt`.  
**Regression test:** `therapy-process.test.ts` CB-HCF-001.  
**Expected realism improvement:** Advanced/expert difficulty becomes audible in the room.

### CB-HCF-002 — No universal human-patient / therapy-process block  
**Severity:** Critical  
**Clinical explanation:** Speech-pace lines alone do not stop symptom lists, perfect chronology, impossible memory, sudden insight, or chatbot empathy. Authored `therapy_behaviour` in personas JSON never reached runtime (`src/` had zero references).  
**Educational impact:** Sessions feel like interviewing a case summary. Alliance, rupture, and layered disclosure cannot be taught.  
**Psychiatric reasoning:** Standardized patients are trained on process (hesitation, shame, topic change, testing) as much as content.  
**Recommended behavioural change:** Mandatory Module 1 block: layered disclosure, imperfect memory, contradictions, silence/avoidance, no DSM self-lecture, no invented records/hospitals/real people.  
**Implementation:** `HUMAN_PATIENT_BEHAVIOUR_LINES` + `formatTherapyProcessForPrompt`; wired in `resolve.ts` even without a case snapshot.  
**Regression test:** CB-HCF-002/003 + resolve wiring tests.  
**Expected realism improvement:** First-pass consultant interviews lose the "AI vignette" smell.

### CB-HCF-003 — Disorder speech profiles lacked defence / disclosure enactment  
**Severity:** High  
**Clinical explanation:** MDD/GAD/PTSD/etc. had HOW-you-speak lines but not HOW-you-defend or HOW-you-disclose-in-layers.  
**Educational impact:** Phenotype collapses to tempo/affect; teaching traps (missed minimisation, premature activation) do not fire.  
**Implementation:** Per-disorder `therapyProcessForDisorder` profiles (defences, layers, pacing).  
**Regression test:** every active builtin slug non-generic.

### CB-HCF-004 — Per-turn reinforcement too thin  
**Severity:** High  
**Clinical explanation:** Mid-session drift back to polished essays and checklists is the classic SP failure mode; one system-prompt paragraph is not enough.  
**Implementation:** Stronger EN/AR per-turn reminders (no symptom lists; one disclosure layer; hesitate/minimise).  
**Regression test:** resolve → `per_turn_reinforcement` match.

### CB-HCF-005 — Therapy modality reaction rules never reached Module 1  
**Severity:** High  
**Clinical explanation:** `therapy_reaction_rules` lived on the case snapshot and were pasted into `ideal_approach` (therapist-facing metadata). The patient model never saw "engages with thought records / resists premature confrontation."  
**Educational impact:** Modality-congruent vs incongruent therapist behaviour produced identical patient responses.  
**Implementation:** `formatTherapyReactionForPrompt` appended into `therapy_process_cue` in `fidelityHintsFromSnapshot`.  
**Regression test:** snapshot resolve contains modality reaction lines.

---

## Still open (next loops)

| ID | Severity | Issue |
|---|---|---|
| CB-HCF-006 | High | Authored persona `therapy_behaviour` / `consistency_rules` / `defence_mechanisms` JSON still not loaded from `personas/*.case.json` into DB runtime — only condensed process profiles above |
| CB-HCF-007 | High | TTS prosody static (`stability`/`similarity_boost`); no affect-congruent voice |
| CB-HCF-008 | Medium | Multi-session memory / symptom evolution engines (PME/HCTF) deferred v1.1 |
| CB-HCF-009 | Medium | No live transcript realism scorer in CI (prompt assembly only) |
| CB-HCF-010 | Medium | Reserved disorders without packages (OCD, social anxiety, eating, …) |
| CB-HCF-011 | Low | Arabic authenticity still prompt-dependent; needs Jordanian SP blind review |

---

## Stop condition

Not met. This pass raises engine-level enactment toward ~7/10 Overall Clinical Realism. Blind consultant sessions on production after deploy remain required before claiming psychiatrists cannot distinguish the avatar from a fictional SP.

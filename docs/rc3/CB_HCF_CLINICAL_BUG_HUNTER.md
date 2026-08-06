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
| Voice Authenticity | 4/10 | 6/10 | Pace/energy → TTS settings; full emotion director still open |
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

### CB-HCF-006 — Authored persona therapy_behaviour never reached runtime  
**Severity:** High  
**Clinical explanation:** Maya/Jordan case files contain full SP training (resistance moves, defence catalogs, disclosure layers, rupture repair, cultural notes) but `src/` had zero references — only prose `persona_prompt` fragments reached the model.  
**Educational impact:** Default-syndrome sessions lost the teaching traps that make these cases educationally load-bearing (false compliance, reassurance loops, inverted GAD disclosure).  
**Implementation:** Condensed cues in `authored-therapy-cues.ts`, injected on Maya/Jordan default syndrome only; skipped on Case Engine diagnosis override so mania/psychosis Module 1 is not fought by MDD/GAD SP scripts. Locale notes for en-US and ar-JO.  
**Regression test:** `authored-therapy-cues.test.ts`.  
**Expected realism improvement:** Default Maya/Jordan interviews enact the authored SP process consultants already certified in the case library.

### CB-HCF-007 — Static TTS prosody for every diagnosis  
**Severity:** High (voice authenticity)  
**Clinical explanation:** Every patient used identical ElevenLabs `stability: 0.4` / `similarity_boost: 0.75`. Depressed, manic, and anxious speech sounded the same — a consultant giveaway in voice sessions.  
**Educational impact:** Trainees cannot practise listening for pressured speech, psychomotor slowing, or anxious edge in the audio channel.  
**Implementation:** `voice/prosody.ts` maps speech pace/energy (and optional disorder slug) → bounded `voice_settings`; wired through TTS route, synthesize client, conversation pipeline, VoiceSession (`personality.speech.pace` after case adapt). Browser TTS rate also adjusted. Cache key includes settings.  
**Regression test:** `prosody.test.ts`.  
**Expected realism improvement:** Voice channel starts matching Module 1 phenotype (still not full HCE emotion director).

---

## Still open (next loops)

| ID | Severity | Issue |
|---|---|---|
| CB-HCF-006b | Medium | Full `consistency_rules` / multi-session evolution still condensed, not full JSON→DB sync |
| CB-HCF-007 | ~~High~~ **Fixed (partial)** | TTS prosody now maps speech pace/energy → ElevenLabs voice_settings + browser rate; not a full emotion director |
| CB-HCF-008 | Medium | Multi-session memory / symptom evolution engines (PME/HCTF) deferred v1.1 |
| CB-HCF-009 | Medium | No live transcript realism scorer in CI (prompt assembly only) |
| CB-HCF-010 | Medium | Reserved disorders without packages (OCD, social anxiety, eating, …) |
| CB-HCF-011 | Low | Arabic authenticity still prompt-dependent; needs Jordanian SP blind review |

---

## Stop condition

Not met. This pass raises engine-level enactment toward ~7/10 Overall Clinical Realism. Blind consultant sessions on production after deploy remain required before claiming psychiatrists cannot distinguish the avatar from a fictional SP.

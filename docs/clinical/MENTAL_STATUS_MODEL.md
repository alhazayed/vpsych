# Mental Status Model

**Status of implementation:** **Split** — rich authored MSE in personas; **no** first-class runtime MSE on `ClinicalCore` / Module 1.

---

## Purpose

Document how mental status examination (MSE) concepts exist in VPsych today, who owns them, and what engines may assume.

---

## Authored representation (personas)

Path: `personas/*.case.json` → `clinical_core.case_file.mental_state_examination` (and `mse_localization` under personalities).

Domains present in authored JSON (evidence: maya-chen.case.json):

| Domain | Authored? | Runtime ClinicalCore? | Module 1 prompt? |
|--------|-----------|----------------------|------------------|
| appearance | Yes | No | No |
| behaviour | Yes | No | No |
| speech | Yes (MSE) + separate speech-behavior cue | Cue only | Fidelity speech cue |
| mood | Yes | Via symptoms / emotion | Indirect |
| affect | Yes | Emotion expression | Emotion block |
| thought_process | Yes | No | No |
| thought_content | Yes | No | No |
| perception | Yes | No | No |
| cognition | Yes | Symptom domain `cognition` only | Partial |
| insight | Yes | Proxy: `difficulty_modifiers.insight` | Difficulty behaviour lines |
| judgement | Yes | Teaching: `judgment_expectation` | CFI, not M1 field |
| risk[] | Yes (rich prose) | Slim `RiskProfile` | Module 4 |

---

## Runtime proxies (what engines actually use)

| MSE-like need | Implementation owner | Mechanism |
|---------------|----------------------|-----------|
| Speech pace/energy | Case Engine `speech-behavior.ts` | `fidelity.speech_behavior_cue` |
| Insight / resistance / masking | DifficultyModifiers | `formatDifficultyBehaviorForPrompt` |
| Affect / openness | Emotion Engine | expression packet + prompt block |
| Nonverbal | NBE / TRM | animation timeline |
| Risk | RiskProfile | Module 4 |
| Insight/judgment teaching flags | clinical_teaching | CFI `mse_realism` checks cue presence |

**Learner competency** `mental_status_examination` exists in ACE/CGE catalogs — that scores the *trainee*, not a patient MSE object.

---

## Ownership

| Layer | Owner |
|-------|-------|
| Authored MSE prose | Persona case library (authoring) |
| Runtime affect | Emotion Engine |
| Runtime speech fidelity | Case Engine |
| Runtime risk | ClinicalCore.RiskProfile |
| **Canonical future MSE object** | Recommended: Case Engine package / ClinicalCore extension — see roadmap |

---

## Gap (do not invent)

There is **no** typed `MentalStatusExam` in `src/lib/types.ts`. Engines must not invent private MSE schemas. Until promoted:

1. Treat persona MSE as authoring-only.  
2. Use Emotion + speech-behavior + RiskProfile for runtime.  
3. Document any new field in `PATIENT_ONTOLOGY.md` first.

---

## Security / clinical integrity

- Authored suicide MSE text is detailed for examiner fidelity; patient-facing Module 4 still forbids method/means instruction.  
- Insight/judgment teaching strings must not become patient self-diagnosis lectures.

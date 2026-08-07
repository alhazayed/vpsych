# Token Budget

---

## Implemented completion caps

| Path | Cap | Source |
|------|-----|--------|
| OpenAI chat patient reply | `maxCompletionTokens: 512` | `patient-agent.ts` |
| AI Gateway patient reply | `maxOutputTokens: 220` | `patient-agent.ts` |
| Temperature | 0.85 | both paths |
| History window | last **20** user/assistant turns | `patient-agent.ts` |

Assessment examiner prompts/tokens: separate path in `assessment.ts` (not the patient mind). Cap details follow assessment implementation — patient turn caps above are the cognitive-brain budget.

---

## Prompt size drivers (patient)

| Component | Relative size | Owner |
|-----------|---------------|-------|
| Module 1 clinical + fidelity | High | Prompt + Case + Adaptation |
| Module 2 personality | High | Avatar |
| Module 2b traits | Medium | HPE |
| Module 3 language | Medium | Avatar |
| Module 4 safety | Medium | Safety + Risk |
| LTM block | Variable | Patient Memory |
| Emotion expression | Low–Medium | Emotion |
| Humanization cues | Low | Humanization |
| CBE reinforcement (user turn) | Low | CBE |
| Per-turn locale cue | Low | Prompt engine |

**No hard max prompt token check** in code — risk of context overflow under large LTM + long history (debt).

---

## Cost coupling

- Higher prompt tokens → higher $ and latency.  
- Gateway 220 vs OpenAI 512 → shorter replies on gateway path.  
- `cbe_direct` → **0** LLM tokens for that turn.  
- Persona fallback → 0 LLM tokens.

---

## Architectural rules

1. Prefer fidelity blocks over duplicating ClinicalCore prose.  
2. Soft engines must not unbounded-append (watch LTM growth).  
3. Do not raise completion caps without updating this budget + cost model.  
4. Assessment must not reuse patient completion caps blindly.

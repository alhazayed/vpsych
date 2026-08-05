# Mission 20 — Human Conversation & Therapeutic Fidelity (HCTF)

**Branch:** `cursor/mission-20-hctf-0594`  
**Prompt engine:** `3.0.0`  
**HCFI:** `1.0.0`

## Objective

Make VPsych patients educationally, emotionally, linguistically, and clinically
indistinguishable from well-trained standardized patients — without trading off
scientific validity or educational value.

## Delivered architecture

| Layer | Change |
|---|---|
| **Prompt v3** | Module 1B human conversation behaviours; alliance reactivity; educational openings; sample utterances; dialect/education rules |
| **Speech profiles** | Disorder-linked pace/energy/behaviour (`src/lib/conversation-fidelity/speech-profiles.ts`) wired into resolve + case generation |
| **Alliance** | Heuristic estimator from therapist turns → patient disclosure guidance on every message |
| **Voice** | Clinical ElevenLabs `voice_settings` (stability/style) from disorder + pace + alliance |
| **HCFI** | 10-dimension 0–100 index with history tracking, admin API, Quality Ledger seal |
| **VQI registry** | HCFI registered as clinical metric (default VQI weights unchanged; HCFI tracked in ledger scores) |

### HCFI dimensions (weights sum 1.0)

Natural Language · Emotional Authenticity · Clinical Authenticity · Cultural Authenticity · Voice Realism · Therapeutic Alliance · Conversational Flow · Patient Consistency · Educational Utility · Immersion

## Self-critique status

Would an experienced psychiatrist believe this is a real patient?

**Not yet reliably.** Structural and prompt improvements raise the floor; live
psychiatrist SP-blind review and learner authenticity surveys remain required
before claiming indistinguishability.

Current offline corpus HCFI is a **calibration floor**, not a published validity claim.

## Recommendations (continuous improvement)

1. Author richer `therapy_behaviour` / `session_arc` consumption from persona JSON into Module 2.
2. Persist `case_memory` disclosed-topics + alliance band per turn (DB), not only prompt injection.
3. Psychiatrist SP-blind rating study (EN + AR) against HCFI for criterion validity.
4. Expand Gulf Arabic personalities beyond ar-JO mapping when product expands locales.
5. Optional: fold HCFI into a new VQI weight set (`hctf-v1`) once board agrees on ratio.
6. Voice: evaluate ElevenLabs style/emotion APIs as they stabilize; keep clinical_intent headers.

## Verification

```
npm run lint
npm run typecheck
npm test
npm run build
```

Admin: `GET /api/admin/hcfi` · `POST /api/admin/hcfi` (transcript score)

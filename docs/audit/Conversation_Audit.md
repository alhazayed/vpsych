# Conversation Audit — Section B (HCFI)

**Audit:** VEA-2026-08-05 · Production SHA `5aae138` · Observational only

## Question that matters

> Could experienced psychiatrists forget they are speaking with AI?

**Production answer:** **Not evidenced. Likely no for a substantial fraction of experts.**  
Mission 20–22 documents explicitly do **not** claim SP-indistinguishability. Human PAS suspected-AI gate (≤40%) has **n = 0**.

---

## Production conversation stack

| Layer | Production status | Evidence |
|---|---|---|
| Prompt engine | **v2 multilingual** | `origin/main` `prompt-engine.ts` header |
| Modules | Clinical, Avatar, Language, Safety | Main prompt modules |
| Cultural / dialect | en-US + ar-JO authored | Personality `cultural_context`, dialect strings |
| `conversation-fidelity/` | **Absent on main** | `git ls-tree origin/main` empty |
| PME expression ownership | **Absent on main** | No `src/lib/pme` |
| HCFI index engine | **Absent on main** | Draft PR #121 |
| Human EN/AR QC | Protocols only (draft) | Mission 22; not executed |

---

## Dimension scores (0–100)

| Dimension | Score | Evidence / gap |
|---|---:|---|
| Natural language | 58 | Persona cases + v2 language module; no human blind corpus |
| Conversation flow | 55 | Turn API works; arc control limited without PME session phases live |
| Hesitation / incomplete sentences / self-correction | 42 | Prompt may encourage; not systematically enforced by mind engine on prod |
| Interruptions / silence | 35 | No strong silence/interruption model on production |
| Topic switching | 50 | Possible via LLM; not state-machine constrained on prod |
| Defensiveness / resistance | 48 | Safety + persona cues; defenses module is draft PME |
| Disclosure timing | 45 | Disclosure rules in packages/personas; continuous disclosure engine draft |
| Trust / rapport development | 50 | Alliance mentioned in prompts; no longitudinal trust physics live |
| Emotion continuity | 48 | LLM affect; no PME emotional state machine on prod |
| Voice pacing (dialogue) | 60 | Coupled to TTS settings; client buffers audio |
| Dialect authenticity (AR) | 70 | Native ar-JO authorship (architectural strength) |
| English realism | 62 | Native en-US personas; depth varies by avatar |
| Educational level consistency | 55 | Learner presets exist; speech register not tightly locked |
| Speech intelligibility | 72 | TTS clarity generally adequate per functional cert notes |
| **Psychiatrist forgets AI?** | **25** | Explicitly unproven; PAS n=0; no production HCTF |

---

## Human Conversation Fidelity Index (HCFI)

**Audit HCFI (production) = 48 / 100**

Note: This is an **audit composite**, not the Mission 20 `src/lib/hcfi` product metric (that library is not on production). Do not conflate with offline HCFI dashboard numbers from draft branches.

### Band

| Band | Meaning |
|---|---|
| 80–100 | Credible SP-adjacent (human-validated) |
| 60–79 | Promising with measurable residual AI tells |
| 40–59 | Useful training dialogue; experts usually detect AI |
| <40 | Not suitable for authenticity claims |

---

## Findings

| ID | Sev | Finding | Root cause | Edu impact | Priority |
|---|---|---|---|---|---|
| CV-C1 | Critical | Authenticity unmeasured on production | No PAS; HCTF not deployed | High risk of overclaim | P0 |
| CV-H1 | High | Production lacks conversation-fidelity subsystem | Unmerged Mission 20 | Hesitation/defense/disclosure uneven | P1 |
| CV-H2 | High | Arabic realism limited to ar-JO | Product locale design | Gulf/Egyptian/MSA learners mismatch | P1 |
| CV-H3 | High | Persona-fallback replies can leak AI tells if mislabeled | Provider key / fallback path | Contaminates expert ratings | P1 |
| CV-M1 | Medium | Incomplete-sentence / silence behaviors not regression-gated on prod | Prompt-only control | Less human micro-structure | P2 |

---

## Recommendations

| Rec | Impact | Priority |
|---|---|---|
| Run blinded PAS before any “feels human” claim | Unlocks (or falsifies) authenticity | P0 |
| Merge/deploy HCTF+PME only after production parity plan | Aligns product with narrative | P0 |
| Separate AR rater stream for dialect | Protects bilingual claim | P1 |
| Exclude `aiSource=persona_fallback` from authenticity packs | Clean measurement | P1 |

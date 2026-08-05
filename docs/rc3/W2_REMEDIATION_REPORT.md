# RC3 Wave 2 Remediation Report

**Mode:** Clinical Fix (High findings only)  
**Authority:** Executive Board — Wave 2 Decision ❌ FAILED (`RC3-W2-EV-20260805T1400Z`, RDL-014)  
**Production SHA (failing baseline):** `5bf66c0`  
**Remediation branch:** `cursor/wave2-remediation-0594`  
**Scope:** W2-H1, W2-H2, W2-H3, W2-H4 only  
**Status:** Engineering remediation complete — **not** a Wave 2 re-certification

---

## Root Cause

| ID | Finding | Root cause |
|---|---|---|
| **W2-H1** | Complex PTSD (`complex-ptsd`, ICD-11 `6B41`) cannot start — `Missing DSM-5 code` | `validateDsmIcd` (case engine) and scenario-template validation required a non-null DSM-5 code even when ICD-11 was present. CPTSD is an ICD-11-only construct with no DSM-5 equivalent. |
| **W2-H2** | Instructor preset `complex-formulation-consultant-en` rejected | `TARGET_LEARNERS` / `TargetLearner` omitted `consultant_psychiatrist`, so preset validation failed on `target_learner`. |
| **W2-H3** | Mania phenotype clinically incorrect (depressive overlay) | (1) Builtin/DB mania packages were thin (≈1 symptom). (2) Module 2 injected full Maya/Jordan MDD `persona_prompt` (“HOW YOU ARE RIGHT NOW”), idioms (`brain fog`, `feeling heavy`), and sample utterances — ~orders of magnitude more text than Module 1. Patient agent followed Module 2. |
| **W2-H4** | Schizophrenia dominated by depressive features | Same Module 2 overlay + thin psychosis package. Negative symptoms were under-specified; depressive chief complaints filled the vacuum. |

---

## Files Changed

| File | Change |
|---|---|
| `src/lib/case-engine/validation.ts` | ICD-11 required; DSM-5 optional when ICD-11 present (W2-H1) |
| `src/lib/scenario-templates/validation.ts` | Same DSM/ICD policy for templates (W2-H1) |
| `src/lib/instructor-presets/types.ts` | Add `consultant_psychiatrist` to `TargetLearner` + `TARGET_LEARNERS` (W2-H2) |
| `src/lib/case-engine/catalog.ts` | Full CPTSD builtin; enrich bipolar-mania + schizophrenia symptom/disclosure packages (W2-H1/H3/H4) |
| `src/lib/case-engine/persist.ts` | `enrichDisorderFromBuiltin()` merges rich builtin phenotype onto thin DB packages without schema change |
| `src/lib/ai/prompt-engine.ts` | **SYNDROME AUTHORITY** — Module 1 overrides conflicting Module 2 current-state |
| `src/lib/avatars/resolve.ts` | Diagnosis-override adaptation: strip EN/AR “current state” blocks, clear idioms/sample utterances, filter localization, set mania/psychosis pace, append CURRENT STATE override |
| `src/lib/case-engine/validation.test.ts` | W2-H1 / package regressions |
| `src/lib/instructor-presets/consultant-learner.test.ts` | W2-H2 regression |
| `src/lib/avatars/resolve.test.ts` | W2-H3 override strip |
| `src/lib/ai/prompt-engine.test.ts` | SYNDROME AUTHORITY present |
| `src/lib/case-engine/generator.test.ts` | Allow null DSM-5 when ICD-11 present |
| `src/lib/scenario-templates/generate.test.ts` | Same ICD-11-first coding assertion |
| `src/lib/case-engine/w2-remediation-scenarios.test.ts` | Production-compatible EN/AR × difficulty probes |

**Not changed (per scope):** voice, auth, database/RLS/migrations, UI, SEO/AEO, analytics, CGE, ACE, release governance.

---

## Clinical Justification

### W2-H1 — ICD-11-only disorders

Complex PTSD (ICD-11 `6B41`) has no one-to-one DSM-5 code. Requiring DSM-5 blocked a catalogued, active disorder from session create. PTSD (`309.81` / `6B40`) remains dual-coded and unchanged. Validation now: **ICD-11 mandatory; DSM-5 optional if ICD-11 is present**.

### W2-H2 — Consultant psychiatrist learner

Consultant / attending psychiatrist is a valid target learner for advanced formulation presets. Adding the enum value restores preset load without altering competency targets, permissions, grading, or ACE/CGE wiring.

### W2-H3 — Mania (DSM-5 manic episode)

Module 1 packages now encode Criterion A/B domains in patient language: elevated/expansive/irritable mood, increased energy/goal-directed activity, **decreased need for sleep**, pressured speech, flight of ideas/distractibility, grandiosity, impulsivity/impaired judgement, with disclosure rules that preserve resistance and severity. Persona MDD current-state blocks are stripped on diagnosis override so scenarios remain variable within mania, not cloned from depression.

### W2-H4 — Schizophrenia spectrum

Module 1 packages emphasize Criterion A domains: delusions, hallucinations, disorganization, negative symptoms, functional decline — with progressive disclosure for teaching differential diagnosis. Depressive features are not the chief complaint unless Module 1 lists them. MDD idioms and current-state narrative are cleared on override.

---

## DSM-5 References

- **Manic episode:** DSM-5-TR Mood Disorders — Manic Episode Criteria A–D (elevated/expansive/irritable mood + increased energy/activity; Criterion B: decreased need for sleep, more talkative/pressured speech, flight of ideas/racing thoughts, distractibility, increase in goal-directed activity/psychomotor agitation, excessive involvement in risky activities; impairment / hospitalization / psychosis as applicable).
- **Schizophrenia:** DSM-5-TR Schizophrenia Spectrum — Criterion A (delusions, hallucinations, disorganized speech, grossly disorganized/catatonic behavior, negative symptoms); functional decline (Criterion B).
- **PTSD (regression):** DSM-5-TR Trauma- and Stressor-Related Disorders — PTSD `309.81` unchanged.
- **CPTSD:** No DSM-5 equivalent code — dual-coding not applicable.

---

## ICD-11 References

- **Complex PTSD:** ICD-11 `6B41` (Complex post-traumatic stress disorder) — prolonged/repeated trauma; re-experiencing, avoidance, persistent sense of threat, plus disturbances in self-organization (affect dysregulation, negative self-concept, interpersonal difficulties).
- **PTSD:** ICD-11 `6B40` — regression path unchanged.
- **Schizophrenia:** ICD-11 `6A20`.
- **Bipolar type I, current manic episode:** ICD-11 `6A60.2` (aligned with production coding).

---

## Regression Results

| Suite | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm test` (vitest) | **192 passed / 38 files** |
| `npm run lint` | 0 errors (pre-existing warnings only) |
| W2-H1 unit + CPTSD × EN/AR × 4 difficulties | PASS |
| PTSD dual-code regression | PASS |
| W2-H2 `consultant_psychiatrist` preset validation | PASS |
| W2-H3 mania package domains + Maya EN/AR strip | PASS |
| W2-H4 schizophrenia psychosis domains EN/AR | PASS |
| Case generator 100-case / template 500-case coding assertions | PASS (ICD-11-first) |
| Instructor preset generate suite | PASS |
| Architecture / ACE / CGE guardrail tests | PASS (untouched engines) |

Voice / text / assessment **runtime** on production still requires **deploy of this remediation** then an independent Wave 2 re-cert agent. Local engine probes cover case minting, preset validation, and prompt assembly for the High findings.

---

## Remaining Risks

1. **Deploy lag:** Production remains on `5bf66c0` until this branch is merged and deployed. Live create of CPTSD / consultant preset / mania–SZ phenotype will still fail or mis-present until then.
2. **LLM residual variance:** SYNDROME AUTHORITY + strip reduce MDD bleed; rare model drift into depressive language remains possible — independent re-cert should probe live EN/AR voice and text mania/SZ sessions.
3. **DB package merge:** `enrichDisorderFromBuiltin` prefers builtin phenotype fields; if operators later author richer DB packages intentionally thinner builtins would still win for those fields until the merge policy is revisited (out of scope).
4. **Arabic “HOW YOU TALK” residual:** Current-state blocks are stripped; depressive speech-style lines in remaining Module 2 sections are overridden by Module 1 + pace/sample clearing for mania/psychosis, but full Arabic talk-section rewrite was not done (avoid persona redesign).
5. **No Wave 2 PASS claimed here** — independent re-certification required before Wave 3 unlock.

---

## Stop Condition

All verified Wave 2 High findings (H1–H4) have engineering fixes and automated verification.  
**Do not proceed to Wave 2 certification in this agent.**  
A fresh independent Wave 2 certification agent must re-run Missions 6–8 (+ voice/safety as applicable) against a deployment that includes this remediation.

# RC3 Wave 2 Application Remediation Report

**Authority:** RDL-016 · `APPLICATION_REMEDIATION_REQUIRED`  
**Evidence of defects:** Independent re-cert `RC3-W2-RECERT-EV-20260805T1545Z`  
**Permit:** `docs/rc3/W2_VERIFIED_HIGHS.md`  
**Branch:** `cursor/w2-application-remediation-0594`  
**Baseline:** production `main` @ `5bf66c0`  
**Role:** Clinical Engineering (not certification)

Wave 3 remains **LOCKED**. This report does **not** certify Wave 2.

---

## Root Cause

| ID | Root cause |
|---|---|
| **W2-H1** | `validateDsmIcd` / scenario-template validation required DSM-5 even when ICD-11 was present. CPTSD (`6B41`) is ICD-11-only with `dsm5_code=null`. Builtin catalog also lacked a full CPTSD package for admin preview. |
| **W2-H2** | (1) `TARGET_LEARNERS` omitted `consultant_psychiatrist`. (2) Admin preset preview mapped DB-only presets by spreading `findPresetBySlug()!` when undefined — leaving `target_learner` / `assessment_type` **undefined** (`Unknown target learner: undefined`). Consultant preset existed in DB seed but not in `BUILTIN_PRESETS`. |
| **W2-H3** | Thin mania disorder packages (≈1 symptom) + Module 2 Maya/Jordan MDD `persona_prompt` (“HOW YOU ARE RIGHT NOW”) / idioms dominated patient replies → hypersomnia/fog instead of DSM-5 manic decreased sleep need. |
| **W2-H4** | Same Module 2 depressive overlay + thin schizophrenia packages → depression-dominant conversation; psychosis denied on probe. |

---

## Files Changed

| File | Change |
|---|---|
| `src/lib/case-engine/validation.ts` | ICD-11 required; DSM-5 optional when ICD-11 present |
| `src/lib/scenario-templates/validation.ts` | Same coding policy for templates |
| `src/lib/case-engine/catalog.ts` | CPTSD builtin; enriched mania + schizophrenia symptom/disclosure packages |
| `src/lib/case-engine/persist.ts` | `enrichDisorderFromBuiltin()` merges rich phenotype onto thin DB packages (no schema change) |
| `src/lib/ai/prompt-engine.ts` | **SYNDROME AUTHORITY** — Module 1 overrides conflicting Module 2 current-state |
| `src/lib/avatars/resolve.ts` | Strip EN/AR current-state blocks; clear idioms/samples on mania/psychosis override; pace + CURRENT STATE block |
| `src/lib/instructor-presets/types.ts` | `consultant_psychiatrist` in `TargetLearner` / `TARGET_LEARNERS` |
| `src/lib/instructor-presets/catalog.ts` | Builtin `complex-formulation-consultant-en` + `mapDbRowToPreset()` |
| `src/app/api/admin/presets/preview/route.ts` | Safe DB→preset mapping (never spread undefined) |
| Tests | `validation.test.ts`, `w2-remediation-scenarios.test.ts`, `consultant-learner.test.ts`, resolve/prompt/generator/template test updates |

**Not changed:** auth, RLS, DB migrations, voice, UI, ACE, CGE, governance.

---

## Clinical Rationale

### W2-H1
Complex PTSD is an ICD-11 construct (`6B41`) without a one-to-one DSM-5 code. Blocking session create on missing DSM-5 prevents valid training cases. PTSD (`309.81` / `6B40`) remains dual-coded and unchanged.

### W2-H2
Consultant / fellowship psychiatrist is a valid CBME target learner (already seeded in Postgres). App must accept the enum and load the preset with competencies, grading, and generation path intact. ACE is untouched (non-blocking compatibility preserved by not changing ACE code).

### W2-H3
DSM-5-TR manic episode requires elevated/expansive **or** irritable mood with increased energy/activity, plus Criterion B features (decreased need for sleep, pressured speech, flight of ideas, grandiosity, goal-directed activity, impaired judgement, etc.). Pipeline fix: enrich disorder **packages** (generation) and strip default-syndrome persona current-state on diagnosis override so Module 1 phenotype can dominate without cloning one script.

### W2-H4
DSM-5-TR / ICD-11 schizophrenia-spectrum presentation centers on Criterion A domains (delusions, hallucinations, disorganization, negative symptoms) and functional decline. Depressive features only when Module 1 justifies them. Same pipeline: richer packages + persona current-state strip + SYNDROME AUTHORITY.

---

## DSM-5 References

- Manic episode: DSM-5-TR Mood Disorders — Criteria A–D (mood + energy; Criterion B symptom list; impairment).  
- Schizophrenia: DSM-5-TR Schizophrenia Spectrum — Criterion A domains; Criterion B functional decline.  
- PTSD regression: `309.81` unchanged.  
- CPTSD: no DSM-5 equivalent code.

## ICD-11 References

- Complex PTSD: `6B41`  
- PTSD: `6B40`  
- Schizophrenia: `6A20`  
- Bipolar type I, current manic episode: `6A60.2` (aligned with production coding)

---

## Regression Results

| Suite | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm test` | **195 passed / 38 files** |
| `npm run lint` | 0 errors (pre-existing warnings only) |
| CPTSD × EN/AR × difficulties (`w2-remediation-scenarios`) | PASS |
| PTSD dual-code regression | PASS |
| Consultant preset validate + `generateFromPreset` | PASS |
| Mania/SZ package domains + Maya EN/AR current-state strip | PASS |
| Case generator / template coding (ICD-11-first) | PASS |
| Architecture / ACE / CGE guardrails | PASS (untouched) |

---

## Remaining Risks

1. **Deploy required:** Fixes are not live until merge to `main` and production deploy. Independent re-cert must target the new production SHA.  
2. **LLM residual variance:** SYNDROME AUTHORITY + strip reduce MDD bleed; rare depressive drift possible — re-cert should probe live EN/AR mania/SZ voice and text.  
3. **Builtin enrich vs DB packages:** `enrichDisorderFromBuiltin` prefers builtin phenotype fields; intentional richer DB authoring later may need merge-policy revisit (out of scope).  
4. **No self-certification:** A fresh independent Wave 2 re-cert agent must re-run after deploy. Wave 3 stays locked until PASS + Board unlock.

---

## Stop

All four verified Highs have engineering fixes and automated verification.  
**Do not unlock Wave 3. Do not perform Wave 2 certification in this run.**

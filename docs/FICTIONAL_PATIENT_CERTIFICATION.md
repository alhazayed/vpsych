# Fictional Patient Certification — Mission Omega

**Date:** 2026-08-06  
**Verdict:** **PASS** (with documented conditionals)

---

## Claim under certification

Every VPsych patient used in production training sessions is:

1. **Synthetic** — authored or procedurally generated for education  
2. **Fictional** — not a real identifiable person  
3. **Non-reproducible as a real patient** — no pathway imports EMR/real identity  

---

## Evidence matrix

| Check | Result | Evidence |
|-------|--------|----------|
| Persona library labeled fictional / examination-approved | PASS | `personas/index.json` |
| Case files use training case IDs (`VPSY-CASE-*`) | PASS | `personas/*.case.json` |
| Session mints immutable `CaseInstance` | PASS | `case-engine/generator.ts`, `persist.ts`, session create API |
| Diagnosis lives on session/case snapshot, not permanent persona ownership | PASS | Engine invariants + DB comments |
| Same persona can present different disorders across sessions | PASS | Generator tests |
| Prompt: role-play / therapy-training simulation | PASS | `prompt-engine.ts` Module 1 |
| Prompt contains literal word “fictional” | CONDITIONAL | Uses simulation/role-play language instead |
| Character lock: no model break | PASS | Prompt Module 4 + hard prohibitions |
| No FHIR/EMR/real-patient import | PASS | Codebase search |
| Research package export strips patient PHI (none stored) | PASS | Anonymized package format |
| Legal/UI copy: fictional patients; not a medical device | PASS | `messages/{en,ar}.json`, KNOWN_LIMITATIONS |

---

## Residual risks (accepted for preview)

| Risk | Mitigation |
|------|------------|
| Trainee pastes real patient details into chat | Privacy copy + training guidance |
| Legacy sessions without clinical snapshot | Fallback to avatar clinical_core — rare |
| Therapist may anthropomorphize AI patient | Reviewer guide + validation portal expectations |

---

## Clinical officer note

Fictional integrity is **certified**. Clinical **measurement validity** is **not** certified (see assessment limitations). Experts must evaluate conversational/educational quality without treating scores as validated instruments.

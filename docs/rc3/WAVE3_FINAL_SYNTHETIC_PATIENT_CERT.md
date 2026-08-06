# Synthetic Patient Certification Report  
## Wave 3 Final — Production `5aae138`

**Verdict:** ⚠ **CONDITIONAL PASS** (synthetic / fictional training patients) — **not** a full PASS for “unique procedural humans incapable of resembling real individuals.”

**Scope:** Production codebase @ `5aae138` / `dpl_8Q7YGEH…` only.

---

## Pathway results

| Pathway | Result | Evidence |
|---|---|---|
| Case mint (`createCaseForSession` / Case Engine) | PARTIAL | Fresh immutable `CaseInstance` + clinical snapshot each session; identity still drawn from fixed avatar personas |
| Life / family / occupation / education / histories | PARTIAL | Authored in `personas/` + clinical packages — fictional, not EHR-derived; not per-session unique biography synthesis |
| Session memory / PME | PARTIAL | PME **absent** on prod SHA; `case_memory` present in schema but not driving patient agent on main |
| Conversation + prompt engine | PASS* | Modules 1–4 character lock; *Medium residual: therapist free text can be echoed by LLM |
| Voice generation | PASS (integrity) / FAIL (availability) | Premade ElevenLabs voices only — no voice cloning of real patients; **TTS currently 502 on prod** (ops/runtime, not identity leak) |
| Knowledge retrieval | PASS | No patient RAG / chart import path |
| Cross-user message isolation | PASS | Session ownership checks + RLS; assistant via RPC |
| Name / biography uniqueness | PARTIAL | Small fixed catalog (e.g. Jordan Hale, Maya Chen) reused globally |
| Real medical-record ingest | PASS | No FHIR/EHR/PDF import surfaces on prod SHA |

---

## Findings

### Critical
None for real-patient recreation / chart ingest.

### High
- Message RPC service-role body vs authenticated EXECUTE grant mismatch remains a defense-in-depth concern (app route still checks owner). Migration evidence: enterprise hardening series on prod.

### Medium
- Fixed persona identities (not procedurally unique humans).
- No secondary PHI scrubber on model output.
- LLM temperature / free-text echo risk for therapist-supplied identifiers.

### Low
- Soft-fail paths on snapshot persistence; shared TTS phrase cache (when TTS healthy).

---

## Certification statement

At production `5aae138`, VPsych patients are **synthetic, fictionally authored** standardized training personas with **procedurally assembled clinical case instances**. The board finds **no evidence** of real medical-record reproduction pipelines.

The platform does **not** yet meet a stricter claim of “every biography is unique and cannot resemble a real person,” because identity is catalog-fixed and dialogue can reflect therapist-entered text.

**Wave 3 gate impact:** Fictional integrity is **not** the blocking Critical for Wave 3 FAIL (W3-C1/H1–H4 are). Conditional PASS recorded for Section 1.

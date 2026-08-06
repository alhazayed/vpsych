# VPsych Wave 3 Certification Dossier

**Document type:** Independent release certification dossier  
**Audience:** Universities · Teaching hospitals · Ethics / IRB committees · Investors · Residency program directors  
**Product:** VPsych — AI standardized-patient platform for therapist training  
**Certification wave:** RC3 Wave 3 (Educational, Scientific, Integrity & Production Readiness)  
**Decision date (UTC):** 2026-08-06  
**Decision ID:** RDL-022  
**Evidence ID:** `RC3-W3-FINAL-EV-20260806T0546Z`

---

## 1. Executive summary

### Verdict

# ❌ NOT READY — Wave 3 is not certified

VPsych’s **production** system at `https://vpsych.vercel.app` was independently examined on 2026-08-06 against educational, scientific, security, fictional-integrity, and production-readiness criteria.

The platform is a **capable training simulator** with working sessions, role isolation, bilingual architecture, and operational curriculum engines. It is **not yet ready** for a Wave 3 educational/scientific certification claim suitable for residency accreditation support or publishable evidence claims.

### Why this matters to external stakeholders

| Stakeholder | What this dossier answers |
|---|---|
| **University / residency director** | Can we rely on VPsych for formal educational assessment today? **Not yet** — dual-coding validity and learner-pathway presets fail certification gates. |
| **Hospital / clinical education lead** | Are patients fictional and sessions isolated? **Conditionally yes** — synthetic patients; no EHR ingest found; admin reports gated. |
| **Ethics / IRB** | Is there evidence of real-patient recreation or PHI export risk? **No Critical recreation path found**; residual LLM echo and medium security items remain. |
| **Investor / board** | Is production scientifically “certified”? **No** — Quality Ledger and research export are absent on the live deploy; remediation exists in unmerged PRs only. |

### Production identity under test

| Field | Value |
|---|---|
| URL | `https://vpsych.vercel.app` |
| Git SHA | `5aae13806c984cb19a9c2e920d14014b548d4400` |
| Vercel deploy | `dpl_8Q7YGEHKesAWt3yNzcJ87cEYYYH2` (target = `production`) |
| Method | Production-only probes + source audit of that SHA |
| Fabricated evidence | **None** |

### One-page outcome

| Domain | Result |
|---|---|
| Security & access control | Conditionally acceptable (no Critical escalation this run) |
| Fictional / synthetic patients | Conditional pass |
| Clinical conversation fidelity (prod) | Incomplete — key remediations undeployed |
| Educational validity | **Fail** |
| Scientific validity / research readiness | **Fail** |
| Production readiness (Wave 3 gate) | **Not ready** |

**Wave 4 remains locked** until a fresh independent re-certification on a remediated production SHA.

---

## 2. Evidence matrix

### 2.1 Preflight and runtime (live production)

| Probe | Result | Observation |
|---|---|---|
| `GET /api/health` | PASS | `ok: true` |
| `GET /api/health/openai` (admin) | PASS | OpenAI configured; model `gpt-5` |
| Admin login | PASS | Audit admin account |
| Therapist login | PASS | Audit therapist account |
| Therapist → `/api/admin/presets` | PASS | **403 Forbidden** (role isolation) |
| `POST /api/sessions` | PASS | 200; clinical case minted (e.g. GAD) |
| `POST /api/sessions/:id/message` | PASS | 200; patient reply returned |
| `GET /api/admin/ace/learners` | PASS | 200 |
| `GET /api/admin/cge` | PASS | 200; learners present |
| Preset preview rate limit | PASS | **429** after budget (controls working) |
| `GET /api/admin/quality-ledger` | **FAIL** | **404** |
| `GET /api/admin/vqi` | **FAIL** | **404** |
| `GET /api/admin/research/export` | **FAIL** | **404** |
| Preset by slug (med student / psychologist / counselor) | **FAIL** | **404** “Preset not found” |
| `POST /api/voice/tts` | **FAIL** | **502** `TTS_FAILED` |

### 2.2 Finding register (blocking)

| ID | Severity | Domain | Status | Production evidence |
|---|---|---|---|---|
| **W3-C1** | Critical | Scientific | **OPEN** | Quality Ledger APIs absent; ledger code/migration absent at prod SHA |
| **W3-H1** | High | Educational | **OPEN** | DB-only learner presets fail when resolved by `presetSlug` |
| **W3-H2** | High | Educational | **OPEN** | GP pathway — prior Wave 3 fail; deep re-test incomplete this run (rate limit) |
| **W3-H3** | High | Educational / Scientific | **OPEN** | Default assessment rubric lacks DSM/ICD reasoning dimensions |
| **W3-H4** | High | Scientific | **OPEN** | Research export API absent |
| **W3-FINAL-H5** | High | Production / Voice | **OPEN** | TTS 502 on production (regression vs Wave 2 TTS PASS) |

### 2.3 What is green on production today

- Authentication and admin/therapist separation  
- Session lifecycle (create → message)  
- Adaptive Curriculum Engine (ACE) and Competency Graph Engine (CGE) admin surfaces  
- Rate limiting on selected admin paths  
- Wave 2 clinical runtime remediations remain on this SHA (prior RDL-019 PASS)

### 2.4 What exists in git but is **not** certified

Remediation PRs **#120** and **#128** address W3-C1 and W3-H1–H4 (plus human-conversation fidelity work). They are **not merged to `main`** and **not deployed** to production. Preview deployments are **out of scope** for this dossier.

Machine pack: `docs/rc3/evidence/wave3_final_pack_2026-08-06T0546Z.json`

---

## 3. Security certification

### 3.1 Scope

Authentication, authorization, admin isolation, API gating, rate limiting, prompt/memory safety surfaces, and privilege-escalation checks against production `5aae138`.

### 3.2 Verdict

**Conditionally acceptable** for continued controlled pilot use under institutional oversight.  
**Not** a blanket “security certified for unrestricted institutional deployment” claim.

### 3.3 Controls observed

| Control | Result |
|---|---|
| Session-based auth (Supabase SSR cookies) | Working |
| Admin API requires admin role | Working (therapist → 403) |
| Session reports admin-only by design | Consistent with prior certification posture |
| OpenAI health endpoint admin-gated | Working (401 unauthenticated) |
| Rate limiting | Observed (429) |
| Critical privilege escalation this run | **Not demonstrated** |

### 3.4 Prompt & memory safety (condensed)

| Area | Verdict | Notes |
|---|---|---|
| Patient system prompt role integrity | Present | Module 4: no role break / no instruction compliance from therapist turns |
| Explicit ban on recreating real/celebrity patients | Gap | Medium — fiction enforced mainly via authored personas |
| Secondary output filter / PHI scrubber | Gap | Medium — model output not post-filtered |
| Cross-user transcript isolation | Acceptable | Ownership checks + RLS patterns; assistant messages via RPC |
| Cross-session patient mind engine | N/A on prod | PME not on production SHA (reduces leakage surface; also limits longitudinal claims) |

### 3.5 Medium security residuals (non-blocking for Wave 3 gate, still material)

- Message RPC grant/body defense-in-depth mismatch (app still checks owner)  
- CSP allows `unsafe-inline` / `unsafe-eval`  
- STT/TTS authenticated but not bound to a specific session id  
- Hard CASCADE deletes / limited recovery UX  
- Institution managers can see peer session metadata (not full transcripts/reports)

### 3.6 Security statement for ethics committees

No production evidence was found of:

- unrestricted therapist access to other users’ reports, or  
- an EHR / real medical-record import pipeline.

Residual risk remains for **LLM free-text echo** (therapist-typed identifiers may be reflected) and **cloud provider retention** outside VPsych’s database.

---

## 4. Fictional Patient Certification

### 4.1 Verdict

**Conditional PASS** — patients are **synthetic training constructs**, not real patients and not chart replays.

### 4.2 What was verified

| Claim | Result |
|---|---|
| Procedurally assembled clinical cases per session | Yes — immutable case instances / clinical snapshots |
| Authored fictional personas (not EHR-derived) | Yes |
| No FHIR / EHR / PDF patient ingest on prod SHA | Yes — none found |
| No real-patient voice cloning | Yes — premade TTS voices only |
| No patient knowledge-base RAG over real charts | Yes — none found |
| Unique procedural human each time | **No** — small fixed persona catalog reused |
| Impossible for dialogue to resemble a real person | **Cannot claim** — therapist text can influence replies |

### 4.3 Certification language approved for external use

> VPsych standardized patients on the examined production release are **fictional, synthetic training personas** with **session-specific clinical case assembly**. The independent board found **no evidence** of real medical-record reproduction pipelines.

### 4.4 Language that must **not** be used yet

> “Every patient is a unique procedural human that cannot resemble any real individual.”

That stronger claim is **not** supported at `5aae138`.

---

## 5. Clinical validation

### 5.1 Scope

Clinical realism for training — case generation, conversation phenotype, bilingual speech, risk portrayal constraints — **as present on production**.

### 5.2 Prior gate (Wave 2) still standing

Wave 2 post-deploy re-certification (**RDL-019**) on this same production SHA passed clinical runtime Highs (complex PTSD create, consultant preset, mania/schizophrenia conversational phenotype). That PASS remains part of the release history.

### 5.3 Wave 3 clinical conversation posture

| Item | Production status |
|---|---|
| Core session conversation | Working (live probe) |
| Human Conversation Fidelity remediations (disorder speech profiles, package thickening) | **Not on production** (present only on undeployed PR #128) |
| Blinded clinical validation laboratory (CVL) | **Not on production** (separate PR; out of Wave 3 scope) |
| Assessment competency scores clinically validated | **No** — measurement machinery may exist in remediations; published reliability coefficients are not claimed |

### 5.4 Clinical statement

VPsych is suitable for **supervised training practice** on the examined release, with the understanding that **consultant-level conversation fidelity upgrades and blinded validation infrastructure are not production-certified**. Clinical believability claims beyond Wave 2’s cleared defects should wait for remediated re-certification.

---

## 6. Educational validation

### 6.1 Verdict

**FAIL** against Wave 3 educational certification criteria.

### 6.2 What works

| Capability | Evidence |
|---|---|
| ACE (adaptive curriculum) admin API | Live 200 |
| CGE (competency graph) admin API | Live 200 |
| Instructor presets list (database) | Live 200 |
| Session-based practice + end-of-session assessment path | Live create/message; prior Wave 3 reliability work reported strong ERI on this SHA |

### 6.3 What fails certification

| Gap | Impact on educators |
|---|---|
| **W3-H1** — medical student / psychologist / counselor presets fail by slug | Learner pathways break when selected by slug (common admin UX) |
| **W3-H2** — GP pathway unresolved for certification | Primary-care training track not cleared |
| **W3-H3** — default rubric lacks DSM-5 / ICD-11 reasoning items | Cannot claim dual-coding educational assessment validity on default sessions |

### 6.4 Educational statement for program directors

> Do **not** treat current production assessment outputs as residency-grade dual-coded (DSM-5 / ICD-11) competency evidence. Use VPsych today as a **supervised skills practice environment**, not as a certified high-stakes assessment system.

---

## 7. Scientific validation

### 7.1 Verdict

**FAIL** against Wave 3 scientific / research-readiness criteria.

### 7.2 Required scientific infrastructure (missing on production)

| Component | Production |
|---|---|
| Quality Ledger (immutable provenance SSOT) | **Absent** (W3-C1) |
| Research export API | **Absent** (W3-H4) |
| Scientific index admin APIs (e.g. VQI) | **Absent** |
| Versioned reproducible export package | **Absent** |

### 7.3 Research ethics implications

Without a production Quality Ledger and research export path, institutions **cannot** truthfully claim:

- reproducible scientific audit trails for every assessment, or  
- publication-ready exports tied to sealed provenance,

on the live system examined in this dossier.

Remediation code exists in unmerged PRs; **code on a branch is not production evidence**.

### 7.4 Scientific statement

> VPsych production at `5aae138` is **not scientifically certified** for research publication support or accreditation dossiers that require sealed, exportable provenance.

---

## 8. Known limitations

1. **Certification is production-only.** Unmerged remediations and preview URLs are excluded.  
2. **Competency scores are not clinically validated** as published psychometric instruments.  
3. **Persona catalog is small and reused**; biographies are authored fiction, not infinite unique humans.  
4. **Longitudinal patient mind / therapy-response engines** featured in later PRs are not on this production SHA.  
5. **Blinded validation laboratory (CVL)** is not production-certified.  
6. **TTS is currently failing** on production (502) — voice training path is not operational in this examination window.  
7. **Arabic and English** are architecturally supported; this final run’s live conversation sample was English-primary.  
8. **Board-computed educational indices from prior Wave 3 FAIL** (e.g. ERI/ALE on that earlier pack) demonstrate partial strengths but **do not override** open Critical/High gates.

---

## 9. Residual risks

| Risk | Severity | Mitigation posture |
|---|---|---|
| Undeployed remediation drift (features “done” in PRs, absent in prod) | Critical process risk | Merge/deploy/#128 + re-cert only |
| LLM reflects therapist-entered identifiers | Medium | Training policy + future output filters |
| Provider-side model/log retention | Medium | DPA / institutional contracting |
| Instruction-only jailbreak resistance | Medium | Continued red-team; no completeness claim |
| Irreversible session purge | Medium | Retention policy / DSAR process |
| Institutional metadata visibility among managers | Medium | Role design review |
| CSP looseness (`unsafe-inline` / `unsafe-eval`) | Medium | Hardening backlog |
| TTS outage | High (ops) | Credential / upstream incident response |
| Over-claiming educational/scientific validity | High (reputational / ethics) | This dossier’s FAIL decision |

---

## 10. Final Wave 3 decision

### Decision

**❌ NOT READY — WAVE 3 NOT CERTIFIED**

Recorded as **RDL-022** in `docs/RELEASE_DECISION_LOG.md`.

### Board actions

1. **Do not unlock Wave 4.**  
2. **Engineering freeze** except Wave 3 remediation deployment and TTS incident fix.  
3. **Required path to re-enter certification:**
   - Merge PR **#128** (Wave 3 educational remediation + HCF)  
   - Apply migration `20260805214500_quality_ledger_and_scientific_indices.sql`  
   - Deploy to production  
   - Restore TTS to PASS (EN/AR)  
   - Run a **new** independent Wave 3 final re-certification on the new production SHA  

### Explicit exclusions from Wave 3 remediation scope

Do not treat the following as Wave 3 certification prerequisites or substitutes:

- Clinical Validation Laboratory (CVL) PR #129  
- CQI / EOI platforms (PRs #126 / #127)  
- Later excellence engines not on production (PME / TRE / etc.), except HCF cues already included in #128  

### Approved external one-liner

> **Independent Wave 3 final certification (2026-08-06): VPsych production is NOT READY.** Core training sessions and role isolation work; educational dual-coding validity, scientific ledger/export infrastructure, several learner presets, and production TTS do not meet certification gates. Wave 4 is locked pending remediated re-certification.

---

## Appendix A — Document control

| Item | Value |
|---|---|
| Dossier path | `docs/WAVE3_CERTIFICATION_DOSSIER.md` |
| Companion executive report | `docs/rc3/WAVE3_FINAL_EXECUTIVE_REPORT.md` |
| Machine evidence | `docs/rc3/evidence/wave3_final_pack_2026-08-06T0546Z.json` |
| Release decision | RDL-022 |
| Certification agent run | `bc-633ebfe4-f64d-4ded-a27d-101fecb90594` |
| Branch carrying this dossier | `cursor/wave3-final-cert-0594` |

## Appendix B — Integrity statement

This dossier contains **no fabricated ratings, no simulated production results, and no assumed deployments**. Every FAIL/PASS claim above is tied to production probes on `5aae138` / `dpl_8Q7YGEH…` and/or source inspection of that SHA. Where evidence was incomplete (e.g. GP deep re-test under rate limit), the finding remains **open**, not cleared.

# VPsych — Phase 4 Readiness Assessment

**Document type:** Read-only assessment. No application code, database, or production change.
**Assessment date:** 2026-08-15 (UTC)
**Branch assessed:** `claude/vpsych-cursor-handoff-h1qovr` @ `09cec18` — **byte-identical to `origin/main`**
**Production SHA:** `7222e6c531e6cbc898c6530d4f4f62ddd044f389` (one docs-only commit behind `main`)
**Production deployment:** `dpl_EbUMBPJAqJuCQfoqvES1aa1So2P1`
**Version:** `1.0.0-rc.1` (CIDP; GA refused by RDL-032/033)

**Scope note:** every claim below was verified against source, git, or a locally executed
gate. Where documentation and code disagree, the code is reported as authoritative and the
drift is recorded. This document does **not** certify anything.

---

## 1. Executive Summary

VPsych is a **technically healthy, architecturally coherent platform with essentially no
validation evidence.** That is the single sentence that should drive Phase 4.

The engineering substrate is in good shape. All five CI gates pass locally on the assessed
SHA (lint 0 errors, typecheck clean, 707 tests across 87 files, migration parity, production
build). Phase 3C's Admin Test Conversation is implemented exactly as its contract describes,
and I verified the isolation gate line-by-line against `src/app/api/sessions/[id]/end/route.ts`
rather than trusting the acceptance record. Phase 3 is genuinely done.

The gap is not code. It is that **nothing the platform measures has been validated, and the
machinery to validate it does not exist on `main`.** The competency scoring formula is an
11-dimension weighted mean with hand-assigned weights and no calibration harness. The
avatar publish gate checks that required fields are non-empty — it performs no clinical
coherence checking and has no expert sign-off step. The clinical, educational, and DR
evidence logs in `docs/cidp/evidence/` contain literal placeholder rows (`| — | — | — |`).
Meanwhile production has accumulated 583 sessions, 466 reports, and 130 learner-competency
rows — real usage that has never been organised into evidence.

There is also a QA blocker that Phase 3C did not intend but did create: **an admin test
conversation's transcript is unreachable in the product UI once the session ends.**
`/sessions/[id]` redirects to `/complete`, which redirects to `/admin/avatars/[id]`, and
`/admin/reports/[sessionId]` requires a `session_reports` row that admin tests deliberately
never get. The QA transcript is written to the database and then orphaned. The feature that
exists to let admins qualify avatars cannot currently show them what the avatar said.

The documented P1 (a therapist can direct-INSERT a forged `admin_test` marker and thereby
evade assessment on their own session) is **real and confirmed against the RLS policy and the
end route.** It is *not* a Phase 4 entry blocker — it cannot forge a successful skip response,
it is audited, and it requires a deliberate Supabase-client call. But it is a scoring-integrity
defect, and it becomes blocking the moment any pilot treats a score as consequential.

Governance has one concrete hole worth naming: **Phase 3 has no row in the append-only Release
Decision Log.** `RELEASE_GOVERNANCE.md` names `RELEASE_DECISION_LOG.md` as the binding record;
the log stops at RDL-033 (Phase 16). Phase 3A/3B/3C acceptance lives entirely in standalone
documents outside the ledger that governs it.

**Recommendation:** Phase 4 should be **"Validation Readiness"** — a deliberately small,
four-workstream phase that closes the scoring-integrity defect, makes avatar QA actually
performable, adds a clinical sign-off gate to publish, and lands the reliability harness. No
new engines. No new features. No GA push. Full rationale in §14.

---

## 2. Current Architecture

### 2.1 Verified inventory

| Dimension | Measured | Documented | Status |
|---|---:|---:|---|
| TypeScript/TSX source files | 665 | — | — |
| Test files (`*.test.ts`) | 87 | 55 (`CLAUDE.md`) | **drift** |
| Tests passing | 707 | ~317 (`CLAUDE.md`) | **drift** |
| SQL migrations | 75 | 61 (`CLAUDE.md`), 66 (`TECHNICAL_DEBT.md`) | **drift** |
| API route handlers | 71 | — | — |
| Authenticated pages | 33 | — | — |
| Persona JSON files | 4 | — | — |
| Disorder IDs declared | 17 | — | — |
| Disorder clinical packages authored | 11 | — | **6 reserved, unpackaged** |
| i18n keys (en / ar) | 1055 / 1055 | parity required | **PASS** |

The count drift is cosmetic but it matters for an assessment phase: the repository's own
orientation document under-reports its test suite by more than half. Anyone reasoning about
coverage from `CLAUDE.md` starts from a wrong baseline.

### 2.2 Stack and layering

Next.js 16 App Router / React 19 · TypeScript strict · Tailwind v4 · Supabase (Auth +
Postgres + RLS) · OpenAI or Vercel AI Gateway · ElevenLabs TTS · next-intl · Vitest · Vercel.

Seven stacked engines, each with a barrel `index.ts` and a matching `docs/` specification:
Dynamic Clinical Case · Clinical Scenario Template · Instructor Preset · Adaptive Curriculum
(ACE) · Competency Graph (CGE) · Human Personality · Clinical Voice Profiles. Beyond these,
`src/lib/` carries a further ~20 subsystem directories (clinical-intelligence, education,
supervisor, enterprise, realtime, quality-ledger, scientific, therapy-room, patient-memory,
validation, ops, plus the single-letter scientific indices `ale/avi/cfi/eri/nbe/rrs/vqi`).

Architectural invariants are enforced by executable guardrails, not convention alone.
`src/lib/architecture.test.ts` asserts them by reading source text — including that
`lib/cge/index.ts` does not re-export `./ace-bridge` (preventing an ACE↔CGE cycle), that
`messageRpcClient` is used rather than hard-requiring a service role, and that the admin-test
skip precedes `assessSession`. This is a genuinely good pattern and it is load-bearing.

### 2.3 Session lifecycle (verified against source)

```
POST /api/sessions              → rate limit → createCaseForSession()
                                → stripAdminTestMarker()  ← defence in depth
                                → requires avatar.is_active
                                → INSERT sessions

POST /api/sessions/[id]/message → ownership + active + time
                                → resolveAvatar(avatar, language, {caseSnapshot})
                                → generatePatientReplyDetailed()
                                → case_memory upsert (best-effort)
                                → insert_assistant_message RPC

POST /api/sessions/[id]/end     → auth → rate limit → load → ownership
                                → close status
                                → [ADMIN-TEST GATE — early return]
                                → session_has_report → assessSession()
                                → education/ACE/CGE → validation → supervisor
                                → enterprise → realtime → patient memory
                                → create_session_report → quality ledger
```

Sessions hard-expire at `MAX_SESSION_SECONDS` (40 min), enforced server-side.

### 2.4 Assessment scoring — the canonical formula

`weightedOverall()` in `src/lib/ai/assessment.ts:256` is a private helper. Eleven dimensions,
each scored 0–5, combined as a weight-normalised percentage:

| Dimension | Weight | Dimension | Weight |
|---|---:|---|---:|
| `risk_formulation` | 12 | `alliance` | 10 |
| `dsm_reasoning` | 11 | `clinical_formulation` | 10 |
| `icd_reasoning` | 11 | `differential_diagnosis` | 10 |
| `assessment` | 8 | `educational_competency` | 8 |
| `interventions` | 8 | `safety` | 8 |
| `structure` | 4 | | |

Weights sum to 100 and are **hand-assigned with no documented derivation** — no expert
weighting exercise, no factor analysis, no criterion anchoring. Two provenance wrappers
(`attachEducationalReliability`, `attachAssessmentValidity`) decorate the output with indices,
but a computed index over an unvalidated instrument does not confer validity.

The `weightedOverallScore` / `reliability.ts` / `calibration/` / `test:reliability` harness
referenced in `CLAUDE.md` **does not exist on `main`.** This is correctly logged as
CI-S05 / `[v1.1]`, but it is the single most consequential absence in the repository.

---

## 3. Phase 3 Outcome

**Verdict: Phase 3 is genuinely complete. Accepted.**

I re-derived this rather than inheriting it. Findings:

| Check | Result |
|---|---|
| Branch vs `origin/main` | **Identical** — zero commits either direction |
| `main` contains production SHA `7222e6c` | **Yes** |
| Phase 3C introduced a migration | **No** — latest migration is `20260811084442`, pre-3C |
| Sole writer of `withAdminTestMarker` | **Confirmed** — only the test-session route |
| Learner create strips forged markers | **Confirmed** — `src/app/api/sessions/route.ts:138` |
| End-gate ordering (skip before assess) | **Confirmed** — `end/route.ts:124–171`, before `session_has_report` |
| Eligibility centralised | **Confirmed** — one helper, called by both API and UI |
| Banner sourced from server marker | **Confirmed** — `?adminTest=1` is navigation only |
| Local CI (all five gates) | **PASS** |

Production delta from the verification run was `+1 session`, `+1 case_instance`,
`+3 messages`, with `session_reports`, `learner_competencies`, `learner_profiles`, CGE nodes/
edges, and learning paths all at delta zero. Maya Chen and Jordan Hale unchanged. That is
exactly what correct isolation looks like.

**One artifact discrepancy, benign:** production runs `7222e6c` while `main` is `09cec18`.
The delta is `docs(phase3c): record mandatory 3C-6 final artifact state` — documentation only,
no application code. Worth an RDL note; not a defect.

**Not re-litigated, per handoff:** PRs #188/#190/#192/#194 remain superseded/closed. #195
(production acceptance documentation) is merged and authoritative. Phase 3 architecture is
unchanged by this assessment.

---

## 4. Clinical Validation Readiness

**Verdict: NOT READY for structured clinical validation.**

This is a judgement about *evidence and controls*, not about whether the simulation is any
good. The simulation may well be good; the platform currently has no mechanism to demonstrate
that, and no mechanism to catch it when it isn't.

### 4.1 Three kinds of validation, kept separate

| Type | Question | Status |
|---|---|---|
| **Technical** | Does the system behave as specified? | **PASS** — 707 tests, guardrail suite, production verification |
| **Clinical** | Do patients present as real patients with these disorders would? | **NO EVIDENCE** |
| **Educational** | Do the scores measure therapist competence? | **NO EVIDENCE** |

Technical validation is strong and should not be confused with the other two. Nothing in this
repository establishes clinical or educational validity, and `docs/stage15/CLINICAL_VALIDATION_REPORT.md`
is honest about this: *"Competency score validation — OPEN — Not scientifically validated."*
That honesty is an asset. It must be preserved.

### 4.2 What exists (real strengths)

- **Clinical formulation depth.** `src/lib/clinical-intelligence/` carries beliefs/schemas,
  runtime MSE subset, protective factors on `ClinicalCore`, typed `TherapyResponseProfile`,
  and a decision stack with dissociation bias. This is well beyond a prompt wrapper.
- **Dual coding.** The catalog carries DSM-5, ICD-10, and ICD-11 codes per disorder
  (e.g. MDD recurrent moderate: `296.32` / `F33.1` / `6A71.1`).
- **Diagnosis is never persona-owned.** Every session mints a fresh immutable `CaseInstance`;
  the diagnosis lives in `sessions.clinical_snapshot`. Locale affects speech and culture only.
  Architecturally correct and guardrail-enforced.
- **Personality independent of diagnosis.** `lib/personality-engine` injects structured traits
  as prompt Module 2b, frozen onto `clinical_snapshot.human_personality`. Two patients with the
  same disorder are different people.
- **Safety module with precedence.** Prompt Module 4 explicitly *"overrides Modules 1–3 on
  conflict"*, carries `risk_profile.suicidal_ideation`, escalation phrasing, and locale-specific
  crisis resources.
- **Anti-hallucination instructions.** *"Imperfect memory; never invent real hospitals, records,
  or people"*; *"obey exactly; never invent"* on substance/medication facts.

### 4.3 What is missing (the gaps that block validation)

| Gap | Evidence | Severity |
|---|---|---|
| **No clinical expert review record.** Nothing in schema or code captures who reviewed an avatar clinically, when, or with what verdict. | No reviewer field in `avatars`; `validation.ts` has no sign-off gate | **Critical** |
| **Safety behaviour is prompt-only.** Crisis, medication, and diagnostic-boundary behaviour are instructions to the model with no runtime enforcement and no adversarial test harness. | Module 4 in `prompt-engine.ts`; no crisis-behaviour test suite | **Critical** |
| **No turn-level realism auditor.** Nothing scores whether a given patient turn was clinically plausible. | R-I11, open in `TECHNICAL_DEBT.md` | **High** |
| **6 of 17 disorders have no clinical package.** `pdd`, `socialAnxiety`, `ocd`, `asd`, `schizoaffective`, `eating` are declared IDs with no authored presentation. | `catalog.ts:16–34` vs 11 `package:` blocks | **High** |
| **No structured medication / substance model.** Prose only. | CLIN-S3-04 | **High** |
| **Symptom consistency, severity, and duration are unconstrained.** No cross-check that authored symptoms match the assigned disorder, or that severity/duration are internally coherent. | `validation.ts` checks presence, not coherence | **High** |
| **Response consistency across turns is unmeasured.** No drift detection. | — | **High** |
| **Arabic clinical heuristics are EN-biased.** Transcript-marker heuristics were authored for English. | EDU-02, SUP-02 | **Medium** |
| **Arabic pronunciation control is a free-text string.** `pronunciation_ar: "Levantine Arabic; soft consonants; measured cadence"` — a prompt hint, not a phoneme control. | `clinical-voice/manager.ts:265` | **Medium** |
| **Interruption handling incompletely wired.** `therapistInterrupted` was a known non-sent flag; now partially closed. | RT-06 / RT-S11-06 | **Medium** |
| **Evidence logs are empty placeholders.** | `docs/cidp/evidence/clinical/` shows `\| — \| — \| — \|` | **Critical for claims** |

### 4.4 Cultural and linguistic assessment

Native bilingual authoring is a real architectural strength and correctly enforced: `en-US`
and `ar-JO` are independently authored humans with different names, cities, and idioms of
distress, and `normalizeAvatarLocale()` maps UI locales onto personality locales. UI key
parity is exact (1055/1055). Locale is confined to speech and culture and never touches
diagnosis — an invariant I verified holds in `resolve.ts`.

What is unproven is whether the Arabic patient is *clinically* as good as the English one.
Nobody has assessed Arabic idioms of distress, Levantine dialect fidelity, or whether the
EN-authored scoring heuristics systematically disadvantage Arabic sessions. Given that
bilingual parity is a core product claim, **an Arabic-specific clinical review is not optional
for Phase 4** — it is the highest-risk unexamined surface in the product.

---

## 5. Avatar Quality

**Verdict: the authoring system can produce *structurally complete* avatars at scale. It
cannot yet produce *clinically consistent, quality-assured* avatars at scale.**

### 5.1 What the publish gate actually enforces

`src/lib/admin/virtual-patient/validation.ts` (518 lines) runs gated checks in `draft` mode
(warnings) and `publish` mode (errors). Gates: `identity`, `clinical`, `disorder`, `voice`,
`personality_en`, `personality_ar`, `human_personality_en`, `human_personality_ar`.

Every check is a **presence/type/format check**:

| Enforced | Not enforced |
|---|---|
| `clinical_core` exists | symptoms are consistent with the assigned disorder |
| `disorder` is set | severity is coherent with symptom count/intensity |
| `age` is a positive number | age is plausible for the disorder's typical onset |
| `symptom_profile` present | duration meets diagnostic criteria |
| `risk_profile.suicidal_ideation` present | risk level is consistent with the presentation |
| `ideal_approach` present | approach is appropriate for the disorder |
| both locale personalities present | the two locales describe the same clinical person |
| voice exists, is found, is active | voice suits the patient's age/gender/affect |
| `schema_version === 2` | any clinician has ever read this avatar |

The gap is stark: an avatar can pass every publish gate while describing a 19-year-old with
three weeks of symptoms labelled *"Major Depressive Disorder, recurrent episode"* — which is
diagnostically impossible. Nothing catches it.

### 5.2 Scale evidence

Production carries **5 avatars**. The persona library carries **4 JSON files**. The
`VirtualPatientWizard` is 1,878 lines. There is no evidence anyone has authored a
high-quality avatar *without* deep familiarity with the system, and no template or guided
clinical path that would let a clinician-author work independently.

**Missing controls, in priority order:**

1. Clinical expert review + sign-off, recorded on the avatar (who, when, verdict, notes).
2. Disorder↔symptom↔severity↔duration coherence validation.
3. Cross-locale clinical equivalence check (same person, two languages).
4. Authoring templates seeded from the disorder catalog packages.
5. Quality rubric with a numeric threshold, not a binary publish flag.
6. Regression detection when an avatar is edited after review.

---

## 6. Admin Workflow

Lifecycle is `draft → testing → published → archived`, with `lifecycle_status` canonical and
`is_active` as the therapist-visibility projection (only `published` → `true`). Transitions
are governed by an explicit graph in `virtual-patient-lifecycle.ts`, and the invariant that
lifecycle changes never rewrite sessions, snapshots, or reports is documented *and*
contract-tested. This is clean design.

| Step | State | Assessment |
|---|---|---|
| Create | → `draft` | Clean |
| Draft edit | `draft` | Warnings not errors — correct |
| Testing | `draft ⇄ testing` | Clean; gates admin test conversation |
| Validate | any | `POST /api/admin/avatars/validate` — non-persisting, good |
| Preview | any | Non-persistent, admin-only, rate-limited |
| Publish | `draft\|testing → published` | Structural gate only (§5.1) |
| Edit published | `published` | **Immutable** — must duplicate |
| Archive | `published → archived` | DEACTIVATE ≡ ARCHIVE |
| Restore | `archived → draft` | Clean |
| Duplicate | → `draft` | Clean |

### Findings (no redesign proposed, per instruction)

| # | Finding | Severity |
|---|---|---|
| UX-1 | **No clinical review step exists in the workflow.** `testing` is the only pre-publish state and it has no completion criterion — nothing records that testing happened, let alone that it passed. | **High** |
| UX-2 | **Published immutability has no correction path.** A typo in a published avatar requires duplicate → edit → publish → archive, which orphans session history against the old avatar ID. Safe, but severe. | **Medium** |
| UX-3 | **Admin test is `testing`-only.** Deliberate MVP choice (PD-1/PD-2), but it means a published avatar cannot be re-qualified in place after a regression. | **Medium** |
| UX-4 | **Two overlapping status concepts surfaced to admins** (`lifecycle_status` and `is_active`). Correct internally; terminology risk in UI. | **Low** |
| UX-5 | **Validation feedback is issue-code driven** (`clinical_disorder_required`) with no clinical explanation of *why* the field matters. | **Low** |
| UX-6 | **`VirtualPatientWizard` is 1,878 lines in one component.** Maintenance and review risk. | **Low** |

---

## 7. Admin Test Conversation

**Verdict: correct as an isolation mechanism. Insufficient as a QA instrument.**

Phase 3C built exactly what its contract specified, and the security properties hold. But the
contract specified *isolation*, not *QA capability* — and the difference now matters, because
avatar QA is on the Phase 4 critical path.

### 7.1 What works (verified)

Reuses the existing session engine, Therapy Room, voice pipeline, and transcript stack — no
second engine. Server-sourced TEST MODE banner in EN and AR. Full voice/STT/TTS runtime.
Rate-limited at 20/h. Three audit events with scrubbed metadata. Learner `/sessions` excludes
admin-test rows; admin `/sessions` badges them. End returns `{ok, adminTest, skippedAssessment:true}`
and stops before every learner-pipeline processor.

### 7.2 Gap A — the transcript is orphaned (**blocking for QA**)

This is the most important finding in this section, and it is a new observation, not a restated
Phase 3C finding.

Traced through source:

```
completed admin-test session
  → /sessions/[id]          : status !== "active" → redirect /sessions/[id]/complete
  → /sessions/[id]/complete : isAdminTestSnapshot → redirect /admin/avatars/[id]
  → /admin/avatars/[id]     : no transcript view
  → /admin/reports/[id]     : requires session_reports row — admin tests never create one
```

Every path loops back to the avatar detail page. **The QA conversation is persisted to
`session_messages` and is then unreachable through the product UI.** Reviewing what the
avatar actually said requires direct database access.

An admin cannot currently: re-read a test transcript, compare two test runs, show a
transcript to a clinical reviewer, or attach a verdict to it. The feature whose purpose is
qualifying avatars cannot display the evidence it generates.

### 7.3 Gap B — missing QA capabilities

| Capability | Present | Needed for professional avatar QA |
|---|---|---|
| Transcript review after end | **No** (§7.2) | **Required** |
| Structured QA verdict (pass/fail + notes) | No | **Required** |
| QA checklist against clinical criteria | No | **Required** |
| Test history per avatar | No | **Required** |
| Side-by-side EN/AR comparison | No | High |
| Run comparison across sessions | No | High |
| Export transcript for expert review | No | High |
| Prompt/snapshot inspection for debugging | No | Medium |
| aiSource surfaced during test | Propagated to client | Medium — must be visible so a `persona_fallback` reply is never QA'd as a model reply |
| Latency/turn timing telemetry | No | Medium |
| Published-avatar re-test | No (`testing` only) | Medium |

### 7.4 Residual isolation observations

- Mid-session `case_memory` upserts (`message/route.ts:410`) carry no admin-test filter.
  Contained per-session; becomes relevant only alongside F-3.
- `loadDyadClinicalCarry` may select a prior admin-test session for the same therapist+avatar
  (F-3, P3). Low under MVP because `testing` avatars are not learner-startable.

---

## 8. Educational Validation

**Verdict: NOT READY. The platform produces scores; it has no evidence they measure anything.**

### 8.1 The core problem

`weightedOverall()` is a weighted mean of 11 LLM-produced 0–5 ratings (§2.4). For this to
constitute educational measurement, one would need: derived rather than assumed weights,
inter-rater reliability against human experts, test-retest reliability, criterion validity
against an external standard (OSCE, supervisor rating), and evidence of no systematic bias by
language, case, or difficulty. **None of these exist.** The repository is consistent and
honest on this point (EDU-05, SUP-04, VAL-03, CI-S05, and the `CLAUDE.md` standing
instruction never to imply scores are validated).

### 8.2 Evidence gaps

| Requirement | Status | Evidence |
|---|---|---|
| Reliability/calibration harness | **Absent from `main`** | CI-S05 — `reliability.ts`, `calibration/`, `test:reliability` do not exist |
| Inter-rater reliability | **No data** | Stage 8 store exists; unpopulated |
| Expert review of scores | **Never performed** | No workflow, no schema |
| Criterion validity | **Absent by design** | VAL-03 — "intentional null until study" |
| Test-retest / repeatability | **No data** | No repeat-session protocol |
| Bias analysis (EN vs AR) | **Never performed** | EDU-02/SUP-02 indicate EN-biased heuristics — bias is *likely*, not merely unknown |
| Case difficulty calibration | **Unvalidated** | EDU-03 — difficulty biases are recommendations only |
| Longitudinal progress validity | **Unvalidated** | ACE/CGE implemented; outcomes unmeasured |
| Rubric derivation | **Undocumented** | Weights hand-assigned |

### 8.3 The asset nobody is using

Production holds **583 sessions, 466 reports, and 130 learner-competency rows**. That is a
substantial retrospective corpus. It cannot establish criterion validity on its own — there is
no external standard to correlate against — but it is more than enough for:

- test-retest and internal-consistency analysis,
- score distribution and ceiling/floor analysis,
- EN vs AR distributional comparison (a first bias signal),
- sampling a stratified subset for blinded expert re-rating, which *would* yield real
  inter-rater reliability.

**This is the cheapest available path from zero evidence to first evidence**, and it requires
no new sessions, no pilot recruitment, and no production change. It should be in Phase 4.

---

## 9. Security & Governance

### 9.1 Security posture — **strong**

| Control | Status | Evidence |
|---|---|---|
| Auth split (pages redirect / routes JSON) | **PASS** | `lib/auth.ts` vs `lib/api-auth.ts` |
| Admin edge gate | **PASS** | `middleware.ts` gates `/admin` + `/api/admin` |
| Roles in `profiles.role`, never `user_metadata` | **PASS** | verified |
| RLS: assistant/system messages via SECURITY DEFINER RPC only | **PASS** | client insert restricted to `role='user'` |
| `session_reports` insert-once, HMAC-signed | **PASS** | `create_session_report` |
| Report reads gated on `is_admin()` | **PASS** | never on therapist-facing API |
| RLS `initplan` optimisation (`(select auth.uid())`) | **PASS** | `20260803021426` |
| Rate limiting on every handler | **PASS** | Upstash-backed with memory fallback |
| Error sanitisation | **PASS** | `clientSafeError` / `sanitizeDbError` |
| Security headers as pure data module | **PASS** | `lib/security-headers.ts` + tests |
| Audit trail | **PASS** | `security_audit_events`; `requireApiAdmin` auto-logs denials |
| Dependency audit | **PASS** | 0 vulnerabilities |
| PHI isolation | **PASS** | fictional standardized patients only |
| Learner isolation | **PASS** | RLS + ownership; admin-test verified isolated in production |

### 9.2 The P1 — forged `admin_test` (assessed, **not fixed**, per instruction)

**Confirmed against source.** The chain:

1. `supabase/migrations/20260803021426_database_certification_hardening.sql:40` —
   `CREATE POLICY "Therapists can create own sessions" ON public.sessions FOR INSERT
   TO authenticated WITH CHECK (therapist_id = (SELECT auth.uid()));`
   **No constraint on `clinical_snapshot` contents.**
2. A therapist can therefore direct-INSERT a session with `clinical_snapshot.admin_test = true`
   using the browser Supabase client, bypassing `POST /api/sessions` entirely.
3. `end/route.ts` closes the session status **first** (line ~103), then evaluates the
   admin-test gate, which denies with 403 and returns — **before** `assessSession`.
4. The session is now permanently `completed` with no assessment. Re-calling `end` re-enters
   the same branch. There is no recovery path.
5. `/sessions` also hides admin-test rows from the learner's own history.

**What the attacker gains:** selective, permanent, self-directed evasion of assessment on
their own sessions, with the evaded session hidden from their history.

**What the attacker does not gain:** any `{skippedAssessment:true}` success response;
access to another user's session; report/competency/ACE/CGE writes; escape from audit —
`admin.avatar.test_session.forged_skip_denied` fires every time.

**Severity assessment:** correctly rated P1. It is a scoring-integrity defect, not a data-breach
or privilege-escalation defect.

**BLOCKING or NON-BLOCKING? → NON-BLOCKING for Phase 4 entry.** It requires deliberate
misuse of the Supabase client, produces an audit record, and cannot fabricate a successful
skip. It becomes **BLOCKING** the moment scores carry consequence — certification, grading,
or any pilot claim about learner performance. Since Phase 4 as recommended is precisely about
making scores meaningful, **it should be fixed inside Phase 4, early.**

Three remediation shapes exist (evaluate in Phase 4, do not pre-commit here): validate the
skip *before* closing status and refuse the close; fall through to the learner pipeline after
auditing a forged marker; or constrain the snapshot at INSERT via trigger or RPC. The third
is the only one that closes the vector rather than the symptom. Note also that direct INSERT
bypasses the `is_active` avatar check and the `start` rate limit — a trigger-based fix
addresses that surface too.

Finally, **F-5 remains open**: the Phase 3C contract says "do not skip" in §5.2 while the
chosen rule is 403. That ambiguity should be resolved in writing before the fix is designed.

### 9.3 Governance — **the weakest area**

| Item | Status |
|---|---|
| Release governance policy | **PASS** — `RELEASE_GOVERNANCE.md`, roles and state machine defined |
| Append-only decision log | **PASS as a mechanism** |
| **Phase 3 recorded in the RDL** | **FAIL — no row.** Log ends at RDL-033 (Phase 16) |
| GA authorization | Correctly **NO-GO** (RDL-032/033) |
| DR procedures documented | **PASS** — `DISASTER_RECOVERY.md`, RTO ≤4h / RPO ≤24h |
| **DR drill executed** | **FAIL** — evidence log: `\| _(none yet)_ \| — \| — \| PITR / backup restore \| OPEN \|` |
| PITR verified | **Never** |
| Penetration test | **Never** |
| Incident response | Documented; never exercised |
| Leaked-password protection (HIBP) | **Disabled** (SEC-S12-01) |
| Upstash in production | **Unconfirmed** (SEC-S12-02) — memory fallback is not horizontally safe |
| APM / Sentry | **Absent** (SEC-S12-03); `X-Request-Id` shipped, vendor APM open |
| Retention policy for admin-test sessions | **PRODUCT DECISION — deliberately not invented** |
| Doc/code drift | Counts stale in `CLAUDE.md` and `TECHNICAL_DEBT.md` |

The Phase 3 RDL gap is the one to fix first and it costs almost nothing. The governing
document names the RDL as binding; a phase that shipped to production and is described as
"formally accepted" without a ledger row is a process inconsistency that will be awkward to
explain at any external review.

---

## 10. Production Readiness

**Verdict: READY for continued Controlled Institutional Deployment. NOT ready for GA.**
This is unchanged from RDL-032/033 and this assessment finds no reason to revisit it.

### 10.1 Gates executed locally on `09cec18`

| Gate | Result |
|---|---|
| `npm run lint` | **PASS** — 0 errors, 13 warnings |
| `npm run typecheck` | **PASS** |
| `npx vitest run` | **PASS** — 707 tests, 87 files, 14.9 s |
| `npm run test:migrations` | **PASS** (local structure; remote parity skipped, `SUPABASE_DB_URL` unset) |
| `npm run build` | **PASS** |

### 10.2 Operational readiness

| Area | Status |
|---|---|
| Deployment (Vercel) | **PASS** — production READY/PROMOTED |
| Health endpoints | **PASS** — `/api/health`; `/api/health/openai` admin-gated |
| In-app ops dashboards | **PASS** — `/api/admin/ops/{metrics,cidp,phase14,phase15,phase16}` |
| External monitoring / APM | **ABSENT** |
| Backup | Supabase automatic (plan-dependent) — **never restore-tested** |
| Disaster recovery | Documented — **never drilled** |
| Rate limiting at scale | **Unconfirmed** — Upstash presence unverified in prod |
| Rollback | Documented (Vercel promote); tag `rc1-pp-1.0-baseline` |

**The largest operational risk is that backups have never been proven restorable.** With 583
sessions and 466 reports of accumulated institutional data, an untested restore path is a
material exposure — and it is a GA blocker already named by the Board.

---

## 11. Certification Readiness

No certification is claimed. What each downstream milestone would require:

| Milestone | Missing |
|---|---|
| **Internal QA** | Transcript review surface (§7.2) · QA checklist + verdict capture · test history · avatar quality rubric |
| **Clinical expert review** | Reviewer role/workflow · sign-off schema · transcript export · Arabic clinical reviewer · structured review instrument |
| **Educational validation** | Reliability harness (CI-S05) · blinded expert re-rating of a stratified sample · IRR statistics · EN/AR bias analysis · documented rubric derivation |
| **Structured pilot** | Registered institutions (registry currently empty) · pilot protocol + objectives · consent/ethics · populated evidence logs · retention decision (PD-3) |
| **Certification** | All of the above **plus** DR drill + PITR evidence · penetration test · security residuals closed (HIBP, Upstash, APM) · Board RDL authorizing the claim set |

**Evidence status:** clinical, educational, and DR logs all contain placeholder rows only.
The Phase 16 dashboard defaults every gate to *Evidence Pending*, and the codebase refuses to
fabricate. That discipline is correct and should be preserved without exception.

---

## 12. Phase 4 Candidate Work

Each candidate carries objective · problem · clinical / educational / technical / security
importance · dependency · complexity · risk · validation requirement.

---

**C-1 · Close the forged `admin_test` vector (F-1) + resolve contract ambiguity (F-5)**
Prevent a non-admin from suppressing their own assessment. *Problem:* sessions INSERT RLS does
not constrain `clinical_snapshot`; the end route closes status before denying, leaving a
permanently unassessable session. *Clinical:* low. *Educational:* **high** — scores are
meaningless if evasion is available. *Technical:* medium. *Security:* **high**.
*Dependency:* F-5 wording resolved first. *Complexity:* medium (may need a migration).
*Risk:* medium — touches the end route's monotonic order; regression risk to Phase 3C skip.
*Validation:* forged-marker test matrix + learner regression suite + architecture-test update.

**C-2 · Admin Test QA review surface**
Make test transcripts reachable and reviewable. *Problem:* §7.2 — transcript is written then
orphaned; avatar QA cannot be performed. *Clinical:* **high** — precondition for expert review.
*Educational:* medium. *Technical:* low–medium. *Security:* low (admin-only, RLS already
permits `is_admin()` reads). *Dependency:* none. *Complexity:* medium. *Risk:* **low** —
additive, admin-only, no learner path touched. *Validation:* transcript reachable and correct;
learner paths unchanged.

**C-3 · Avatar clinical review + sign-off gate**
Record clinical review as first-class state and require it to publish. *Problem:* publish
enforces structure only; no clinician need ever have read an avatar. *Clinical:* **critical**.
*Educational:* high. *Technical:* medium. *Security:* low. *Dependency:* **C-2** — reviewers
need transcripts. *Complexity:* medium–high (migration + lifecycle + UI). *Risk:* medium —
touches Phase 3B lifecycle, which is production-verified; must be strictly additive.
*Validation:* lifecycle contract tests; existing published avatars must not break.

**C-4 · Clinical coherence validation**
Check disorder↔symptom↔severity↔duration↔age consistency at validate/publish.
*Problem:* diagnostically impossible avatars pass today. *Clinical:* **critical**.
*Educational:* medium. *Technical:* medium. *Security:* none. *Dependency:* disorder catalog.
*Complexity:* medium. *Risk:* medium — may fail existing avatars; must ship as warnings first.
*Validation:* rule suite + regression over all 5 production avatars.

**C-5 · Assessment reliability harness (CI-S05)**
Land `reliability.ts` + `calibration/` + `test:reliability` on `main`. *Problem:* no mechanism
to measure score reliability. *Clinical:* medium. *Educational:* **critical**. *Technical:*
medium. *Security:* none. *Dependency:* none (retrospective corpus suffices to start).
*Complexity:* high. *Risk:* low — analysis-side, no runtime change. *Validation:* harness
reproduces known scores; documented statistical method.

**C-6 · Retrospective score analysis over 583 sessions / 466 reports**
Produce the first real evidence: distributions, internal consistency, test-retest, EN/AR
comparison. *Problem:* zero evidence despite a substantial corpus. *Clinical:* medium.
*Educational:* **critical**. *Technical:* low. *Security:* medium — must be aggregate-only,
PHI-free, admin-only. *Dependency:* **C-5**. *Complexity:* medium. *Risk:* low (read-only).
*Validation:* reproducible analysis; no raw narrative leaves the admin boundary.

**C-7 · Blinded expert re-rating → first inter-rater reliability**
Stratified sample re-rated by human experts; compute IRR. *Problem:* no IRR data exists.
*Clinical:* **critical**. *Educational:* **critical**. *Technical:* low. *Security:* medium.
*Dependency:* **C-2**, **C-5**, **C-6**. *Complexity:* high — mostly process, not code.
*Risk:* medium — may show poor agreement, which is a *valuable* result and must be reportable.
*Validation:* documented protocol; pre-registered statistics.

**C-8 · Arabic clinical + linguistic review**
Assess Arabic patients' clinical fidelity, dialect authenticity, and scoring parity.
*Problem:* bilingual parity is a core claim and is entirely unexamined; EN-biased heuristics
make bias likely rather than merely unknown. *Clinical:* **critical**. *Educational:* high.
*Technical:* low. *Security:* none. *Dependency:* **C-2**. *Complexity:* medium.
*Risk:* medium — may reveal systematic disparity. *Validation:* native-speaker clinician review.

**C-9 · Governance reconciliation**
Append the Phase 3 RDL row; record the production/`main` docs-only delta; refresh stale counts
in `CLAUDE.md` and `TECHNICAL_DEBT.md`. *Problem:* §9.3. *Clinical:* none. *Educational:*
none. *Technical:* low. *Security:* low. *Dependency:* none. *Complexity:* **trivial**.
*Risk:* **none** (docs only). *Validation:* review.

**C-10 · Ops analytics filtering (F-2)**
Exclude admin-test sessions from institutional ops counts, or document their inclusion.
*Problem:* verified — `phase14`/`phase16`/`cidp` routes run unfiltered `count` queries.
*Clinical:* none. *Educational:* low. *Technical:* low. *Security:* none. *Dependency:* none.
*Complexity:* low. *Risk:* low. *Validation:* counts match filtered expectation.

**C-11 · Dyad carry admin-test exclusion (F-3) + admin home badge (F-4)**
Small correctness cleanups. *Importance:* low across the board. *Complexity:* low.
*Risk:* low. *Validation:* unit tests.

**C-12 · DR drill + PITR verification**
Execute and record a real restore. *Problem:* backups never proven restorable; GA blocker.
*Clinical:* none. *Educational:* none. *Technical:* medium. *Security:* **high**.
*Dependency:* ops/infra access. *Complexity:* medium. *Risk:* medium — a real drill touches
infrastructure and must not run against production data paths carelessly.
*Validation:* signed evidence rows in `docs/cidp/evidence/dr/`.

**C-13 · Security residuals** — enable HIBP; confirm Upstash in production; add APM/Sentry.
*Security:* high. *Complexity:* low. *Risk:* low. *Validation:* config verification.

**C-14 · Complete 6 unpackaged disorders** — author packages for `pdd`, `socialAnxiety`,
`ocd`, `asd`, `schizoaffective`, `eating`. *Clinical:* high. *Complexity:* high (authoring).
*Risk:* low. *Dependency:* **C-3/C-4** should exist first so new content is reviewed and
coherence-checked. *Validation:* clinical review of each package.

**C-15 · Turn-level realism auditor (R-I11)** · **C-16 · Structured medication/substance model
(CLIN-S3-04)** · **C-17 · Retention policy implementation (PD-3)** — all deferred; see §17.

---

## 13. Prioritization

Classified against the strategic priority order given in the handoff: clinical validity >
educational validity > structured expert review > security/governance > avatar quality >
Arabic/voice quality > measurable QA > continuous improvement.

### P0 — Phase 4 must contain these

| ID | Item | Rationale |
|---|---|---|
| **C-2** | Admin Test QA review surface | Nothing else in the clinical chain can start. Expert review requires readable transcripts. |
| **C-3** | Avatar clinical review + sign-off gate | Highest-priority clinical control; converts "someone should review this" into enforced state. |
| **C-1** | Close forged `admin_test` (F-1/F-5) | Scoring integrity must be sound before scores are analysed or claimed. |
| **C-5** | Reliability harness | The instrument that makes educational validity measurable at all. |
| **C-9** | Governance reconciliation | Trivial cost, removes a real process inconsistency. |

### P1 — strongly recommended, sequence after P0 lands

| ID | Item | Rationale |
|---|---|---|
| **C-4** | Clinical coherence validation | Natural completion of C-3; ship warnings-first. |
| **C-6** | Retrospective score analysis | Cheapest path from zero evidence to first evidence. |
| **C-8** | Arabic clinical review | Highest-risk unexamined surface; core product claim. |
| **C-13** | Security residuals | Cheap, closes named GA blockers. |
| **C-10** | Ops filtering (F-2) | Small; prevents metric contamination as admin tests accumulate. |

### P2 — Phase 4.5 / Phase 5

C-7 (expert re-rating — process-heavy, depends on all of P0/P1) · C-12 (DR drill — needs ops
scheduling) · C-14 (6 disorder packages — needs C-3/C-4 first) · C-11 (F-3/F-4 cleanups).

### P3 — deferred

C-15 (realism auditor) · C-16 (medication model) · C-17 (retention — **product decision, not
engineering**) · new engines · feature expansion · GA push.

---

## 14. Recommended Phase 4 Scope

## PHASE 4 — "VALIDATION READINESS"

**Objective:** make VPsych *capable of being validated* — clinically, educationally, and
operationally — without adding a single new user-facing feature.

**Scope: the five P0 items only.** C-2, C-3, C-1, C-5, C-9.

### Why this is the smallest coherent scope

It is coherent because the five items form one dependency chain rather than a list:

```
C-9  governance ledger reconciled        (unblocks: honest phase record)
  │
C-2  transcripts become readable         (unblocks: C-3, C-8, C-7)
  │
C-3  clinical review becomes enforced state
  │
C-1  scoring integrity restored          (unblocks: C-6, C-7 credibility)
  │
C-5  reliability harness lands           (unblocks: C-6, C-7)
```

Remove any one and the chain breaks. C-3 without C-2 asks reviewers to sign off on
conversations they cannot read. C-5 without C-1 measures the reliability of a score that can
be evaded. C-2 without C-3 builds a QA surface with no workflow behind it.

It is *smallest* because everything else genuinely defers. C-4 is a refinement of C-3. C-6/C-7
are the *use* of C-5 and can follow immediately in a 4.5. C-8 needs C-2 to exist first. C-12
and C-13 are ops-scheduled and independent of this chain. C-14's content work should not begin
until C-3/C-4 can review it.

### What Phase 4 explicitly is NOT

- Not new engines, not new features, not UI redesign.
- Not a GA push — RDL-032/033 stand; the recommendation does not reopen them.
- Not a retention policy — PD-3 remains a product decision and must not be invented.
- Not Phase 16 evidence collection — evidence gets collected when it exists, never fabricated.
- Not a Phase 3 revisit — Phase 3 is accepted and its architecture is unchanged.

### Success criteria

1. An admin can start a test conversation, end it, **re-read the full transcript**, and record
   a structured QA verdict against the avatar.
2. An avatar cannot reach `published` without a recorded clinical review with a named reviewer,
   timestamp, and verdict.
3. A forged `admin_test` marker can no longer suppress assessment; the chosen semantics are
   documented and contract-tested; F-5 ambiguity is closed in writing.
4. `npm run test:reliability` exists, runs in CI, and produces reproducible statistics over the
   retrospective corpus.
5. The RDL contains a Phase 3 row and a Phase 4 authorization row.
6. All five existing CI gates remain green; Phase 3C isolation properties remain intact and
   contract-tested.

---

## 15. Risks

| # | Risk | L | I | Mitigation |
|---|---|---|---|---|
| R-1 | **C-1 regresses the production-verified Phase 3C skip path.** | Med | **High** | Strictly additive change; extend `architecture.test.ts` before implementing; full forged-marker matrix; re-verify in preview before production. |
| R-2 | **C-3 breaks Phase 3B lifecycle**, which is production-verified. | Med | **High** | Additive state only; never mutate existing transitions; existing published avatars must be grandfathered, not invalidated. |
| R-3 | **C-4 fails existing production avatars** on coherence rules. | **High** | Med | Ship as warnings first; run the rule suite over all 5 production avatars before making anything an error. |
| R-4 | **C-5/C-6 produce results showing poor reliability.** | Med | Med | This is a *successful* outcome, not a failure. Pre-commit to reporting whatever the analysis shows. The documented honesty discipline must extend to unfavourable results. |
| R-5 | **Retrospective analysis mishandles session content.** | Low | **High** | Aggregate-only, admin-only, PHI-free; never export narrative or transcript; mirror the existing quality-ledger export discipline. |
| R-6 | **Clinical reviewer capacity is unavailable**, stalling C-3/C-8. | Med | **High** | Identify reviewers *before* Phase 4 starts (see §18); C-3 builds the mechanism regardless of reviewer availability. |
| R-7 | **Scope creep into feature work** — the standing failure mode of a 16-phase program. | **High** | Med | The five-item P0 list is the scope. Anything else requires an RDL row. |
| R-8 | **Doc/code drift widens further.** | Med | Low | C-9 refreshes counts; add the count check to the migration-parity script if cheap. |
| R-9 | **P1 exploited before C-1 lands.** | Low | Med | Audit events already fire; monitor `admin.avatar.test_session.forged_skip_denied` during Phase 4. |
| R-10 | **Untested backup restore + accumulating data.** | Low | **Critical** | Independent of Phase 4 — schedule C-12 in parallel via ops. Do not let it block the chain, and do not let the chain excuse it. |

---

## 16. Dependencies

**Internal (technical):** C-3 → C-2 · C-6 → C-5 · C-7 → C-2, C-5, C-6 · C-8 → C-2 ·
C-4 → disorder catalog · C-14 → C-3, C-4.

**External / non-engineering — these are the real critical path:**

| Dependency | Needed for | Status |
|---|---|---|
| Named clinical reviewer(s) with DSM/ICD competence | C-3, C-4, C-7 | **Not identified** |
| Native Arabic-speaking clinician | C-8 | **Not identified** |
| Statistical/psychometric competence | C-5, C-6, C-7 | **Not identified** |
| Product decision on retention (PD-3) | C-17 | **Open — do not pre-empt** |
| Product decision on published-avatar testing (PD-1/PD-2) | UX-3, C-3 | **Open** |
| Board authorization (RDL row) for Phase 4 | all | **Not yet sought** |
| Supabase plan tier supporting PITR | C-12 | **Unconfirmed** |
| Ops window for a DR drill | C-12 | **Unscheduled** |

The engineering work in Phase 4 is tractable. **The binding constraint is human clinical and
psychometric expertise, and none of it is currently identified.** C-3 and C-5 build the
mechanisms; without reviewers and an analyst, the mechanisms sit idle. This should be resolved
before Phase 4 is authorized, not during it.

---

## 17. Deferred Work

Deferred **with reasons**, so nothing is silently dropped:

| Item | Why deferred |
|---|---|
| **F-1 fix as an emergency hotfix** | Assessed NON-BLOCKING (§9.2); belongs inside Phase 4 as C-1 with proper test coverage, not as an out-of-band patch to a production-verified path. |
| **F-2 / F-3 / F-4** | P2/P3; no learner-scoring impact. C-10/C-11 in Phase 4.5. |
| **Retention policy (PD-3)** | **Product decision. Explicitly not invented here.** No TTL, no purge job, no Option B/C. |
| **Published-avatar admin test (PD-1/PD-2)** | Product decision; MVP `testing`-only constraint stands. |
| **6 unpackaged disorders (C-14)** | Content work should follow the review and coherence gates, not precede them. |
| **Turn-level realism auditor (R-I11)** | Needs a realism criterion; C-3/C-8 must define one first. |
| **Medication/substance model (CLIN-S3-04)** | High value, but sequence after the review gate exists. |
| **DR drill (C-12)** | Ops-scheduled, parallel track. GA blocker, not a Phase 4 chain dependency. |
| **APM/Sentry, HIBP, Upstash confirm (C-13)** | Cheap ops work; parallel track. |
| **`VirtualPatientWizard` decomposition** | Maintenance debt; no behavioural impact. |
| **ARCH-S2-01…07, RT-01…12, EDU-01…06, SUP/ENT/RT-S11 debt** | Catalogued in `TECHNICAL_DEBT.md`; none block validation readiness. |
| **GA push** | RDL-032/033 stand. Nothing in this assessment supports reopening. |
| **New engines / feature expansion** | Per strategic priority: feature expansion does not outrank validation. |

---

## 18. Phase 4 Entry Criteria

Phase 4 should not begin until all of the following hold:

**Governance**
1. RDL row appended recording Phase 3 acceptance (C-9 may run first as a standalone docs change).
2. RDL row authorizing Phase 4 with explicit scope = the five P0 items.
3. F-5 contract ambiguity resolved in writing (forged-marker semantics stated unambiguously).
4. Production/`main` docs-only SHA delta recorded.

**People — the actual blocker**
5. At least one clinical reviewer identified and committed, with DSM/ICD competence.
6. Arabic-speaking clinical reviewer identified (may be the same person) or C-8 explicitly deferred.
7. Statistical/psychometric competence identified for C-5/C-6, or C-5 scoped to harness-only
   with analysis deferred.

**Technical**
8. All five CI gates green on the Phase 4 base SHA. *(Verified green on `09cec18` as of this
   assessment.)*
9. Remote migration parity confirmed with `SUPABASE_DB_URL` set — this assessment could only
   verify local structure.
10. Phase 3C architecture tests reviewed and understood by whoever implements C-1.

**Product decisions**
11. PD-3 (retention) explicitly deferred *or* decided — recorded either way.
12. PD-1/PD-2 (published-avatar testing) explicitly deferred *or* decided.

**Explicitly NOT entry criteria:** DR drill · pen test · pilot registration · GA gates. These
are GA prerequisites and must not be allowed to block validation-readiness work.

---

## 19. Recommended Next Decision

**The decision to make now is not "what should Phase 4 build". It is "who reviews the clinical
content".**

Every high-priority Phase 4 item terminates in a human with clinical expertise. C-3 builds a
sign-off gate that needs a signer. C-4's coherence rules need a clinician to author them. C-8
needs a native Arabic-speaking clinician. C-7 needs expert raters. The engineering is the
straightforward part; the expertise is unidentified and is the true critical path (§16).

**Recommended decision sequence:**

1. **Identify clinical reviewers** (blocking — §18 items 5–7). Without this, Phase 4 delivers
   mechanisms nobody can operate.
2. **Authorize Phase 4 = the five P0 items**, via RDL, with scope explicitly closed.
3. **Run C-9 immediately** — governance reconciliation is a docs-only change with no risk and
   removes a live process inconsistency.
4. **Schedule C-12 and C-13 in parallel** on the ops track. They are GA blockers, independent
   of the Phase 4 chain, and must not be starved by it.
5. **Resolve F-5 in writing** before C-1 is designed.
6. **Decide or explicitly defer PD-3 and PD-1/PD-2**, recording either outcome.

**The one thing not to do** is start Phase 4 implementation before the reviewers are named.
That would produce a clinical review gate with no reviewer, a coherence validator with no
clinical rules, and a reliability harness with no analyst — three mechanisms and zero evidence,
which is precisely the position the platform is in today.

---

## Final Status Card

```text
PHASE 3:
ACCEPTED

PHASE 4 ASSESSMENT:
COMPLETE

TECHNICAL READINESS:
PASS

CLINICAL READINESS:
FAIL

EDUCATIONAL READINESS:
FAIL

SECURITY:
PASS

GOVERNANCE:
FAIL

P1:
NON-BLOCKING

RECOMMENDED PHASE 4:
"Validation Readiness" — five P0 items forming one dependency chain:
C-9 governance reconciliation · C-2 Admin Test QA review surface ·
C-3 avatar clinical review + sign-off gate · C-1 close forged admin_test (F-1/F-5) ·
C-5 assessment reliability harness. No new engines, no new features, no GA push,
no invented retention policy. Critical path is human clinical/psychometric
expertise, which is currently unidentified and must be resolved before entry.

PHASE 4 IMPLEMENTATION:
NOT STARTED

APPLICATION CODE CHANGED:
NO

DATABASE CHANGED:
NO

PRODUCTION CHANGED:
NO

PR:
NOT CREATED

STOP.
```

---

### Appendix — verification method

Gates executed locally on `09cec18`: `npm ci` · `npm run lint` (0 errors / 13 warnings) ·
`npm run typecheck` (clean) · `npx vitest run` (707 passed / 87 files) ·
`npm run test:migrations` (local structure OK; remote parity skipped) · `npm run build` (OK).

Source verified directly for: `sessions` INSERT RLS policy · end-route execution order ·
`withAdminTestMarker` sole-writer property · `stripAdminTestMarker` on the learner path ·
lifecycle transition graph · publish validation gate contents · `weightedOverall` formula and
weights · admin-test redirect chain · ops `count` queries · i18n key parity · disorder catalog
ID-vs-package coverage · git ancestry of the production SHA.

No application code, migration, production data, or deployment was modified by this assessment.

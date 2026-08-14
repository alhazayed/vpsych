# VPsych — Phase 4 Readiness Assessment

**Assessment type:** Read-only architecture, evidence, and readiness review  
**Assessment baseline:** production SHA `7222e6c531e6cbc898c6530d4f4f62ddd044f389` (Phase 3C-6 production verified)  
**Repository evidence reviewed:** `main` at `09cec18` (documentation-only successor to the stated production SHA), application source, migrations, tests, and the Phase 3 records available in this checkout.  
**Scope boundary:** No application code, database schema, migration, deployment, production data, merge, or PR change is authorized or made by this assessment.

## 1. Executive Summary

Phase 3 established a technically coherent virtual-patient authoring lifecycle and an isolated persistent Admin Test Conversation. The implementation is suitable as a controlled technical platform baseline: sessions are case-snapshotted, virtual-patient identities are bilingual and separately authored, assessment reports are admin-only, and the Admin Test path is excluded from the learner assessment pipeline when it is validly created and ended by its admin owner.

That conclusion must not be widened into a clinical or educational-validity claim. The current implementation has strong structural controls, but it does not yet contain the evidence needed to demonstrate clinically safe, culturally reliable virtual-patient behaviour; accurate Arabic clinical interaction and pronunciation; reliable scoring; or valid educational decisions. The existing validation and inter-rater modules are useful measurement infrastructure, not completed clinical or psychometric validation.

The smallest coherent Phase 4 should therefore be a **controlled validation-and-quality release**, not a broad feature expansion:

1. close the session-insert/admin-test forgery risk and define retention/operational metric semantics;
2. build a governed avatar clinical-QA workflow with rubric-based expected-versus-observed review;
3. run clinician-led bilingual text/voice validation, including safety and interruption scenarios;
4. run an educational-scoring study before scores, progress, certification, or competency outputs are represented as reliable.

Admin UX improvements are appropriate only where they directly support that quality workflow. Mobile, broad enterprise expansion, and new immersive features should remain deferred until the validation evidence exists.

### Evidence interpretation

“Implemented” means present in the reviewed source. “Production verified” means the Phase 3 acceptance artifacts record an observed production result. “Documented” means a design, plan, or operational procedure exists but was not independently re-executed in this review. It does not mean clinically validated or certified.

Two filenames named in the requested baseline — `docs/VPsych_PHASE3_FINAL_ACCEPTANCE.md` and `docs/VPsych_PHASE3C_IMPLEMENTATION_CONTRACT.md` — are not present at `origin/main` in this checkout. Their available lineage is cross-checked through `VPsych_PHASE3B_PRODUCTION_ACCEPTANCE.md`, `VPsych_PHASE3C_IMPLEMENTATION.md`, `VPsych_PHASE3C_SECURITY_READINESS_REVIEW.md`, and `VPsych_PHASE3C6_FINAL_ARTIFACT_STATE.md`; the stated production SHA and acceptance status are treated as authoritative.

## 2. Current Architecture

### Application and runtime

VPsych is a Next.js 16 App Router / React 19 TypeScript application. It uses server components and route handlers for privileged work, Supabase SSR clients for user-scoped database access, OpenAI or Vercel AI Gateway for generation, and ElevenLabs for TTS. The normal session flow is:

```text
authenticated learner → POST /api/sessions
  → active avatar check → immutable CaseInstance + clinical snapshot → session
  → message / voice routes → resolveAvatar(snapshot, locale) → patient agent
  → POST /api/sessions/:id/end
  → assessment → education / ACE / CGE / validation / supervisor / enterprise
  → signed or service-role report write → quality ledger
```

`src/app/api/sessions/route.ts` makes the diagnosis, clinical core, locale, difficulty, modality, template, and preset session-specific through `createCaseForSession`; it strips an admin-test marker before a standard learner insert. `src/app/api/sessions/[id]/end/route.ts` owns the assessment and downstream orchestration. The end path treats educational/validation/supervisor/enterprise/realtime/patient-memory extensions as best effort, but report creation is a required session-end dependency.

### Authentication, authorization, Supabase, and RLS

- Supabase Auth supplies the authenticated user. Middleware refreshes sessions and gates authenticated/admin areas. Server pages use `requireUser`/`requireProfile`/`requireAdmin`; route handlers use API-specific guards.
- Roles are held in `profiles.role`, not user metadata. `requireApiAdmin` protects the admin API and emits denied audit activity.
- RLS provides user ownership boundaries: sessions are selectable by owner or admin; messages are limited to a session participant or admin; reports are readable by admins only. Avatar reads are limited to active records or admins.
- Assistant/system transcript writes use controlled RPC paths; report creation is either service-role insertion or a signed HMAC RPC. The security certification records the prior client-callable assistant/system-message forge issue as fixed.
- The current sessions INSERT policy is nevertheless broad: an authenticated user may insert a session where `therapist_id = auth.uid()` without a JSON-schema restriction on `clinical_snapshot`. This is material to P1 in section 9.
- The database contains lifecycle-aware admin authoring RPCs using `SECURITY INVOKER` plus `is_admin()` defense in depth. Lifecycle is canonical on `avatars.lifecycle_status`; `is_active` is the therapist-visibility projection.

### Avatar, persona, disorder, personality, and Module 2B

- An avatar is a reusable identity and authoring container. A persona/default disorder is a catalog linkage, not a permanent diagnosis assignment.
- The Case Engine mints an immutable `CaseInstance` per session. The session snapshot owns the live diagnosis and clinical presentation; avatar identity, biography, culture, and language remain separate. `resolveAvatar` explicitly removes default-syndrome cues when a snapshot diagnosis overrides the avatar default.
- Publish validation requires English and Arabic (`en-US`, `ar-JO`) independently authored personalities, active disorder linkage, clinical core, human personality, and voice coverage. The validator blocks equal EN/AR persona prompts and requires native-authoring/never-translate flags.
- The Human Personality Engine stores structured traits independently of diagnosis and GPT. It freezes the selected profile into the case snapshot and injects it into the runtime prompt as Module 2B (“HUMAN PERSONALITY PROFILE … stay consistent every turn”).
- Clinical authoring covers a disorder, symptom profile, disclosure rules, goals, ideal approach, and a risk profile. This is technical completeness validation, not a review of clinical accuracy, sufficient symptom criteria, or safety appropriateness.

### Lifecycle, authoring, preview, and Admin Test Conversation

The lifecycle states are `draft → testing → published → archived`, with `published` the only therapist-visible state. Published patients are immutable through ordinary update; the intended edit route is duplicate to a new draft. Archive is non-destructive, restore returns to draft, and duplicate does not copy sessions, reports, or cases.

The administrator has create, edit, validation, voice preview, runtime preview, lifecycle, publish, archive, restore, and duplicate paths. The detail view is organized into Overview, Clinical profile, Personality, Behaviour, Voice, Therapy configuration, Preview, and Advanced. The current “preview” is mostly an inspection surface; the API resolves a runtime projection and prompt excerpt, not an expected-behaviour simulation or a reviewable scenario suite.

Phase 3C adds `POST /api/admin/avatars/[id]/test-session`, which may start a persistent, server-marked test only for a `testing` avatar. It reuses the normal case/session/message/voice engines, labels the transcript and UI as an admin test, and skips assessment/report/learner pipeline only if marker + admin role + session ownership hold. Admin tests persist; no dedicated test-history, comparison, or retention workflow exists.

### Session, patient, voice, assessment, reporting, learning, and enterprise

- `resolveAvatar` composes the locale-specific persona, case clinical core, disorder speech/therapy cues, Module 2B, voice projection, and per-turn reinforcement. The patient agent sends up to 20 prior turns to OpenAI/Gateway, has provider failover, and visibly identifies `gpt`, `gateway`, or `persona_fallback`.
- Classic `VoiceSession` is the standard interactive UI. Therapy Room is an optional feature flag, default off; it reuses the same session/voice APIs. Its documented hands-free design includes VAD and client-side barge-in cancellation, but it requires expert validation and is not the default production path.
- STT goes through authenticated/rate-limited OpenAI transcription with size/MIME controls. TTS goes through an authenticated/rate-limited ElevenLabs route whose voice is resolved from the registry/avatar rather than an arbitrary browser-provided id. Audio blobs are intended to remain in memory; transcript text persists server-side.
- Assessment uses a weighted rubric and a model-based structured output with provider failover. With no usable provider it uses deterministic heuristic keyword/turn-count scoring. This fallback is disclosed as `persona_fallback`, but it makes a score unsuitable for high-stakes interpretation without validation.
- Reports are admin-only. End-of-session writes can trigger education, ACE/CGE, validation observation, supervisor, enterprise, realtime, patient memory, and a quality ledger. ACE/CGE are deliberately non-blocking.
- Enterprise tenancy/RBAC, compliance/retention schema, observability structures, research export, and institutional dashboards exist, but feature inventory and operational evidence describe enterprise as partial. Many score/analytics tables are sparse, and no evidence in scope proves production load at the stated capacity envelope.

### Localization, Arabic, security, operations, and deployment

- UI strings support EN/AR with cookie-driven locale and RTL. English and Arabic patient personalities are separately authored; Arabic is normalized to `ar-JO`. Voice/STT/TTS language fields exist, with Arabic TTS fallback configuration in older flat rows.
- Security controls include RLS, ownership checks, API admin checks, client-safe error treatment, report signing, CSP/HSTS/COOP/CORP headers, input validation, and per-user rate limits. Upstash provides distributed rate limiting if configured; in-memory fallback is explicitly not horizontally safe.
- `security_audit_events` capture security/admin events, including Admin Test creation/end/forged-marker denial. Audit is best effort, so an audit-write failure does not fail the primary path.
- CI is documented to run lint, typecheck, tests, migration integrity/parity, and build. Vercel hosts the application; Supabase hosts auth/data. DR documentation records application rollback and plan-dependent Supabase backups/PITR, but a quarterly restore drill remains an operational residual. Monitoring is dashboard/health/audit oriented; full APM/SIEM/alerting evidence is incomplete.

## 3. Phase 3 Outcome

| Classification | Evidence-based outcome |
|---|---|
| **Implemented** | Lifecycle-aware admin authoring RPCs/routes and validation; canonical draft/testing/published/archived lifecycle; native EN/AR and Module 2B publish gates; preview and voice preview; create/test/publish/archive/restore/duplicate UI; persistent Admin Test Conversation with server marker, test banner, audit events, centralized end skip, and learner-list exclusion. |
| **Verified in production** | Phase 3B production record verifies admin create → validate → testing → preview → publish → therapist visibility → archive → restore → duplicate and therapist/admin authorization boundaries. Phase 3C-6 artifact verifies an inactive testing avatar, admin test session, transcript label, completed end with `skippedAssessment:true`, no report/ACE/CGE/competency/learner-profile changes, and therapist/anonymous denial. The stated production SHA is `7222e6c`. |
| **Documented** | Lifecycle rationale; admin-test architecture and security review; retention as a product decision; DR targets/procedures; capacity envelope; Therapy Room hands-free design; observational validation/inter-rater machinery. These are not all production exercises or validation studies. |
| **Remaining gaps** | P1 forged admin-test direct INSERT effect; no resolved retention policy; unfiltered operational session aggregates; no dedicated avatar QA history/comparison; no clinician-reviewed scenario corpus or release gate; no observed bilingual voice/barge-in validation; no educational reliability/criterion/inter-rater evidence; partial enterprise/compliance/monitoring/DR evidence. |

Phase 3 should be retained as accepted for its defined lifecycle and admin-test scope. It did not claim completion of clinical validation, educational validity, high-stakes scoring validation, or governance certification.

## 4. Clinical Validation Readiness

### Technical readiness for validation: ready

The platform can support a structured study because it can freeze a per-session case snapshot, preserve transcripts, identify provider source, retain assessment provenance, separate an admin test from learner processing, record validation observations, and calculate agreement statistics without fabricating inference. Its native-personality and Module 2B structures provide explicit material for reviewers to inspect.

### Clinical readiness for wider release: not ready

The following require clinician-led review against defined scenarios, not more code inspection:

| Domain | Existing control | Evidence still required before wider clinical release |
|---|---|---|
| Avatar clinical content and formulation | Clinical core, symptom/disclosure/risk fields, disorder catalog, case snapshots | Expert review that each authored case has coherent diagnosis, severity, duration, impairment, differential boundaries, and risk formulation. |
| Symptom/personality consistency | Snapshot overrides, native personas, Module 2B, per-turn reinforcement | Repeated multi-turn probes demonstrating symptoms, affect, biography, disclosure pacing, and trait expression remain coherent across conditions and diagnosis overrides. |
| Therapeutic realism | Therapy reaction/speech cues and patient agent | Blinded clinician ratings of realism, alliance response, resistance, rupture/repair, disclosure, and non-leading behavior against an approved rubric. |
| Safety/crisis behavior | Risk profile is mandatory at publish; safety-related assessment rubric exists | Explicit expert-approved crisis scripts and adverse-prompt test set: suicidal ideation/plan, self-harm, violence, abuse, psychosis, emergency escalation, and boundary-setting. No evidence here proves their behavior. |
| Hallucination/inappropriate response control | Prompt composition, provider fallback/source disclosure, basic error treatment | Red-team corpus for unsafe/inappropriate patient claims, instruction hijacking, false certainty, clinician impersonation, inappropriate sexual/violent content, and leakage. There is no independent output safety classifier or demonstrated moderation gate. |
| Diagnostic and medication boundary | Snapshot diagnosis and authored clinical constraints | Clinician review that the patient does not diagnose, prescribe, fabricate medication effects, or contradict the session case; test medication questions and contraindicated advice. |
| Culture and Arabic clinical language | Independently authored AR-JO identity/persona and RTL | Arabic clinician review of idioms, register, stigma, family/religion/community context, culturally unsafe stereotypes, code-switching, and equivalence of intended educational challenge—not literal translation. |
| Voice, interruption, and turn-taking | STT/TTS controls; optional Therapy Room VAD/barge-in design | Device/browser network study for Arabic/English transcription, pronunciation, latency, overlap, interruption recovery, false VAD endpoints, and transcript/audio alignment. The documentation is not a completed study. |

Technical validation asks whether the requested behavior is wired, isolated, durable, and observable. Clinical validation asks whether the behavior is clinically appropriate and safe. Educational validation asks whether a score or learning decision is meaningful. Passing the first does not establish either of the latter two.

## 5. Avatar Quality and Authoring at Scale

The current model is a good structured starting point: identity/biography/demographics; clinical core; disorder linkage; symptoms and disclosure rules; therapy goals; dual native personas; human personality; voice registry; lifecycle; immutable case snapshots; and publish gates. It prevents several low-quality failure modes, including unstructured publish, missing Arabic content, missing Module 2B, inactive voice/disorder linkage, and direct mutation of published patients.

It is not yet sufficient as a scalable *quality-assurance system*. Missing controls are:

1. A clinician-approved authoring rubric with definitions, evidence sources, required review roles, and sign-off version for every clinical, cultural, safety, and medication assertion.
2. Structured fields and validators for duration, functional impairment, developmental/course history, differential exclusions, protective factors, medication stance, crisis thresholds, and “must not say/do” rules. Some may exist in free-form packages, but publish validation only proves presence of broad fields.
3. Explicit expected dialogue probes per avatar/case/locale, including expected disclosure trajectory and prohibited responses.
4. Versioned clinical-content review, approver identity, rationale, change impact, and rollback—not merely avatar lifecycle or JSON inspection.
5. Cross-field consistency checks (symptoms versus disorder/severity/risk, identity versus locale, voice dialect versus persona, rubric versus learning objective) beyond structural presence.
6. Arabic linguistic/clinical review and pronunciation sign-off distinct from English review.
7. A content provenance rule that records whether facts are authored, generated, or clinically reviewed and prevents real-patient content entering authoring.
8. A reproducible test suite across provider/model versions. Temperature-based generation and provider failover can change behavior after content has been approved.

## 6. Admin Workflow

### Current journey

Create creates a draft. Draft/testing records can be edited. Validation reports gate failures/warnings. An admin moves the avatar to testing, previews runtime configuration/voice, starts a persistent test conversation, edits while permitted, publishes after gates pass, archives without destruction, restores to draft, or duplicates to a draft for post-publication edits.

### Gaps and bottlenecks

- **Terminology and discoverability:** “preview” means data/runtime inspection while “test conversation” is the behavioral test. The difference is not a complete QA workflow and could be misread as a clinical approval.
- **Fragmented configuration:** behavior is oriented from the avatar detail but edited via Cases/Templates/Presets; personality has a separate panel; voice lives in a separate library. This is technically deliberate but creates a reviewer navigation burden.
- **No review state:** lifecycle has no “submitted for clinical review,” “approved,” “failed QA,” reviewer sign-off, or reasoned approval. “Testing” is a workflow state, not evidence of clinical validation.
- **No guided validation feedback:** structural validation identifies missing inputs, but it does not identify inconsistent formulation, incomplete safety conditions, culturally unsafe language, or weak expected behavior.
- **No semantic diff/impact warning:** duplicate is safe for historical data, but there is no content comparison, provenance, “what changed,” or warning that a change needs re-review.
- **No test run management:** no named test plan, repeatable scenario set, pass/fail capture, reviewer assignment, or release decision linked to an avatar version.
- **Permissions:** application roles are therapist/admin; there is no separately bounded clinical reviewer, content author, QA reviewer, instructor, or compliance role. Admin is broad for serious multi-person production use.
- **Preview gaps:** current preview lacks rendered full prompt provenance, case variation sampling, user-facing dialogue behavior, Arabic voice pronunciation results, and expected-versus-observed comparison.

These are gaps to address in a validation-focused Phase 4, not a reason to redesign the completed lifecycle.

## 7. Test Conversation

### What Phase 3C provides

The test conversation is a real persistent session using the main text/voice stack. It has a server-derived admin-test marker, transcript system label, EN/AR test-mode banner, test-only eligibility, owner/admin gate, audit events, and redirect away from learner completion UX. Production verification demonstrated an English test turn and learner-pipeline exclusion. Therapy Room may be selected only when its feature flag allows it.

### Professional QA workflow gaps

- No test dashboard/history keyed by avatar version, case snapshot, locale, provider/model, voice configuration, or reviewer.
- No deliberate text/voice parity view, audio playback QA record, transcript timing/turn-latency data, or pronunciation checklist.
- No scenario library or expected responses. A transcript alone cannot demonstrate patient consistency, safety, or therapeutic realism.
- No capture of observed versus expected behavior, pass/fail findings, severity, reproduction prompt, disposition, or regression status.
- No explicit test controls for deterministic/repeatable seed, temperature/model pin, case pinning, controlled disorder/severity/difficulty matrix, or side-by-side comparison of releases.
- No automated interruption/barge-in measurement. The classic flow and the optional Therapy Room have different interaction mechanics; both need controlled browser/device testing, especially in Arabic.
- No focused debug trace suitable for an authorized reviewer that explains resolved locale, case snapshot version, prompt module versions, provider source/model, voice profile, and failures without exposing secrets or unnecessary transcript data.
- No clear retention disposition for persistent test transcripts/cases. Product decision is explicitly deferred.

## 8. Educational and Assessment Validation

The platform can generate reports, competency-oriented feedback, ACE/CGE updates, supervisor outputs, quality ledgers, and observational validation measures. It uses a defined weighted overall formula and records AI source/model provenance. It also avoids presenting reports to the learner directly. Those are useful technical foundations.

It cannot yet claim educational validity or reliable therapist evaluation:

- The rubric weights and LLM-generated item scores have no demonstrated content validity, construct validity, criterion validity, calibration, or acceptable repeatability.
- The heuristic fallback scores by turns/keywords. It is explicitly a fallback, but a report/score still exists; policy must specify whether fallback output can be viewed, stored, used for progression, or must be excluded from educational decisions.
- “Educational Reliability Index” and “Assessment Validity Index” are computed indicators. The latter currently seeds a synthetic ±1 three-score window for a single pass and explicitly has no external criterion. These are not empirical reliability or validity evidence.
- Inter-rater code correctly withholds inference until at least two raters and five cases, but no reviewed evidence establishes sufficient raters/cases, agreement thresholds, or expert benchmark results.
- Case difficulty, diagnosis, model behavior, language, transcript length, and provider fallback can all affect scores. There is no released calibration protocol demonstrating invariance across these factors.
- Longitudinal ACE/CGE/supervisor/enterprise outputs are implementation pathways, not proof that learners improve or that recommendations are fair.
- Bias analysis is unproven across language, gender, culture, clinical presentation, dialect, disability/access mode, and training level.

Required educational validation is a pre-specified expert study: define intended use and prohibited use; create a gold-standard transcript/case set; obtain independent blinded expert ratings; compare model scoring with experts; assess repeatability across reruns/models/locales; analyze subgroup performance; establish thresholds and confidence/abstention rules; and publish a governance decision. Until then, outputs should remain formative, experimental, and clearly non-validated.

## 9. Security & Governance

### Controls present

Authentication and ownership checks, RLS, role enforcement, report isolation, message RPC hardening, report signing, rate limiting, error sanitization, security headers, admin audit logs, CI checks, and a documented rollback/backup procedure form a meaningful technical baseline. Phase 3C production evidence confirms learner processing was not written for a valid admin test.

### Remaining governance gaps

| Area | Readiness finding |
|---|---|
| PHI/data classification | Simulated-patient architecture and learner isolation are meaningful, but the compliance program, data inventory, vendor agreements, and formal use boundary for real PHI are incomplete. |
| Admin-test isolation | Learner reports/ACE/CGE are skipped for valid tests; session/case/transcript persist; ops aggregate filtering is incomplete; no retention policy or test-review governance exists. |
| P1 direct INSERT / forged `admin_test` | **NON-BLOCKING WITH MITIGATION for the narrow Phase 3C contract; BLOCKING for serious scored-production expansion until corrected.** A therapist can direct-insert their own session with `clinical_snapshot.admin_test=true` under current RLS. The end route closes that session, then denies the non-admin skip with 403 and audits it; it does not return a successful skipped assessment or confer admin authority. However, the close occurs before the denial, so the user can evade assessment/report/ACE for that self-created session. This cannot corrupt another learner or create a privileged report bypass, but it defeats the integrity of a session that should be assessed. Existing API marker stripping, central end gate, audit logging, and testing-only admin route materially mitigate scope; they do not remove the vector. |
| Rate limiting | Route budgets exist. Distributed enforcement depends on configured Upstash; in-memory fallback is per instance and not horizontally safe. Production configuration was not independently inspected in this read-only review. |
| Audit and monitoring | Security/audit events exist, but audit is best effort and evidence of SIEM integration, alert ownership, response testing, and comprehensive admin-mutation coverage is not established. |
| Retention/privacy | No admin-test TTL/deletion policy; generic purge is not test-specific. Formal retention schedule, DSAR process, legal basis, subprocessors/BAAs/DPAs, and access-review evidence remain required. |
| Backups/DR | Procedures and RTO/RPO targets are documented; plan-dependent backup/PITR and quarterly staging restore drill need independently retained execution evidence. |
| Change controls | CI/migration parity and release documentation exist. Evidence is still needed for protected branches, required reviews, environment access control, secret rotation, preview protection, and a formal incident exercise. |

The P1 classification is intentionally conditional. It does not retroactively invalidate the verified Phase 3C behavior, which met its chosen 403-and-audit rule. It is not acceptable as an unresolved exception if Phase 4 expands score-bearing learner use, institutional reporting, certification, or unsupervised production cohorts.

## 10. Production Readiness

| Dimension | Verdict | Basis |
|---|---|---|
| **Technical** | **READY** | Core session/authoring/admin-test architecture is implemented and the specified Phase 3 flows were production verified. |
| **Clinical** | **NOT READY** | No clinician-reviewed content/safety/realism/bilingual voice evidence supports wider clinical release. |
| **Educational** | **NOT READY** | Assessment and competency outputs are explicitly unvalidated; no empirical reliability/validity study is evidenced. |
| **Security** | **READY WITH MATERIAL P1 MITIGATION** | Strong baseline controls and Phase 3C verification exist; direct session INSERT can evade assessment of a forged marker session and must be closed before serious expansion. |
| **Governance** | **NOT READY** | Retention, privacy/compliance evidence, formal access/change controls, incident/DR exercise evidence, and validation governance are incomplete. |
| **Scalability** | **NOT READY** | A documented capacity envelope is not production load evidence; distributed rate-limit configuration, provider capacity, observability/alerting, and load/chaos evidence are not established. |
| **Overall** | **NOT READY** | Technical readiness does not substitute for the clinical, educational, governance, and scalability gates. |

## 11. Phase 4 Candidate Work

| Priority / candidate | Objective and user problem | Importance | Dependency / complexity / risk | Validation requirement |
|---|---|---|---|---|
| **P0 — Session integrity hardening** | Prevent a learner from using direct Supabase INSERT plus forged `admin_test` to close a session outside the learner assessment path. Protect learner, institutional, and research data integrity. | Security: high; technical: high; clinical: indirect. | Depends on agreed forged-marker policy and RLS/RPC design. Moderate complexity, high regression risk because sessions are core. | RLS/API adversarial tests; production-like ownership/report/ACE regression; audit verification. |
| **P0 — Clinical QA governance and corpus** | Give clinical authors/reviewers a versioned rubric, approval evidence, expected/prohibited responses, and release gate for each avatar/case/locale. | Clinical: high; technical: medium; security: medium. | Depends on named clinical governance owner and approved review protocol. Moderate product/data-model/workflow complexity. | Clinician sign-off, inter-reviewer agreement, complete safety/culture/medication scenario coverage. |
| **P0 — Bilingual text/voice safety study** | Establish whether EN/AR virtual-patient behavior, STT/TTS, pronunciation, turn taking, and crisis handling are fit for intended training use. | Clinical: high; technical: high; security: medium. | Depends on QA corpus and approved test accounts/data handling. Moderate-to-high testing/operational complexity. | Blinded clinician/language-expert review, device/browser matrix, adverse scenario results, defect thresholds. |
| **P0 — Assessment intended-use and fallback policy** | Stop unvalidated scores/fallback reports from being interpreted as reliable progression/certification decisions. | Educational: high; governance: high; technical: medium. | Depends on product/education owner decision. Low-to-moderate implementation complexity, high policy risk. | Policy review, UI/API/report semantics test, provenance audit. |
| **P1 — Educational calibration study and evaluator controls** | Compare rubric/model scoring to independent expert ratings; establish repeatability, agreement, bias, confidence, and abstention. | Educational: high; clinical: medium; technical: medium. | Depends on P0 corpus and intended-use policy. High research/operations complexity; high misuse risk. | Pre-registered study, blinded ratings, ICC/kappa/criterion analysis, locale/subgroup analysis, expert approval. |
| **P1 — Professional Admin Test QA workspace** | Turn transcript-only testing into reviewable scenario runs with expected-versus-observed findings, version/provider/voice trace, approvals, and regression history. | Clinical: high; technical: medium; security: medium. | Depends on QA governance/corpus and retention decision. Moderate complexity; risk of exposing transcript data too broadly. | Role/access tests, retention review, clinician usability test, regression suite. |
| **P1 — Retention, privacy, and operational metrics decision** | Define retention/deletion, test-session/case disposition, admin-test operational metric filtering, privacy requests, and audit review cadence. | Governance/security: high; technical: medium. | Depends on legal/privacy owner and institutional intended use. Moderate data/process complexity; destructive-data risk. | Legal/privacy approval, migration/data lifecycle tests if later implemented, operations dashboard reconciliation. |
| **P1 — Observability, alerting, and DR exercise** | Make provider failures, assessment fallback, authz denials, rate-limit degradation, and recovery operationally actionable. | Technical/security: high; clinical: indirect. | Depends on operations ownership and monitoring destination. Moderate complexity. | Alert drills, backup restore exercise, rollback drill, load/provider-failure evidence. |
| **P2 — Authoring consistency tooling** | Add semantic cross-field checks, content provenance, locale/dialect/voice checks, structured clinical authoring aids, and content diff. | Clinical: medium-high; technical: medium. | Depends on clinical QA rubric. Moderate complexity; false-positive authoring friction risk. | Clinician author usability and false-positive/negative review. |
| **P2 — Admin UX clarity** | Clarify preview versus behavioral test, surface validation feedback/context, reduce cross-library navigation, and make lifecycle/review state legible. | User: medium; clinical: enabling. | Depends on decisions above. Moderate complexity; do not redesign lifecycle. | Admin usability study and permission regression. |
| **P2 — Operations analytics separation** | Exclude admin tests from operational learner metrics and label “all sessions” measures where intentional. | Governance: medium; technical: medium. | Depends on canonical metrics definition. Low-to-moderate complexity. | Query/data reconciliation with known admin-test fixtures. |
| **P3 — Enterprise expansion** | Complete institution workflows, roles, compliance automation, and institutional dashboards. | Commercial: medium; governance: high. | Depends on P0/P1 governance and validation evidence. High complexity/risk. | Tenant isolation, legal/compliance review, customer pilot. |
| **P3 — Mobile application** | Add mobile access. | User: medium; clinical: neutral. | Depends on validated interaction/voice requirements. High surface-area complexity. | Accessibility, mobile voice/device safety study, security review. |
| **P3 — Therapy Room / hands-free expansion** | Promote immersive/continuous voice experiences. | User: medium; clinical/technical: high risk. | Depends on bilingual interruption and voice validation. High complexity. | Full device/browser/VAD/barge-in clinical QA; accessibility and privacy review. |

## 12. Prioritization

P0 is not a generic backlog. It is the minimum set that converts Phase 3’s technical authoring/test capability into a controlled evidence-producing system:

1. Protect session/assessment integrity.
2. Define what constitutes approved clinical content and how it is tested.
3. Gather bilingual clinical/voice safety evidence.
4. Prevent unvalidated educational output from being used beyond formative experimentation.

P1 follows only once P0 artifacts exist: an educational calibration study, a professional QA workspace, retention/governance implementation, and operating evidence. P2 improves authoring and usability without substituting for expert evidence. P3 expands commercial/platform surface and should not lead Phase 4.

## 13. Recommended Phase 4 Scope

**Recommended Phase 4: Clinical and Educational Validation Readiness.**

The coherent scope is:

1. **Integrity and governance foundation:** decide and close P1 forged-marker semantics; establish admin-test retention, metric treatment, roles/review responsibility, and fallback-score policy.
2. **Avatar quality system:** create a clinician-owned bilingual content standard, review gate, scenario corpus, and expected/prohibited behavior rubric tied to content versions.
3. **Controlled QA/pilot capability:** enhance Admin Test Conversation only enough to execute, record, compare, and review the approved scenario corpus across text and voice.
4. **Empirical assessment validation:** run a structured, expert-rated calibration/reliability study and define whether/when the platform may make formative, progression, or certification claims.

This selection joins A (clinical validation), B (avatar quality), C (educational assessment validation), E (voice/Arabic quality), and F (security/governance) because they are mutually dependent evidence gates. D is included only as enabling QA UX. G/H/I are excluded: analytics cannot be interpreted reliably before measurement validity; enterprise commitments amplify unresolved governance; mobile adds surface area without addressing the core release risk.

## 14. Certification Readiness

| Milestone | Current position | Evidence still needed |
|---|---|---|
| Internal QA | Partially ready | Approved test plan/corpus, versioned expected outcomes, repeatable execution, defect triage, traceability, retention policy, and evidence repository. |
| Expert clinical review | Not ready | Named reviewers, authoring standard, bilingual content package, safety/crisis/medication/culture scenarios, blinded ratings, agreement/acceptance criteria, signed decisions. |
| Educational validation | Not ready | Intended-use statement, gold-standard data, independent rater study, calibration/repeatability/bias analysis, fallback policy, score-use governance, expert acceptance. |
| Structured pilot | Not ready | Completed clinical and educational gates, participant safeguards/consent, support/escalation protocol, privacy/retention approval, monitoring/incident plan, predefined pilot outcomes. |
| Wave/certification readiness | Not ready | Auditable evidence pack from the prior gates plus DR/rollback exercise, security/access review, change control, vendor/legal obligations, and formal release authority. |

No certification is claimed by this assessment.

## 15. Risks

1. Treating well-structured prompts as clinical validation may expose learners to unsafe or unrealistic patient behavior.
2. Treating model-generated scores, ERI/AVI labels, or supervisor outputs as validated measures may create unfair learner decisions.
3. Provider/model/temperature/fallback changes may alter behavior after a content review unless releases are versioned and re-tested.
4. The forged `admin_test` direct-insert path can create unassessed completed sessions, weakening data integrity.
5. Persistent test transcripts/cases without a policy create privacy, cost, and operational-metric ambiguity.
6. Arabic content may be structurally native but still fail clinical register, cultural safety, STT, pronunciation, or interruption expectations.
7. In-memory rate limiting during missing/unavailable Upstash and limited operational alerting are insufficient evidence for scale claims.
8. Enterprise/mobile/immersive expansion before validation would multiply surface area and support obligations while core evidence is absent.

## 16. Dependencies

- Clinical governance owner(s), Arabic clinical/language reviewer(s), educational measurement lead, privacy/compliance owner, and operational owner.
- An approved intended-use statement distinguishing simulation/training from clinical care and formative feedback from high-stakes evaluation.
- A curated, de-identified/synthetic bilingual test corpus with safety, medication, crisis, cultural, and interruption scenarios.
- Controlled test identities and a secure evidence repository with access/retention rules.
- Stable provider/model/version recording and sufficient observability for reproducible review.
- Legal and institutional decisions on retention, privacy obligations, vendor terms, backups, incident response, and pilot participant safeguards.

## 17. Explicitly Deferred Work

The following should not constitute Phase 4’s initial implementation scope:

- Mobile application development.
- Broad enterprise tenant/compliance/product expansion.
- Promotion of Therapy Room or hands-free mode as a default experience.
- New diagnostic engines, new score formulas, or new experimental “excellence” engines.
- Broad analytics dashboards or certification claims before measurement validation.
- Lifecycle redesign, database-wide refactoring, or replacement of the existing session/voice engine.
- Any use of real patient data in authoring or validation.

## 18. Recommended Next Decision

Authorize a Phase 4 charter limited to **Validation Readiness**, with explicit owners and acceptance criteria for: (1) session-integrity/P1 disposition, (2) retention and score-use policy, (3) clinician-approved bilingual avatar QA corpus and review protocol, and (4) educational calibration study design. Do not authorize broad feature implementation until those governance decisions determine the required controls and evidence.

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
PASS WITH P1 MITIGATION

GOVERNANCE:
FAIL

P1:
NON-BLOCKING WITH MITIGATION FOR PHASE 3C;
BLOCKING BEFORE SERIOUS SCORED-PRODUCTION EXPANSION

RECOMMENDED PHASE 4:
Clinical and educational validation readiness: session-integrity hardening,
governed bilingual avatar QA, text/voice clinical validation, and assessment
calibration before feature or market expansion.

PHASE 4 IMPLEMENTATION:
NOT STARTED

APPLICATION CODE CHANGED:
NO

DATABASE CHANGED:
NO

PRODUCTION CHANGED:
NO

PR:
DO NOT CREATE
```

# VPsych — Phase 4 Readiness Assessment

**Document type:** Read-only readiness assessment (no implementation)  
**Assessment date:** 2026-08-14 (UTC)  
**Production application SHA (Phase 3 / 3C-6 verified):** `7222e6c531e6cbc898c6530d4f4f62ddd044f389`  
**Repository HEAD at assessment writing:** `09cec182cf0f776a66789fa5461a8220b5b38536` (docs-only commit after `7222e6c`; application code of Phase 3C is unchanged)  
**Production deployment (3C-6 verification):** `dpl_EbUMBPJAqJuCQfoqvES1aa1So2P1`  
**Method:** Cross-check of source (`src/`, `supabase/migrations/`, `messages/`, `personas/`) against Phase 3 acceptance artifacts and existing certification / gap documents. Claims that exist only in older docs and contradict source are marked as documentation drift.

**This assessment does not:** implement Phase 4, modify application code, modify schema, create migrations, deploy, create production data, merge, or open a pull request.

---

## 1. Executive Summary

Phase 3 is **ACCEPTED**. Phase 3C-6 is **PRODUCTION VERIFIED**. VPsych is a functioning bilingual therapist-training platform with production-proven Virtual Patient authoring, lifecycle, and Admin Test Conversation isolation.

VPsych is **not** ready to claim clinical validity, educational measurement validity, Wave/certification closure, or unrestricted general availability.

| Dimension | Verdict | Why |
|---|---|---|
| Technical | **READY** | Session, voice, case, authoring, and admin-test paths work in production. |
| Clinical | **NOT READY** | Prompt/safety architecture exists; no structured clinician sign-off of conversational phenotype, crisis portrayal, or Arabic clinical language. |
| Educational | **NOT READY** | Scoring machinery exists; scores are explicitly **not validated**. Reliability harness is not on main. Production CGE attempts = 0. |
| Security | **READY with residual** | AuthN/AuthZ/RLS/report isolation hold for intended paths. P1 forged `admin_test` INSERT is **non-blocking with mitigation**. |
| Governance | **NOT READY** | DR drill unsigned; retention of admin-test sessions is a product decision; vendor APM/Sentry open; leaked-password protection residual. |
| Scalability | **NOT READY** | Catalog is five avatars; ACE/CGE unused in production learning paths; authoring is sufficient for a small library, not a high-volume SP factory. |
| **Overall** | **NOT READY** for wider release / certification | **READY to start Phase 4 as a structured clinical-validation program.** |

**Recommended Phase 4 (smallest coherent set):** **Structured clinical validation of Virtual Patients**, using the Phase 3 authoring + Admin Test Conversation machinery, plus the minimum QA, Arabic/voice, and safety residuals that make that validation honest. Educational-assessment validation, enterprise expansion, analytics platforms, and mobile are **explicitly deferred**.

**P1 (direct session INSERT / forged `admin_test`):** **NON-BLOCKING WITH MITIGATION** for Phase 4 clinical validation. It becomes closer to blocking if the product claims scored learner outcomes as trustworthy. Do not fix in this assessment.

---

## 2. Current Architecture

Inventory below is from **source**, not from marketing or stale counts. `docs/SOFTWARE_ARCHITECTURE.md` is useful but dated (API route count and migration count have grown). Live tree at assessment: **71** App Router `route.ts` files; **75** files under `supabase/migrations/`.

### 2.1 Application architecture

| Layer | Source | Actual behavior |
|---|---|---|
| UI | Next.js 16 App Router, React 19 | Authenticated shell `(app)/` — avatars, sessions, learning, admin. Public login/signup/legal/validation/health. |
| API | `src/app/api/**/route.ts` | JSON Route Handlers. Pattern: auth → rate limit → validate → work → sanitized JSON. |
| Domain engines | `src/lib/{case-engine,scenario-templates,instructor-presets,personality-engine,ace,cge,clinical-voice,therapy-room,enterprise,education,validation,…}` | Engines stack; none replaced an earlier API. ACE/CGE remain best-effort and non-blocking. |
| Types | `src/lib/types.ts` | Canonical DB row shapes. |
| i18n | `messages/{en,ar}.json`, `src/i18n/` | Cookie locale (`en` / `ar`); no locale path segment. Arabic RTL via `localeDirection()`. |
| Deploy | Vercel | Production alias `https://vpsych.vercel.app`. Merges to `main` auto-deploy. |

Runtime topology (verified): Browser → Edge middleware (session refresh, `/admin` gate, locale cookie) → App Router / Route Handlers → Supabase Auth+Postgres+RLS; OpenAI or AI Gateway for chat/assessment; OpenAI STT; ElevenLabs TTS.

### 2.2 Authentication

| Control | Source | Status |
|---|---|---|
| Identity | Supabase Auth password grant; cookies via `@supabase/ssr` | Production-verified (Phase 3B/3C-6 audit admin + therapist) |
| Pages | `requireUser` / `requireProfile` / `requireAdmin` in `src/lib/auth.ts` | Redirect on failure |
| APIs | `requireApiUser` / `requireApiAdmin` in `src/lib/api-auth.ts` | JSON 401/403; never redirect. `requireApiAdmin` writes denied `security_audit_events` |
| Roles | `profiles.role` only | Never `user_metadata` (architecture invariant) |
| Middleware | `src/middleware.ts` → `src/lib/supabase/middleware.ts` | Session refresh; unauthenticated → `/login?next=…`; `/admin` + `/api/admin` require admin; locale cookie wins over `profiles.preferred_language` |
| Passwords | `src/lib/password-policy.ts` | Min 8 + complexity (security certification L1) |
| Redirects | `src/lib/safe-redirect.ts` | Open-redirect guard |

Production also sits behind **Vercel Authentication** on the deployment protection layer (observed during 3C-6). That is platform SSO, not application RBAC.

### 2.3 Authorization

| Actor | Can |
|---|---|
| Anonymous | Health, login/signup, selected public legal/validation/certificate-verify routes |
| Therapist | Own sessions, own messages (`role=user` client insert only), STT/TTS for owned sessions, ACE/CGE **read** surfaces, no `session_reports` bodies |
| Admin | Authoring, lifecycle, preview, validate, Admin Test Conversation, reports, ops, scientific admin APIs |

Therapist cannot start unpublished Virtual Patients (`is_active` projection). Therapist cannot start Admin Test Conversation (`requireApiAdmin` → 403). Therapist cannot see another user’s session (RLS → 404 on message/end).

### 2.4 Supabase architecture

| Item | Actual |
|---|---|
| Auth + Postgres + RLS | Production project used by the app (anon + user JWT; service role is Route Handler / Server Action only) |
| Migrations | `supabase/migrations/` is schema of record; **75** files in tree. Do not edit applied migrations. |
| RPCs | Message insert (`insert_assistant_message` / `insert_system_message` SECURITY DEFINER); report insert (`create_session_report` HMAC-signed); Virtual Patient lifecycle (`admin_*_virtual_patient` family, migration `20260811084442_…`) |
| Service role | `messageRpcClient` prefers service role, falls back to authenticated client (RPC still enforces auth). Hard-fail on missing service role was a past outage. |
| Vault | `REPORT_WRITE_KEY` must match Postgres Vault `report_write_key` **or** service-role direct insert |

### 2.5 RLS (load-bearing)

Verified policies (among others):

- `session_messages`: client INSERT only `role = 'user'`; assistant/system via RPCs.
- `sessions` SELECT: owner or `is_admin()`.
- `sessions` INSERT: `therapist_id = auth.uid()` — **no JSON constraint on `clinical_snapshot`** (P1 vector).
- `session_reports`: admin read; writes via signed RPC / service role.
- ACE/CGE learner writes: SELECT-only for learners (security certification H1).
- New policies wrap `auth.uid()` / `is_admin()` in `(select …)`.

### 2.6 Avatar architecture

`avatars` row + locale + optional `clinical_snapshot` → `resolveAvatar()` (`src/lib/avatars/resolve.ts`). Published catalog visibility is `is_active` (projection of `lifecycle_status=published`). Seeded production patients: Maya Chen, Jordan Hale (published). Phase 3 verification artifacts exist as inactive drafts/testing rows (see §3).

### 2.7 Persona architecture

`personas` is the clinical case library companion of an avatar. Case mint (`createCaseForSession`) loads persona + disorder + optional template/preset. Invariant: **a persona never permanently owns a disorder**; diagnosis is minted onto `sessions.clinical_snapshot` / `case_instances`.

Learner mint requires `persona.is_active`. Admin Test Conversation sets `allowInactivePersona: true` **only** in `src/app/api/admin/avatars/[id]/test-session/route.ts`, which clones the persona in memory as active for validation — it does **not** persist `is_active=true`. Architecture test `admin-test-phase3c.architecture.test.ts` forbids the learner create route from setting that flag.

### 2.8 Disorder model

`disorders` catalog + Case Engine packages (DSM-5 / ICD-10 / ICD-11 fields). Session diagnosis is a frozen `ClinicalCore` on the snapshot. Admin authoring binds `persona.default_disorder_id` / slug. Completeness of packages varies (known limitation: conversational phenotype richness is uneven).

### 2.9 Personality model and Module 2b

Human Personality Engine (`src/lib/personality-engine/`): structured traits independent of GPT and of diagnosis. Frozen onto `clinical_snapshot.human_personality`. Prompt Module 2b injects `formatHumanPersonalityForPrompt` every turn (`src/lib/ai/prompt-engine.ts`).

Resolution order (`resolve.ts`): frozen snapshot → DB `avatars.human_personality` map → builtin catalog (`maya-chen`, `jordan-hale`) → **`synthesizeHumanPersonalityFromAvatar()`** (always returns a valid profile). Phase 3A Amendment 1 documents this: missing authored HPE does **not** produce an “empty soul”; synthesis fills traits. That is a quality risk for new avatars, not a crash.

### 2.10 Lifecycle model (Option B — canonical)

`lifecycle_status` ∈ `draft | testing | published | archived`. `is_active` is therapist-visibility projection (`published` → true; else false). Transitions (`src/lib/admin/virtual-patient-lifecycle.ts`):

- draft → testing, published, archived
- testing → draft, published, archived
- published → archived only (immutable content; duplicate to edit)
- archived → draft (restore)

Create and duplicate always land on `draft`. Lifecycle must not rewrite historical sessions or snapshots.

### 2.11 Admin avatar authoring, validation, preview, publish / archive / restore

| Capability | Source | Notes |
|---|---|---|
| Create draft | `POST /api/admin/avatars` + persist RPCs | Wizard + detail JSON surfaces |
| Validate | `POST /api/admin/avatars/validate` | Draft vs publish gates; no persist |
| Preview | `POST /api/admin/avatars/[id]/preview` | Real `resolveAvatar` + optional case gen; **non-persistent** |
| Lifecycle | `POST …/lifecycle`, publish, archive, restore, deactivate | SECURITY DEFINER RPCs |
| Duplicate | `POST …/duplicate` | New slug; lifecycle `draft` |
| Completeness | `virtual-patient-completeness.ts` | EN personality, AR personality, voice, clinical — coarse |
| Field validation | `virtual-patient/validation.ts` | Identity, clinical_core, symptoms, disclosure, goals, risk SI, HPE, voice |

There is **no** approved DELETE route (`DELETE` → 405 in Phase 3B). Retention of verification artifacts is by leaving them inactive.

### 2.12 Admin Test Conversation

Architecture (implemented and production-verified):

```
EXISTING SESSION ENGINE
  + POST /api/admin/avatars/[id]/test-session
  + clinical_snapshot.admin_test = true + label
  + VoiceSession / Therapy Room TEST MODE banner (server marker only)
  + POST /api/sessions/[id]/end skip gate (marker ∧ admin ∧ owner)
```

No second session engine. Eligibility: `lifecycle_status=testing` only. Learner `POST /api/sessions` strips any marker. End skip happens **before** assess / report / ACE / CGE / education. Production proof: session `4e289c20-…`, `{ skippedAssessment: true }`, reports for that session = 0.

### 2.13 Session engine, case engine, patient runtime

```
POST /api/sessions → rate limit → createCaseForSession()
  → INSERT sessions (case_instance_id, clinical_snapshot)
POST /api/sessions/[id]/message → ownership + active + time
  → resolveAvatar → generatePatientReplyDetailed → insert_assistant_message
POST /api/sessions/[id]/end → complete/expire → assess (unless admin-test skip)
  → report RPC → runAceAfterAssessment() best-effort
```

Hard cap: `MAX_SESSION_SECONDS` = 40 minutes, server-side.

Patient runtime: prompt Modules 1–4 (`prompt-engine.ts`) + optional fidelity blocks (speech, difficulty, therapy process, adaptation, humanization, clinical intelligence) + Module 2b + per-turn cue. Provider: OpenAI SDK or AI Gateway; `aiSource` must propagate (`gpt` | `gateway` | `persona_fallback`).

### 2.14 Therapy Room vs VoiceSession

| Surface | Flag | Default |
|---|---|---|
| Classic `VoiceSession` | always | **Default** |
| Therapy Room | `NEXT_PUBLIC_THERAPY_ROOM_MODE=true` | **Off** (`KNOWN_LIMITATIONS`) |

Barge-in / `startBargeInMonitor` lives in `TherapyRoomSession.tsx`. Classic VoiceSession does not implement the same barge-in monitor. Pipeline supports `therapistInterrupted`, but `TECHNICAL_DEBT.md` RT-06 records that **clients do not send it** (except realtime test helpers). Turn-taking is therefore technically specified and only partially wired in the default UI.

### 2.15 STT / TTS

| Path | Provider | Controls |
|---|---|---|
| `POST /api/voice/transcribe` | OpenAI STT | Rate 120/h; 10MB + MIME allowlist |
| `POST /api/voice/tts` | ElevenLabs | Rate 60/h; voice resolved from avatar/voice_profile — client cannot pass arbitrary `voiceId` (security M3) |
| Arabic voice | `voice_id_ar` / voice profile locale mapping | Casting, not phoneme authoring |

No admin SSML / pronunciation lexicon surface was found.

### 2.16 Assessment, reporting, competency, ACE/CGE, learner analytics

| Piece | Source | Production posture |
|---|---|---|
| Assessment | `src/lib/ai/assessment.ts` private `weightedOverall()` | Canonical overall 0–100. Do not fork. |
| Rubric | 11 items (alliance, assessment, DSM/ICD reasoning, formulation, differential, risk, educational competency, interventions, safety, structure) | Heuristic fallback if provider down |
| Reports | `create_session_report` HMAC RPC; admin-only read | Therapist APIs must not return report bodies |
| Education hook | `lib/education` after assess | Best-effort |
| ACE | `lib/ace` | Implemented; `runAceAfterAssessment` never throws |
| CGE | `lib/cge` | Implemented; barrel must not re-export `ace-bridge` |
| ERI / AVI | `lib/eri`, `lib/avi` | Engines on main; **not** scientific validation |
| Reliability harness | `docs/ASSESSMENT_RELIABILITY.md`, `calibration/`, `test:reliability` | **Absent** (`CLAUDE.md` / technical debt) |
| Production CGE | 3C-6 counts | `cge_attempts = 0`, `learning_paths = 0`, `learning_assignments = 0`, `adaptive_learning_effectiveness_scores = 0` |

### 2.17 Audit, enterprise, localization, security controls, rate limiting, monitoring, deployment

| Area | Actual |
|---|---|
| Audit | `logSecurityEvent` → `security_audit_events`. Admin test create/end/forged events exist. Best-effort (must not fail the primary path). |
| Enterprise | `lib/enterprise` + admin/enterprise APIs (RBAC matrix, tenants, courses, certificates). `KNOWN_LIMITATIONS` still calls the preview **single-tenant**. Code exists; institutional adoption is not the current operating mode. |
| Localization | UI EN/AR; native `en-US` / `ar-JO` personalities (never machine-translated). Module 3 Jordanian dialect rules for Arabic. |
| Security headers | `lib/security-headers.ts` via `next.config.ts` (CSP, HSTS, COOP/CORP, Permissions-Policy). `/api/*` `no-store`. |
| Rate limit | `lib/rate-limit.ts` — Upstash if configured, else in-memory (not horizontally safe). |
| Monitoring | In-app `/api/admin/ops/metrics`; **vendor Sentry/APM not baseline**. |
| Deployment | Vercel + GitHub `main`. CI: lint → typecheck → test → migration parity → build (Node 22). |

---

## 3. Phase 3 Outcome

Phase 3 is **not reinterpreted**. The user instruction and production artifacts treat it as **ACCEPTED**. Two documents listed as authoritative baseline are **not present in the repository tree** at this SHA:

| Listed baseline | In repo? |
|---|---|
| `docs/VPsych_PHASE3_FINAL_ACCEPTANCE.md` | **Missing** |
| `docs/VPsych_PHASE3B_PRODUCTION_ACCEPTANCE.md` | Present |
| `docs/VPsych_PHASE3C_IMPLEMENTATION_CONTRACT.md` | **Missing** (referenced by 3C implementation + security review) |
| `docs/VPsych_PHASE3C_SECURITY_READINESS_REVIEW.md` | Present |
| `docs/VPsych_PHASE3C6_FINAL_ARTIFACT_STATE.md` | Present |

Missing files are a **documentation gap**, not a reason to reopen Phase 3.

### 3.1 What Phase 3 delivered

**Phase 3A** — contract amendment only (lifecycle Option B; HPE synthesis correction). No production schema change in that amendment.

**Phase 3B** — Virtual Patient authoring + lifecycle on production (`docs/VPsych_PHASE3B_PRODUCTION_ACCEPTANCE.md`).

Verified path: Create → Draft → Validate → Testing → Preview → Publish → therapist visibility → Archive → Restore → Duplicate. Therapist boundaries enforced. Maya/Jordan unchanged. No learner sessions created in 3B. DELETE 405. Two inactive draft verification patients left in production.

**Phase 3C** — Admin Test Conversation on the **existing** session engine (`docs/VPsych_PHASE3C_IMPLEMENTATION.md`, security review, 3C-6 artifact state).

Hotfix `7222e6c`: `allowInactivePersona` in-memory for admin-test mint only (testing lifecycle keeps persona inactive).

### 3.2 IMPLEMENTED / VERIFIED / DOCUMENTED / REMAINING GAP

| Item | Implemented | Verified in production | Documented | Remaining gap |
|---|---|---|---|---|
| Option B lifecycle | Yes | 3B | 3A amendment + 3B record | Dual language `is_active` vs `lifecycle_status` still confuses operators |
| Authoring create/validate/preview | Yes | 3B | 3B | Completeness gates are coarse; JSON-heavy detail UI |
| Publish immutability + duplicate | Yes | 3B | 3B | No in-place published edit (by design) |
| Archive / restore | Yes | 3B | 3B | No DELETE |
| Admin Test Conversation | Yes | 3C-6 | 3C impl + 3C-6 | No QA review workspace; no expected-vs-observed |
| Assessment skip on admin-test | Yes | 3C-6 (reports 0) | 3C | Forged INSERT residual (P1) |
| Isolation vs learners | Yes | 3C-6 (403/401/404; ACE/CGE unchanged) | 3C | Ops counts unfiltered (F-2) |
| TEST MODE banner from server | Yes | 3C-6 | 3C | Query param not auth (correct) |
| Inactive persona mint for testing | Yes (`7222e6c`) | 3C-6 (after first 400) | 3C-6 | Learner path must never gain the flag |
| Retention policy | Persist (Option A) | Sessions kept | Product decision | No TTL; no safe DELETE |
| Phase 3 final acceptance doc | — | — | **File missing** | Write later if product wants a single cover sheet |
| 3C implementation contract file | Referenced | — | **File missing** | Reconstruct from implementation + security review if needed |

Phase 3 **did not** deliver: clinical validation, educational validity, P1 RLS/trigger hardening, DR drill, Sentry, pronunciation tooling, or a professional avatar QA bench.

---

## 4. Clinical Validation Readiness

Distinguish three kinds of validation (do not invent new clinical requirements; these distinctions already exist in `CLAUDE.md`, `KNOWN_LIMITATIONS.md`, `FICTIONAL_PATIENT_CERTIFICATION.md`, and Stage 15 clinical/educational reports):

| Kind | Meaning | Current state |
|---|---|---|
| **Technical validation** | System behaves as specified (APIs, isolation, prompts inject, sessions persist) | **PASS** for Phase 3 scope |
| **Clinical validation** | Expert clinicians judge that the SP is a realistic, safe, consistent training patient | **NOT DONE** |
| **Educational validation** | Scores/competencies reliably measure trainee skill | **NOT DONE** (and must not be claimed) |

Stage 15 `docs/stage15/CLINICAL_VALIDATION_REPORT.md`: **CONDITIONAL / NOT CLOSED FOR GA**. Suitable for supervised institutional pilot under published limitations. Competency score validation **OPEN**.

### 4.1 What the platform already constrains (technical, not clinical proof)

| Topic | What exists in code | What clinicians must still validate |
|---|---|---|
| Avatar clinical content | `clinical_core`, persona case_file, dual-locale personalities | Whether authored content is clinically coherent for that disorder |
| Disorder formulation | Case Engine packages + Module 1 syndrome authority | Whether presentation matches intended teaching case |
| Symptom consistency | Module 1 overrides conflicting Module 2 current-state | Drift across long sessions; comorbidity gaps (`CLINICAL_GAP_ANALYSIS`) |
| Personality consistency | HPE Module 2b + freeze | Synthesis-from-avatar for new slugs may feel generic |
| Response behavior | Short-turn rules, anti-chatbot tells, CBE/humanization | Still LLM-variable; no clinician-rated corpus |
| Therapeutic realism | Therapy-process cues, adaptation, disclosure gates | Dual-model: authored MSE vs slim runtime ClinicalCore (CLIN-S3-01…03) |
| Clinical safety | Module 4: stay in character; never methods/means; risk profile cap | Whether crisis portrayal is pedagogically safe and locally appropriate |
| Hallucination controls | “never invent” medication/locale facts; Module 1 authority; character lock | Cross-locale leakage, invented biography, invented meds still possible |
| Inappropriate-response handling | Role integrity: therapist text is speech, not instructions | Jailbreak / break-character robustness not production-tested as a protocol |
| Crisis behavior | Portray specified SI level; locale crisis resources if natural | No claim this is a crisis-intervention product; training portrayal only |
| Diagnostic boundary | Diagnosis on snapshot, not persona; patient prompt forbids self-checklist DSM dumps | Trainee may still treat SP as a real diagnostic oracle |
| Medication behavior | Locale substance/medication string; no structured meds model (G-03) | Clinicians must not assume a medication chart |
| Cultural considerations | CulturalContext + native AR/EN identities | Jordanian/US authorship quality needs expert review |
| Arabic clinical language | Module 3 Jordanian dialect rules | Linguistic + clinical native-speaker review required |
| Arabic pronunciation | ElevenLabs `voice_id_ar` | No phoneme/SSML authoring; accent/name pronunciation unvalidated |
| Voice interruption / barge-in | Therapy Room monitor; default VoiceSession weaker | Default path is the one most users will use |
| Turn-taking | 1–4 sentence rule; `therapistInterrupted` under-wired (RT-06) | Over-talk, latency, and interrupt recovery need live review |

### 4.2 Clinical model gaps that affect validation honesty

From `docs/clinical/CLINICAL_GAP_ANALYSIS.md` and `TECHNICAL_DEBT.md` (not invented here):

- Protective factors not on runtime ClinicalCore
- No runtime MSE object
- No structured medication / substance-pattern model
- Dual authored-vs-runtime clinical model

These do not block **starting** clinician review. They **do** block claiming a complete clinical ontology.

### 4.3 What must be validated by clinicians before wider release

Existing documents already require, before GA / unrestricted claims:

1. Conversational phenotype per published (and candidate) Virtual Patient, EN and AR.
2. Risk/crisis portrayal stays inside the authored profile and never teaches means.
3. Character lock / no model-break under ordinary trainee behavior.
4. Cultural and dialect authenticity (especially `ar-JO`).
5. Voice casting and intelligibility.
6. That scores are **not** presented as validated instruments during the review.

Fictional integrity is already certified (`FICTIONAL_PATIENT_CERTIFICATION.md`). That is **not** clinical measurement validity.

---

## 5. Avatar Quality

The authoring model can create **usable** Virtual Patients. It is **not** yet a high-quality SP factory at scale.

### 5.1 Coverage of authoring dimensions

| Dimension | Authored today? | Gap |
|---|---|---|
| Identity | Yes (`personalities.*.identity`) | Dual locale must be native, not translated — wizard does not prove nativeness |
| Biography | Partial (persona identity + case_file prose) | No structured life-history editor |
| Demographics | Yes (`clinical_core.age/gender`) | Limited gender enum; no structured SES beyond prose |
| Presenting complaint | Partial (persona prompt / localization) | Not a first-class required field distinct from disorder |
| Disorder | Yes (persona default + case mint) | Package richness varies |
| Symptoms | Yes (`symptom_profile` required to publish) | No past-symptom structure |
| Severity | Case engine severity at mint | Weak as an authoring control on the avatar itself |
| Duration | Not a first-class clinical_core field in publish gates | Often buried in prose |
| Personality | HPE + Module 2 personalities | Synthesis fallback hides missing authorship |
| Behavior | disclosure_rules, session_goals, CBE at runtime | Author sees little of CBE |
| Speech style | `personality.speech` | No live “hear this register” loop except TTS preview |
| Cultural context | `cultural_context` | No CFI interview object |
| Module 2b | `human_personality` map | Easy to skip; synthesis conceals the skip |
| Voice | voice profile / `voice_id` / `voice_id_ar` | No pronunciation lexicon |
| Language | `en-US` / `ar-JO` | Completeness requires both, but quality unmeasured |
| Clinical constraints | Module 1 + risk_profile | Dual-model drift |
| Response rules | Prompt modules; not admin-editable as a ruleset | Authors edit JSON/prose, not a behavior matrix |
| Safety rules | `safety_module` on personality | No safety review checklist in the UI |
| Validation | Structural gates | No clinical-quality gate (expert rating) |

### 5.2 Missing authoring controls (gaps only — no redesign)

- Structured presenting complaint, duration, medication list, MSE, protective factors.
- Per-locale “natively authored” attestation (not just non-empty strings).
- Forced HPE authorship without silent synthesis for new slugs.
- Pronunciation / TTS script preview of names and idioms.
- Side-by-side EN/AR identity check (names, cities, institutions must not leak).
- Safety-profile preview (what SI level will the patient actually say).
- Versioning of published content beyond “duplicate to edit”.
- Expert sign-off record on the avatar (who reviewed, which locale, which protocol).

---

## 6. Admin Workflow

Journey that exists:

**Create → Draft → (edit) → Validate → Testing → Preview and/or Test Conversation → Publish → Archive → Restore → Duplicate.**

### 6.1 What works

Phase 3B production-verified the mechanical path. Permissions: admin-only APIs; therapists cannot author or start testing VPs. Published rows are immutable (correct clinical freeze). Duplicate resets to draft.

### 6.2 Gaps (identify only)

| Class | Gap |
|---|---|
| Unnecessary complexity | `lifecycle_status` and `is_active` both visible; operators must know Option B. Advanced JSON (`clinical_core`, `human_personality`) sits beside a wizard. |
| Confusing terminology | “Inactive” ≠ draft (testing and archived are also inactive). “Preview” is non-persistent; “Test Conversation” is a real session. “Deactivate” ≡ archive from published. |
| Missing safeguards | Publish has structural gates, not clinical sign-off. No second-admin review. Synthesis HPE can publish a patient that was never trait-authored. |
| Missing previews | Preview shows resolved prompt/case, not a scored QA rubric. No EN/AR diff. No “what the learner will hear” mandatory step. |
| Missing validation feedback | Completeness is four booleans. Path-level issues exist in `ValidationIssue` but the UI is not a guided repair flow. |
| Workflow bottlenecks | Testing is required for Admin Test Conversation, but 3B allowed draft→published. Operators may publish without ever testing. No DELETE; leftover verification VPs accumulate. |
| UX | Prompt-for-slug duplicate; dense detail page; two session UIs (VoiceSession vs optional Therapy Room). |
| Permissions | Other admins can SELECT transcripts via `is_admin()` RLS (documented). No “clinical author” vs “ops admin” split. Enterprise RBAC exists in `lib/enterprise` but is not the live authoring permission model. |

---

## 7. Test Conversation

Phase 3C delivered a **secure reuse of the learner session engine**, not a professional QA workbench.

| Need | After Phase 3C | Gap for professional QA |
|---|---|---|
| Text | Same message API | Yes |
| Voice | Same STT/TTS | Default UI barge-in incomplete |
| Transcript | Persisted `session_messages` | No admin QA transcript viewer tied to the avatar with notes |
| Session controls | Start (testing only), end skip | No pause/reset/replay-as-new-seed controls in admin chrome |
| Test-mode indicator | Server banner EN/AR | Yes |
| Interruption | Therapy Room only | Classic path under-wired |
| Arabic | Locale cookie + `voice_id_ar` | No forced bilingual test protocol |
| Patient consistency | Frozen snapshot + HPE | No automated consistency checks on the test transcript |
| Debugging | `aiSource` on replies; server logs | No admin-visible prompt/module dump (correctly withheld from learners; also absent as a privileged QA view) |
| Test-session review | End redirects to avatar detail | No “this test vs last test” |
| Expected vs observed | **None** | Authors cannot attach expected disclosures, forbidden utterances, or crisis lines |

Production 3C-6 ran **one** English-capable GPT turn on a fictional testing VP. That proves isolation, not clinical quality.

**Needed for professional avatar QA (product gaps, not a redesign spec):** a review object on the test session (pass/fail/notes, locale, voice vs text, expected behaviors); comparison across tests; bilingual checklist; interruption test; explicit “do not publish until QA recorded” policy (today publish does not require a completed test session).

---

## 8. Educational Validation

`CLAUDE.md`: **The platform’s competency scores are not yet validated. Do not state or imply that scores are validated.**

Stage 15 educational report: **OPEN — pilot evidence required.**

| Area | What exists | Gap before educational-validity claims |
|---|---|---|
| Session scoring | `weightedOverall` + 11-item rubric | Single LLM rater; heuristic fallback; no published reliability |
| Competency assessment | ACE/CGE types + learner_competencies (130 rows historically) | Production CGE attempts 0; graph unused as a live curriculum |
| Rubric consistency | Localized labels; weights sum 100 | No inter-rater study vs human experts |
| Report generation | Admin-only narrative + scores + excerpts | Therapists do not see full reports (by design) — feedback loop for learners is limited |
| Feedback | Report + optional education/ACE coach | Not a validated formative instrument |
| Longitudinal progress | ACE learner profile; CGE mastery/decay | Empty learning_paths/assignments in production |
| Case difficulty | Case engine difficulty / presets | Not calibrated to outcome data |
| Repeatability | Frozen snapshots help; model/provider variance remains | `KNOWN_LIMITATIONS`: do not expect identical scores across models |
| Evaluator reliability | ERI engine on main | No `test:reliability` / calibration corpus |
| Bias | Not measured | Language, gender, culture of SP vs trainee not studied |
| Inter-rater validation | Validation pipeline can consume expert ratings | Pipeline exists (`docs/VALIDATION_PIPELINE.md`); production expert-rating program not closed |
| Expert review | `/validation` invite routes | Not a completed educational validation |

Educational validation is a **later phase**. It depends on stable, clinician-accepted patients (Phase 4 recommendation) and a reliability protocol that is still technical debt.

---

## 9. Security & Governance

### 9.1 Controls that hold

| Control | Verdict | Evidence |
|---|---|---|
| Authentication | Pass | Supabase Auth + middleware; 3B/3C-6 password grant |
| Authorization | Pass | `profiles.role`; admin API gate; therapist 403 on test-session |
| RLS | Pass for intended app paths | Owner/admin select; message RPC lockdown (H2); ACE write lockdown (H1) |
| PHI isolation | Pass with caveat | Fictional SPs; no EMR import (`FICTIONAL_PATIENT_CERTIFICATION`). Residual: trainees may paste real data into chat (`KNOWN_LIMITATIONS`) |
| Learner isolation | Pass | RLS + strip marker + skip gate; 3C-6 therapist 404 on test session |
| Admin-test isolation | Pass on intended path | Skip before assess; reports 0; ACE/CGE unchanged |
| Audit | Pass | create/end/forged events; metadata scrubbed of transcripts |
| Secrets | Pass as policy | No secrets in repo; client-safe errors |
| Logging | Partial | Server logs + audit table; no vendor APM |
| Rate limiting | Pass with residual | Present on routes; in-memory fallback if Upstash unset |
| Privacy | Partial | Legal pages; DSAR automation deferred (`V1_1_BACKLOG` / limitations) |
| Production change control | Weak | `main` auto-deploys; docs commits move the alias |

Security certification (`docs/PRODUCTION_SECURITY_CERTIFICATION.md`): **certified with recommendations** after High findings were fixed. That certification predates Phase 3C; 3C security review re-checked the admin-test slice and passed with residuals F-1…F-4.

### 9.2 P1 — direct session INSERT / forged `admin_test`

**Classification: NON-BLOCKING WITH MITIGATION**

**What it is:** RLS `sessions INSERT` allows any authenticated user to insert a row with `therapist_id = auth.uid()` and arbitrary `clinical_snapshot` JSON, including `admin_test: true`, bypassing `POST /api/admin/avatars/[id]/test-session`.

**What happens on end:** Status may close. Non-admin receives **403** + `forged_skip_denied` (audited). They do **not** receive `{ skippedAssessment: true }`. The learner assessment/report/ACE pipeline **does not run** for that session (self-evasion of scoring).

**Why non-blocking for Phase 4 clinical validation:**

- No privilege escalation to another user’s data.
- No forged **successful** admin skip JSON.
- Unpublished testing avatars remain non-startable via the learner API (`is_active=false`).
- App create path strips markers (`stripAdminTestMarker`).
- Impact is **the forger’s own score/report omission**, not PHI leakage or catalog corruption.
- Phase 3C contract accepted API + end-gate hardening instead of an RLS migration; 3C-6 acknowledged P1 without treating it as a 3C blocker.

**Mitigations already in place:** admin-only writer in application source (architecture test); strip on learner create; 403 + audit on forged end; testing VPs not therapist-visible.

**When it would become blocking:** high-stakes educational claims, institutional gradebooks, or any assertion that “every completed learner session is assessed.” For those, prefer continue-the-learner-pipeline on forged marker, or constrain INSERT via trigger/RPC (security review F-1 recommendation — **not implemented here**).

**Not tested in production** (do not forge-INSERT). Residual F-2 (ops counts), F-3 (dyad carry), F-4 (admin home widget) remain P2/P3.

### 9.3 Governance residuals

| Topic | Status |
|---|---|
| Data retention | Admin-test retention = product decision (persist). Generic purge does not distinguish admin tests. |
| Backups / DR | Procedures documented; Stage 15 DR certification **FAIL / OPEN — no signed drill**; PITR unverified |
| Incident response | Not evidenced as a closed program |
| Leaked-password protection | Disabled (ops residual, `KNOWN_LIMITATIONS` / `TECHNICAL_DEBT`) |
| Monitoring | No Sentry baseline |
| Privacy/DSAR | Enterprise compliance deferred |

---

## 10. Production Readiness

Do not equate technical readiness with clinical validity.

| Dimension | Maturity |
|---|---|
| TECHNICAL | **READY** |
| CLINICAL | **NOT READY** |
| EDUCATIONAL | **NOT READY** |
| SECURITY | **READY** (P1 residual: non-blocking with mitigation) |
| GOVERNANCE | **NOT READY** |
| SCALABILITY | **NOT READY** |
| **OVERALL** | **NOT READY** for wider release / certification |

**Ready for:** continued supervised institutional preview; Phase 4 structured clinical review of Virtual Patients using Admin Test Conversation.

**Not ready for:** validated scoring claims, unrestricted GA, Wave closure, mobile/enterprise expansion as the next bet.

Production catalog scale (3C-6 closed counts): 5 avatars / 5 personas; 584 sessions (1 admin-test); 466 reports; 439 case instances; 5 learner profiles. This is a preview library, not a scaled SP program.

---

## 11. Phase 4 Candidate Work

Every candidate is classified later in §12. Complexity is technical breadth, not calendar.

### C1 — Structured clinical validation protocol for Virtual Patients

- **Objective:** Obtain expert clinical judgments (EN/AR) on realism, safety, consistency, and teaching fitness for live and candidate VPs.
- **User/problem:** Cannot ethically widen training use without clinician review.
- **Clinical importance:** Critical  
- **Technical importance:** Low (mostly protocol + recording surface)  
- **Security importance:** Low  
- **Dependency:** Phase 3 authoring + Admin Test Conversation (done)  
- **Complexity:** Medium (process, raters, bilingual)  
- **Risk:** Reviewers treat scores as validated if copy is sloppy  
- **Validation requirement:** Clinical (expert protocol); not educational coefficients  

### C2 — Professional Admin Test QA workflow

- **Objective:** Expected-vs-observed checklist, test-session review, bilingual/voice/text matrix, notes stored against the VP.
- **User/problem:** Authors cannot systematically QA a patient before publish.
- **Clinical importance:** High (enables C1)  
- **Technical importance:** Medium  
- **Security importance:** Low (keep skip/isolation invariants)  
- **Dependency:** 3C session reuse  
- **Complexity:** Medium  
- **Risk:** Accidentally scoring admin tests (must not)  
- **Validation requirement:** Technical + clinical protocol  

### C3 — Authoring quality gates (HPE required, nativeness, safety preview)

- **Objective:** Stop silent HPE synthesis on new slugs; require both locales as authored humans; surface SI/safety preview.
- **User/problem:** Easy to publish a structurally complete but clinically thin patient.
- **Clinical importance:** High  
- **Technical importance:** Medium  
- **Security importance:** Low  
- **Dependency:** 3B validation module  
- **Complexity:** Medium  
- **Risk:** Breaking Maya/Jordan builtin catalog path  
- **Validation requirement:** Technical gates + clinician spot-check  

### C4 — Arabic + voice quality as a validation dimension

- **Objective:** Native-speaker and TTS intelligibility review; optional pronunciation notes — not a new TTS engine.
- **User/problem:** Bilingual claim is central; quality is unmeasured.
- **Clinical importance:** High for AR programs  
- **Technical importance:** Low–medium  
- **Security importance:** None  
- **Dependency:** Existing `voice_id_ar` / Module 3  
- **Complexity:** Low (protocol) to medium (lexicon)  
- **Risk:** Machine-translating EN→AR to “fill” AR (forbidden)  
- **Validation requirement:** Linguistic + clinical  

### C5 — Default-path interruption / turn-taking honesty

- **Objective:** Either wire `therapistInterrupted` on VoiceSession or document Therapy Room as the only barge-in path and test that path.
- **User/problem:** Conversational realism review will fail on over-talk if the default UI cannot interrupt.
- **Clinical importance:** Medium  
- **Technical importance:** Medium  
- **Security importance:** Low  
- **Dependency:** RT-06; Therapy Room flag  
- **Complexity:** Medium  
- **Risk:** Changing default session UX  
- **Validation requirement:** Technical + live clinical listening  

### C6 — P1 forged `admin_test` hardening

- **Objective:** Close self-evasion (continue learner pipeline on forged marker, or INSERT constraint).
- **User/problem:** Learner can omit their own assessment via PostgREST.
- **Clinical importance:** Low  
- **Technical importance:** Medium  
- **Security importance:** High for educational integrity; medium for PHI  
- **Dependency:** Product choice among F-1 options; likely a migration if trigger/RPC  
- **Complexity:** Medium  
- **Risk:** Changing end-route semantics; must not break 3C skip  
- **Validation requirement:** Security regression + learner regression  

### C7 — Governance minimums (retention decision, DR drill, APM)

- **Objective:** Record admin-test retention; one signed restore/PITR drill; vendor error monitoring.
- **User/problem:** Preview cannot become serious production ops without this.
- **Clinical importance:** None directly  
- **Technical importance:** Medium  
- **Security importance:** High (ops)  
- **Dependency:** Ops owners, not app features  
- **Complexity:** Medium (mostly operational)  
- **Risk:** Docs-only “PASS” without a drill (forbidden by Stage 15)  
- **Validation requirement:** Operational evidence  

### C8 — Educational assessment validation program

- **Objective:** Reliability/validity study, expert ratings, calibration harness.
- **User/problem:** Cannot claim the product evaluates therapists.
- **Clinical importance:** Medium (linked)  
- **Technical importance:** High  
- **Security importance:** Low  
- **Dependency:** Stable patients (C1); `ASSESSMENT_RELIABILITY` still unshipped  
- **Complexity:** High  
- **Risk:** Premature validity claims  
- **Validation requirement:** Educational (psychometric)  

### C9 — ACE/CGE live curriculum and learner analytics

- **Objective:** Use engines that are implemented but unused (`cge_attempts=0`).
- **User/problem:** Adaptive learning is advertised in architecture, idle in production.
- **Clinical importance:** Low  
- **Technical importance:** Medium  
- **Security importance:** F-2 ops filter if analytics expand  
- **Dependency:** Educational validity (C8) for claims; C1 for cases  
- **Complexity:** High  
- **Risk:** Dashboard theater without outcome evidence  
- **Validation requirement:** Educational  

### C10 — Admin UX simplification (terminology, guided repair)

- **Objective:** Reduce Option B confusion; guided validation; discourage JSON-only authoring.
- **User/problem:** Authoring will not scale with current density.
- **Clinical importance:** Medium (indirect)  
- **Technical importance:** Medium  
- **Security importance:** None  
- **Dependency:** C3 gates  
- **Complexity:** Medium  
- **Risk:** Redesign churn during validation  
- **Validation requirement:** Usability with authors  

### C11 — Runtime clinical-model promotion (MSE, protectives, meds)

- **Objective:** Close CLIN-S3 dual-model gaps.
- **User/problem:** Prompts cannot rely on authored MSE/protectives.
- **Clinical importance:** High long-term  
- **Technical importance:** High (Case Engine)  
- **Security importance:** Low  
- **Dependency:** Clinical data model roadmap  
- **Complexity:** High  
- **Risk:** Snapshot shape change; historical sessions  
- **Validation requirement:** Clinical + technical  

### C12 — Enterprise tenancy / mobile application

- **Objective:** Multi-org or native mobile.
- **User/problem:** Expansion, not current preview bottleneck.
- **Clinical importance:** None  
- **Technical importance:** High  
- **Security importance:** High (new threat surface)  
- **Dependency:** Governance + clinical + educational baselines  
- **Complexity:** High  
- **Risk:** Dilutes Phase 4  
- **Validation requirement:** Full security + product  

---

## 12. Prioritization

| ID | Candidate | Priority |
|---|---|---|
| C1 | Structured clinical validation protocol | **P0** |
| C2 | Professional Admin Test QA workflow | **P0** |
| C3 | Authoring quality gates (HPE / nativeness / safety preview) | **P1** |
| C4 | Arabic + voice as validation dimension | **P1** |
| C6 | P1 forged `admin_test` hardening | **P1** |
| C5 | Interruption / turn-taking honesty | **P1** |
| C7 | Retention decision + DR drill + APM | **P1** |
| C10 | Admin UX simplification | **P2** |
| C11 | Runtime MSE / protectives / meds | **P2** |
| C8 | Educational assessment validation | **P2** (start design only; execution after C1) |
| C9 | ACE/CGE live curriculum | **P3** |
| C12 | Enterprise / mobile | **P3** |
| F-2 ops counts / F-3 dyad / F-4 widget | Analytics hygiene | **P2 / P3** as previously classified |

**P0** = must exist before further expansion of the patient library or wider trainee cohorts.  
**P1** = required for serious production use of the preview (integrity, bilingual honesty, ops).  
**P2** = useful; do not let it define Phase 4.  
**P3** = optional/future.

---

## 13. Recommended Phase 4 Scope

### 13.1 Directions evaluated

| Direction | Fit as Phase 4 spine? | Reason |
|---|---|---|
| **A. Clinical validation** | **Yes — spine** | Phase 3 just made authoring + testing real. The next honest question is whether patients are clinically fit. |
| **B. Avatar quality / authoring** | Partial | Only the gates that make A truthful (C3), not a factory redesign. |
| **C. Educational assessment validation** | No (too early) | Scores are unvalidated; patients are unreviewed. C8 is Phase 5 material. |
| **D. Admin UX** | Partial | QA workflow (C2) only; full UX simplification is P2. |
| **E. Voice/Arabic quality** | Partial | As a **dimension of A**, not a TTS rewrite. |
| **F. Security/governance** | Rider | C6+C7 are P1 but must not replace the product question. |
| **G. Analytics** | No | Engines idle; dashboards without C1/C8 are theater. |
| **H. Enterprise** | No | Code exists; operating mode is still single-tenant preview. |
| **I. Mobile** | No | New surface; no clinical baseline. |
| **J. Other** | — | Runtime clinical-model promotion (C11) is important but too invasive to be the Phase 4 spine. |

### 13.2 Smallest coherent Phase 4

**Name:** Phase 4 — Structured Clinical Validation of Virtual Patients  

**Include:**

1. **C1** Clinical validation protocol (EN/AR, safety, realism, consistency, teaching fitness) on Maya/Jordan and any candidate VP — using Admin Test Conversation, **not** learner scoring.
2. **C2** Minimum QA recording: test-session review notes, locale, modality, expected vs observed, publish-not-required-but-strongly-gated policy.
3. **C3** Authoring honesty gates so validation is not undermined by synthesized personalities.
4. **C4** Arabic language + TTS intelligibility as mandatory review dimensions.
5. **C5** Document and/or fix default-path interruption so reviewers are not scoring a UI limitation as a patient defect.
6. **C6** Schedule P1 hardening (do not pretend educational scores are trustworthy until it lands if grade-like use is intended).
7. **C7** Record retention decision; do not fake a DR PASS.

**Exclude from Phase 4 implementation (defer):** educational validity study execution, ACE/CGE curriculum rollout, enterprise/mobile, full admin redesign, ClinicalCore ontology expansion, score-marketing.

**Why this set is coherent:** it is one job — **prove (or refute) that the Virtual Patients Phase 3 can now create are fit for supervised training** — plus the few product/security truths that would make that proof false. It is the smallest set that does not skip the clinical question or drown it in a backlog.

**Why not A alone:** without C2–C5, “clinical validation” is ad-hoc chatting with no evidence trail.  
**Why not C (educational) as Phase 4:** it would validate a ruler before validating the patient. Existing policy forbids validated-score claims.

---

## 14. Certification Readiness

Do **not** claim certification. Existing certs are conditional, dated, or explicitly open.

| Target | What exists | Evidence still missing |
|---|---|---|
| Internal QA | CI; architecture tests; 3B/3C-6 production proofs | Repeatable avatar QA protocol (C2); bilingual interruption tests |
| Expert clinical review | Fictional-patient cert; Stage 15 clinical **conditional**; validation invite routes | Signed clinician protocol, N, κ/agreement, EN+AR, crisis/safety cases (`stage15/CLINICAL_VALIDATION_REPORT.md`) |
| Educational validation | Rubric + ERI/AVI engines; Stage 15 edu **OPEN** | Reliability harness, expert dual coding, bias analysis, longitudinal outcomes |
| Structured pilot | Preview limitations published | Inclusion criteria, faculty protocol, incident channel used, no score-as-credential |
| Wave / GA certification | Stage 15 bundle; DR **FAIL**; educational gate open | Signed DR/PITR; APM; educational_validation_successful; no remaining High security residuals if high-stakes scoring is in scope |

`docs/FINAL_RELEASE_CERTIFICATION.md` / Wave docs must not be treated as a substitute for the open Stage 15 clinical and educational gates.

---

## 15. Risks

| Risk | If ignored |
|---|---|
| Treating Phase 3 technical success as clinical validity | Unsafe or misleading training; reputational harm |
| Publishing VPs without bilingual native authorship | Arabic becomes translated EN (explicitly forbidden) |
| HPE synthesis on new slugs | “Complete” patients with generic souls |
| Claiming scores are validated | Contradicts product law in `CLAUDE.md` |
| Expanding ACE/CGE/enterprise before C1 | Idle complexity; false maturity |
| Forged `admin_test` if scoring is used for progression | Integrity failure (P1) |
| `main` docs deploys | Production alias moves without application change (already happened `7222e6c` → `09cec18`) |
| Therapy Room off / barge-in only there | Clinical reviewers judge the wrong UX |
| Accumulating undeletable verification VPs | Catalog noise; operator error |
| Inventing clinical requirements in engineering | Scope explosion; this assessment refuses that |

---

## 16. Dependencies

| Phase 4 item | Depends on |
|---|---|
| Clinical protocol | Production Admin Test Conversation (done); clinician raters; EN+AR authors |
| QA workflow | Must preserve 3C skip/isolation; no assessment on admin tests |
| Authoring gates | Must not break Maya/Jordan builtin HPE catalog |
| P1 fix | Product choice (pipeline-on-forge vs INSERT constraint); likely security regression suite |
| DR | Ops access to backups; **no fabricated drill rows** |
| Educational Phase 5 | C1 complete; reliability harness shipped |
| Any wider release | Governance P1s; no validated-score marketing |

Missing docs (`PHASE3_FINAL_ACCEPTANCE`, `PHASE3C_IMPLEMENTATION_CONTRACT`) should be reconstructed from existing 3B/3C/3C-6 records if a single cover sheet is needed — **not** by re-running Phase 3.

---

## 17. Explicitly Deferred Work

| Work | Defer to |
|---|---|
| Educational validity / calibration harness execution | After Phase 4 clinical acceptance (candidate C8 as Phase 5) |
| ACE/CGE curriculum assignment in production | After educational design (C9 / P3) |
| Enterprise multi-tenant / DSAR automation | v1.1 backlog / later |
| Mobile application | Later |
| Full admin UX redesign | P2 after validation protocol exists |
| Runtime MSE / medications / protectives on ClinicalCore | Clinical roadmap (C11 / P2) |
| Excellence / experimental HCE stacks | `KNOWN_LIMITATIONS` / open PRs — not Phase 4 |
| Admin-test TTL/DELETE | Product decision; not invented here |
| Forging P1 in production to “prove” it | **Forbidden** |
| Phase 4 implementation, migrations, deploy, merge, PR | **This assessment** |

---

## 18. Recommended Next Decision

Product/clinical leadership should choose **one**:

1. **Accept this Phase 4 spine** (structured clinical validation + minimum QA/authoring/Arabic/interruption honesty + scheduled P1/governance riders), then authorize a **separate** implementation contract.  
2. **Narrow further** to protocol-only Phase 4 (C1 + paper checklists, zero application changes) if engineering freeze is required.  
3. **Reject** and name a different spine (not recommended: educational validation or enterprise/mobile first).

Until that decision, **do not implement Phase 4**.

---

## Assessment closure

```
PHASE 3:                         ACCEPTED
PHASE 3C-6:                      PRODUCTION VERIFIED
PHASE 4 ASSESSMENT:              COMPLETE
TECHNICAL READINESS:             PASS
CLINICAL READINESS:              FAIL
EDUCATIONAL READINESS:           FAIL
SECURITY:                        PASS  (P1 NON-BLOCKING WITH MITIGATION)
GOVERNANCE:                      FAIL
P1:                              NON-BLOCKING WITH MITIGATION
RECOMMENDED PHASE 4:             Structured clinical validation of Virtual Patients
                                 (QA trail + authoring honesty + Arabic/voice +
                                 interruption honesty; P1/governance as riders)
PHASE 4 IMPLEMENTATION:          NOT STARTED
APPLICATION CODE CHANGED:        NO
DATABASE CHANGED:                NO
PRODUCTION CHANGED:              NO
PR:                              DO NOT CREATE
```

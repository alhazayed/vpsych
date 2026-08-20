# VPSYCH MASTER CONTEXT

**Compiled:** 2026-08-20 (UTC) · **Compiled from:** `alhazayed/vpsych` @ `1a83424` (≡ `origin/main`)
**Version:** `1.0.0-rc.1` · **Production:** `https://vpsych.vercel.app` · **Supabase:** `rrzudbkxigeavfdnidnm` (us-east-1)

---

## ⚠ Provenance and limits of this document — read first

**What was consolidated.** The complete repository record: 60 commits (2026-08-02 → 2026-08-15),
231 documents under `docs/`, the append-only Release Decision Log (RDL-001 … RDL-035), the
Phase 3 and Phase 4 governance corpus, source code, migrations, personas, and i18n message trees.
Every factual claim below was verified against source, git, or a locally executed command, and
counts were re-measured rather than copied from documentation.

**What could NOT be consolidated.** I had access to the repository only. **I could not read prior
Claude, Cursor, or ChatGPT conversation transcripts** — they are not in the repository and are not
reachable from this session. Where the repository itself records that a decision was made "in
conversation" and never written down, that gap is flagged explicitly (see
`CONTRADICTIONS` C-10 and `DO NOT LOSE` §D-1) rather than papered over.

**Consequence.** "Chronology" below is reconstructed from commit dates, RDL rows, and document
headers — a strong and unusually complete record, but a record of *outcomes*, not of the reasoning
that happened in chat. Product-side material (business model, pricing, marketing, competitors) is
correspondingly thin in the repository, and that thinness is a finding, not an omission.

**Status vocabulary used throughout:**
`CONFIRMED` · `WORKING ASSUMPTION` · `PROPOSED` · `REJECTED/SUPERSEDED` · `OPEN QUESTION` · `UNCERTAIN`

---

## 1. Executive Summary

VPsych is a bilingual (English/Arabic) therapist-training platform. A trainee conducts a voice or
text psychotherapy session against an AI standardized patient; the platform then generates an
**admin-only** performance report.

One sentence carries the whole project's current situation, taken verbatim from its own Phase 4
readiness assessment and independently re-verified here:

> **VPsych is a technically healthy, architecturally coherent platform with essentially no
> validation evidence.**

The engineering substrate is genuinely strong: 668 TypeScript files, 724 tests across 88 files,
75 migrations with RLS enforced at the database, executable architecture guardrails, seven stacked
clinical engines, and all CI gates green. Sixteen numbered stages/phases shipped in roughly two
weeks (2026-08-02 → 2026-08-15) under a formal release-governance process with an immutable
decision log.

The gap is not code. **Nothing the platform measures has been validated.** The competency score is
an 11-dimension weighted mean of LLM-produced 0–5 ratings with hand-assigned weights and no
calibration harness. The avatar publish gate checks that fields are non-empty — it performs no
clinical coherence checking and requires no clinician sign-off. General Availability has been
formally refused three times (RDL-032, RDL-033); the platform sits in **Controlled Institutional
Deployment (CIDP)** at `1.0.0-rc.1`.

The current frontier is **Phase 4 "Validation Readiness"** — deliberately no new features, five P0
items forming one dependency chain. One of the five (P0-1, the Admin Test transcript review
surface) shipped on 2026-08-15. The binding constraint on everything else is **not engineering**:
it is that **no clinical, Arabic-clinical, or psychometric reviewer has been identified**, and the
root appointment — the Clinical Governance Lead — owns 15 of the 27 open governance decisions.

---

## 2. Product / Project Definition

**CONFIRMED.**

| Attribute | Value |
|---|---|
| Name | **VPsych** (repo `alhazayed/vpsych`, owner Aladdin Zayed / `alhazayed`) |
| Category | Therapist-training platform / AI standardized-patient simulation |
| Core loop | Trainee ("therapist") runs a timed voice or text psychotherapy session against an AI standardized patient → platform generates an **admin-only** performance report |
| Locales | `en` / `ar` — bilingual, each locale's patient personality **natively authored, never translated** |
| Session cap | 40 minutes (`MAX_SESSION_SECONDS`), enforced server-side |
| Patients | **Fictional standardized patients only.** No real patient data, no PHI, never clinical decision support for real patients |
| Report audience | **Admins only.** Therapists never see their own full report (RLS-enforced) |
| Deployment posture | Controlled Institutional Deployment (CIDP) — **not** General Availability |

---

## 3. Vision

Reconstructed from `docs/cidp/`, `docs/stage14–16/`, `docs/EDUCATIONAL_MODEL.md`, and the landing
copy. Treat the long-range items as **WORKING ASSUMPTION** — they are consistently implied across
documents but never stated as a single ratified vision statement.

- **Near term (CONFIRMED):** a training instrument that lets psychiatry/psychology trainees
  practise interviewing, diagnostic reasoning, risk assessment, and therapeutic technique against
  clinically credible simulated patients, in their own language, with structured feedback.
- **Mid term (WORKING ASSUMPTION):** institutional deployment — residency programmes, medical
  schools, hospital training departments — with faculty/supervisor surfaces, cohorts, curricula,
  and programme-level analytics (the Stage 7/9/10 engines exist for this).
- **Long term (PROPOSED, unevidenced):** a *validated* competency-measurement instrument suitable
  for formative and eventually consequential educational use, backed by published clinical and
  psychometric evidence. **Everything about this depends on Phase 4 and beyond; nothing supports
  it today.**
- **Arabic-first-class (CONFIRMED as an architectural commitment):** Arabic is not a translation
  layer. `ar-JO` patients are independently authored humans with different names, cities, family
  structures, faith references, currencies, clinics, and idioms of distress.

---

## 4. Problems We Are Solving

**CONFIRMED** (as the project's stated rationale, drawn from `docs/EDUCATIONAL_MODEL.md`,
`docs/cidp/FACULTY_GUIDE.md`, `docs/cidp/RESIDENT_GUIDE.md`, landing copy):

1. **Scarcity of safe practice.** Trainees get limited supervised contact with diverse
   presentations before real patients; high-risk presentations (active suicidality, mania,
   psychosis) are precisely the ones a trainee cannot practise on demand.
2. **Standardized patients are expensive and inconsistent.** Human SPs cost money, do not scale,
   and vary run to run — so cases are not comparable across trainees.
3. **Feedback is scarce, slow, and unstructured.** Supervisor time is the bottleneck; feedback is
   rarely dimension-by-dimension or turn-referenced.
4. **Non-English clinical training is under-served.** Arabic-language psychotherapy training
   material is scarce, and translated material misrepresents idioms of distress and help-seeking
   norms.
5. **Programme directors lack objective progress signal** across a cohort.

**Honest caveat, and it is load-bearing:** the platform currently *addresses* problems 1, 2 and 4
and *claims to address* 3 and 5. Problems 3 and 5 depend on scores that are not validated.

---

## 5. Target Users

**CONFIRMED** (roles exist in schema/code) unless marked.

| Audience | In-product role | Status |
|---|---|---|
| Trainee therapist / resident / psychology student | `profiles.role = 'therapist'` | CONFIRMED — the primary live user |
| Programme administrator / faculty / supervisor | `profiles.role = 'admin'` | CONFIRMED — the only role that can read reports |
| Institution (residency programme, medical school, hospital) | `institutions` + `institution_memberships` | PARTIAL — schema and Stage 10 engine exist; **memberships table is empty in production** |
| Clinical reviewer / Clinical Governance Lead | — | **PROPOSED — no such role exists in schema, and no person is identified** |
| Researcher | `docs/RESEARCH_ARCHITECTURE.md`, research export API | PARTIAL — admin-gated export exists; no research programme running |
| Invited expert evaluator | `/validation` portal (PR #142) | CONFIRMED — portal exists |

There are **two roles only** in the live authorization model: `therapist` and `admin`
(`profiles.role`). Every other persona above is a documentation concept, not an enforced role.

---

## 6. Core Value Proposition

**WORKING ASSUMPTION** (assembled from landing copy + docs; never ratified in one place):

> Practise psychotherapy — in English or Arabic — against AI patients that behave like real people
> with real disorders, as often as you need, and get structured competency feedback afterwards.

Differentiators the codebase actually supports:

1. **Disorder is minted per session, never owned by a persona.** The same avatar can present
   differently across sessions; trainees cannot memorise "Maya = MDD".
2. **Human personality is modelled independently of diagnosis and of the LLM.** Two patients with
   the same disorder are different people.
3. **Native bilingual authoring**, with locale confined to speech and culture — never diagnosis.
4. **Clinical depth beyond a prompt wrapper**: beliefs/schemas, runtime MSE subset, protective
   factors, typed therapy-response profiles, disclosure rules keyed to therapist behaviour.
5. **Safety module with explicit prompt precedence** over persona and language modules.

---

## 7. Current Product Structure

```
Public         /  /login  /signup  /auth/*  /privacy  /terms  /validation  robots  sitemap
Authenticated  (app)/  → AppShell + requireProfile
  /avatars                 catalog of published patients (is_active = true)
  /sessions                own session list (admin-test rows hidden from learners)
  /sessions/[id]           live session (VoiceSession — classic default)
  /sessions/[id]/complete  post-session
  /learning                ACE/CGE learner surfaces
  /clinic                  Virtual Mental Health Center (flag-gated, off)
Admin (middleware-gated + requireAdmin)
  /admin/avatars           Virtual Patient authoring + lifecycle
  /admin/avatars/[id]      detail · admin-test conversations list (NEW, P0-1)
  /admin/test-sessions/[sessionId]   admin test transcript review (NEW, P0-1, 2026-08-15)
  /admin/reports/[sessionId]         learner performance report (admin-only)
  /admin/cidp              CIDP + Phase 14/15/16 evidence dashboards
  /admin/…                 scenario templates, presets, scientific indices, quality ledger, feedback triage
API            71 route handlers, all JSON, all rate-limited, all `no-store`
```

---

## 8. Features

Verified against `docs/FEATURE_INVENTORY.md` and re-checked against the tree. **Production = live
on `main` and deployed**, not "exists somewhere".

**Production, implemented:** auth + password recovery · role authorization (middleware + API
guards) · Case Engine patient generation · patient conversation agent · assessment engine ·
admin reports · ACE · CGE · Quality Ledger · scientific indices (CFI/ERI/AVI/ALE/RRS/VQI — APIs
live, score tables mostly empty) · research export · instructor presets · scenario templates ·
OpenAI STT · ElevenLabs TTS · avatar catalog · Virtual Patient authoring wizard + lifecycle ·
admin test conversation (Phase 3C) · **admin test transcript review (Phase 4 P0-1)** ·
institutional feedback + triage · CIDP/Phase 14–16 ops dashboards · rate limiting · security audit
logging · security headers · i18n EN/AR + RTL · `/validation` portal.

**Flag-gated, off by default:** Therapy Room Mode (`NEXT_PUBLIC_THERAPY_ROOM_MODE`) · Virtual
Mental Health Center (`FEATURE_THERAPY_ROOM`) · SSE message streaming.

**Partial:** email verification (provider/hook dependent) · institutions/enterprise tenancy
(schema yes, memberships empty) · ACE learner analytics (sparse data) · supervisor (admin report
surface only; no separate supervisor role).

**Experimental / open PRs only — NOT on main:** PME · TRE · HCTF · CQI · EOI · CVL · HFTE ·
Hands-Free Therapy · clinical validation programme PRs. Feature inventory finding worth keeping:
**no experimental engine ships behind a silent default-on flag.**

---

## 9. User Experience / User Journeys

**Trainee (CONFIRMED):** sign up → (admin grants role in SQL) → `/avatars` → pick a published
patient → session starts (case minted fresh) → voice or text turns, 40-min server-enforced cap →
end → `/complete` → **sees no report** (by design) → `/learning` shows ACE/CGE progress.

**Admin authoring (CONFIRMED, Phase 3B "Option B" lifecycle):**
`draft → testing → published → archived`. `lifecycle_status` is canonical; `is_active` is the
therapist-visibility projection (`true` **iff** `published`). Published avatars are **immutable**
through normal PATCH — correction path is duplicate → edit → publish → archive. "Deactivate" ≡
"Archive"; there is no separate deactivated state.

**Admin QA (Phase 3C + Phase 4 P0-1):** set avatar to `testing` → start an Admin Test Conversation
(full voice/STT/TTS runtime, TEST MODE banner sourced from server state, 20/h rate limit) → end →
**assessment is skipped by design, no report is created** → transcript is now readable at
`/admin/test-sessions/[sessionId]` (this was the P0-1 fix; before 2026-08-15 the transcript was
persisted and then unreachable in the UI).

**Admin review (CONFIRMED):** `/admin/reports/[sessionId]` for learner sessions; ops and CIDP
dashboards for programme-level evidence, which display **"Evidence Pending"** wherever real
evidence does not exist.

---

## 10. Technical Architecture

**CONFIRMED.** Canonical doc: `docs/SOFTWARE_ARCHITECTURE.md` (Stage 2).

```
Browser (EN/AR, cookie locale)
  → Vercel Edge middleware (auth refresh · /admin + /api/admin gate · locale cookie)
  → Next.js 16 App Router (React 19, TS strict, Tailwind v4)
  → Route Handlers (auth → rate limit → validate → work → sanitized JSON)
  → Supabase Auth + Postgres RLS (us-east-1)
  → OpenAI / Vercel AI Gateway (patient replies + assessment)
  → ElevenLabs (TTS)
```

**Measured on `1a83424` (2026-08-20):** 668 TS/TSX files · 88 test files · **724 tests** ·
71 API route handlers · 33 authenticated pages · **75 SQL migrations** · ~80 tables ·
i18n keys **1085 / 1085** exact parity.

**Engine stack** (they stack; none replaced an earlier API):

| # | Engine | Code | Doc |
|---|---|---|---|
| 1 | Dynamic Clinical Case Engine | `lib/case-engine/` | `DYNAMIC_CLINICAL_CASE_ENGINE.md` |
| 2 | Clinical Scenario Template Engine | `lib/scenario-templates/` | `CLINICAL_SCENARIO_TEMPLATE_ENGINE.md` |
| 3 | Instructor Preset Engine | `lib/instructor-presets/` | `INSTRUCTOR_PRESET_ENGINE.md` |
| 4 | Adaptive Curriculum Engine (ACE) | `lib/ace/` | `ADAPTIVE_CURRICULUM_ENGINE.md` |
| 5 | Competency Graph Engine (CGE) | `lib/cge/` | `COMPETENCY_GRAPH_ENGINE.md` |
| 6 | Human Personality Engine | `lib/personality-engine/` | `HUMAN_PERSONALITY_ENGINE.md` |
| 7 | Clinical Voice Profiles (CVP) | `lib/clinical-voice/` | `CLINICAL_VOICE_PROFILES.md` |

Plus ~20 further `src/lib/` subsystems: `clinical-intelligence` (Stage 6 SP mind),
`education` (7), `validation` (8), `supervisor` (9), `enterprise` (10), `realtime` (11),
`ops` (12/CIDP/Phase 14–16), `quality-ledger`, `scientific`, `therapy-room`, `patient-memory`,
`adaptation`, `emotion`, `humanization`, `conversation-behaviour`, and the index modules
`ale/avi/cfi/eri/nbe/rrs/vqi`.

**Ownership rule that recurs everywhere:** only the patient-cognition layers write patient state.
Education, Validation, Supervisor, Enterprise, Realtime and Ops **never write patient mind**.

**Session lifecycle (canonical):**
```
POST /api/sessions        → rate limit → createCaseForSession() → stripAdminTestMarker()
                          → require avatar.is_active → INSERT sessions (case_instance_id, clinical_snapshot)
POST …/[id]/message       → ownership + active + time → resolveAvatar(avatar, language, {caseSnapshot})
                          → Adaptation → LTM → Emotion → CBE → DecisionPlan → Humanization → reply
                          → case_memory upsert (best-effort) → insert_assistant_message RPC
POST …/[id]/end           → close status → [ADMIN-TEST GATE, early return]
                          → session_has_report → assessSession() → education/ACE/CGE → validation
                          → supervisor → enterprise → realtime → patient memory
                          → create_session_report (HMAC-signed RPC) → quality ledger
```
Everything after `assessSession` is **best-effort soft-fail** — a missing engine table must never
prevent a report from persisting.

**Voice path:** therapist speech → OpenAI STT (`/api/voice/transcribe`) → patient reply
(`/api/sessions/:id/message`) → ElevenLabs TTS (`/api/voice/tts`) → browser audio. Text-only skips
STT/TTS and hits the same message API. **Transcript persistence is always server-side**, regardless
of mode.

**Executable guardrails (`src/lib/architecture.test.ts` + siblings)** — these read source text and
assert invariants. If one fails, the invariant is the thing to preserve. They currently enforce,
among others: `lib/cge/index.ts` must not re-export `./ace-bridge` (prevents an ACE↔CGE cycle) ·
`messageRpcClient` is used rather than hard-requiring a service role · the admin-test skip precedes
`assessSession` · the P0-1 transcript surface uses no service role and gates on the persisted
marker before querying messages.

---

## 11. AI / LLM Architecture

**CONFIRMED.**

- `lib/ai/provider.ts` is the **single decision point**, shared by patient chat and assessment.
- Official OpenAI SDK when `OPENAI_API_KEY` is set (default model **`gpt-5`**); Vercel AI Gateway
  when `AI_GATEWAY_API_KEY` is set; `OPENAI_CHAT_PROVIDER=openai|gateway` forces a path.
- **With no key at all the patient agent returns persona fallback replies rather than erroring.**
- `aiSource` (`gpt` | `gateway` | `persona_fallback`) must always propagate to the client.
  **A fallback reply must never be presented as a model reply.** (Protocol consequence: a
  validation session containing a `persona_fallback` turn is *void*.)
- STT: OpenAI. TTS: ElevenLabs, with `AbortSignal.timeout` (default 30s, `ELEVENLABS_TIMEOUT_MS`).
- `/api/health/openai` is **admin-gated**. Do not relax it.

---

## 12. Prompts & AI Workflows

**CONFIRMED.** `src/lib/ai/prompt-engine.ts` assembles a modular system prompt per turn:

| Module | Content | Precedence rule |
|---|---|---|
| **Module 1 — CLINICAL** | language-neutral; this session's diagnosis, symptoms, salience, disclosure rules, risk profile, MSE | **Sole authority for mood polarity, sleep need, and current-state facts.** Overrides Module 2 on current-state conflict |
| **Module 2 — AVATAR** | the authored human for `session.locale` — identity, speech, cultural context, idioms of distress | Keeps identity/biography; its *current-state* narrative yields to Module 1 |
| **Module 2b — HUMAN PERSONALITY** | structured traits from the personality engine, **independent of GPT and of diagnosis** | Omitted for legacy avatars with no authored profile |
| **Module 3 — LANGUAGE** | locale + dialect register | — |
| **Module 4 — SAFETY** | crisis behaviour, risk disclosure style, locale-specific crisis resources | **Overrides Modules 1–3 on conflict** |

**Anti-hallucination instructions in the prompt (preserve these exact intents):** *"Imperfect
memory; never invent real hospitals, records, or people"* · *"obey exactly; never invent"* on
substance and medication facts · match Module 1 speech pace/affect *"not a polished chatbot"*.

**Syndrome authority block (worth preserving verbatim in spirit):** if Module 2 persona text
describes a state that contradicts Module 1 (e.g. a low-mood narrative when Module 1 is mania),
the conflicting current-state lines are ignored and Module 2 identity is kept. This exists because
personas were originally authored around one disorder and the case engine now mints others onto
them.

**Assessment workflow:** `assessSession()` produces 11 dimension ratings (0–5) parsed with Zod
(`lib/ai/assessment-parse.ts` — the *only* place Zod is used), combined by the private
`weightedOverall()` helper into 0–100, then decorated by `attachEducationalReliability` and
`attachAssessmentValidity`. The report is written by the HMAC-signed insert-once RPC.

---

## 13. Data / Memory / Context Strategy

**CONFIRMED.**

- **`sessions.clinical_snapshot`** is the frozen truth for a session: the minted `CaseInstance`,
  the human personality profile, and (when present) the `admin_test` marker. Locale never touches
  diagnosis.
- **`case_instances`** — immutable per-session case record.
- **`case_memory`** — mid-session mind state (emotion, adaptation, clinical-intelligence
  namespaces). **Known debt:** two writers (Emotion and Adaptation) both upsert it without an
  atomic namespaced patch helper (ARCH-S2-02 / RT-01 / OWN-01).
- **`loadDyadClinicalCarry`** — cross-session carry for the same therapist+avatar dyad, seeded at
  create and message time. **Known gap (F-3):** it may select a prior *admin-test* session.
- **`session_messages`** — full transcript, always server-persisted.
- **Long-Term Patient Memory** — `lib/patient-memory/`, `docs/LONG_TERM_PATIENT_MEMORY.md`.
- **Token budget** — `docs/runtime/TOKEN_BUDGET.md`; **RT-05 "unbounded prompt token growth" is
  open High debt.**

---

## 14. Tools, Services & Integrations

| Service | Use | Env |
|---|---|---|
| Supabase | Auth, Postgres, RLS, Vault, edge functions | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| OpenAI | patient replies + assessment + STT | `OPENAI_API_KEY`, `OPENAI_CHAT_PROVIDER` |
| Vercel AI Gateway | alternative model path | `AI_GATEWAY_API_KEY` |
| ElevenLabs | TTS | `ELEVENLABS_API_KEY` (must be a valid `sk_…` **Production** key), `ELEVENLABS_TIMEOUT_MS` |
| Upstash Redis | distributed rate limiting | `UPSTASH_REDIS_REST_URL` / `_TOKEN` — **falls back to in-memory, which is not horizontally safe** |
| Resend | auth emails via Supabase Send Email hook (`supabase/functions/send-email-hook`) | `RESEND_API_KEY`, `SEND_EMAIL_HOOK_SECRET`, `AUTH_EMAIL_FROM` |
| Vercel | hosting, deploys, promote-based rollback | — |
| next-intl | i18n, cookie-driven locale | — |
| Report signing | HMAC-SHA256 over `${sessionId}\n${narrative}\n${scoresJson}\n${excerptsJson}` | `REPORT_WRITE_KEY` **must equal** Vault secret `report_write_key` |

**Documented as unused / dead:** Azure Speech (`hasAzureSpeech()` is a dead export), Deepgram
(comments only in `.env.example`).

---

## 15. Business Model

**Status: UNCERTAIN — and this is the largest genuine knowledge gap in the repository.**

What exists: a **pricing section on the public landing page** with three tiers —

| Tier | Price | Advertised features |
|---|---|---|
| Free | **$0** | practice sessions with preset avatars · voice-first training · admin-only assessments |
| Professional | **$29/mo** ("Most Popular") | unlimited sessions · **full performance reports** · expanded patient library |
| Institution | **Custom** ("Contact Sales") | supervisor dashboards · custom case creation · enterprise support |

What does **not** exist anywhere in the repository: billing integration, Stripe or any payment
provider, subscription tables, entitlement checks, plan enforcement, usage metering tied to a
plan, a "Contact Sales" destination, or any document discussing revenue, unit economics, or
go-to-market.

**Two readings, and I cannot resolve them from the repo (see CONTRADICTIONS C-2):**
(a) these are real intended tiers awaiting implementation; (b) this is template marketing copy that
shipped with the landing page and was never a business decision.

**Direct conflict to resolve either way:** the Professional tier advertises *"Full performance
reports"* to the trainee, which contradicts the CONFIRMED, RLS-enforced invariant that
**session reports are admin-only and are never exposed on a therapist-facing API.**

**Institutional model (better evidenced, PROPOSED):** the CIDP corpus, Stage 10 enterprise engine,
`institutions`/`institution_memberships`/`programs`/`enterprise_courses` schema, faculty and
hospital-administration guides, and pilot machinery all point at **institutional licensing to
residency programmes / medical schools / hospitals** as the intended commercial motion. Five seed
institutions exist; **zero memberships**; the pilot registry is deliberately empty rather than
fabricated.

---

## 16. Branding & Positioning

**CONFIRMED (as shipped copy):**

- Name **VPsych**; tagline *"Clinical excellence in every interaction. Empowering the next
  generation of mental health professionals through AI simulation."*
- Hero: *"Practice Psychotherapy with AI Patients"*; badge *"Next-Gen Clinical Training"*.
- Positioning pillars in the landing feature grid: clinical simulations · AI patient avatars ·
  competency-based feedback · performance analytics · progress tracking · **Arabic & English
  support**.
- Internal positioning is markedly more conservative than external: *"Limited Professional
  Preview"*, *"Controlled Institutional Deployment"*, *"formative feedback for training discussion,
  not high-stakes credentialing"*.

**The gap between external and internal voice is itself a finding.** External copy says *"Instant
scoring on empathy, verbal reflections, and adherence to therapeutic modalities"* and
*"Trusted by Professionals"*; internal governance says scores are unvalidated and must never be
described otherwise. See CONTRADICTIONS C-1.

---

## 17. Marketing / Growth

**Thin. Nearly all of it is deferred or unevidenced.**

- Shipped: landing page, robots, sitemap, `/privacy`, `/terms`, `/validation` invited-expert portal.
- **Deferred to `[v1.1]`:** full technical SEO suite (#93), AEO certification (#94), GEO
  certification (#95), brand & conversion (#97). All four are **REJECTED-for-now/SUPERSEDED for
  v1.0** with the stated reason: *conversion surfaces come after the core product is stable in
  production*.
- Growth motion implied by CIDP: invited institutional pilots → evidence → GA. **No pilot has been
  registered**; the registry is empty by policy (empty ≠ fabricated).
- **Landing page carries three named testimonials and four headline statistics that the production
  database does not support.** See CONTRADICTIONS C-1 — this is the single highest-risk item in
  this document for a platform whose entire governance culture is built on not fabricating
  evidence.

---

## 18. Research & Insights

**CONFIRMED — real assets:**

- **A retrospective corpus exists and is unanalysed:** ~583–584 sessions, ~466 reports,
  130 learner-competency rows, 401+ case instances in production. Both the readiness assessment
  and the validation protocol call this *"the cheapest available path from zero evidence to first
  evidence"* — it needs no new sessions, no pilot recruitment, and no production change.
- **An adversarial clinical examination of the persona library exists**
  (`personas/clinical-examination.json`, dated 2026-08-02): a criterion-by-criterion DSM-5-TR
  attack on all four personas, ICD-11 verification, timeline and arithmetic audit, cross-locale
  parity audit, risk/trauma/psychosis/substance probes. Fourteen consistency and localization
  defects were found and repaired; the stated bar was >9.5/10 clinical accuracy with the primary
  diagnosis surviving every attack. **UNCERTAIN whether the "board-certified psychiatrist" examiner
  was a human clinician or an AI acting in that role — the repository does not say.** See C-5.
- **Authoring principles from `personas/index.json` worth preserving verbatim** (see DO NOT LOSE).
- **Stage 8** validation platform, inter-rater store (unpopulated), psychometric report scaffolding.

**Insight that recurs across every audit and should be treated as the project's core research
finding:** *technical validation is strong and must never be confused with clinical or educational
validation.* Three kinds, kept separate: Technical **PASS** · Clinical **NO EVIDENCE** ·
Educational **NO EVIDENCE**.

---

## 19. Competitors / Alternatives

**Status: ABSENT.** No competitor analysis, market scan, or alternatives comparison exists anywhere
in the repository — no document, no doc heading, no commit. The only "alternatives" reasoning
present is internal (human standardized patients being expensive and inconsistent, §4).

This is stated plainly rather than filled in: **if competitive analysis was done, it exists only in
conversations I cannot read, and it should be written down.**

---

## 20. Security / Privacy / Compliance

**CONFIRMED — this is the strongest non-clinical area. Several items are fixed findings; treat
them as load-bearing.**

| Control | State |
|---|---|
| Auth split | pages `requireUser/requireProfile/requireAdmin` (redirect) vs routes `requireApiUser/requireApiAdmin` (JSON 401/403, never redirect) |
| Admin gate | `src/middleware.ts` gates `/admin` **and** `/api/admin` at the edge |
| Roles | `profiles.role` **only** — never `user_metadata` |
| `session_messages` RLS | client insert allowed **only** for `role='user'`; assistant/system go through `insert_assistant_message` / `insert_system_message` SECURITY DEFINER RPCs that re-check ownership, active status, turn order |
| `session_reports` | written by `create_session_report` — HMAC-signed, **insert-once**; reads gated on `is_admin()`; never on a therapist-facing API |
| RLS performance | new policies must wrap `auth.uid()` / `is_admin()` in `(select …)` so they evaluate once per statement |
| Service role | Route Handler / Server Action only; permitted call sites documented in `lib/supabase/admin.ts`. Prefer `messageRpcClient(userClient)` |
| Rate limiting | every handler, before work; per-user per-hour: `msg` 120 · `stt` 120 · `tts` 60 · `start` 30 · `end` 20 · admin previews 30 · admin test 20 · scientific admin 60 · OpenAI health 30 |
| Error sanitisation | `clientSafeError()` / `sanitizeDbError()` — never return raw provider/Postgres/env detail |
| Headers | CSP/HSTS/COOP/CORP/Permissions-Policy as a **pure data module** (`lib/security-headers.ts`) applied via `next.config.ts`; `/api/*` is `no-store` |
| Audit | `security_audit_events`; `requireApiAdmin` auto-logs denials |
| PHI | none by construction — fictional standardized patients only |
| Dependency audit | 0 vulnerabilities; `npm run audit:deps` gates CI |

**Open security/ops residuals (all named, none secret):**
1. **Supabase leaked-password protection (HIBP) disabled** — dashboard setting (SEC-S12-01).
2. **Upstash presence in production unconfirmed** — in-memory fallback is not horizontally safe
   (SEC-S12-02).
3. **No vendor APM/Sentry** — `X-Request-Id` correlation shipped, vendor APM open (SEC-S12-03).
4. **DR drill and PITR restore never executed.** Procedures documented (RTO ≤4h / RPO ≤24h);
   **backups have never been proven restorable** against 583 sessions and 466 reports of
   institutional data. Named by the Board as a GA blocker.
5. **Penetration test never performed.**
6. **P1 — forged `admin_test`** (§25).

**Standing prohibitions:** never commit secrets · `.env.production` intentionally holds only the
public anon key · the `*.vpsych.test` demo accounts are deliberately banned (`banned_until` set)
and must not be re-enabled.

---

## 21. Confirmed Decisions

The invariants. Breaking any of these is a regression, not a design change.

1. **A persona never permanently owns a disorder.** Every session mints a fresh immutable
   `CaseInstance`; diagnosis lives in `sessions.clinical_snapshot`. Avatar `clinical_core.disorder`
   is an authored *default presentation*, not ownership.
2. **Locale affects speech and culture only — never diagnosis.**
3. **Human personality is independent of GPT and of diagnosis**, injected every turn as Module 2b
   and frozen onto `clinical_snapshot.human_personality`.
4. **Patient personalities are natively authored per locale, never machine-translated.**
5. **Reports are admin-only**, RLS-enforced, insert-once, HMAC-signed.
6. **Assistant/system messages never go in via direct client insert** — RPC only.
7. **ACE and CGE are best-effort and non-blocking.** `runAceAfterAssessment` never throws and must
   never prevent a report from persisting.
8. **`lib/cge/index.ts` must not re-export `./ace-bridge`** (ACE↔CGE cycle) — guardrail-enforced.
9. **`messageRpcClient` over hard-requiring a service role** — hard-failing on an unset service role
   caused a production outage.
10. **Route Handler shape:** auth → rate limit → validate body → work → sanitized JSON.
11. **Lifecycle Option B:** `lifecycle_status` canonical, `is_active` projection, published ⇒
    immutable, DEACTIVATE ≡ ARCHIVE, lifecycle changes never rewrite sessions/snapshots/reports.
12. **Admin Test Conversations reuse the real session engine** and are isolated: no report, no
    assessment, no ACE/CGE/competency writes, hidden from learner history, three audit events.
13. **The end-route admin-test skip must precede `assessSession`** — guardrail-enforced.
14. **Competency scores are NOT validated** and must never be described as validated in docs, UI,
    marketing, or certification material.
15. **Evidence is never fabricated.** Missing evidence displays **"Evidence Pending"**; an empty
    pilot registry is correct, not a bug.
16. **GA is refused.** `1.0.0-rc.1` is CIDP only; do not tag `v1.0.0` (RDL-032, RDL-033).
17. **Every new i18n key goes into both `messages/en.json` and `messages/ar.json`.**
18. **Never edit an applied migration** — add a new one; filenames `YYYYMMDDHHMMSS_snake_case.sql`.
19. **Credential Verification Gate** is binding for every release (RDL-009), not just v1.0.
20. **`aiSource` always propagates**; a fallback reply is never presented as a model reply.

---

## 22. Working Assumptions

Operating today, but never permanently ratified — safe to revisit with evidence.

| # | Assumption |
|---|---|
| WA-1 | `gpt-5` is the default model; provider is selected once in `lib/ai/provider.ts` |
| WA-2 | Classic `VoiceSession` is the default interaction mode; Therapy Room Mode and VMHC stay flag-off |
| WA-3 | Single-tenant preview; multi-tenant is schema-present but product-incomplete |
| WA-4 | 40-minute session cap is the right ceiling |
| WA-5 | The 11 assessment dimensions and their weights are the right instrument (**hand-assigned, no derivation**) |
| WA-6 | Admin-test is `testing`-lifecycle-only (PD-1/PD-2 remain open product decisions) |
| WA-7 | Phase 4 = "Validation Readiness", five P0 items, no new features |
| WA-8 | Track A (avatar validation) and Track B (assessment validation) run in parallel; Track B is the hedge against slow clinical recruitment |
| WA-9 | The retrospective corpus is the first evidence source |
| WA-10 | Aladdin Zayed (`alhazayed`) is product owner and sole decision authority in practice; "Executive Board", "Release Manager", "Certification Board" are governance *roles* played within the process, not separate identified people |
| WA-11 | Institutional licensing is the commercial motion (landing-page consumer pricing notwithstanding) |

---

## 23. Rejected / Superseded Decisions

**With reasons — this is the section most expensive to reconstruct.**

| Decision | Status | Reason |
|---|---|---|
| **`v1.0.0` General Availability** | **REJECTED ×3** (RDL-028 partial, RDL-032, RDL-033) | Unvalidated competency scores; DR/PITR drills never run; HIBP/APM/pen-test open; pilot portfolio empty; validation observation packs incomplete. CIDP is GO; GA is NO-GO |
| **Majority (2-of-3) voting for split reviewer verdicts** | **REJECTED** (protocol §9.5.1) | Majority voting would let a critical safety failure be outvoted, making the non-compensatory safety rule meaningless. The adjudicator decides on reasoning instead |
| **Compensatory scoring across validation domains** | **REJECTED** (R-1) | *"An avatar that is superb in fifteen domains and mishandles disclosed suicidal intent is not an 85% avatar, it is a failed one"* |
| **Treating realism as implying educational usefulness** | **REJECTED** (R-2) | A perfectly realistic patient who discloses everything in two minutes is clinically excellent and educationally worthless |
| **Delta-reviewing Arabic against English validation** | **REJECTED** (R-3) | English validation never transfers; §13 is a full re-run by a native-speaking clinician. EN-biased heuristics make disparity *likely*, not merely unknown |
| **A separate "deactivated" avatar state** | **SUPERSEDED** by Option B | DEACTIVATE ≡ ARCHIVE; `lifecycle_status` canonical, `is_active` projection |
| **`is_active` as the primary admin status concept** | **SUPERSEDED** (Phase 3B, commit `c69b067`) | `lifecycle_status` is the admin-facing truth |
| **Writing coherence-validation rules in engineering first** | **REJECTED** (protocol §1) | *"Engineering can enforce a clinical standard; it cannot author one."* Doing so converts an engineer's assumption into an enforced constraint and makes it harder to question |
| **Emergency hotfix for the forged `admin_test` P1** | **REJECTED** | Assessed NON-BLOCKING; belongs inside Phase 4 as C-1 with proper coverage, not as an out-of-band patch to a production-verified path |
| **Merging Instructor-preset heuristic grader with assessment `weightedOverall`** | **REJECTED** | Different purposes — keep separate |
| **Merging Education domain scores with ACE EMAs / Supervisor skills / Enterprise certificates** | **REJECTED** | Distinct ownership; ACE remains SSOT for competency persistence |
| **Merging Realtime gateway with Therapy Room VAD** | **REJECTED** | Complementary; do not merge ownership |
| **Excellence engines (PME, TRE, HCTF, CQI, EOI, CVL, HFTE, VMHC) on `main` for v1.0** | **DEFERRED** | Held as open/experimental PRs; do not merge during RC |
| **19 `[v1.1]` PRs** (#62–#69, #87–#89, #91–#97, #99) | **DEFERRED with a hard gate** | Do not merge before tag `v1.0.0`; each must be rebased and re-reviewed after |
| **Inventing a retention policy (PD-3)** | **REFUSED** | Product decision; explicitly not invented by engineering. No TTL, no purge job |
| **Fabricating pilot/drill/survey evidence** | **REFUSED** (RDL-033) | Evidence-Pending-first; empty registry ≠ fabricated registry |
| **Conditional/partial avatar approval state** | **Protocol default: NO** (OD-4 open) | Erosion of gates under delivery pressure is their normal fate |
| **Azure Speech / Deepgram STT** | **ABANDONED** | Dead export + `.env.example` comments only; OpenAI STT is the path |
| **WebRTC/SFU media plane** | **REJECTED for v1** (RT-S11-06) | Intentional HTTPS path |

---

## 24. Lessons Learned

Preserved because each was paid for once.

1. **Hard-failing on an unset service role caused a production outage.** The fix — prefer service
   role when configured, fall back to the authenticated client since the RPCs enforce
   authorization themselves — is now guardrail-tested. Do not reintroduce the hard requirement.
2. **A grant-only migration restore broke SECURITY DEFINER RPC bodies** (W1-C1): session create
   500'd because `insert_system_message`/`insert_assistant_message` bodies remained
   service_role-only. Restoring *grants* is not restoring *function ownership/auth*.
3. **Certification stalled three times on credentials, not on code** (RDL-006/007/008): secrets
   absent → secrets whose values equalled their own key names → therapist/admin emails swapped
   across role env vars with invalid passwords. This produced RDL-009: a mandatory **Credential
   Verification Gate** binding on every future release.
4. **Deployment drift wastes whole certification cycles** (RDL-014/015/017/018): Wave 2 failed
   three times because remediation PRs were merged to a branch but never promoted to production;
   the certification board correctly refused to certify preview deploys.
5. **A TTS 502/503 was an ops key problem, not an application defect** (W3-H5): replacing the
   Production `ELEVENLABS_API_KEY` with a valid `sk_…` key closed it.
6. **Migration files and the deployed schema diverge silently.** Repo-vs-production parity had to
   be reconciled twice (54≡54, then 61≡61). `npm run test:migrations` exists because of this.
7. **Documentation drifts faster than anyone expects.** `CLAUDE.md` under-reported the test suite
   by more than half and still references a reliability harness that does not exist.
8. **Scope creep is the standing failure mode of a 16-phase programme** (risk R-7). The
   countermeasure adopted: the P0 list *is* the scope; anything else requires an RDL row.
9. **A poor reliability result is a successful outcome** (risk R-4). Pre-commit to reporting
   whatever the analysis shows; the honesty discipline must extend to unfavourable results.
10. **Building mechanisms without the humans to operate them is the trap to avoid.** *"That would
    produce a clinical review gate with no reviewer, a coherence validator with no clinical rules,
    and a reliability harness with no analyst — three mechanisms and zero evidence, which is
    precisely the position the platform is in today."*
11. **Isolation is not QA.** Phase 3C built exactly what its contract specified — and the contract
    specified isolation, not QA capability. The transcript was persisted and then orphaned. Specify
    the *use*, not only the *containment*.
12. **A governance register that quietly edits its own source is not a governance register.**
    (Protocol defect DEF-1 was recorded, not silently corrected.)

---

## 25. Current Problems / Blockers

**Ranked by consequence.**

| # | Problem | Severity | Notes |
|---|---|---|---|
| 1 | **No clinical, Arabic-clinical, or psychometric reviewer identified.** All 10 protocol roles UNFILLED; the CGL owns 15 of 27 open decisions | **Blocking** | The true critical path. Engineering is not the bottleneck |
| 2 | **Zero clinical and educational validation evidence** | **Blocking for claims** | Technical validation is strong and is not a substitute |
| 3 | **Forged `admin_test` (P1 / F-1).** `sessions` INSERT RLS constrains only `therapist_id`, so a therapist can direct-INSERT `clinical_snapshot.admin_test = true`, end the session, receive 403 *after* status is closed, and permanently evade assessment — with the session also hidden from their own history | **P1** | NON-BLOCKING for Phase 4 entry; **BLOCKING the moment scores carry consequence**; P0 for Track B. Audited every time (`admin.avatar.test_session.forged_skip_denied`); cannot forge a success response |
| 4 | **F-5 contract ambiguity.** Phase 3C contract §5.2 says "do not skip"; the implemented rule is 403 | Medium | Must be resolved **in writing before** the C-1 fix is designed |
| 5 | **Backups never proven restorable; PITR never verified; no DR drill** | **Critical (ops)** | 583 sessions / 466 reports of institutional data |
| 6 | **Publish gate enforces structure only.** An avatar can pass every gate while being diagnostically impossible (e.g. "recurrent MDD" with three weeks of symptoms and no prior episode) | **Critical (clinical)** | C-3 + C-4 |
| 7 | ~~**Governance ledger gap** — no RDL row for Phase 3 or Phase 4~~ | **Closed 2026-08-20** | RDL-034 (Phase 3 acceptance) and RDL-035 (Phase 4 authorization, scope closed) appended. Residual: `VP-CLIN-PROTOCOL` still unadopted (OD-1, blocked on OD-13), and the P0-1 executive brief still exists only in a conversation |
| 8 | **6 of 17 disorders have no clinical package** (`pdd`, `socialAnxiety`, `ocd`, `asd`, `schizoaffective`, `eating`) | High | Verified: 17 IDs, 11 packages |
| 9 | **Landing-page claims unsupported by data** (10,000+ sessions, 500+ cases, 95% satisfaction, three named testimonials) | **High (integrity)** | See C-1 — directly at odds with the no-fabrication discipline |
| 10 | ~~**Doc/code drift** in `CLAUDE.md` counts~~ | **Closed 2026-08-20** | Corrected to 724 tests / 88 files · 75 migrations · ~100 tables · 7 CI steps. Remaining drift is `CANONICAL_MIGRATION_LEDGER.md` (frozen at 54) |
| 11 | **Security residuals:** HIBP disabled · Upstash unconfirmed in prod · no vendor APM · no pen test | Medium | Cheap, named GA blockers |
| 12 | **Ops counts include admin-test sessions** (F-2) | Low | `phase14`/`phase16`/`cidp` run unfiltered `count` queries |
| 13 | **Dyad carry may select a prior admin-test session** (F-3); admin home badge (F-4) | Low | P2/P3 cleanups |
| 14 | **`VirtualPatientWizard` is 1,878 lines** | Low | Maintenance/review risk |
| 15 | **Unbounded prompt token growth** (RT-05) | High (runtime) | Open |

---

## 26. Open Questions

**Governance — 27 registered open decisions (13 P0 · 11 P1 · 2 P2 · 1 P3).** Full detail in
`docs/VPsych_PHASE4_OPEN_DECISIONS_REGISTER.md`. The ones that gate everything:

| ID | Question | Owner | Priority |
|---|---|---|---|
| **OD-13** | **Who is the Clinical Governance Lead?** | Joint Governance | **P0 — root of the graph** |
| **OD-1** | Adopt / reject / amend `VP-CLIN-PROTOCOL v1.0-draft` (incl. DEF-1 correction to §19.4) | Joint Governance | P0 |
| **OD-14** | Which avatar fields are *clinically material* for the content version hash, and what are its determinism guarantees? | CGL + Engineering | **P0 — the only decision gating a P0 software item** |
| OD-26 | Author the D1 diagnostic coherence checklist | CGL | P0 |
| OD-16/17/22/24 | Ratify reviewer qualifications · pass thresholds · adjudication model · publication authority | CGL / Joint Gov | P0 |
| OD-15 | Adopt a **clinical safety incident** procedure (distinct from operational incidents) | Joint Gov | P0 |
| OD-20/21 | Appoint Educational Reviewer · Psychometric Reviewer | CGL + Product / Joint Gov | P0 |
| OD-25 | Authorize retrospective analysis of the production corpus (aggregate-only, PHI-free) | Product + Sec/Gov + Legal | P0 |
| OD-27 | Which remediation shape for forged `admin_test`? | Engineering + Sec/Gov | P0 |
| OD-5 | Does a model/prompt/provider change invalidate every behavioural approval platform-wide? | CGL + Joint Gov | P1 — *most likely cause of mass re-review* |
| OD-18/19/7 | Appoint Arabic Clinical Reviewers · Voice Reviewer · ratify the Arabic opening prompt | CGL + Product | P1 |
| OD-9/OD-10 | **`[LEGAL-UNKNOWN]`** — obligations if scores become consequential; human-subjects obligations for analysing/publishing trainee data | Legal/Compliance | P1 — **must not be guessed** |
| OD-2/4/11/23 | Evidence retention period · conditional approval state · legacy grandfathering deadline · change-classification table | Product / Joint Gov / CGL | P1 |
| OD-3 | How does the Educational Reviewer obtain a report for domain E9, given admin tests produce none? | CGL + Product | P1 |
| OD-8/12 | Sequence the 6 unpackaged disorders · can D13 be validated without a medication model? | Joint Gov / CGL | P2 |
| OD-6 | Empirically calibrate the 24-month re-review interval and 20% adjudication trigger | CGL + Psychometrician | P3 — **genuinely unresolvable until the programme has run** |

**Pre-existing product decisions, still open:** **PD-1/PD-2** — may a *published* avatar be
admin-tested in place? · **PD-3** — retention policy for admin-test sessions and evidence packages.

**Business/product questions this consolidation could not answer from the repository:**
Are the landing pricing tiers a real business decision? Who is the buyer — individual trainee or
institution? Which institutions are the pilot targets? Is there a competitive landscape analysis?
What is the jurisdiction for the `[LEGAL-UNKNOWN]` items?

---

## 27. Current Priorities

**Phase 4 — "Validation Readiness."** Objective: make VPsych *capable of being validated* without
adding a single new user-facing feature. Scope is exactly five P0 items forming **one dependency
chain** — remove any one and the chain breaks.

```
C-9  governance ledger reconciled            → honest phase record
  │
C-2  transcripts become readable             → SHIPPED 2026-08-15 as P0-1 (#200)
  │
C-3  clinical review becomes enforced state  → needs OD-13/OD-24/OD-26
  │
C-1  scoring integrity restored (F-1/F-5)    → unblocks credible C-6/C-7
  │
C-5  reliability harness lands (CI-S05)      → unblocks C-6/C-7
```

**Also P0-2 (from the protocol's own derivation, which *raised* it from P1):** the **avatar content
version identifier** — a deterministic hash over clinically material fields. Without it, approvals
cannot be bound to what was approved and the entire change-control policy is unenforceable.

**Recommended decision sequence (from the register, unchanged and still correct):**
1. **OD-13 — appoint the CGL.** Nothing substitutes.
2. ~~**RDL-034** — record Phase 3 acceptance.~~ **Done 2026-08-20**, together with **RDL-035**
   (Phase 4 authorization, scope closed to the five P0 items + P0-2).
3. **OD-1** — adopt the protocol, incorporating DEF-1. **Still open**: it needs a CGL first, so it
   takes a later RDL row rather than the RDL-035 slot protocol §16.3 had planned for it.
4. **OD-14** — CGL + Engineering define version-identifier scope.
5. **Code may begin** on P0-2 (P0-1 is done).
6. **In parallel from step 1:** OD-21 + OD-25 to start **Track B**, which needs neither the CGL nor
   step 4.
7. **While code is written:** OD-16, OD-17, OD-22, OD-24, OD-26, OD-15, OD-20.

**Parallel ops track (must not be starved by the chain, and must not block it):** C-12 DR drill +
PITR · C-13 security residuals (HIBP, Upstash, APM).

---

## 28. Backlog / Future Ideas

**Phase 4.5 / 5:** C-4 clinical coherence validation (ship warnings-first) · C-6 retrospective
score analysis · C-7 blinded expert re-rating → first IRR · C-8 Arabic clinical + linguistic review
· C-10 ops filtering (F-2) · C-11 F-3/F-4 cleanups · C-14 author the 6 missing disorder packages
(after C-3/C-4 exist).

**Deferred with reasons:** C-15 turn-level realism auditor (needs a realism criterion first) ·
C-16 structured medication/substance model (CLIN-S3-04 — sequence after the review gate) ·
C-17 retention policy (**product decision, not engineering**) · `VirtualPatientWizard`
decomposition · ARCH-S2-01…07 · RT-01…12 · EDU-01…06 · SUP/ENT/RT-S11 debt.

**`[v1.1]` registry — 19 PRs, hard-gated until tag `v1.0.0`:** scientific indices #62–#67 ·
Quality Ledger #68 · Multi-Ledger #69 · enterprise compliance/DSAR #87 · multi-tenant #88 ·
DR & ops excellence #89 · HCE #91/#92/#96 · SEO #93 · AEO #94 · GEO #95 · brand & conversion #97 ·
assessment reliability #99. Suggested order: HCE #92→#91→#96 · scientific #62→…→#69 (+#99) ·
enterprise #87→#88 · discoverability #93→#94→#95→#97 · ops #89.

**Excellence stacks intentionally off `main`:** PME · TRE · HCTF · CQI · EOI · CVL · HFTE · VMHC.

---

## 29. Reusable Assets

| Asset | Where | Why it matters |
|---|---|---|
| **Architecture guardrail test pattern** | `src/lib/architecture.test.ts`, `admin-test-phase3c.architecture.test.ts`, `admin-test-transcript.architecture.test.ts` | Asserts invariants by reading source text. Load-bearing and cheap to extend. **If it fails, preserve the invariant — do not loosen the assertion** |
| **Release Decision Log** | `docs/RELEASE_DECISION_LOG.md` | Append-only governance trail; format + append procedure documented in-file |
| **Modular prompt engine** | `src/lib/ai/prompt-engine.ts` | Modules 1/2/2b/3/4 with explicit precedence and syndrome-authority resolution |
| **Persona authoring principles** | `personas/index.json` `_meta.authoring_principles` | The clearest statement of the bilingual authoring doctrine anywhere in the project |
| **Adversarial clinical examination method** | `personas/clinical-examination.json` `_meta.method` | A reusable 7-step attack protocol for auditing a new persona |
| **Validation protocol** | `docs/VPsych_PHASE4_VALIDATION_GOVERNANCE_AND_PROTOCOL.md` | 9 validation objects, 4 independence rules, domain batteries, thresholds. **Designed to be executable manually on day one** with a spreadsheet and a DB query |
| **Open decisions register format** | `docs/VPsych_PHASE4_OPEN_DECISIONS_REGISTER.md` | 12-field decision entries + dependency graph + gate matrix + owner summary |
| **Migration parity script** | `scripts/verify-migration-parity.mjs` | Filename/version integrity + optional remote parity via `SUPABASE_DB_URL` |
| **Credential Verification Gate** | `docs/RELEASE_OPERATIONS_CHECKLIST.md`, `scripts/rc3-credential-gate-preflight.mjs` | Binding preflight for every release |
| **Report-signing contract** | `supabase/migrations/20260730181421_harden_session_reports.sql` | HMAC-signed insert-once RPC pattern |
| **CIDP institutional package** | `docs/cidp/` | Role manuals (administrator/faculty/resident/research/IT), ops manual, pilot template — reusable for any institutional pilot |

---

## 30. Important Terminology

| Term | Meaning |
|---|---|
| **Avatar / Virtual Patient (VP)** | A `public.avatars` row, `schema_version = 2`; an authored *default* presentation, not a permanent disorder owner |
| **CaseInstance** | The immutable per-session case minted by `createCaseForSession()` |
| **`clinical_snapshot`** | Frozen per-session truth on `sessions`: case, human personality, `admin_test` marker |
| **ClinicalCore** | Language-neutral clinical record: disorder, DSM-5/ICD-10/ICD-11 codes, age, gender, severity, onset duration, symptom profile, disclosure rules, session goals, ideal approach, risk profile, protective factors, MSE, formulation |
| **Human Personality (Module 2b)** | Structured traits independent of GPT *and* of diagnosis |
| **`aiSource`** | `gpt` \| `gateway` \| `persona_fallback` — must reach the client |
| **Admin Test Conversation** | Admin-only QA session against a `testing` avatar: no assessment, no report, isolated from learner data |
| **Lifecycle (Option B)** | `draft → testing → published → archived`; `lifecycle_status` canonical, `is_active` projection |
| **CIDP** | Controlled Institutional Deployment — governed Limited Institutional Production, **not GA** |
| **RDL-0NN** | A row in the append-only Release Decision Log |
| **Evidence Pending** | The mandatory display state where real evidence does not exist. Never fabricate |
| **`[GOV]`** | A protocol rule adopted by decision, not compelled by law — unratified until an RDL adopts it |
| **`[LEGAL-UNKNOWN]`** | A question requiring counsel; **must not be guessed** |
| **CGL / CR / ACR / ER / PR / VR / ADJ** | Clinical Governance Lead · Clinical Reviewer · Arabic Clinical Reviewer · Educational Reviewer · Psychometric Reviewer · Voice Reviewer · Adjudicator — **all UNFILLED** |
| **Track A / Track B** | Avatar validation (needs clinicians) / Assessment validation (needs one psychometrician + the existing corpus) |
| **V0–V6** | Protocol governance states overlaying the software lifecycle; V-LEGACY = grandfathered published avatars |
| **P0-1 / P0-2** | Admin Test transcript surface (**shipped**) / avatar content version identifier (**not started**) |
| **F-1 … F-5** | Readiness-assessment findings: forged `admin_test` · unfiltered ops counts · dyad carry leak · admin home badge · contract ambiguity |
| **C-1 … C-17** | Phase 4 candidate work items |
| **OD-1 … OD-27** | Open governance decisions |
| **PD-1/2/3** | Product decisions: published-avatar testing (×2) · retention |
| **Persona fallback** | Heuristic reply when no model key is configured — **never a model reply** |
| **Mission Omega** | The 2026-08-06 release-engineering mission that produced the Limited Professional Preview baseline |

---

## 31. Current State of the Project

```
REPO / BRANCH        alhazayed/vpsych @ 1a83424 (≡ origin/main), clean tree
VERSION              1.0.0-rc.1
PRODUCTION           https://vpsych.vercel.app · Supabase rrzudbkxigeavfdnidnm (ACTIVE_HEALTHY)
DEPLOYMENT POSTURE   CIDP (Controlled Institutional Deployment) — GA refused (RDL-032, RDL-033)

CODE                 668 TS/TSX · 71 API routes · 33 auth pages · 75 migrations · ~80 tables
TESTS                724 passing / 88 files
CI (7 steps)         audit:deps → lint → typecheck → test → test:migrations → perf-smoke → build
I18N                 1085 / 1085 en/ar parity

LIVE DATA (approx)   5 avatars · 11 profiles · 584 sessions · 3730+ messages · 466 reports
                     401+ case instances · 17 disorders (11 packaged) · 5 seed institutions
                     0 institution memberships · 0 registered pilots

TECHNICAL READINESS  PASS
SECURITY             PASS (residuals: HIBP · Upstash · APM · pen test · DR drill)
CLINICAL READINESS   FAIL — no evidence
EDUCATIONAL READINESS FAIL — no evidence
GOVERNANCE           PARTIAL — RDL-034/035 appended 2026-08-20; protocol still unadopted (OD-1)

PHASE 3              COMPLETE and independently re-verified · ACCEPTED by RDL-034
PHASE 4              IN PROGRESS — P0-1 shipped (#200, 2026-08-15); governance corpus landed (#201)
                     P0-2 not started · C-1/C-3/C-5/C-9 not started
PROTOCOL             VP-CLIN-PROTOCOL v1.0-draft — PROPOSED, NOT ADOPTED
REVIEWERS            NONE IDENTIFIED (all 10 roles)
OPEN DECISIONS       27 (13 P0)
LAST RDL ROW         RDL-035 (2026-08-20)
```

---

## 32. Recommended Next Steps

Ordered by leverage. Steps 1–4 are not engineering, and that is the point.

1. **Appoint the Clinical Governance Lead (OD-13).** Root of the dependency graph; converts 15 of
   27 decisions from unownable to actionable. No other party can make this decision.
2. ~~**Append RDL-034 and RDL-035.**~~ **Done 2026-08-20.** RDL-035 retroactively ratifies P0-1,
   records that it shipped ahead of its ledger row, and states that no further Phase 4 code may.
   Still outstanding from this thread: **commit the P0-1 executive decision brief** if it survives
   in a conversation — it remains the only authorization artifact that is not in version control.
3. **Start Track B in parallel** — it needs no CGL: appoint a psychometrician (OD-21) and authorize
   the corpus analysis (OD-25, aggregate-only/PHI-free/admin-boundary/no narrative export). Two
   decisions and one appointment stand between the project and its first real evidence.
4. **Resolve the landing-page integrity issue** (§17, C-1) — decide whether to replace the
   fabricated statistics and testimonials with real numbers, remove them, or mark them
   illustrative. This is cheap, and it is inconsistent with the project's own evidence discipline
   for it to remain.
5. **Resolve F-5 in writing**, then choose the OD-27 remediation shape (the snapshot-constraining
   trigger/RPC is the only one that closes the vector rather than the symptom, and it also covers
   the `is_active` and rate-limit bypass on direct INSERT).
6. ~~**Land C-9 doc refresh**~~ — **done 2026-08-20**: `CLAUDE.md` now reads 724 tests / 88 files
   · 75 migrations · ~100 tables · seven CI steps, and the two `TECHNICAL_DEBT.md` drift rows are
   closed, and **RDL-034/035 are appended**. The only C-9 remainder is to mark
   `CANONICAL_MIGRATION_LEDGER.md` superseded.
7. **Schedule the DR drill + PITR restore (C-12) and close security residuals (C-13)** on the ops
   track. Independent of the Phase 4 chain — must neither block it nor be starved by it.
8. **Then, and only then, build P0-2** (version identifier) once OD-14 defines materiality.
9. **Write down the business context that does not exist in the repo:** buyer, pricing intent,
   pilot targets, competitive landscape, jurisdiction. Every one of these is currently
   unrecoverable from the repository alone.

---

# DECISION LOG

Compact, cross-cutting. `RDL-0NN` = row in `docs/RELEASE_DECISION_LOG.md` (the authoritative
append-only ledger); other sources are commits, PRs, or documents. **Status** uses the
classification vocabulary from the top of this file.

| Area | Decision | Status | Reason | Supersedes | Source / Context |
|---|---|---|---|---|---|
| Product | Trainee runs a session vs an AI standardized patient; report is **admin-only** | CONFIRMED | Prevents gaming and keeps feedback in a supervised frame | — | `README.md`, RLS `is_admin()` |
| Product | Sessions hard-cap at 40 min server-side | CONFIRMED | Bounded cost + bounded assessment window | — | `MAX_SESSION_SECONDS`, `lib/types.ts` |
| Clinical | **A persona never permanently owns a disorder**; case minted per session | CONFIRMED | Trainees must not memorise "avatar = diagnosis" | — | Case Engine, `clinical_snapshot`, guardrail test |
| Clinical | Locale affects speech/culture only, never diagnosis | CONFIRMED | Clinical equivalence across locales | — | `resolve.ts`, verified in Phase 4 assessment |
| Clinical | Personalities natively authored per locale; **never machine-translated** | CONFIRMED | Translated distress idioms are clinically wrong | — | `personas/index.json` authoring principles |
| Clinical | Human personality modelled independently of GPT and of diagnosis (Module 2b) | CONFIRMED | Two patients with one disorder must feel like different people | — | `lib/personality-engine`, `HUMAN_PERSONALITY_ENGINE.md` |
| Clinical | Module 4 (Safety) overrides Modules 1–3; Module 1 overrides Module 2 on current state | CONFIRMED | Safety must not be negotiable; syndrome authority resolves persona/diagnosis conflict | — | `prompt-engine.ts` |
| Clinical | Persona library passed an adversarial DSM-5-TR/ICD-11 examination (4 personas, 14 defects repaired, >9.5/10 bar) | CONFIRMED *as a record*; examiner identity **UNCERTAIN** | Diagnoses had to survive hostile re-interrogation | — | `personas/clinical-examination.json` (2026-08-02) |
| Architecture | Seven stacked engines; none replaced an earlier API | CONFIRMED | Additive evolution; no rewrites | — | `ARCHITECTURE_STATE.md` |
| Architecture | Education/Validation/Supervisor/Enterprise/Realtime/Ops **never write patient mind** | CONFIRMED | Ownership separation; prevents cognition drift | — | Stage 2 ownership matrix |
| Architecture | ACE/CGE are best-effort, non-blocking | CONFIRMED | A missing engine table must never block a report | — | `runAceAfterAssessment` |
| Architecture | `lib/cge/index.ts` must not re-export `./ace-bridge` | CONFIRMED | Prevents an ACE↔CGE import cycle | — | `architecture.test.ts` |
| Architecture | `messageRpcClient(userClient)` over hard-requiring a service role | CONFIRMED | Hard requirement caused a production outage | Hard service-role requirement | `FUNCTIONAL_CERTIFICATION.md`, guardrail test |
| Architecture | Route Handler shape: auth → rate limit → validate → work → sanitized JSON | CONFIRMED | Uniform security posture | — | `CLAUDE.md`, all 71 routes |
| Architecture | No WebRTC/SFU media plane in v1 | REJECTED for v1 | Intentional HTTPS path | — | RT-S11-06 |
| Architecture | Realtime layer status | **UNCERTAIN** | `FEATURE_INVENTORY` says "Deprecated/unused"; `ARCHITECTURE_STATE` lists Stage 11 as a production layer | — | See CONTRADICTIONS C-6 |
| Admin UX | **Lifecycle Option B** — `lifecycle_status` canonical, `is_active` projection | CONFIRMED | One canonical admin state; RLS keeps a simple boolean | `is_active`-primary model | `PHASE3B_LIFECYCLE_RECONCILIATION.md`, `c69b067` |
| Admin UX | Published avatars are immutable; correction = duplicate → edit → publish → archive | CONFIRMED | Approvals must bind to unchanged content | — | Phase 3B |
| Admin UX | DEACTIVATE ≡ ARCHIVE (no separate deactivated state) | CONFIRMED | Two withdrawal concepts confuse admins | Separate deactivate state | Phase 3B |
| Admin UX | Admin Test Conversations reuse the real session engine, skip assessment, create no report | CONFIRMED | One engine; isolation from learner data | Second QA engine | Phase 3C, `#195` |
| Admin UX | Admin test is `testing`-lifecycle only | WORKING ASSUMPTION | MVP constraint; PD-1/PD-2 remain open | — | Phase 3C, UX-3 |
| Admin UX | Admin test transcripts readable at `/admin/test-sessions/[sessionId]` | CONFIRMED (shipped 2026-08-15) | Transcript was persisted then orphaned — QA impossible | Orphaned-transcript state | P0-1, PR #200 |
| Admin UX | P0-1 ships **no** verdicts, ratings, approve/reject or reviewer comments | CONFIRMED | Those depend on OD-17/22/24/26, all unresolved, all CGL-owned | — | P0-1 record §8 |
| AI | Single provider decision point; `gpt-5` default; gateway alternative | CONFIRMED | One place to reason about model choice | — | `lib/ai/provider.ts` |
| AI | No key ⇒ persona fallback rather than error; `aiSource` always surfaced | CONFIRMED | Degrade gracefully, but never disguise a fallback as a model reply | — | `CLAUDE.md`, protocol Rule 6.5.1 |
| AI | Canonical score = private `weightedOverall()`; do not fork a second copy | CONFIRMED | One formula, one source of truth | — | `lib/ai/assessment.ts` |
| AI | The 11 dimensions and their weights | WORKING ASSUMPTION | **Hand-assigned, no documented derivation** — no weighting exercise, no factor analysis | — | `assessment.ts:50–60` |
| Security | Reports insert-once, HMAC-signed, admin-read-only | CONFIRMED | Tamper resistance + role separation | — | `create_session_report` |
| Security | Assistant/system messages only via SECURITY DEFINER RPC | CONFIRMED | RLS cannot express turn-order/ownership re-checks | Direct client insert | `harden_session_reports.sql` |
| Security | Roles in `profiles.role`, never `user_metadata` | CONFIRMED | `user_metadata` is client-writable | — | `SECURITY_MODEL.md` |
| Security | New RLS policies wrap `auth.uid()`/`is_admin()` in `(select …)` | CONFIRMED | Per-statement not per-row evaluation | — | `20260731110213…` |
| Security | Every handler rate-limits before work | CONFIRMED | Cost + abuse control | — | `lib/rate-limit.ts` |
| Security | `*.vpsych.test` demo accounts banned | CONFIRMED | Live-access risk | Demo accounts | security-hardening migration |
| Security | Forged `admin_test` fixed **inside** Phase 4, not as a hotfix | CONFIRMED | NON-BLOCKING; a hotfix to a production-verified path is riskier than the defect | Emergency hotfix | Readiness §17 |
| Security | Which remediation shape for the forged marker | **OPEN (OD-27)** | Trigger/RPC constraint is the only one closing the vector, but it needs a migration | — | Register OD-27 |
| Validation | Nine validation objects (A–I) must not collapse into one "quality score" | PROPOSED (protocol not adopted) | A strong result in one object would mask failure in another | Single quality score | Protocol §3 |
| Validation | Safety is **non-compensatory** (R-1) | PROPOSED | A safety failure cannot be offset by excellence elsewhere | Compensatory scoring | Protocol §3.1 |
| Validation | Realism ≠ educational usefulness (R-2) | PROPOSED | A patient who discloses everything immediately teaches no elicitation | — | Protocol §3.1 |
| Validation | English validation never transfers to Arabic (R-3) | PROPOSED | EN-biased heuristics make disparity likely | Delta review | Protocol §3.1 |
| Validation | E/F (assessment validity + reliability) are platform-level, not per-avatar (R-4) | PROPOSED | The instrument is validated once, re-validated on rubric change | — | Protocol §3.1 |
| Validation | **No majority voting** on split verdicts; adjudicator decides on reasoning | PROPOSED (OD-22) | Majority voting could outvote a critical safety failure | 2-of-3 majority | Protocol §9.5.1 |
| Validation | Engineering must not author clinical rules | PROPOSED, and already respected in practice | Converting an engineer's assumption into an enforced constraint makes it harder to question | Engineering-authored coherence rules | Protocol §1 |
| Validation | P0-2 (version identifier) raised **P1 → P0** | PROPOSED | Evidence integrity depends on it from the first approval | Suggested P1 ordering | Protocol §17.6 |
| Validation | Forged-marker hardening reclassified as **Track B P0**, not Track A blocker | PROPOSED | Avatar validation does not depend on learner scoring integrity | Suggested "P0 overall" | Protocol §17.6 |
| Validation | Protocol is executable manually on day one | PROPOSED (design requirement) | *"A validation programme that cannot start until its tooling ships is one that does not start"* | Tooling-first | Protocol §1 |
| Governance | Adopt three-role release model (Release Manager / certification agent / Executive Board) | CONFIRMED | RDL-005 | — | RDL-005 |
| Governance | **Credential Verification Gate** binding on every release | CONFIRMED | Three certification stalls caused by credential misconfiguration, not code | Ad-hoc credential checks | RDL-009 |
| Governance | Long-term Release Governance policy | CONFIRMED | Policy vs runbook separation | — | RDL-010 |
| Governance | Certify **production only**, never preview deploys | CONFIRMED | Deployment drift wasted three Wave 2 cycles | Preview-based certification | RDL-015/017/018 |
| Governance | RC1 approved; RC2 approved; migration parity reconciled (54≡54, later 61≡61) | CONFIRMED | Git must be canonical with production | — | RDL-001/002/003 |
| Governance | Wave 1 CERTIFIED-with-recommendations; Wave 2 PASSED after deploy; Wave 3 PASSED after H5 | CONFIRMED | Independent board evidence | Earlier FAILs | RDL-012/019/024/025 |
| Governance | Mission Omega = **Limited Professional Preview**, not expert clinical validation | CONFIRMED | Scores unvalidated; auth-gated smoke blocked | "Ready for expert clinical validation" | RDL-027 |
| Governance | `1.0.0-rc.1` authorized for **Limited Institutional Production**; NO-GO for GA marketing | CONFIRMED | Unvalidated scores; DR + APM residuals | — | RDL-028 |
| Governance | CIDP authorized and executing | CONFIRMED | Institutional pilots under governance | — | RDL-029/030 |
| Governance | Phase 14 ten-gate GA framework adopted; **GA NO-GO** | CONFIRMED | Gates unmet | — | RDL-031 |
| Governance | **Refuse `v1.0.0` GA** | CONFIRMED | DR/PITR drills, HIBP/APM/pen-test, empty pilot portfolio, incomplete validation packs | GA tagging | RDL-032 |
| Governance | Phase 16 = Evidence-Pending-first; **no fabrication** of pilots/drills/outcomes | CONFIRMED | Empty registry ≠ fabricated registry | Fabricated placeholders | RDL-033 |
| Governance | Phase 3 acceptance recorded in the ledger | **CONFIRMED** (RDL-034, 2026-08-20) | Phase 3 had shipped to production and been called accepted with no row in the binding ledger | The unrecorded-acceptance state | RDL-034 · Readiness §9.3 |
| Governance | Phase 4 authorized, scope closed to five P0 items + P0-2 | **CONFIRMED** (RDL-035, 2026-08-20) | Retroactively ratifies P0-1, which shipped ahead of its ledger row; bars any further Phase 4 code from doing so; entry criteria §18.5–7 (reviewers) remain unmet, so mechanisms may be built but clinical validation may not be executed | The unauthorized-shipping state | RDL-035 |
| Governance | Protocol §19.4 under-specifies entry criteria (OD-1…OD-8 vs §20's OD-1…OD-12) | Recorded as defect **DEF-1**, not corrected | A register that silently edits its source is not a register | — | Register §1.3 · to be carried by the adoption row (OD-1) |
| Claims | Competency scores are **not validated** and must never be described as validated | CONFIRMED — standing, no exceptions | No derivation, no IRR, no criterion validity, no bias analysis | Any validation claim | `CLAUDE.md`, `KNOWN_LIMITATIONS.md`, every certification |
| Claims | Landing statistics + testimonials | **UNCERTAIN / flagged** | Unsupported by production data; contradicts the no-fabrication discipline | — | See CONTRADICTIONS C-1 |
| Business | Pricing tiers Free / $29 Professional / Custom Institution | **UNCERTAIN** | Present in shipped UI; **no billing, entitlement, or plan enforcement exists anywhere** | — | `messages/*.json`, `src/app/page.tsx` |
| Business | Institutional licensing as the commercial motion | WORKING ASSUMPTION | Weight of CIDP/enterprise/faculty artifacts points here | — | `docs/cidp/`, Stage 10 |
| Marketing | SEO/AEO/GEO/brand suites deferred to `[v1.1]` | CONFIRMED | Conversion surfaces after the core product is stable | Pre-v1.0 merge | `V1_1_BACKLOG.md` #93–#97 |
| Product | Retention policy (PD-3) | **REFUSED to invent — OPEN** | Product decision; engineering must not pre-empt it | — | Readiness §17 |
| Product | Six unpackaged disorders: author before or after exercising the protocol | **OPEN (OD-8)** | Authoring first risks six avatars built against unproven criteria | — | Register OD-8 |
| Legal | Consequential-score obligations; human-subjects obligations | **OPEN `[LEGAL-UNKNOWN]`** (OD-9/OD-10) | No regulatory analysis exists; **must not be guessed** | — | Protocol §2.3 |

---

# CONTRADICTIONS / ITEMS REQUIRING CONFIRMATION

Ten meaningful conflicts. For each: the two versions, which appears newer, my reading, confidence,
and whether you must resolve it manually.

---

### C-1 · Landing-page claims vs actual data and the no-fabrication rule — **RESOLVE MANUALLY**

- **Version A (shipped, `src/app/page.tsx` + `messages/{en,ar}.json`):** headline statistics
  **"10,000+ Practice Sessions · 500+ AI Patient Cases · 25+ Clinical Competencies · 95% User
  Satisfaction"**, and three named testimonials ("Dr. Sarah Khalil, Senior Psychiatrist"; "Dr. James
  Wilson, Clinical Psychologist"; "Layla Ahmed, Medical Resident"). Feature copy promises
  *"Instant scoring on empathy, verbal reflections, and adherence to therapeutic modalities."*
- **Version B (governance, everywhere):** production holds ~584 sessions, **5 avatars**, 11
  profiles, and **no satisfaction survey data at all**; RDL-033 mandates that pilots, drills and
  outcomes are never fabricated and that missing evidence shows **"Evidence Pending"**;
  `CLAUDE.md` and `KNOWN_LIMITATIONS.md` forbid implying that scores are validated.
- **Newer:** Version B is continuously reaffirmed through 2026-08-15; the landing copy has been
  present since early and is flagged in `TECHNICAL_DEBT.md` as *"Landing marketing stats — Medium —
  Honesty risk for preview."*
- **My reading:** the marketing copy is template/placeholder content that was never reconciled with
  the project's own evidence discipline. The statistics overstate real usage by roughly 17× on
  sessions and 100× on cases; the testimonials appear to be invented personas presented as real
  practitioners. **This is the single highest-reputational-risk item in the repository**, precisely
  because everything else in the project refuses to fabricate.
- **Confidence:** High that the numbers are unsupported. **Low** on intent — I cannot tell whether
  they were placeholders awaiting real data or a deliberate positioning choice.
- **You must decide:** remove, replace with real figures, or explicitly mark as illustrative.

---

### C-2 · Pricing exists in the UI but nowhere in the system — **RESOLVE MANUALLY**

- **Version A:** a full pricing section ships publicly — Free $0, Professional **$29/mo** ("Most
  Popular"), Institution "Custom" with a "Contact Sales" CTA.
- **Version B:** no billing provider, no subscription/entitlement tables, no plan checks, no usage
  metering, no `/contact` destination, and no document anywhere discussing revenue or pricing
  rationale.
- **Sub-conflict, and it is a real one:** the Professional tier advertises **"Full performance
  reports"** to the paying trainee, which directly contradicts the CONFIRMED, RLS-enforced rule
  that reports are admin-only and never exposed on a therapist-facing API.
- **Newer:** indeterminate — both states have coexisted since the landing page shipped.
- **My reading:** placeholder marketing scaffolding, not a ratified business model. The
  "Full performance reports" line is the strongest evidence for this: no one who understood the
  admin-only invariant would have written it as a paid feature.
- **Confidence:** Medium-high that it is placeholder. **The intended business model is genuinely
  unrecoverable from the repository.**

---

### C-3 · `CLAUDE.md` counts vs reality — **RESOLVED 2026-08-20**

- **Version A (`CLAUDE.md`, until 2026-08-20):** "~317 tests / 55 files", "61 migrations",
  "~80 tables", CI runs **five** steps.
- **Version B (measured):** **724 tests / 88 files** (suite run, all passing) · **75 migrations** ·
  **~100 tables** created across migrations · CI runs **seven** steps (`audit:deps` and
  `test:perf-smoke` were added at Stage 12).
- **Resolution:** `CLAUDE.md` was corrected to Version B, and the two `TECHNICAL_DEBT.md`
  documentation-drift rows were closed. No further action.
- **Correction to an earlier reading in this document:** `TECHNICAL_DEBT.md` records that
  `CLAUDE.md` "references `weightedOverallScore` / `reliability.ts` / `test:reliability` /
  `calibration/`" as though they were presented as available. It does not — it names them
  explicitly as **not shipped on main**, which is accurate. That debt row was itself stale and has
  been marked not-a-defect.
- **Confidence:** Very high — re-measured directly.

---

### C-4 · Migration count, three different answers — **resolve with C-9**

`CANONICAL_MIGRATION_LEDGER.md` = 54 (frozen) · `CLAUDE.md` = 61 · `TECHNICAL_DEBT.md` = 66 ·
Phase 4 assessment = 75 · **measured today = 75**. Newest and measured agree. The ledger and the
two docs are stale snapshots, not disagreements about fact. **Confidence: very high.**

---

### C-5 · "No clinical expert review has ever happened" vs the persona examination record — **RESOLVE MANUALLY**

- **Version A (Phase 4 readiness assessment, 2026-08-15):** *"No clinical expert review record.
  Nothing in schema or code captures who reviewed an avatar clinically, when, or with what
  verdict"*; the publish gate can pass an avatar that *"any clinician has ever read"* — never.
- **Version B (`personas/clinical-examination.json`, 2026-08-02):** a detailed adversarial
  examination of all four personas by an examiner described as *"Board-certified psychiatrist,
  acting as hostile board examiner"*, with a criterion-by-criterion DSM-5-TR attack, ICD-11
  verification, timeline/arithmetic/cross-locale audits, 14 defects found and repaired, and a
  stated >9.5/10 approval bar.
- **Newer:** Version A.
- **My reading:** both are true at different scopes and do not actually collide. A **one-off
  document-level examination of the persona JSON library** exists; a **systematic, schema-recorded,
  named-reviewer sign-off gate on `avatars` rows** does not. The examination also covered 4 persona
  files, while production now carries 5 avatars.
- **The genuine uncertainty:** the repository never says whether that "board-certified psychiatrist"
  was a **human clinician** or an **AI acting in the role**. That distinction matters enormously
  for what the record is worth as evidence. **Only you can answer it.**
- **Confidence:** High on the reconciliation; **very low** on the examiner's identity.

---

### C-6 · Realtime layer: production or deprecated? — **worth one line of confirmation**

- **Version A (`FEATURE_INVENTORY.md`, Mission Omega):** *"Realtime | Deprecated / unused | Not a
  product path."*
- **Version B (`ARCHITECTURE_STATE.md`, Stage 11/12; `CHANGELOG`):** Stage 11 Real-Time Clinical
  Simulation is an implemented production engine layer (`src/lib/realtime/`) with its own debt
  register (RT-S11-01…06) and an SSE `/message/stream` path.
- **Newer:** Version B (Stage 11 merged 2026-08-07; feature inventory reflects the 2026-08-06 Omega
  baseline).
- **My reading:** the code exists and is wired, the *product surface* is flag-gated and effectively
  unused. "Deprecated" is the wrong word; "present but not a default product path" is right.
- **Confidence:** Medium-high.

---

### C-7 · Avatar count: 2 vs 5 — **resolved by recency, no action**

`ARCHITECTURE_STATE.md` (2026-08-07) reports 2 avatars; Phase 3C-6 (2026-08-13) and Phase 4
(2026-08-15) report 5. Newer wins — the catalog grew. **Confidence: very high.**

---

### C-8 · Is the forged `admin_test` P1 blocking? — **already reconciled, keep the nuance**

- **Version A (readiness assessment):** NON-BLOCKING for Phase 4 entry; **BLOCKING the moment
  scores carry consequence**; fix early inside Phase 4 as C-1.
- **Version B (protocol §17.6):** not a Track A blocker at all; **P0 for Track B**, because a score
  that can be evaded cannot be meaningfully analysed.
- **Newer:** B (same day, derived from A).
- **My reading:** consistent, not contradictory — A is about *phase entry*, B is about *which
  track*. Combined rule: **it does not block avatar validation; it blocks credible assessment
  analysis, and it is live in production meanwhile.** **Confidence: high.**

---

### C-9 · F-5: the Phase 3C contract contradicts the shipped behaviour — **RESOLVE MANUALLY (in writing)**

The Phase 3C contract §5.2 says *"do not skip"* for a forged marker; the implemented rule returns
**403** after the session status has already been closed. Both the readiness assessment and OD-27
insist this ambiguity be **resolved in writing before the fix is designed** — *"designing a fix
against an ambiguous contract reproduces the ambiguity."* **Confidence: high that it is unresolved.**

---

### C-10 · Phase 4 P0-1 shipped under an authorization that does not exist in the repository — **RESOLVE MANUALLY**

- **Version A:** PR #200 shipped the P0-1 transcript surface to `main` on 2026-08-15.
- **Version B:** the implementation record states plainly that its authorization message cited
  `docs/VPsych_PHASE4_EXECUTIVE_DECISION_BRIEF.md`, that this brief *"was delivered in conversation
  and was never written to the repository, so it does not exist as a file"*, and that the two
  Phase 4 governance documents were used instead. At the time, the RDL — named as binding by
  `RELEASE_GOVERNANCE.md` — had **no row for Phase 3 or Phase 4**.
- **My reading:** this is the exact failure mode this consolidation exists to prevent. Code shipped
  under an authorizing document that lives only in a chat transcript. The governance gap is
  therefore **larger** than the readiness assessment described, because at that time no Phase 4
  code had shipped yet.
- **Status:** **Partly resolved 2026-08-20.** RDL-034 and RDL-035 are appended; RDL-035 records
  the out-of-order shipping explicitly and bars its repetition. **Still open:** the executive
  decision brief itself is not in version control. If it survives in a conversation, commit it.
- **Confidence:** Very high (self-documented).

---

# DO NOT LOSE

Erring toward preservation. Everything here would be expensive or impossible to rediscover.

### D-1 · The decision brief that exists only in a conversation
`docs/VPsych_PHASE4_P0_1_ADMIN_TEST_TRANSCRIPT_IMPLEMENTATION.md` records that
`VPsych_PHASE4_EXECUTIVE_DECISION_BRIEF.md` was *delivered in conversation and never written to the
repository*. **If you still have that chat, extract the brief and commit it.** It is the only
authorization artifact for shipped Phase 4 code, and it is one archive action away from being lost.

### D-2 · Why the persona/diagnosis split exists
A persona never owns a disorder because trainees would otherwise memorise "Maya = MDD" and stop
examining. The consequence lives on in the prompt engine's **syndrome authority** block: personas
were authored around one disorder, the case engine now mints others onto them, so Module 1 must
explicitly override Module 2's *current-state* narrative (mania minted onto an MDD-flavoured
persona) while keeping Module 2's identity. Delete that block and patients become incoherent in
exactly the cases hardest to notice.

### D-3 · Why the service-role client is not hard-required
Hard-failing on an unset `SUPABASE_SERVICE_ROLE_KEY` **caused a production outage**. The RPCs
enforce authorization themselves, so `messageRpcClient(userClient)` prefers the service role when
configured and falls back to the authenticated client. `architecture.test.ts` guards the
regression. Do not "tighten" this.

### D-4 · A grant-only migration restore is not a restore
W1-C1: `insert_system_message` / `insert_assistant_message` bodies stayed service_role-only after a
grant-only restore, and session create started 500ing in production. Function **bodies and
ownership/auth** must be restored, not only grants. Fixed by
`20260805130453_restore_session_message_rpc_owner_auth`.

### D-5 · Three certification stalls were credentials, not code
Placeholder secrets whose values equalled their own key names → therapist/admin emails swapped
across role env vars → passwords invalid for both accounts. Three full board cycles lost. The
answer is the **Credential Verification Gate** (RDL-009): prove `email_matches_expected` and
`login_success` for both roles, manually, in a browser, before dispatching any certification agent.
Binding on every release, forever.

### D-6 · Certify production, never preview
Wave 2 failed three consecutive times (RDL-014/015/017) because remediation PRs were merged to a
branch but never promoted. The board was right to refuse. **Deployment drift is the most expensive
recurring failure in this project's history.**

### D-7 · The reason majority voting was rejected
2-of-3 majority voting is the intuitive default and the protocol explicitly rejects it: majority
voting would let a **critical safety failure be outvoted**, which makes the non-compensatory safety
rule meaningless. *"An avatar that is superb in fifteen domains and mishandles disclosed suicidal
intent is not an 85% avatar, it is a failed one."* This will be argued the first time a split
verdict costs a release — the reasoning must survive.

### D-8 · Why engineering must not author the clinical rules
*"Engineering can enforce a clinical standard; it cannot author one."* A rule like "recurrent MDD
requires ≥2 discrete episodes separated by ≥2 months of remission" is a clinical assertion. Writing
it in code converts an engineer's assumption into an enforced constraint **and makes it harder to
question**. This is the central purpose statement of the entire validation protocol.

### D-9 · The worked example that motivates coherence validation
An avatar can pass **every** current publish gate while describing a 19-year-old with **three weeks**
of symptoms labelled *"Major Depressive Disorder, recurrent episode"* — diagnostically impossible.
Nothing catches it. Keep this example; it explains C-4 to any audience in one sentence.

### D-10 · Withdrawal is deliberately easier than publication
Protocol Rule 10.3.1: any CR, ER, CGL or admin may withdraw an avatar immediately and unilaterally,
while publication requires non-delegable CGL approval. The asymmetry is intentional — the cost of a
wrongly withdrawn avatar is inconvenience; the cost of a wrongly retained unsafe one is harm.

### D-11 · The model-change landmine (OD-5)
Rule 12.7.2 would invalidate the **behavioural half of every approval platform-wide** whenever the
model, provider, or prompt engine changes. With `gpt-5` as default and provider-side changes
possible without notice, **every behavioural approval could silently invalidate**, and a programme
with 7–9 part-time reviewers cannot absorb an unplanned full re-review. This is the most likely
cause of mass re-review on the platform and it has no phasing policy.

### D-12 · Track B is the hedge, and it is cheap
Track B (assessment validation) needs **one psychometrician**, no clinical reviewers, no new
sessions, and no production change — it runs against the existing ~584-session / 466-report corpus.
Two decisions (OD-21, OD-25) stand between the project and its first real evidence. Do not sequence
it behind Track A out of habit; it has no dependency on the CGL.

### D-13 · The forged `admin_test` chain, precisely
`sessions` INSERT RLS (`20260803021426…:40`) checks only `therapist_id = (SELECT auth.uid())` and
**places no constraint on `clinical_snapshot`**. A therapist can direct-INSERT
`clinical_snapshot.admin_test = true` via the browser Supabase client, bypassing `POST /api/sessions`
entirely; `end/route.ts` closes status **first**, then denies with 403 — leaving a permanently
`completed`, permanently unassessed session that is also hidden from the learner's own history, with
no recovery path. Direct INSERT **also** bypasses the `is_active` avatar check and the `start` rate
limit. Only the **trigger/RPC snapshot constraint** remediation closes the vector rather than the
symptom. They gain no success response and every attempt fires
`admin.avatar.test_session.forged_skip_denied`.

### D-14 · Isolation was specified; QA was not
Phase 3C built exactly what its contract asked for and the transcript still ended up orphaned:
`/sessions/[id]` → `/complete` → `/admin/avatars/[id]`, and `/admin/reports/[id]` requires a
`session_reports` row admin tests deliberately never create. **The feature that exists to qualify
avatars could not display the evidence it generates.** Specify the use, not only the containment.

### D-15 · A bad reliability result is a good outcome
Risk R-4, pre-committed: if C-5/C-6 show poor reliability, that is a **successful** result and must
be reported. The honesty discipline extends to unfavourable findings. This has to be agreed
*before* the numbers exist, not after.

### D-16 · Do not build mechanisms without operators
*"That would produce a clinical review gate with no reviewer, a coherence validator with no clinical
rules, and a reliability harness with no analyst — three mechanisms and zero evidence, which is
precisely the position the platform is in today."*

### D-17 · The persona authoring doctrine (`personas/index.json`)
Preserve verbatim in spirit:
- `clinical_core` is language-neutral — illness, criteria, trajectory and risk are identical across
  locales.
- Each personality is a **separate human being** authored natively — different name, family, city,
  faith, currency, clinics, idioms. Never a translation.
- Locale-appropriate substitution of a behaviour is **not** an inconsistency when the clinical
  function is identical (alcohol as a sleep aid in the US personality vs heavy nicotine, water-pipe,
  and non-prescribed pharmacy medication in the Jordanian one).
- **Every quantity a patient states is fixed** and must be identical in every session, in every
  language, to every therapist.
- Negative findings are encoded as deliberately as positive ones — *"the exclusions are what make
  the case examinable."*
- **Each case carries at least one item that is present but sub-threshold**, so a trainee who
  pattern-matches instead of examining gets it wrong.

### D-18 · The adversarial examination method (reusable)
Full re-interview of each persona against its own case file, in its own language · criterion-by-
criterion DSM-5-TR attack attempting to force the opposite conclusion from the encoded evidence ·
ICD-11 verification · timeline audit recomputing every dated event/age/duration against the
reference date · arithmetic audit (weights, percentages, relatives' ages, chronologies, financial
figures) · cross-locale parity audit for contradiction or **biographical leakage** · separately
scored risk/trauma/personality/psychosis/substance/sleep/family-history/cultural/emotional probes.

### D-19 · The Arabic opening prompt is provisional and was authored by a non-native speaker
`أهلاً، سعيد بحضورك اليوم. شو اللي جابك اليوم؟` — deliberately Levantine colloquial rather than MSA
to match the `ar-JO` register. The protocol states explicitly it **must not be treated as settled**
(OD-7) because register and dialect materially change first-turn behaviour, which is the clean test
of salience. The same caution applies to the Arabic UI strings added by P0-1.

### D-20 · Evidence Pending is a feature
An empty pilot registry, an empty evidence log, a gate that reads "Evidence Pending" — these are
**correct outputs**, not bugs to fill in. RDL-033 forbids fabricating pilots, drills, surveys or
outcomes. Any future contributor's instinct to "populate the dashboard" must be resisted.

### D-21 · What the Arabic risk actually is
Bilingual parity is a **core product claim** and is **entirely unexamined**. The scoring heuristics
were authored for English (EDU-02, SUP-02), which makes systematic disadvantage of Arabic sessions
**likely rather than merely unknown**. `pronunciation_ar` is a free-text prompt hint
(`"Levantine Arabic; soft consonants; measured cadence"`), not a phoneme control. The Arabic
Clinical Reviewer is described as the hardest role to fill, and AR12 (clinical equivalence) is the
only domain that tests whether the parity claim is true.

### D-22 · Load-bearing environment facts
`REPORT_WRITE_KEY` **must equal** the Postgres Vault secret `report_write_key`; the signed payload
is `${sessionId}\n${narrative}\n${scoresJson}\n${excerptsJson}` (HMAC-SHA256). With neither
`REPORT_WRITE_KEY` nor `SUPABASE_SERVICE_ROLE_KEY` set, **session end 500s**. TTS requires a valid
Production `sk_…` ElevenLabs key — a wrong key surfaces as 502/503 `TTS_CONFIG`, which cost a full
certification wave before it was recognised as ops, not code. Without Upstash, rate limiting is
in-memory and **not horizontally safe**.

### D-23 · Guardrail tests are the spec
`architecture.test.ts` and its siblings assert invariants by reading source text. When one fails,
**the invariant is the thing to preserve — do not loosen the assertion to make it pass.** They are
also honest about their limits: they are source-invariant assertions, not runtime HTTP tests, and
the repository has no request/component integration harness (`environment: node`, `.tsx` not unit
tested). Runtime verification of the P0-1 authorization layers remains outstanding.

### D-24 · The CGL owns 56% of the register
15 of 27 open decisions are owned or co-owned by a role that does not exist. Appointing the Clinical
Governance Lead does not unblock one decision — it converts **more than half the register** from
unownable to actionable. It is also the one decision nobody can make on the CGL's behalf, including
the decision of who the CGL should be.

### D-25 · What must never be claimed
No validated competency measurement · no high-stakes credentialing · no clinical decision support
for real patients · no guaranteed identical scores across models/providers · no expert
clinical-validation completion · no GA. `1.0.0-rc.1` is CIDP. Do not tag `v1.0.0`.

---

# VPSYCH ACTIVE CONTEXT — COMPRESSED

*Everything another session needs to work effectively right now. Nothing historical.*

**Identity.** VPsych — bilingual (EN/`ar-JO`) therapist-training platform. Trainee runs a voice/text
psychotherapy session vs an AI standardized patient → **admin-only** performance report.
Repo `alhazayed/vpsych` @ `1a83424` ≡ `origin/main`. Version `1.0.0-rc.1`. Prod
`vpsych.vercel.app` · Supabase `rrzudbkxigeavfdnidnm`.

**Stack.** Next.js 16 App Router · React 19 · TS strict · Tailwind v4 · Supabase (Auth/Postgres/RLS)
· OpenAI (`gpt-5` default) or Vercel AI Gateway · ElevenLabs TTS · next-intl · Vitest · Vercel.
668 TS files · 724 tests/88 files · 71 API routes · 75 migrations · i18n 1085/1085.
CI (7): `audit:deps → lint → typecheck → test → test:migrations → perf-smoke → build`.

**Architecture.** 7 stacked engines (Case · Scenario Template · Instructor Preset · ACE · CGE ·
Human Personality · Clinical Voice) + ~20 `lib/` subsystems (clinical-intelligence, education,
validation, supervisor, enterprise, realtime, ops, quality-ledger, scientific…).
Lifecycle: `POST /api/sessions` (mint case, strip forged marker, require `is_active`) →
`POST …/message` (Adaptation→resolve→LTM→Emotion→CBE→DecisionPlan→Humanization→reply, RPC insert) →
`POST …/end` (close → **admin-test gate** → assess → engines → signed report → ledger). Everything
after assess is best-effort soft-fail. Voice: STT → message → TTS; transcripts always server-side.

**Invariants — never break.**
- Persona never owns a disorder; case minted per session into `sessions.clinical_snapshot`.
- Locale = speech/culture only, never diagnosis. Personalities natively authored, never translated.
- Human personality (Module 2b) independent of GPT and of diagnosis.
- Prompt precedence: Module 4 Safety > Modules 1–3; Module 1 Clinical > Module 2 on current state.
- Reports admin-only, insert-once, HMAC-signed (`create_session_report`); therapist APIs never expose them.
- Assistant/system messages only via `insert_assistant_message`/`insert_system_message` RPCs.
- `messageRpcClient(userClient)` — never hard-require the service role (caused an outage).
- `lib/cge/index.ts` must not re-export `./ace-bridge`.
- ACE/CGE best-effort; never block report persistence.
- Route handler shape: auth → rate limit → validate → work → sanitized JSON.
- Lifecycle Option B: `lifecycle_status` canonical, `is_active` projection (`true` iff `published`);
  published = immutable (duplicate to edit); DEACTIVATE ≡ ARCHIVE.
- `aiSource` always surfaced; `persona_fallback` is never a model reply.
- Both `messages/en.json` and `messages/ar.json` get every new key.
- Never edit an applied migration; `YYYYMMDDHHMMSS_snake_case.sql`.
- **Scores are NOT validated — never state or imply otherwise.**
- **Never fabricate evidence.** Missing = "Evidence Pending". Empty pilot registry is correct.
- Guardrail tests (`architecture.test.ts` + siblings) are the spec — preserve the invariant, don't
  loosen the assertion.

**Current state.**
Technical PASS · Security PASS (residuals) · Clinical FAIL (no evidence) · Educational FAIL (no
evidence) · Governance PARTIAL (RDL-034/035 appended; protocol unadopted). GA refused ×3 — do **not**
tag `v1.0.0`. Live data ≈ 5 avatars · 11 profiles · 584 sessions · 466 reports · 17 disorders
(11 packaged) · 0 institution memberships · 0 pilots.

**Active work — Phase 4 "Validation Readiness"** (no new features, no new engines, no GA push):
- **Decision:** Phase 4 = 5 P0 items in one dependency chain. **Reason:** remove one and the chain
  breaks. **Current:** `C-9` governance reconciliation NOT DONE · `C-2` **SHIPPED** as P0-1
  (`/admin/test-sessions/[sessionId]`, PR #200) · `C-3` avatar clinical review + sign-off gate NOT
  STARTED · `C-1` close forged `admin_test` NOT STARTED · `C-5` reliability harness NOT STARTED.
- **Plus P0-2** avatar content version identifier (deterministic hash over clinically material
  fields) — NOT STARTED, **blocked on OD-14 → OD-13**.
- **Two tracks.** Track A (avatar validation) needs clinicians. **Track B (assessment validation)
  needs one psychometrician + the existing corpus and is NOT blocked on the CGL.**

**Binding constraint (not engineering).** All 10 reviewer roles UNFILLED. The **Clinical Governance
Lead (OD-13)** owns 15 of 27 open decisions and is the root of the dependency graph.
27 open decisions · 13 P0. Protocol `VP-CLIN-PROTOCOL v1.0-draft` is **PROPOSED, NOT ADOPTED**.

**Live defect (P1).** Forged `admin_test`: `sessions` INSERT RLS constrains only `therapist_id`, so
a therapist can direct-INSERT `clinical_snapshot.admin_test = true`, end, get 403 *after* status
closes, and permanently evade assessment (session also hidden from their history). Audited every
time; cannot forge a success response. **Non-blocking for Phase 4 entry; P0 for Track B.** Fix shape
= OD-27 (only the INSERT-trigger/RPC snapshot constraint closes the vector). **Resolve F-5 in
writing first** (3C contract §5.2 "do not skip" vs shipped 403).

**Counts (`CLAUDE.md` corrected 2026-08-20, trust it again).** 724 tests / 88 files ·
75 migrations · ~100 tables · 668 TS files · 71 API routes · 7 CI steps · i18n 1085/1085.
Still stale elsewhere: `CANONICAL_MIGRATION_LEDGER.md` frozen at 54. Canonical score is the private
`weightedOverall()` in `lib/ai/assessment.ts` (11 dims, weights sum 100, hand-assigned, **no
documented derivation**); the shared `reliability.ts` / `calibration/` harness is correctly
documented as **not on main**.

**Needs your decision, not mine.** Landing page ships unsupported stats (10,000+ sessions, 500+
cases, 95% satisfaction) and three named testimonials · pricing tiers ($0/$29/Custom) with no
billing anywhere, and the Pro tier advertises "full performance reports" which contradicts
admin-only reports · whether the 2026-08-02 persona examiner was a human psychiatrist or an AI ·
retention policy PD-3 · published-avatar testing PD-1/PD-2 · `[LEGAL-UNKNOWN]` OD-9/OD-10.

**Ops residuals (GA blockers, parallel track).** HIBP disabled · Upstash unconfirmed in prod · no
vendor APM · **backups never proven restorable, PITR never verified, DR drill never run** ·
no pen test.

**Next 4 actions.** 1) Appoint CGL (OD-13). 2) Start Track B: OD-21 + OD-25. 3) Fix landing-page
integrity (C-1 above). 4) Commit the P0-1 executive decision brief if it survives in a chat.
*(Done 2026-08-20: RDL-034 + RDL-035 appended; `CLAUDE.md` counts corrected.)*

---

# VPSYCH NEW CHAT BOOTSTRAP

*Paste at the start of a new chat. Everything below is verified as of 2026-08-20 @ `1a83424`.*

```
VPSYCH — PROJECT CONTEXT

WHAT IT IS
Bilingual (EN / ar-JO) therapist-training platform. A trainee runs a voice or text
psychotherapy session against an AI standardized patient; the platform then generates an
ADMIN-ONLY performance report. Repo: alhazayed/vpsych. Version 1.0.0-rc.1, deployed on
Vercel with Supabase. Posture: Controlled Institutional Deployment — NOT General
Availability. GA has been formally refused three times; do not tag v1.0.0.

STACK
Next.js 16 App Router · React 19 · TypeScript strict · Tailwind v4 · Supabase
(Auth + Postgres + RLS) · OpenAI (gpt-5 default) or Vercel AI Gateway · ElevenLabs TTS ·
next-intl · Vitest · Vercel. ~668 TS files, 724 tests/88 files, 71 API routes,
75 migrations, i18n parity 1085/1085. CI: audit:deps → lint → typecheck → test →
test:migrations → perf-smoke → build.

ARCHITECTURE
Seven stacked engines (Dynamic Clinical Case · Scenario Template · Instructor Preset ·
ACE · CGE · Human Personality · Clinical Voice) plus ~20 lib/ subsystems. Session flow:
POST /api/sessions (mint case) → POST …/message (patient reply via RPC) → POST …/end
(close → admin-test gate → assess → engines → HMAC-signed report). Everything after
assessment is best-effort soft-fail.

INVARIANTS — NEVER BREAK
· A persona never permanently owns a disorder; the case is minted fresh per session into
  sessions.clinical_snapshot.
· Locale affects speech and culture only, never diagnosis. Personalities are natively
  authored per locale and NEVER machine-translated.
· Human personality (prompt Module 2b) is independent of the LLM and of diagnosis.
· Prompt precedence: Module 4 Safety overrides Modules 1–3; Module 1 Clinical overrides
  Module 2 on current-state conflicts.
· Reports are admin-only, insert-once, HMAC-signed; never on a therapist-facing API.
· Assistant/system messages only via SECURITY DEFINER RPCs, never direct client insert.
· Use messageRpcClient(userClient); never hard-require the service role (past outage).
· ACE/CGE are best-effort and must never block a report from persisting.
· Avatar lifecycle Option B: lifecycle_status canonical, is_active is the projection
  (true iff published); published avatars are immutable; DEACTIVATE ≡ ARCHIVE.
· Route handlers: auth → rate limit → validate body → work → sanitized JSON.
· Every new i18n key goes into BOTH messages/en.json and messages/ar.json.
· Never edit an applied migration — add a new one.
· aiSource (gpt | gateway | persona_fallback) always reaches the client; a fallback reply
  is never presented as a model reply.
· COMPETENCY SCORES ARE NOT VALIDATED. Never state or imply otherwise anywhere.
· NEVER fabricate evidence. Missing evidence displays "Evidence Pending"; an empty pilot
  registry is correct, not a bug.
· src/lib/architecture.test.ts and its siblings assert invariants by reading source. If one
  fails, preserve the invariant — do not loosen the assertion.

CURRENT STATE
Technical PASS · Security PASS (residuals) · Clinical FAIL (no evidence) · Educational
FAIL (no evidence) · Governance PARTIAL (RDL-034/035 appended 2026-08-20; the validation
protocol is still unadopted because it needs a Clinical Governance Lead first).
Live: ~5 avatars, 584 sessions, 466 reports, 17 disorders (11 packaged), 0 institution
memberships, 0 registered pilots.

ACTIVE WORK — PHASE 4 "VALIDATION READINESS" (no new features, no new engines, no GA push)
Five P0 items in one dependency chain:
  C-9 governance reconciliation ......... NOT DONE
  C-2 admin test transcript surface ..... SHIPPED (P0-1, /admin/test-sessions/[id])
  C-3 avatar clinical review + sign-off . NOT STARTED (needs a Clinical Governance Lead)
  C-1 close forged admin_test (F-1/F-5) . NOT STARTED
  C-5 assessment reliability harness .... NOT STARTED
Plus P0-2 avatar content version identifier — blocked on decision OD-14, which needs OD-13.
Track A (avatar validation) needs clinicians. Track B (assessment validation) needs ONE
psychometrician plus the existing 584-session corpus and is NOT blocked on the CGL.

BINDING CONSTRAINT
It is not engineering. All ten reviewer roles are UNFILLED. The Clinical Governance Lead
(OD-13) owns 15 of 27 open governance decisions and roots the dependency graph. The
validation protocol (VP-CLIN-PROTOCOL v1.0-draft) is PROPOSED, NOT ADOPTED.

LIVE P1 DEFECT
Forged admin_test: sessions INSERT RLS constrains only therapist_id, so a therapist can
direct-INSERT clinical_snapshot.admin_test = true, end the session, receive 403 after the
status has already closed, and permanently evade assessment. Audited every time; cannot
forge a success response. Non-blocking for Phase 4 entry; P0 for Track B. Resolve contract
ambiguity F-5 in writing before designing the fix.

COUNTS
724 tests / 88 files · 75 migrations · ~100 tables · 668 TS files · 71 API routes ·
seven CI steps · i18n 1085/1085. CLAUDE.md was corrected to these on 2026-08-20.
docs/CANONICAL_MIGRATION_LEDGER.md is still frozen at 54 and should not be trusted.
The canonical score is the private weightedOverall() in lib/ai/assessment.ts:
11 dimensions, weights summing to 100, hand-assigned with no documented derivation.
The shared reliability.ts / calibration/ harness is not on main — that absence is
correctly documented, not hidden.

OPEN — MINE TO DECIDE, NOT YOURS TO ASSUME
Landing-page statistics and testimonials are unsupported by real data; pricing tiers exist
in the UI with no billing anywhere; retention policy (PD-3); published-avatar testing
(PD-1/PD-2); two [LEGAL-UNKNOWN] items (consequential scores, human-subjects obligations).
Do not invent answers to these — ask me.

HOW TO WORK WITH ME
· Verify against source, git, or a run command before asserting a fact; if code and docs
  disagree, code wins and the drift gets recorded.
· Label uncertainty explicitly rather than smoothing it over. Flag contradictions; do not
  resolve them on insufficient evidence.
· Do not expand scope. The P0 list is the scope; anything else needs a decision from me.
· Never fabricate evidence, pilots, drills, reviewers, or validation results.
· Governance decisions, clinical rules, retention, pricing and legal questions are mine —
  bring me the options and the trade-off, not a chosen answer.
· Full detail lives in docs/VPSYCH_MASTER_CONTEXT.md; the authoritative governance ledger
  is docs/RELEASE_DECISION_LOG.md.
```

---

# ARCHIVE RECOMMENDATIONS

**Scope caveat, stated plainly:** I could not read prior chat conversations — only the repository.
So this is a recommendation about **documents**, not about chats. If you also want chat-level
archive advice, the transcripts would need to be exported into the repo (or pasted) first.

**One overriding constraint before you move anything:** the Release Decision Log cites evidence by
path (`docs/rc3/…`, `docs/stage15/…`, PR links, deploy IDs). **Moving those files breaks an
append-only governance trail** — the thing whose whole value is that it still resolves years later.

**Recommended mechanism instead of moving files:** create `docs/INDEX.md` marking each document
`CURRENT` / `HISTORICAL — EVIDENCE` / `SUPERSEDED — DO NOT USE FOR CURRENT TRUTH`, and add a
one-line status banner at the top of superseded documents. That gets the token/attention benefit
without breaking a single citation. If you do prefer physical archiving, move only the `SUPERSEDED`
group and leave a stub at each original path.

### Keep immediately accessible — current truth

| Document | Why |
|---|---|
| `docs/VPSYCH_MASTER_CONTEXT.md` | This file |
| `CLAUDE.md` | First thing every session reads — counts corrected 2026-08-20 |
| `docs/RELEASE_DECISION_LOG.md` | Authoritative append-only governance ledger; RDL-001…033 |
| `docs/RELEASE_GOVERNANCE.md` · `RELEASE_OPERATIONS_CHECKLIST.md` | Binding policy + runbook, incl. the Credential Verification Gate |
| `docs/VPsych_PHASE4_READINESS_ASSESSMENT.md` | The most accurate single description of the current state |
| `docs/VPsych_PHASE4_VALIDATION_GOVERNANCE_AND_PROTOCOL.md` | The validation programme design (PROPOSED) |
| `docs/VPsych_PHASE4_OPEN_DECISIONS_REGISTER.md` | The 27 open decisions + dependency graph |
| `docs/VPsych_PHASE4_P0_1_ADMIN_TEST_TRANSCRIPT_IMPLEMENTATION.md` | Only record of shipped Phase 4 code |
| `docs/VPsych_VIRTUAL_PATIENT_CREATION_CONTRACT.md` + `PHASE3A_CONTRACT_AMENDMENT` + `PHASE3B_LIFECYCLE_RECONCILIATION` + `PHASE3B_PRODUCTION_ACCEPTANCE` + `PHASE3C_IMPLEMENTATION` + `PHASE3C6_FINAL_ARTIFACT_STATE` | The live avatar/lifecycle/admin-test contract |
| `docs/SOFTWARE_ARCHITECTURE.md` · `clinical/CLINICAL_DATA_MODEL.md` · `runtime/COGNITIVE_ARCHITECTURE.md` · `clinical-intelligence/README.md` + `IMPLEMENTATION.md` | Canonical Stage 2–6 architecture |
| The 7 engine docs + `THERAPY_ROOM_MODE.md` | Required reading before touching an engine |
| `docs/TECHNICAL_DEBT.md` · `KNOWN_LIMITATIONS.md` · `V1_1_BACKLOG.md` · `ARCHITECTURE_STATE.md` · `FEATURE_INVENTORY.md` | Live registries (counts stale — see C-3/C-4/C-6) |
| `docs/SECURITY_MODEL.md` · `SECURITY_AUDIT.md` · `PRODUCTION_SECURITY_CERTIFICATION.md` · `OPERATIONS_RUNBOOK.md` · `DEPLOYMENT_GUIDE.md` · `DISASTER_RECOVERY.md` · `INCIDENT_RESPONSE.md` | Load-bearing security + ops |
| `docs/stage16/EVIDENCE_POLICY.md` · `docs/cidp/README.md` · `docs/cidp/GA_READINESS_REPORT.md` | The no-fabrication policy and the GA gate set |
| `personas/*.json` · `schemas/*.json` | Authoritative clinical + schema source |

### Keep, but as historical evidence (cited by the RDL — do not move)

`docs/rc3/**` (Wave 1–3 reports, remediation records, H5 closeout, evidence JSON) ·
`docs/stage8/` … `docs/stage16/` per-stage reports · `docs/cidp/evidence/**` ·
`docs/RC1_CODE_FREEZE.md` · `RC1_MANIFEST.md` · `RC2_INFRASTRUCTURE_FREEZE.md` ·
`MIGRATION_RECONCILIATION_REPORT.md` · `SCHEMA_DIFF_REPORT.md` ·
`REPOSITORY_PRODUCTION_INTEGRITY_SCORES.md` · `SAFE_SEQUENTIAL_ENGINE_MERGE_REPORT.md`.

**Their conclusions are captured above; their value now is traceability, not orientation.** Label
them `HISTORICAL — EVIDENCE` so no future session reads them as current state.

### Mark SUPERSEDED — actively misleading if read as current

| Document | Problem |
|---|---|
| `docs/CANONICAL_MIGRATION_LEDGER.md` | Frozen at 54 migrations; actual is 75. **Most misleading file in the repo** |
| `docs/V1_RELEASE_CERTIFICATION.md` | States scientific ledgers are absent — stale; Wave 3 shipped the Quality Ledger and indices |
| `docs/FINAL_EXECUTIVE_SUMMARY.md` · `FINAL_RELEASE_CERTIFICATION.md` · `FINAL_PREVIEW_QA.md` · `RELEASE_NOTES_RC1.md` · `PRODUCTION_READINESS_REPORT.md` | Mission Omega (2026-08-06) baseline `7dc9a35`, superseded by Stage 12 → CIDP → Phase 14–16 → Phase 4 |
| `docs/FEATURE_INVENTORY.md` (Realtime row; "61 migrations"; "2 avatars") | Point-in-time; see C-6, C-7 |
| Overlapping security certifications (`SECURITY_CERTIFICATION.md` vs `SECURITY_AUDIT.md` vs `stage15/SECURITY_CERTIFICATION_REPORT.md` vs `cidp/SECURITY_REPORT.md`) | Four documents, one subject. Nominate **one** current; mark the rest historical |
| Duplicate `DSM_MAPPING.md` (`docs/clinical/` and `docs/clinical-intelligence/`) · duplicate `PERFORMANCE_REPORT.md` / `TECHNICAL_DEBT.md` under stage8–16 | Ambiguous which is canonical |

### Do not archive under any circumstances

`docs/RELEASE_DECISION_LOG.md` (append-only by rule) · `personas/clinical-examination.json` (the only
clinical examination record that exists) · anything cited as evidence by an RDL row · the Phase 3 and
Phase 4 corpus.

### The one document that should be *created*, not archived

If the Phase 4 **Executive Decision Brief** still exists in a conversation, write it into the repo.
It is the authorizing document for already-shipped code (PR #200) and it currently exists nowhere in
version control. See CONTRADICTIONS C-10 and DO NOT LOSE §D-1.

---

*Compiled 2026-08-20 from the repository record at `1a83424`. Chat transcripts were not available to
this compilation. Where evidence was insufficient, items are labelled UNCERTAIN rather than resolved.
**This document is a summary, not an authority.** If future evidence contradicts it, investigate the
source material — `docs/RELEASE_DECISION_LOG.md`, the Phase 3/4 corpus, and the code itself — rather
than trusting this file.*

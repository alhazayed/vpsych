# Wave 3 Final Certification — Sections 2 / 3 / 4

**Auditor role:** Independent security + AI-safety review  
**Production baseline:** `5aae13806c984cb19a9c2e920d14014b548d4400` (`origin/main`)  
**Audit branch:** `cursor/wave3-final-cert-audit-5dce`  
**Date:** 2026-08-06  
**Method:** Static analysis of application routes, AI prompt assembly, RLS migrations, and memory/persistence paths. No fabricated evidence; line citations refer to this SHA.

---

## Executive verdict

| Section | Verdict | Summary |
|---|---|---|
| **2 Prompt Safety** | **Conditional pass** | Patient + examiner prompts exist with role/jailbreak and examiner injection rules. Gaps: no runtime ban on real-patient/celebrity recreation; no secondary output filter; admin-authored `persona_prompt` is raw system-prompt content. |
| **3 Memory Safety** | **Conditional pass** | Session transcripts and assessments are session-scoped with ownership RLS. `case_memory` is empty and unused in the patient agent. Quality Ledger absent. Hard delete is irreversible; institutional managers can list peer session metadata. |
| **4 Security** | **Conditional pass** | AuthZ (edge + API + RLS), report admin isolation, voice caps, and rate limits are largely in place. Residuals: CSP `unsafe-inline`/`unsafe-eval`, optional Upstash, some admin routes unthrottled, message RPC body is service-role-only while EXECUTE is also granted to `authenticated`. |

**No Critical findings** verified on this SHA for Sections 2–4.

---

## Not on production main (`5aae138`)

These subsystems exist on draft/feature branches only and are **out of scope for production memory/export claims**:

| Subsystem | On `5aae138`? | Evidence of absence / elsewhere |
|---|---|---|
| Quality Ledger | **Absent** | No `src/lib/quality-ledger/`; present on `origin/cursor/quality-ledger-engine-8acf` |
| Multi-ledger | **Absent** | No `src/lib/ledgers/`; present on `origin/cursor/multi-ledger-platform-8acf` |
| CQI | **Absent** | No `src/lib/cqi/`; present on `origin/cursor/cqi-platform-0594` |
| EOI | **Absent** | No `src/lib/eoi/`; docs/code on `origin/cursor/eoi-platform-0594` |
| PME | **Absent** | No `src/lib/pme/`; present on `origin/cursor/mission-21-pme-0594` |
| CVL | **Absent** | No `src/lib/cvl/`; present on `origin/cursor/mission-100-cvl-0594` |
| CFI / ERI / AVI / ALE / RRS / VQI | **Absent** | Confirmed in `docs/V1_RELEASE_CERTIFICATION.md` §8 (draft PRs only) |
| Dedicated export APIs (CQI/CVL-style) | **Absent** | No `/api/**/export` Route Handlers under `src/app/api/` |

**Present on main and in scope:** patient prompt engine, examiner prompts, sessions/messages/reports, ACE, CGE, case engine, scenario templates, instructor presets, voice STT/TTS, institutional foundation + session tenancy migrations.

---

## SECTION 2 — Prompt Safety

### 2.1 System prompt inventory (complete on this SHA)

| # | Prompt | File | Role |
|---|---|---|---|
| P1 | Patient avatar Modules 1–4 | `src/lib/ai/prompt-engine.ts` `SYSTEM_PROMPT_TEMPLATE` L101–251; assembled L266–272 | Patient simulation |
| P2 | Per-turn reinforcement | `src/lib/ai/prompt-engine.ts` `PER_TURN_TEMPLATE` L253–261; `assemblePerTurnReinforcement` L278–292 | Appended to therapist turn |
| P3 | Examiner (EN) | `src/lib/ai/report-locale.ts` `buildExaminerSystemPrompt` L84–101 | Assessment |
| P4 | Examiner (AR) | `src/lib/ai/report-locale.ts` L63–81 | Assessment |
| P5 | Persona fragment | `{{personality.persona_prompt}}` interpolated at L145; sourced from avatar/personality JSON | Nested inside P1 |

Call sites:

- Patient: `src/lib/ai/patient-agent.ts` L149 / L171 (`system: avatar.system_prompt`)
- Assessment: `src/lib/ai/assessment.ts` L246–267 / L297

No other LLM system prompts were found under `src/` (search for `role: "system"`, `SYSTEM_PROMPT`, examiner builders).

### 2.2 Findings

#### W3-S2-M1 — Medium — No runtime ban on real-patient / living-person recreation

**Evidence:** MODULE 4 (`prompt-engine.ts` L228–250) covers role integrity, jailbreaks, risk portrayal, and crisis resources. It does **not** instruct the model to refuse recreating real patients, celebrities, identifiable living persons, or staff-known cases.

Corpus metadata states fiction (`personas/index.json` L24: *"fictional patients; no field refers to a real person"*), and UI copy warns trainees (`messages/en.json` privacy FAQ / legal strings), but those strings are **not** injected into the model system prompt.

**Risk:** Adversarial therapist turns asking the avatar to “be [real person]” or to replay a real clinical case rely only on soft character instructions (L232–235), not an explicit recreation ban.

#### W3-S2-M2 — Medium — No secondary output filter (patient or examiner)

**Evidence:** `patient-agent.ts` returns model text after trim (L154–188) with no post-generation policy filter. `assessment.ts` parses structured JSON (`parseAssessmentModelText`) but does not scrub leaked system-prompt text or jailbreak compliance from narrative/excerpts.

Prior certification already logged this residual (`docs/PRODUCTION_SECURITY_CERTIFICATION.md` L125, L187). Still open on `5aae138`.

#### W3-S2-M3 — Medium — Admin-authored `persona_prompt` is untrusted-as-code inside the system prompt

**Evidence:** `prompt-engine.ts` L145 inserts `{{personality.persona_prompt}}` into MODULE 2 with no escaping beyond template formatting. Avatars/`personas/*.case.json` are admin/clinical content. A compromised admin account (or malicious persona import) can plant instruction-override text that sits **above** MODULE 4 in the same system string (MODULE 4 claims override on conflict at L228, but models do not reliably honor ordering).

#### W3-S2-M4 — Medium — Therapist turn isolation is instruction-only; history can duplicate the attack turn

**Evidence:**

- MODULE 4 L232–235: therapist content framed as “speech from a person in a room”.
- `sessions/[id]/message/route.ts` L76–108 inserts the user message, then loads history **including** that message, then `patient-agent.ts` L129–140 / L170–174 appends the (reinforced) user message again → duplicate user turn in the model context.
- No delimiter wrapping / tool-role separation for user content.

**Risk:** Increases prompt-injection success chance under adversarial phrasing; reinforcement text is adjacent to attacker-controlled content (`patient-agent.ts` L137–140).

#### W3-S2-L1 — Low — Heuristic assessment narrative names env var keys

**Evidence:** `report-locale.ts` L117–128 embeds `AI_GATEWAY_API_KEY` / `OPENAI_API_KEY` in fallback narrative copy stored on reports.

**Risk:** Configuration fingerprinting for admins (and anyone who later gains report read); not secret values.

#### W3-S2-OK — Controls that pass

| Control | Evidence |
|---|---|
| Patient never therapist / never AI | `prompt-engine.ts` L109–110, L128, L232–233 |
| Jailbreak / role-change refusal | L232–235; persona `boundary_rules` e.g. `maya-chen.case.json` L1217–1222 |
| No self-harm method/means | L244–245; persona boundary L1221 |
| Examiner treats transcript as untrusted | `report-locale.ts` L67–69 (AR), L87–90 (EN); test `report-locale.test.ts` L50–53 |
| Risk capped to clinical profile | L237–243 |
| Locale/script constraints | MODULE 3 L183–225 |
| Syndrome authority vs persona conflict | MODULE 1 L130–140 |

### 2.3 Adversarial / PHI notes

- **PHI:** Product is simulated training data. UI warns against entering real PHI (`messages/en.json`). There is **no** server-side PHI detector on `/api/sessions/[id]/message` or STT transcripts. Residual acceptance risk if trainees paste real notes.
- **Injection surfaces:** therapist text (message API), STT transcript → same message path, admin persona content, assessment transcript assembly (`assessment.ts` L231–258).
- **Provider logs:** Transcripts leave the trust boundary to OpenAI / AI Gateway / ElevenLabs (threat model in prior certs). No app-level retention contract with providers is enforced in code.

---

## SECTION 3 — Memory Safety

### 3.1 Memory surfaces on main

| Store | Purpose on `5aae138` | Cross-session? | Cross-user? |
|---|---|---|---|
| `session_messages` | Transcript | No (keyed by `session_id`) | Owner or admin SELECT (`20260803021426_…sql` L52–63) |
| `sessions.clinical_snapshot` | Immutable case snapshot | Per session | Owner/admin; **also institution managers** (see W3-S3-M2) |
| `case_memory` | Empty JSON shell at case create | Designed per `case_instance_id` | Ownership RLS (`20260802180922_…sql` L503–529) |
| `session_reports` | Assessment narrative/scores/excerpts | 1:1 session | **Admin SELECT only** (L79–83) |
| ACE `learner_profiles` / competencies / coach_feedback | Longitudinal learner state | Yes, by design | Own learner or admin (`20260802230739_…sql`) |
| CGE remediation / mastery | Graph-linked learner state | Yes | Own / admin |
| Quality Ledger | **N/A — absent** | — | — |

**Patient agent does not read `case_memory`:** inserts only in `case-engine/persist.ts` (e.g. L831–836). No `from("case_memory").select` in patient/assessment paths. Longitudinal template mode is a stub: `scenario-templates/generate.ts` L156–159 both branches set `memory_scope: "case_instance"`.

### 3.2 Findings

#### W3-S3-M1 — Medium — Hard delete; no soft-delete / recovery path

**Evidence:**

- `session_messages.session_id` → `ON DELETE CASCADE` (`20260730132727_vpsych_initial_schema.sql` L44)
- `session_reports.session_id` → `ON DELETE CASCADE` (L52)
- Admin retention purge deletes sessions (`purge_training_sessions_older_than`, `20260803201325_…sql` L85–91)
- ACE tables typically `ON DELETE SET NULL` for `session_id` (e.g. competency_scores / coach_feedback schema) → learner aggregates can outlive the transcript

**Risk:** Deleted sessions (purge or cascade) are not recoverable in-product. No DSAR export/erase UX beyond the purge RPC. “Deleted session recovery” = **not supported**.

#### W3-S3-M2 — Medium — Institution managers can SELECT peer session rows (including `clinical_snapshot`)

**Evidence:** `20260803202534_institutional_session_tenancy_m23.sql` L26–36 adds permissive policy `Institution managers can view tenant sessions` via `can_manage_institution(institution_id)`.

Comment L26: *"not messages by default"* — verified: `session_messages` SELECT still owner/admin only (`20260803021426_…sql` L52–63). Reports remain admin-only.

**Risk:** Cross-therapist leakage **within an institution** of session metadata and clinical snapshot (diagnosis practiced, difficulty, etc.), not full transcripts. Intentional for tenancy, but broader than pure therapist isolation.

#### W3-S3-M3 — Medium — Session-end returns ACE `coachSummary` to the therapist

**Evidence:** `sessions/[id]/end/route.ts` L194–199 / L269–274 returns `adaptive.coachSummary` from `ace.coach?.supervisor_feedback` while L265 comments *"Do not return report content to therapist — admin only"*. Full `session_reports` content is not returned; coach text is still assessment-derived coaching.

**Risk:** Partial cross-channel disclosure of evaluation substance to the trainee (product choice for ACE, but conflicts with strict admin-only report isolation).

#### W3-S3-L1 — Low — `case_memory.longitudinal_group_id` column exists without enforcement

**Evidence:** Table L164–168 in `20260802180922_…sql`; comment *"longitudinal mode may share later"*. Runtime does not populate shared groups on main.

**Risk:** Future longitudinal wiring could create cross-session memory bleed if RLS is not revisited.

#### W3-S3-OK — Controls that pass

| Control | Evidence |
|---|---|
| Message API ownership | `message/route.ts` L55–57 |
| Assessment loads only this session’s messages | `end/route.ts` L87–91 |
| Patient history capped / same session | `patient-agent.ts` L129–135; history query `message/route.ts` L97–101 |
| Case rebinding blocked | `enforce_session_update_guard` `20260802230721_…sql` L32–46 |
| Reports not therapist-readable via RLS | `20260803021426_…sql` L79–83 |
| UI complete page hides report for non-admin | `sessions/[id]/complete/page.tsx` L79–87 |
| Quality Ledger N/A | Absent from tree |

### 3.3 Cross-session / cross-user / cross-institution matrix

| Vector | Result on `5aae138` |
|---|---|
| Therapist A reads Therapist B messages | Blocked (RLS + API) |
| Therapist reads own report scores via Data API | Blocked (admin SELECT) |
| Therapist reads own ACE coach_feedback | Allowed (own learner) — by design |
| Institution manager lists peer sessions | Allowed (M23 policy) |
| Institution manager reads peer messages/reports | Blocked by current policies |
| Cross-institution session list | Requires `can_manage_institution` for that `institution_id` |
| Patient model context from prior sessions | Not implemented (no case_memory read) |

---

## SECTION 4 — Security

### 4.1 AuthN / AuthZ

| Control | Evidence | Status |
|---|---|---|
| Session refresh + unauth redirect | `lib/supabase/middleware.ts` L72–92 | Pass |
| Admin edge gate `/admin` + `/api/admin` | middleware L99–135 | Pass |
| Page admin | `lib/auth.ts` `requireAdmin` L30–41 | Pass |
| API admin + deny audit | `lib/api-auth.ts` `requireApiAdmin` L59–81 | Pass |
| Role in `profiles`, not metadata | initial schema + CLAUDE.md; signup `handle_new_user` forces `therapist` | Pass |
| Role self-escalation blocked | `profiles_role_guard` `20260802230721_…sql` L58–75; UPDATE WITH CHECK `20260803021426_…sql` L108–111 | Pass |
| Password policy 8+ upper/number/special | `lib/password-policy.ts` L13–24 | Pass |
| Open redirect hardened | `safe-redirect` used in middleware L95 | Pass |

### 4.2 RLS / privileged RPCs

| Control | Evidence | Status |
|---|---|---|
| `session_messages` INSERT `role = 'user'` only | `20260803021426_…sql` L65–77 | Pass |
| Assistant/system via SECURITY DEFINER RPCs | `insert_assistant_message` / `insert_system_message` | Pass (with residual below) |
| Latest RPC **body** requires `service_role` | `20260803194707_…sql` L25–28, L79–80 | Pass vs client forge |
| EXECUTE also granted to `authenticated` | `20260804055602_…sql` L10–13 | Residual landmine (W3-S4-M1) |
| `create_session_report` HMAC + owner | `20260730181421_…sql` L88–109 | Pass |
| Service-role report insert path | `end/route.ts` L157–169; `createServiceClient` | Pass / prefer HMAC |
| Purge admin-gated in body | `20260803201325_…sql` L77–78 | Pass |
| ACE learner write lockdown | `20260802230739_…sql` SELECT-only learner policies | Pass |
| Learner instructor-field trigger | `enforce_learner_profile_guard` L77–107 | Pass |

### 4.3 Findings

#### W3-S4-M1 — Medium — Message RPC EXECUTE restored to `authenticated` while body is service-role-only

**Evidence:** Body hard-fails non-service callers (`20260803194707_…sql` L25–28). Later grant restore (`20260804055602_…sql` L10–13) re-enables EXECUTE for `authenticated` so PostgREST exposes the RPC, but calls fail authorization inside the function.

**Risk:** (1) Misleading security posture / advisor noise. (2) If a future migration “fixes” fallback by relaxing the body without re-adding ownership + turn-order checks carefully, transcript forge returns. (3) With `SUPABASE_SERVICE_ROLE_KEY` set, `messageRpcClient` (`admin.ts` L33–36) uses service role whose RPC body **does not re-check therapist ownership** — ownership depends entirely on Route Handlers (`message/route.ts` L55–57). That is acceptable today but brittle.

#### W3-S4-M2 — Medium — Some admin APIs lack rate limits

**Evidence:** Most admin routes call `rateLimit`. Exceptions observed:

- `src/app/api/admin/cge/route.ts` — GET/PATCH: `requireApiAdmin` only, **no** `rateLimit`
- `src/app/api/admin/ace/learners/route.ts` — GET/PATCH: **no** `rateLimit`

**Risk:** Authenticated admin credential abuse / accidental loops against DB.

#### W3-S4-M3 — Medium — Voice endpoints are authenticated but not session-bound

**Evidence:**

- STT: `voice/transcribe/route.ts` L33–47 auth + rate limit; size/MIME via `stt` helpers; **no** `sessionId` ownership check.
- TTS: `voice/tts/route.ts` L34–48 auth + rate limit; voice allowlist in `resolve-tts-voice.ts` L101–107; text max 2500 (`elevenlabs/service.ts` L195–199); **no** session binding.

**Risk:** Any logged-in user can spend STT/TTS quota (cost abuse). Voice IDs cannot be arbitrary (allowlist) — prior High partially fixed.

#### W3-S4-M4 — Medium — CSP still allows `'unsafe-inline'` and `'unsafe-eval'`

**Evidence:** `lib/security-headers.ts` L40–41. Documented Next.js constraint; XSS residual.

#### W3-S4-L1 — Low — Production rate limit may be per-instance without Upstash

**Evidence:** `rate-limit.ts` L123–134 warns when Upstash unset in Vercel production.

#### W3-S4-L2 — Low — Public `/api/health` discloses service name

**Evidence:** `health/route.ts` L8–12 — intentional liveness; no secrets.

#### W3-S4-L3 — Low — Admin CGE unlock/approve writes fixed scores

**Evidence:** `admin/cge/route.ts` L67–97 upserts `score: 70` / `80` with instructor flags. Expected privilege; ensure audit logging coverage for these mutations (only deny path auto-audits via `requireApiAdmin`).

#### W3-S4-OK — Additional passes

| Control | Evidence |
|---|---|
| OpenAI health admin-only + sanitized | `health/openai/route.ts` L9–36 |
| Client-safe errors | `api-errors.ts`, `safe-client-error.ts` |
| TTS voice allowlist | `resolve-tts-voice.ts` L5–14, L101–107 |
| STT 10MB + MIME | `lib/voice/stt` (wired in transcribe route L73–87) |
| No dedicated export/download APIs on main | API tree under `src/app/api/` |
| Security headers HSTS/COOP/CORP/XFO | `security-headers.ts` L57–73 |
| `.env.production` holds public anon only | verified; service role not in git |
| Session message length cap | `message/route.ts` L37–41 (4000) |
| ACE profile mass-assignment allowlist | `ace/profile/route.ts` L11–19, L82–114 |

### 4.4 Privilege escalation summary

| Attempt | Outcome |
|---|---|
| Therapist → admin via profile UPDATE | Blocked (trigger + WITH CHECK) |
| Therapist SELECT reports | Blocked (RLS) |
| Therapist forge assistant row via INSERT | Blocked (`role = 'user'` check) |
| Therapist forge assistant via RPC without service role | Blocked (RPC body) |
| Therapist PATCH ACE instructor locks | Blocked (API 403 + DB trigger) |
| Non-admin `/api/admin/*` | Middleware 403 + `requireApiAdmin` |
| Admin → arbitrary ElevenLabs voice id | Blocked by allowlist (still can use any **registered** voice) |

---

## Residual risks (open, not over-claimed as fixed)

1. Prompt-injection remains instruction-only; no output filter (W3-S2-M2).
2. Real-patient / celebrity recreation not banned in runtime prompts (W3-S2-M1).
3. Provider-side retention of transcripts/audio (OpenAI, ElevenLabs, Gateway) — contractual/ops.
4. Leaked-password protection (HIBP) still an ops dashboard item (prior certs).
5. Distributed rate limits depend on Upstash provisioning (W3-S4-L1).
6. CSP nonce migration not done (W3-S4-M4).
7. Hard delete / purge is irreversible; no productized DSAR export (W3-S3-M1).
8. Institutional manager session metadata visibility (W3-S3-M2).
9. Message RPC grant/body mismatch is a future regression hazard (W3-S4-M1).
10. Engines not on main (QL/CQI/EOI/PME/CVL) will introduce new export, aggregation, and longitudinal memory surfaces when merged — re-audit required.
11. Assessment scores are **not scientifically validated** (`docs/ASSESSMENT_RELIABILITY.md` posture / CLAUDE.md) — educational risk, not an AuthZ defect.

---

## Severity tally (this audit)

| Severity | Count | IDs |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 11 | W3-S2-M1..M4, W3-S3-M1..M3, W3-S4-M1..M4 |
| Low | 5 | W3-S2-L1, W3-S3-L1, W3-S4-L1..L3 |

---

## Certification statement

For **Wave 3 Final Certification Sections 2, 3, and 4** against production git SHA **`5aae138`**:

**CONDITIONALLY CERTIFIED** — no Critical/High defects newly verified on this baseline; Medium residuals above must be tracked. Quality Ledger, CQI, EOI, PME, CVL, and scientific multi-ledgers are **not part of production main** and must not be asserted as production-certified memory or export controls.

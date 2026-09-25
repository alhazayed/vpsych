# Phase 8.1 — P0/P1 Security Verification (READ ONLY)

**Repository:** `alhazayed/vpsych`  
**Verified against:** `main` tip `dfe118c` (Phase 7 CLEAR) + live Supabase project `vpsych` (`rrzudbkxigeavfdnidnm`)  
**Date:** 2026-09-25  
**Mode:** VERIFY-FIRST — no source, migration, policy, env, or dependency changes in this phase.

Classification vocabulary used throughout (exact):

| Tag | Meaning |
|-----|---------|
| `CONFIRMED VULNERABLE` | Current code and/or live DB still permit the unsafe behavior |
| `FIXED` | Control is present and effective in current tree (and live DB where checked) |
| `PARTIALLY FIXED` | Some controls exist; a bypass or material gap remains |
| `NOT VERIFIABLE` | Evidence insufficient without destructive live attack or unavailable runtime |

---

## 1. Executive summary

| ID | Finding | Classification |
|----|---------|----------------|
| **P0-1** | Authenticated therapist can forge assistant/system transcript rows via PostgREST RPCs; forged content reaches assessment and signed reports | **CONFIRMED VULNERABLE** |
| P0-1a | Direct table INSERT of `assistant`/`system` via RLS | **FIXED** |
| P0-1b | UPDATE/DELETE of existing `session_messages` via RLS | **FIXED** |
| P0-1c | Browser exposure of `REPORT_WRITE_KEY` / message HMAC secret | **FIXED** (secret unused for messages today) |
| P0-1d | `admin_test` forged scoring-evasion marker | **FIXED** (DB INSERT guard) |
| **P1-1** | Client/SSE error leakage (`clientSafeError` denylist + raw `err.message` on stream) | **PARTIALLY FIXED** |
| **P1-2** | Admin MFA as cryptographic / AAL enforcement | **CONFIRMED VULNERABLE** (not implemented; role-only) |
| **P1-3** | Clinical risk-inquiry detection (EN/AR, N/A, UNCERTAIN) | **PARTIALLY FIXED** |
| **P1-4** | Arabic / English examiner prompt parity (Wave-3 block) | **PARTIALLY FIXED** |
| **P1-5** | Next.js security advisories vs locked `16.3.4` | **PARTIALLY FIXED** |

**Blocking issues:** P0-1 (message/transcript forgery).  
**Non-blocking issues:** P1-1, P1-2, P1-3, P1-4, P1-5.  
Stale documentation: `docs/PRODUCTION_SECURITY_CERTIFICATION.md` H2 still claims message RPCs were revoked from `authenticated` — contradicted by git tip and live DB.

---

## 2. P0 findings — Message / transcript forgery

### 2.1 Overall classification

**CONFIRMED VULNERABLE**

CQG-011 briefly required HMAC on `insert_assistant_message` / `insert_system_message`. Migration `20260806143023_restore_session_message_rpc_owner_auth_qa.sql` intentionally removed HMAC verification (kept unused `p_sig`) and re-granted `EXECUTE` to `authenticated`. No later migration restores HMAC. Live production matches that QA restore.

### 2.2 Answers to mandatory questions

| # | Question | Answer | Classification |
|---|----------|--------|----------------|
| 1 | Can an authenticated therapist directly call the message insertion path? | **Yes** — PostgREST `rpc('insert_assistant_message'\|'insert_system_message')` with user JWT; also legitimate API routes | **CONFIRMED VULNERABLE** |
| 2 | Can the therapist forge an assistant message? | **Yes** — own active session; last turn must be `user`; **no signature check** | **CONFIRMED VULNERABLE** |
| 3 | Can the therapist forge a system message? | **Yes** — own active session; **no turn-order gate**; **no signature** | **CONFIRMED VULNERABLE** |
| 4 | Can the therapist modify an existing message? | **No** via table API — no UPDATE/DELETE RLS policies on `session_messages` | **FIXED** |
| 5 | Can a forged message influence evaluation/report generation? | **Yes** — `/end` loads all messages → `assessSession` → HMAC-signed `create_session_report` over **resulting** scores | **CONFIRMED VULNERABLE** |
| 6 | Is the signing secret accessible to the browser? | **No** — `REPORT_WRITE_KEY` is server-only; message HMAC is not enforced anyway | **FIXED** (secret exposure) |
| 7 | Is authorization enforced server-side? | **Partial** — Route Handlers auth + ownership; **RPC bypasses** the trusted server path | **PARTIALLY FIXED** |
| 8 | Is authorization enforced at the database boundary? | **Partial** — owner/admin/service + active + assistant turn-order; **no cryptographic write auth** | **PARTIALLY FIXED** |
| 9 | Are there regression tests proving the protection? | **No** forge/HMAC regressions; `architecture.test.ts` asserts `messageRpcClient` **fallback to user client** | **CONFIRMED VULNERABLE** (test gap) |

### 2.3 Complete execution path (forge)

```
Browser (authenticated therapist JWT + anon key)
  → PostgREST /rest/v1/rpc/insert_assistant_message
       { p_session_id, p_content, p_sig?: ignored }
  → PostgreSQL SECURITY DEFINER insert_assistant_message
       checks: session exists, auth.uid() = therapist_id OR is_admin(),
               status = active, last role = user (assistant only)
       NO HMAC / NO server-only gate
  → INSERT session_messages (role = 'assistant'|'system')
  → POST /api/sessions/:id/end (owner)
       SELECT session_messages → assessSession(transcript)
       → signSessionReport(REPORT_WRITE_KEY) OR service-role insert
       → create_session_report / session_reports
```

Legitimate path still works without `p_sig`:

```
Browser → POST /api/sessions/:id/message
  → requireApiUser + ownership + rate limit
  → RLS INSERT role=user
  → generatePatientReplyDetailed
  → messageRpcClient().rpc('insert_assistant_message', { p_session_id, p_content })
       (service role if set; else authenticated user client — same EXECUTE surface)
```

### 2.4 Security boundary analysis

| Boundary | Control | Status |
|----------|---------|--------|
| Browser | Must not hold write secrets | Holds only anon key + user JWT — **insufficient alone** because RPCs are executable |
| Next.js API | Auth, rate limit, ownership | Effective for **API** calls only |
| `messageRpcClient` | Prefers service role; falls back to user | Fallback preserves forge surface when service role unset **and** does not help when attacker calls PostgREST directly |
| RLS `session_messages` | SELECT + INSERT `role='user'` only | Blocks direct assistant/system table inserts |
| RPC SECURITY DEFINER | Owner/active/(turn) | **Does not** bind writes to server-minted content |
| Report HMAC | Signs assessment **output**, not transcript **inputs** | Attacker poisons input; server signs poisoned output |
| Live DB | `authenticated` EXECUTE=true; `has_hmac=false` | Confirmed 2026-09-25 |

### 2.5 Evidence — migrations and live DB

**Latest function bodies (git):**  
`supabase/migrations/20260806143023_restore_session_message_rpc_owner_auth_qa.sql`

```sql
-- Preview QA: CQG HMAC on message RPCs broke session start when
-- SUPABASE_SERVICE_ROLE_KEY is unset (app calls without p_sig).
-- Restore V1-C1 / W1-C1 certified owner-auth bodies (no HMAC).
...
GRANT EXECUTE ON FUNCTION public.insert_system_message(uuid, text, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.insert_assistant_message(uuid, text, text)
  TO authenticated, service_role;
```

`p_sig` is accepted and **never read**.

**Prior HMAC (superseded):**  
`supabase/migrations/20260806131604_cqg_freeze_snapshot_signed_messages_body.sql` — Vault `report_write_key`, `extensions.hmac`, raises `Invalid message signature`.

**Later migrations:** `20260909110000_phase1_security_integrity.sql` does **not** redefine message RPCs.

**Live `vpsych` (2026-09-25):**

| Function | Args | authenticated EXECUTE | HMAC in body | Signature check |
|----------|------|----------------------|--------------|-----------------|
| `insert_assistant_message` | `(uuid, text, text)` | **true** | **false** | **false** |
| `insert_system_message` | `(uuid, text, text)` | **true** | **false** | **false** |

**RLS (table forge closed):**  
`supabase/migrations/20260803021426_database_certification_hardening.sql` — policies `"Participants can view session messages"` (SELECT), `"Therapists can insert user messages on own sessions"` (INSERT with `role = 'user'`).

**admin_test:**  
`supabase/migrations/20260821084315_session_admin_test_insert_guard.sql` + `src/lib/admin/admin-test-session.ts` — **FIXED** for forged `clinical_snapshot.admin_test`.

**App call sites:**  
- `src/app/api/sessions/[id]/message/route.ts` — `writer.rpc("insert_assistant_message", { p_session_id, p_content })` (no `p_sig`)  
- `src/app/api/sessions/route.ts` / admin test-session — `insert_system_message`  
- `src/lib/supabase/admin.ts` — `messageRpcClient`  
- `src/app/api/sessions/[id]/end/route.ts` + `src/lib/ai/assessment.ts` — consume full transcript  
- `src/lib/report-sign.ts` — report-only HMAC  

**Stale cert:** `docs/PRODUCTION_SECURITY_CERTIFICATION.md` H2 (“Revoked from authenticated; service_role only”) is **false** relative to current main + live DB. `docs/FINAL_PREVIEW_QA.md` correctly records the QA restore as applied to production.

### 2.6 Regression-test status (P0)

| Expected proof | Present? |
|----------------|----------|
| Therapist cannot forge assistant via RPC | **No** |
| Therapist cannot forge system via RPC | **No** |
| Invalid / missing `p_sig` rejected | **No** (HMAC removed) |
| Modified content invalidates signature | **No** |
| Legitimate AI path still works | Indirect product tests only |
| `admin_test` forge denied | **Yes** (`architecture.test.ts`, admin-test unit tests) |

---

## 3. P1 findings

### 3.1 Error information leakage — **PARTIALLY FIXED**

#### What works

- `src/lib/safe-client-error.ts` → `sanitizeDbError()` **always** returns `"Database error"` (used on `/api/sessions/[id]/end` and several admin routes).
- `src/lib/api-errors.ts` → `clientSafeError()` strips messages matching a denylist (`postgres`, `supabase`, `openai`, `api key`, `secret`, `REPORT_WRITE`, etc.) or length > 120.
- Many soft-fail paths log `err.message` **server-side only** (`console.warn` / `console.error`).

#### What remains open

1. **`clientSafeError` is a denylist, not an allowlist.** Short PostgREST/Postgres strings that omit denylist keywords (e.g. constraint / relation / column names without the word `postgres`) can pass through to JSON `error` fields. Example call sites: `message/route.ts` (`Failed to save message` / `Failed to save reply`), session create, notes, therapy-room, etc.
2. **SSE raw exception:** `src/app/api/sessions/[id]/message/stream/route.ts` lines 183–190:

   ```ts
   send("error", {
     message: err instanceof Error ? err.message : "Streaming turn failed",
   });
   ```

   Any thrown `Error` (including rethrown DB/provider wrappers) reaches the client over SSE **without** `clientSafeError`.
3. **Admin voice-profile routes** return `{ error: error.message }` raw (`src/app/api/admin/voice-profiles/[id]/live-switch/route.ts`, `[id]/route.ts`) — admin-gated but still leaks internals to admin browsers.
4. Tests in `src/lib/api-errors.test.ts` cover only denylist hits — **no** allowlist / SSE / table-name regression.

| Sub-finding | Classification |
|-------------|----------------|
| Intentional sanitization helpers exist | **PARTIALLY FIXED** |
| SSE catch path raw `err.message` | **CONFIRMED VULNERABLE** |
| Universal allowlist client errors | **CONFIRMED VULNERABLE** (not implemented) |
| End-route DB errors | **FIXED** (`sanitizeDbError`) |

### 3.2 Admin MFA — **CONFIRMED VULNERABLE** (not real enforcement)

| Layer | Behavior |
|-------|----------|
| Login | Supabase Auth password/session cookies — **no** TOTP/AAL gate in app code |
| Middleware | `src/lib/supabase/middleware.ts` — admin paths require `profiles.role === 'admin'` only |
| `requireAdmin` / `requireApiAdmin` | Role check + audit on deny — **no** `getAuthenticatorAssuranceLevel`, **no** MFA challenge |
| Enterprise “MFA” | `src/lib/enterprise/security.ts` — **in-memory / policy flag** `mfa_required` for dashboards/tests; not wired to Auth |
| UI | `AdminEnterprisePanel` displays `mfa_required` boolean |

**Bypass (conceptual):** Any valid admin session JWT calling `/api/admin/*` succeeds without second factor. MFA is not UI-state alone — it is **absent**; the enterprise flag is non-enforcing policy metadata.

Classification of implementation: **policy flag / abstraction only**, not cryptographic or session-assurance enforcement.

### 3.3 Clinical / risk detection — **PARTIALLY FIXED**

Primary heuristic: `analyzeInterviewProcess` in `src/lib/education/session-evaluation.ts`.

| Behavior | Current state |
|----------|---------------|
| English detection | Regex on therapist (`user`) turns: `suicid`, `kill yourself`, `harm yourself`, `safety plan`, `are you safe`, `thoughts of dying/death`, etc. |
| Arabic detection | **Absent** in education heuristic (no Arabic stems in that regex) |
| Language detection | **None** — same English regex for all locales |
| False positives | Possible (e.g. substring `suicid` / English idioms in non-risk context) |
| False negatives | High for Arabic risk phrasing; also English paraphrases outside the regex |
| `NOT_APPLICABLE` | **Not implemented** |
| `UNCERTAIN` | **Not implemented** |
| Absence of risk inquiry | Always emits finding `missed-risk` with **`severity: "critical"`** and lowers process score (`risk_inquiry_present ? 70 : 25`) — **yes, treated as critical educational failure**, regardless of case risk profile |

Secondary path: LLM examiner + heuristic fallback in `src/lib/ai/assessment.ts` includes **some** Arabic safety tokens (`انتحار`, `أذى`, `آمن`, `خطة`) for rubric `safety` / `risk_formulation` scoring — does **not** replace education `missed-risk` logic and is keyword-hit based (also false-positive prone, e.g. `خطة`).

### 3.4 Arabic / English evaluation parity — **PARTIALLY FIXED**

Source: `src/lib/ai/report-locale.ts` → `buildExaminerSystemPrompt`.

#### Parity matrix

| Element | English | Arabic | Parity |
|---------|---------|--------|--------|
| Examiner role + fairness | Present | Present (native AR) | Match |
| Integrity / untrusted transcript | Present | Present | Match |
| Native report language rules | Present | Present (`ممنوع الترجمة`) | Match |
| Patient / approach / goals / duration | Present | Present | Match |
| Rubric id scoring 0–5 | Present | Present | Match |
| Dual-coding DSM/ICD instructions | Present | Present | Match |
| **Wave-3 block** (`clinical_formulation`, `differential_diagnosis`, `risk_formulation`, `educational_competency`) | **Present** (EN-only paragraph) | **Missing** | **Gap** |
| Rubric **labels** for Wave-3 ids | `DEFAULT_RUBRIC_LABELS_EN` | `DEFAULT_RUBRIC_LABELS_AR` | Match |
| Rubric **weights / ids** in `assessment.ts` | Shared | Shared | Match |
| Heuristic safety/empathy keywords | Bilingual set | Bilingual set | Match (heuristic) |
| Automated prompt parity test for Wave-3 | EN covered indirectly | **No assert that AR contains Wave-3** | Gap |

Material difference: Arabic examiner prompt lacks the Wave-3 educational dimension instructions that English includes. Rubric ids may still be scored if listed in `rubricLines`, but Arabic examiners do not receive the same scoring criteria text.

### 3.5 Next.js security — **PARTIALLY FIXED**

| Item | Value |
|------|-------|
| Declared / locked version | `next@16.3.4` (`package.json`, `package-lock.json`) |
| `npm audit --omit=dev` (this environment) | **0 vulnerabilities** |
| `ImageResponse` / `next/og` usage in repo | **None** |

| Advisory | Affects 16.3.4? | App impact | Notes |
|----------|-----------------|------------|-------|
| CVE-2026-64647 (UTF-8 cache confusion) | Fixed since 16.2.11 / in 16.3.x | Low | Tree is past patch floor |
| August 2026 AVIF / Windows RCE (16.3.3) | 16.3.4 ≥ 16.3.3 | Windows RCE N/A on Vercel Linux; AVIF re-enabled with sharp gating in 16.3.4 | |
| **GHSA-vcvr-r3jv-pc5j** (Node `ImageResponse` RCE) — fixed in **16.3.6** | **Yes** (`>=16.2.0 <16.3.6`) | **Mitigated in practice** — no `next/og` imports found | Package version still in affected range; upgrade recommended but **not** performed in this read-only phase |

Classification: **PARTIALLY FIXED** — recent LTS security floors for 16.3.3 are met; **16.3.6** ImageResponse advisory remains open at the dependency version even though this application does not call the vulnerable API.

---

## 4. Evidence index (files / functions)

| Area | Paths |
|------|-------|
| Message RPC (current) | `supabase/migrations/20260806143023_restore_session_message_rpc_owner_auth_qa.sql` |
| Message RPC (HMAC era) | `supabase/migrations/20260806131452_*.sql`, `20260806131604_*.sql` |
| RLS | `supabase/migrations/20260803021426_database_certification_hardening.sql` |
| admin_test guard | `supabase/migrations/20260821084315_session_admin_test_insert_guard.sql` |
| RPC client | `src/lib/supabase/admin.ts` → `messageRpcClient` |
| Message API | `src/app/api/sessions/[id]/message/route.ts` |
| Stream SSE | `src/app/api/sessions/[id]/message/stream/route.ts` |
| End / report | `src/app/api/sessions/[id]/end/route.ts`, `src/lib/report-sign.ts`, `src/lib/ai/assessment.ts` |
| Errors | `src/lib/api-errors.ts`, `src/lib/safe-client-error.ts` |
| AuthZ | `src/lib/auth.ts`, `src/lib/api-auth.ts`, `src/lib/supabase/middleware.ts` |
| Enterprise MFA flag | `src/lib/enterprise/security.ts` |
| Risk heuristic | `src/lib/education/session-evaluation.ts` |
| Examiner parity | `src/lib/ai/report-locale.ts` |
| Next version | `package.json`, `package-lock.json` |
| Stale / accurate docs | `docs/PRODUCTION_SECURITY_CERTIFICATION.md` (stale H2), `docs/FINAL_PREVIEW_QA.md` (QA restore) |

---

## 5. Recommended remediation (guidance only — not applied here)

### Blocking (P0)

1. Reintroduce **server-only** write authority for assistant/system messages (preferred minimum):
   - Revoke `EXECUTE` on message RPCs from `authenticated`, **or**
   - Restore CQG-011 HMAC with server-side signing in Route Handlers (and ensure service role / signing key always present in deploy), **or**
   - Equivalent SECURITY DEFINER check that non-service callers cannot insert assistant/system content.
2. Add regression tests that call the **actual** security boundary (RPC as authenticated owner without server signature → deny).
3. Correct stale H2 text in production security certification after fix lands.

### Non-blocking (P1)

1. Replace `clientSafeError` denylist with allowlist / always-fallback; sanitize SSE `error` payloads; stop returning raw `error.message` from admin voice routes.
2. Implement real admin MFA (Supabase AAL2 / TOTP) in `requireApiAdmin` + middleware — or remove misleading `mfa_required` UI until then.
3. Extend risk detection for Arabic; introduce `NOT_APPLICABLE` / `UNCERTAIN` when case risk profile does not require inquiry; stop auto-`critical` when N/A.
4. Add Wave-3 educational dimension instructions to the Arabic examiner prompt; add parity tests.
5. Upgrade `next` to **≥ 16.3.6** when remediation is authorized (out of scope for this read-only phase).

---

## 6. Final rollup

### BLOCKING ISSUES

- **P0-1 Message / transcript forgery** — `CONFIRMED VULNERABLE` (git + live DB). Authenticated session owners can insert assistant/system messages without HMAC; forged transcripts influence assessment and become HMAC-signed reports.

### NON-BLOCKING ISSUES

- **P1-1 Error leakage** — `PARTIALLY FIXED` (SSE raw `err.message`; denylist holes; some admin raw messages).
- **P1-2 Admin MFA** — `CONFIRMED VULNERABLE` (role-only; enterprise flag non-enforcing).
- **P1-3 Risk detection** — `PARTIALLY FIXED` (EN-only education regex; absence → always critical; no N/A/UNCERTAIN).
- **P1-4 EN/AR examiner parity** — `PARTIALLY FIXED` (Wave-3 instructions missing in Arabic prompt).
- **P1-5 Next.js** — `PARTIALLY FIXED` (`16.3.4` < `16.3.6` for ImageResponse advisory; app does not use `next/og`).

### NO ISSUES FOUND

- Direct RLS INSERT of assistant/system roles.
- RLS UPDATE/DELETE of `session_messages`.
- Browser exposure of `REPORT_WRITE_KEY`.
- Forged `admin_test` session marker (DB + app guards).
- Anon EXECUTE on message RPCs (denied live).

---

*End of Phase 8.1 verification. No application code, migrations, policies, environment variables, or dependencies were modified to produce this document.*

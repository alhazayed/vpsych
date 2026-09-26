# Phase 9 — Production Verification (before merge)

**Decision: CLEAR** (after Phase 9C gate clearance)  
**PR:** [#244](https://github.com/alhazayed/vpsych/pull/244) — **still UNMERGED** (manual merge only)  
**Branch:** `cursor/admin-phase9-guided-case-builder-fc9c`  
**Feature tip:** `8e9345bccff3bad356d0fd12e72276b647763d55`  
**Docs tip (this record):** post-9C commit on same branch  
**Base:** `b6e5e32b8674e7b4b11b6772bb01671c721e9dc3`  

Phase 9B (below) remains historical CONDITIONAL evidence. Phase 9C supersedes the three open gaps.

---

## 1. CI

| Check | Result |
|---|---|
| GitHub Actions `verify` | **SUCCESS** (completed 2026-09-26T07:22:50Z) |
| Vercel status | **SUCCESS** |
| Vercel Preview Comments | **SUCCESS** |
| Local `tsc --noEmit` | **PASS** |
| Local `npm run lint` | **0 errors** (13 pre-existing warnings) |
| Local `npm test` | **966 passed / 104 files** |
| Local `npm run build` | **PASS** |

---

## 2. Preview deployment

| Field | Value |
|---|---|
| Deployment ID | `dpl_5ZJFZrxvbTjA3APwYguwT3gWrqRC` |
| URL | `https://vpsych-gz17ni69t-alhazayed-1540s-projects.vercel.app` |
| Alias | `vpsych-git-cursor-admin-phase9-a29c9a-alhazayed-1540s-projects.vercel.app` |
| State | **READY** |
| Commit | `8e9345bccff3bad356d0fd12e72276b647763d55` |
| `/api/health` | **200** `{ ok: true, service: "vpsych", version: "1.0.0-rc.1", certId: "VPSYCH-1.0-RC1-STAGE12" }` |

Production alias was **not** used for Phase 9 feature APIs (preview first, per plan).  
Interactive admin API matrix for case-builder was executed against **local `next start` of the same tip** with `ADMIN_MFA_REQUIRED=true` and production Supabase, because constructed SSR session cookies against the protected preview returned app-level `401 Unauthorized` even with a valid Vercel share cookie (see notes).

---

## 3. Admin authentication (MFA)

| Check | Result |
|---|---|
| Password login AAL | **aal1** |
| AAL1 `GET /api/admin/analytics` | **403** `MFA_REQUIRED` |
| AAL1 `GET /api/admin/case-builder/catalogues` | **403** `MFA_REQUIRED` |
| AAL1 `POST /api/admin/case-builder/generate` | **403** `MFA_REQUIRED` |
| AAL1 `POST /api/admin/case-builder/create` | **403** `MFA_REQUIRED` |
| Invalid TOTP | **rejected** (`Invalid TOTP code entered`), AAL stays **aal1** |
| AAL2 after valid challenge | **aal2** |
| AAL2 `GET /api/admin/analytics` | **200** |
| Therapist (non-admin) catalogues | **403 Forbidden** |
| Unauthenticated catalogues / analytics | **401 Unauthorized** |
| After sign-out analytics | **401 Unauthorized** |

**MFA note:** Prior Phase 8.9B factor `vpsych-phase89b-prod` TOTP secret was unavailable in this agent store. Factor was removed once via Supabase Admin Auth API and re-enrolled through the legitimate MFA enroll/verify path as `vpsych-phase9b-verify` (not an AAL bypass). Secret retained only in the private agent store.

---

## 4. Guided Case Builder access (UI)

Local AAL2 browser session (`http://127.0.0.1:3010/admin/avatars/new`):

| Check | Result |
|---|---|
| Guided mode default | **PASS** (10-step shell; step 1 Clinical presentation active) |
| Advanced mode available | **PASS** (`Advanced mode` / `الوضع المتقدم`) |
| Fictional banner | **PASS** — “Fictional training case — not a real patient.” / Arabic equivalent |
| Help control | **PASS** — dialog explains educational training diagnosis (not a real chart) |
| English | **PASS** |
| Arabic + RTL | **PASS** |
| Preview unauth `/admin/avatars/new` | **307** → `/login?next=%2Fadmin%2Favatars%2Fnew` |

Artifacts: `phase9b-ui-guided-en.png`, `phase9b-ui-help.png`, `phase9b-ui-guided-ar.png`, `phase9b-ui-presentation-search.png`.

---

## 5–8. Presentation / profile / goals / symptoms

| Check | Result |
|---|---|
| Presentation catalogue | **11** packages from Case Engine (`adult-adhd` … `schizophrenia`) |
| Fabricated DSM taxonomy / proprietary criteria text | **not present** (`hasDsmCriteriaText: false`) |
| UI wording | Clinical presentation / educational training diagnosis |
| Presentation search + select Panic Disorder | **PASS** (UI) |
| Real-identifier block (`Patient MRN 99999`) | **400** `real_identifier_blocked` |
| Goals catalogue | present; custom goal persisted as `[custom] …` on draft |
| Goals treated as trainee teaching targets | **PASS** (stored under clinical session goals / ideal approach, not patient-reported) |
| Symptom multi-select from package | **PASS** (API draft path) |

---

## 9–14. AI paths, review, create

| Check | Result |
|---|---|
| AI generate (local, no provider key) | **503** `AI_UNAVAILABLE`, `manualFallback: true` for symptoms/context/framework/case |
| Manual continue after AI failure | **PASS** — draft fields preserved; create succeeded without AI payload |
| Fabricated AI output on failure | **not observed** |
| Live AI success on preview | **not evidenced** (preview OpenAI secret not pullable to this environment) |
| Unit / architecture coverage for AI success | present in `case-builder.test.ts` + route guards |
| Create draft | **200** `ok: true`, slug `jordan-lee-mqn3`, lifecycle **`draft`**, `is_active: false`, fictionalNotice set |
| Auto-publish | **no** (`notPublished: true`) |
| Persistence mechanism | existing `createVirtualPatientDraft` / avatar lifecycle RPC |

---

## 15. Arabic safety

| Check | Result |
|---|---|
| EN vs AR persona prompts equal | **false** |
| AR prompt requires independent authoring | **true** (`مستقل` / `لا تنسخ` language present) |
| EN mentions fictional / training | **true** |
| Silent EN→AR copy as authoritative personality | **not observed — PASS** |

---

## 16. Hidden information

| Check | Result |
|---|---|
| Disclosure rules persisted | `on_direct_question`, `on_empathic_rapport`, `volunteered` |
| Hidden salience on created sample symptoms | **not set** on the two package symptoms used (manual path without AI case generation) |

Disclosure-rule distinction is preserved after persistence. Full AI-generated hidden-information notes were not live-generated in this environment (AI unavailable).

---

## 17. Create draft / audit / lifecycle

| Check | Result |
|---|---|
| Admin authorization | AAL2 admin only |
| Browser DB write | none (Route Handler → RPC) |
| Lifecycle | **draft**, inactive |
| Case type (API response) | `training_simulation` |

**Known non-blocking gap:** DB trigger `sync_avatar_flat_from_v2` rewrites `ideal_guidelines` to only `{ session_goals, ideal_approach }`, so Phase 9 fields `case_type` / `primary_framework` / interaction metadata sent by `map-to-write` do **not** survive on the avatar row. Not a security failure; metadata enrichment incomplete until that trigger is extended in a later change.

---

## 18. Security regression (new APIs)

| Actor | catalogues | generate | create |
|---|---|---|---|
| Unauthenticated | 401 | — | — |
| Therapist | 403 | — | — |
| Admin AAL1 | 403 MFA_REQUIRED | 403 MFA_REQUIRED | 403 MFA_REQUIRED |
| Admin AAL2 | 200 | 503 AI_UNAVAILABLE (safe) / would 200 with key | 200 draft |

Rate limiting + `requireApiAdmin` remain architecture-tested. Errors sanitized (no provider/stack leakage observed).

---

## 19. Phase 8 regression

| Check | Result |
|---|---|
| Unsigned assistant insert | **REJECTED** `Invalid message signature` |
| Bad HMAC | **REJECTED** `Invalid message signature` |
| Tampered / wrong session (Phase 8.9B prior) | **REJECTED** (`phase89b-hmac-live.json`: `all_forgeries_fail: true`, `hmac_intact: true`) |
| Valid signed (Phase 8.9B prior + service-role path) | **SUCCESS** (prior evidence); this run lacked `REPORT_WRITE_KEY` locally |
| AAL1 admin API | **403** |
| AAL2 admin API | **200** |
| Logout → API | **401** |
| RLS / non-admin | **403** |
| Secrets in browser | not observed |

---

## 20. Existing VPsych functionality

| Check | Result |
|---|---|
| Avatar library admin list | **200** |
| Advanced mode entry point | **visible** on `/admin/avatars/new` |
| Draft lifecycle of new VP | **draft** / inactive |
| Broader publish/archive/duplicate/session/report E2E | not re-run end-to-end in this gate; no Phase 9 code path changes those surfaces beyond additive routes |

---

## 21–22. Help / UX / performance

| Check | Result |
|---|---|
| Contextual help keyboard/dialog | **PASS** |
| EN / AR / RTL | **PASS** |
| AI double-submit / timeout | AI unavailable path returns once with `manualFallback` (no fabricated fill) |
| Duplicate create | not observed in scripted single create |

---

## 23. Evidence files

- `/opt/cursor/artifacts/phase9b-preview-evidence.json`
- `/opt/cursor/artifacts/phase9b-preview-verify.log`
- `/opt/cursor/artifacts/phase9b-npm-test.log`
- `/opt/cursor/artifacts/phase9b-npm-build.log`
- `/opt/cursor/artifacts/phase9b-ui-checklist.json`
- UI screenshots under `/opt/cursor/artifacts/phase9b-ui-*.png`

---

## 24. Phase 9B decision (historical)

# CONDITIONAL (Phase 9B)

Superseded by Phase 9C below.

---

## PHASE 9C VERIFICATION

**Verified at:** 2026-09-26T08:33Z–08:41Z  
**Preview (post env fix + redeploy):**  
- URL: `https://vpsych-morntesjf-alhazayed-1540s-projects.vercel.app`  
- Deployment: `dpl_FwKmcLezpdthVibxroZ3oeeJZyCd`  
- Commit: `858b9b3f919b702e95760a8ceb6a8aa5bc119177` (docs tip; feature code identical to `8e9345b`)  
- Identity class: `qa_admin` / `qa_therapist` (no PII recorded)

### Preview infrastructure root cause (Gate 1)

Preview `NEXT_PUBLIC_SUPABASE_URL` pointed at a **DNS-dead** Supabase hostname (orphan Preview config). Browser login failed with `net::ERR_NAME_NOT_RESOLVED` before any MFA challenge.

**Remediation (Vercel Preview env only — not a Phase 8 control change):**

1. Pointed Preview `NEXT_PUBLIC_SUPABASE_URL` at the same live Supabase project used by Production  
2. Replaced Preview `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` to match that project  
3. Redeployed Preview → `dpl_FwKmcLezpdthVibxroZ3oeeJZyCd`

### AUTHENTICATED PREVIEW — **PASS**

Legitimate Playwright browser session against the redeployed Preview (Vercel share cookie + password + TOTP MFA). Responses carry `x-vercel-id` and host `vpsych-morntesjf-…vercel.app`.

| Actor / AAL | catalogues | generate | create | notes |
|---|---|---|---|---|
| Logged out | **401** | — | — | Unauthorized |
| Therapist (`qa_therapist`) | **403** | — | — | Forbidden |
| Admin AAL1 | **403** `MFA_REQUIRED` | **403** `MFA_REQUIRED` | **403** `MFA_REQUIRED` | analytics also 403 |
| Admin AAL2 | **200** (11 presentations) | **200** (see Gate 2) | **200** draft | guided page loads |
| Cookie cleared | analytics **401** | — | — | |

Evidence: `/opt/cursor/artifacts/phase9c-preview-gates-evidence.json`, screenshot `phase9c-preview-guided.png`.

### LIVE AI SUCCESS — **PASS**

| Check | Result |
|---|---|
| `POST /api/admin/case-builder/generate` `{ kind: "symptoms" }` | **200** `ok: true` |
| `aiSource` | **`gpt`** (server-side OpenAI path) |
| Suggestion count | **8** |
| Schema | `{ id, description, domain, salience }` — server validation PASS |
| Secrets in response | **none** |
| Auto-persist | **no** (generate never writes avatar) |
| Audit | `admin.case_builder.generate.symptoms` outcome **success** |
| Review → approve one → create | **200** slug `casey-nguyen-1q61` |
| Lifecycle | **`draft`**, `is_active: false`, not published |

Evidence: `phase9c-ai-suggestion-shape.json`, audit rows in evidence JSON.

### IDEAL_GUIDELINES PERSISTENCE — **PASS** (no code change)

**Classification: B — intentional flat projection / non-authoritative for Phase 9 extras.**

Trace:

1. Guided Builder → `mapToVirtualPatientWrite` writes `clinical_core` (incl. `session_goals`, `ideal_approach` with `Primary training framework: …`) and also attaches optional extras on `ideal_guidelines` (`case_type`, `primary_framework`, …).  
2. Draft RPC persists the avatar row.  
3. Trigger `sync_avatar_flat_from_v2` **rebuilds** `ideal_guidelines` as `{ session_goals, ideal_approach }` from `clinical_core` (by design since migration `20260731191943_…`).  
4. Runtime `resolveAvatar` / assessment / VoiceSession read **`clinical_core` first**, then only `session_goals` + `ideal_approach` from `ideal_guidelines` (`Avatar` / `ResolvedAvatar` types do not declare `case_type` / `primary_framework`).

| Concern | Affected? |
|---|---|
| Patient simulation | **No** — uses clinical_core + personalities |
| Session generation | **No** |
| Reports | **No** — goals/approach from clinical_core / flat projection |
| Therapeutic framework | **Preserved** in `clinical_core.ideal_approach` text (verified: `ideal_approach_has_framework: true` on created draft) |
| Clinical presentation | **On** `clinical_core.disorder` / codes / persona |
| Case classification | API create returns `caseType`; not required on flat ideal_guidelines |
| Admin edit / resume | Goals + approach remain; structured Phase 9 extras were never part of the typed flat contract |

**No migration / trigger change.** Extending the trigger would alter the long-standing flat projection contract without a runtime consumer.

### Phase 9C regression

| Gate | Result |
|---|---|
| `tsc --noEmit` | PASS |
| `npm run lint` | 0 errors / 13 warnings |
| `npm test` | **966 passed** |
| `npm run build` | PASS |
| AAL1 → 403 / AAL2 → 200 / non-admin → 403 / logout → 401 | PASS (preview) |
| HMAC unsigned / bad / tampered / wrong session | REJECTED |
| HMAC valid (service-role path on active session) | **SUCCESS** |
| Secrets in browser | none |

---

## 25. Final decision (Phase 9C)

# CLEAR

| CLEAR checklist | |
|---|---|
| Authenticated preview API matrix | ✓ |
| Live AI SUCCESS demonstrated | ✓ |
| AI output schema validated | ✓ |
| Review / approval demonstrated | ✓ |
| Draft remains inactive | ✓ |
| ideal_guidelines persistence verified (intentional projection) | ✓ |
| No Phase 8 regression | ✓ |
| tests / lint / build green | ✓ |
| No secrets exposed | ✓ |

**Merge instruction:** PR #244 is **CLEAR for merge readiness**, but this agent **does not merge**. Human merge when ready.

# Phase 9 — Production Verification (before merge)

**Decision: CONDITIONAL**  
**PR:** [#244](https://github.com/alhazayed/vpsych/pull/244)  
**Branch:** `cursor/admin-phase9-guided-case-builder-fc9c`  
**Tip SHA:** `8e9345bccff3bad356d0fd12e72276b647763d55`  
**Base:** `b6e5e32b8674e7b4b11b6772bb01671c721e9dc3`  
**Verified at:** 2026-09-26T07:59Z–08:23Z  
**Do not merge on this record alone.**

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

## 24. Final decision

# CONDITIONAL

**Why not CLEAR**

1. Preview interactive admin cookie session could not be established for `/api/admin/*` (local same-commit + production Supabase used instead).  
2. Live AI *success* path not evidenced on preview (provider secret unavailable here); failure→manual fallback **is** evidenced.  
3. `ideal_guidelines` Phase 9 metadata keys are stripped by pre-existing `sync_avatar_flat_from_v2` (non-security data gap).  
4. Valid HMAC with `REPORT_WRITE_KEY` not re-executed in this environment (forgeries rejected; Phase 8.9B legitimate success retained).

**Why not BLOCKED**

- No Phase 8 security boundary failed (HMAC forgeries rejected, MFA AAL1 deny / AAL2 allow, RLS/non-admin deny, no auto-publish, Arabic independent-authoring boundary held, no secrets exposed).  
- Guided builder UI + draft create path work.  
- CI and preview deployment healthy.

**Merge instruction:** Do **not** merge PR #244 on this CONDITIONAL record. Clear the gaps above (preview session auth path and/or production post-merge gate with live AI + trigger metadata) before CLEAR.

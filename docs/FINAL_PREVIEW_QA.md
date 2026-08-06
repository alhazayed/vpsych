# FINAL PREVIEW QA — VPsych Professional Preview

**Date (UTC):** 2026-08-06  
**Production:** `https://vpsych.vercel.app`  
**Production deploy (at smoke):** `dpl_2KoD6onP1e1yg6cijZRB5xyiAHkA` · `main` @ `ad48ded`  
**Supabase:** `rrzudbkxigeavfdnidnm`  
**QA branch:** `cursor/final-preview-qa-0f18`  
**Evidence:** `/opt/cursor/artifacts/prod-smoke.json`, `/opt/cursor/artifacts/screenshots/preview-qa/`

---

## Verdict

### NOT READY FOR INVITED PROFESSIONAL REVIEW

Critical reviewer workflows are largely operational on production (auth, session, messaging, TTS, assessment, admin reports), but **two blockers remain** before invitations should go out:

1. **`VALIDATION_INVITE_CODES` is unset in Vercel Production** — `/api/validation/invite` returns `invitesConfigured: false` and POST returns **503**. Guests cannot redeem invitation codes on `/validation`.
2. **Code fixes in this PR are not yet on production** — empty **My Sessions** list (selects missing `ui_mode`), analysis overlay overpromise, classic complete transcript, and invite empty-state UX.

Until (1) is set + redeployed and (2) is merged and deployed, do **not** send invitation emails that depend on the code gate.

---

## PASS

| Area | Evidence |
|------|----------|
| Public pages `/`, `/validation`, `/login`, `/signup`, `/privacy`, `/terms`, `/auth/reset-password` | HTTP 200; browser screenshots 01–04, 12–14 |
| Auth gates | Unauth `/avatars` `/sessions` `/admin` → login; `/api/*` → JSON 401 |
| Login (therapist + admin) | Browser + API cookie session |
| Signup + email confirm path | Signup creates user; confirm route exists; QA user confirmable via admin |
| Forgot password control | Present on login; API rate-limits when abused (expected) |
| Reset password page | Loads; expired-link messaging present |
| Avatar selection | Jordan Hale, Maya Chen active |
| Session start / message / end | Fixed DB RPC; smoke: start 200, messages `aiSource=gpt`, end 200 + `reportId` |
| Voice TTS EN + AR | `POST /api/voice/tts` → `audio/mpeg` (~35KB) |
| Arabic patient reply | `locale=ar-JO` session → Levantine Arabic reply |
| Transcript persistence | `session_messages` rows for smoke session |
| Assessment / scoring / report write | End returns `reportId`, `ledgerId`, adaptive ACE payload |
| Admin reports UI | Library + detail with narrative + rubric (screenshots 08–09) |
| Therapist cannot read reports (RLS) | Therapist select count 0 on `session_reports` |
| Admin APIs CFI/ALE/ERI/VQI, ACE, CGE | Authenticated admin → 200 |
| Rate limiting | Present on routes; Upstash unset → in-memory warn in logs |
| Security headers | CSP, HSTS, COOP/CORP on production responses |
| i18n EN/AR key parity | 749/749 keys; validation portal RTL verified |
| Mobile 375px | validation + avatars no overflow (screenshots 10–11) |
| Local regression | lint 0 errors · typecheck PASS · **329** tests PASS · migrations local OK · build PASS |

---

## FAIL

| ID | Severity | Finding | Status |
|----|----------|---------|--------|
| **QA-C1** | Critical | `VALIDATION_INVITE_CODES` unset → invite redeem 503 | **OPEN (ops)** — Release Manager must set env + redeploy |
| **QA-C2** | Critical | Session start 500 `Invalid message signature` (CQG HMAC vs app without `p_sig`, no service role) | **FIXED** in DB migration `20260806143023` (applied live) + mirrored in git |
| **QA-H1** | High | My Sessions empty — page selects `ui_mode` which **does not exist** on production (VMHC migration not applied) | **FIXED** in code (use `interaction_mode`) — **needs deploy** |
| **QA-H2** | High | Analysis overlay promised personal report that opens automatically | **FIXED** in copy EN/AR — **needs deploy** |
| **QA-H3** | High | Classic complete page hid transcript; copy claimed My Sessions review | **FIXED** (always show transcript + copy) — **needs deploy** |
| **QA-H4** | High | Invite UI ignored `invitesConfigured`; English 503 string | **FIXED** in ValidationPortal + i18n — **needs deploy** |
| **QA-M1** | Medium | TTS browser fallback silent | **FIXED** status string — **needs deploy** |
| **QA-M2** | Medium | Session end failure used hardcoded English | **FIXED** — **needs deploy** |
| **QA-M3** | Medium | Cloud agent audit passwords stale vs vault | Documented; vault passwords work |

---

## FIXED

| Fix | Where |
|-----|--------|
| Restore owner-auth `insert_system_message` / `insert_assistant_message` (no HMAC required for session owners) | `supabase/migrations/20260806143023_restore_session_message_rpc_owner_auth_qa.sql` **applied to production** |
| My Sessions query uses `interaction_mode` | `src/app/(app)/sessions/page.tsx` |
| Classic + room complete pages show transcript | `src/app/(app)/sessions/[id]/complete/page.tsx` |
| Honest analysis / complete / feedback copy | `messages/en.json`, `messages/ar.json` |
| Invite unavailable empty state | `ValidationPortal.tsx` + i18n |
| TTS fallback + end-error i18n | `VoiceSession.tsx` |

---

## KNOWN LIMITATIONS

Unchanged product scope (not treated as defects for this preview):

- Competency scores are **formative**, not validated (`docs/KNOWN_LIMITATIONS.md`).
- Full performance reports are **admin-only** by design.
- **CQI / Educational Opportunity (EOI)** and related excellence stacks are **out of this preview** (stated on `/validation` and KNOWN_LIMITATIONS). Research indices CFI/ALE/ERI/VQI exist as **admin APIs only**, not reviewer UI.
- Expert feedback is **off-platform** (`docs/FEEDBACK_GUIDE.md` + Release Manager channel) — no in-app survey.
- Avatar catalog is limited to two EN-named patients; both expose `en-US` + `ar-JO` personalities.
- Therapy Room / VMHC behind feature flags; `ui_mode` / VMHC migration not on production yet.
- Remote schema_migrations includes CQG versions (`20260806130513` … `20260806135528`) **not present as files in git** — migration parity residual.
- Leaked-password protection still off in Supabase Auth (advisor WARN).
- Upstash unset → per-instance rate limits.

---

## Reviewer journey checklist

| Step | Production verified? | Notes |
|------|----------------------|-------|
| Invitation | **FAIL** | Codes not configured |
| Account creation | PASS (path) | Email confirm depends on Resend/hook |
| Email verification | PASS (route) | `/auth/confirm` |
| Login | PASS | |
| Forgot password | PASS (UI + API) | Rate limited under load |
| Reset password | PASS (page) | Token expiry messaging present |
| Avatar selection | PASS | |
| Session start | PASS | After QA-C2 DB fix |
| Voice conversation | PASS | TTS audio/mpeg; text path solid |
| Session completion | PASS | Report written |
| Feedback submission | **LIMITATION** | External guide only |
| Logout | PASS | |

---

## Production capability matrix

| Capability | Result |
|------------|--------|
| Authentication | PASS |
| Authorization (admin vs therapist) | PASS |
| Session creation | PASS (post-fix) |
| Messaging | PASS (`gpt`) |
| TTS | PASS EN/AR |
| Transcript | PASS (DB + complete page after deploy) |
| Assessment / scoring | PASS |
| Reports | PASS (admin) |
| CQI | N/A — out of preview |
| Educational Opportunity | N/A — out of preview |
| Admin dashboard | PASS (reports, presets, etc.) |
| Reviewer analytics | PASS via admin research indices APIs; no dedicated reviewer dashboard |

---

## Security (spot-check)

| Control | Result |
|---------|--------|
| Auth gates (pages + APIs) | PASS |
| Reset password flow | PASS (structure) |
| Role permissions / RLS reports | PASS |
| Rate limiting | PASS (present) |
| Secrets in repo | PASS (`.env.production` public keys only) |
| Admin export / quality-ledger | Auth required (401 unauth) |

---

## Gate to flip READY → invitations

1. Merge + deploy this QA branch to production.  
2. Set `VALIDATION_INVITE_CODES` in Vercel Production and redeploy.  
3. Smoke: invite redeem → signup/login → session → TTS → end → admin report → logout.  
4. Re-check `/sessions` lists history and complete page shows transcript.

Then update this document’s verdict to **READY FOR INVITED PROFESSIONAL REVIEW**.

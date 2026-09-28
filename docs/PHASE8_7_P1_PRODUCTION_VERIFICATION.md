# Phase 8.7 — P1 Production Verification

**Date (UTC):** 2026-09-25T09:37:00Z  
**Cron verified (UTC):** 2026-09-25T10:19:24Z  
**Mode:** P1 release remediation (rebase → verify → merge → deploy → verify)  
**Vocabulary:** `PASS` | `FAIL` | `PARTIAL` | `WAITING` | `CLEAR` | `CONDITIONAL` | `BLOCKED`

---

## FINAL STATUS: CONDITIONAL

P1 is **merged and deployed** to production. P0 HMAC remains intact. Production P1 behavioral checks pass for errors, risk, Wave-3 parity, and Next.js. Post-deploy `expire-sessions.yml` scheduled run on `b627a79` **succeeded** (`HTTP 200`, secret not exposed). Admin MFA **enforcement code is live** (production default ON), but **no admin has verified MFA factors** (`0/7`), so the live “valid MFA succeeds” path is still not proven — criterion 2 remains **PARTIAL**, therefore status stays **CONDITIONAL** (not **CLEAR**).

---

## 1. PR #235

| Field | Value |
|-------|-------|
| URL | https://github.com/alhazayed/vpsych/pull/235 |
| Title | fix(security): Phase 8.3 P1 remediation (errors, MFA, risk, parity, Next) |
| Prior base | `cursor/admin-phase8-p0-remediation-fc9c` (draft) |
| Rebased onto | `main` @ `d4a59927cd48c2938773132ccb8cf8a17b308b4f` |
| Head after rebase + CI trigger | `e924015d5ac1364208d85f17e43cc9bc16acfbe2` |
| Merge strategy | **Merge commit** (repo convention) |
| Merged at (UTC) | `2026-09-25T09:32:50Z` |
| State | **MERGED** |

### Rebase safety

| Preserved | Evidence |
|-----------|----------|
| Phase 8 HMAC migration | `supabase/migrations/20260925120000_phase8_restore_message_hmac.sql` unchanged in PR diff |
| `prepareMessageRpc` / `signSessionMessage` | No diff vs `main` for `src/lib/supabase/admin.ts`, `src/lib/report-sign.ts` |
| RLS / cron config | Untouched |

---

## 2. Final commit / deployment

| Role | SHA / ID |
|------|----------|
| Pre-P1 production | `d4a59927cd48c2938773132ccb8cf8a17b308b4f` |
| Merge commit on `main` | `b627a795da9e991588d08808e8a800981ca64f9a` |
| Feature commit | `f0924e9` (P1) + empty `e924015` (CI trigger) |
| Vercel production deployment | `dpl_89HSgDz9RA8KuL6Gw7XW2pbw5A1G` |
| Deployment state | **READY** |
| Alias | `vpsych.vercel.app` |
| Health | `GET /api/health` → **200** `{"ok":true,...}` |
| Expected commit deployed | **PASS** (`meta.githubCommitSha` = `b627a79…`) |

---

## 3. CI

| Gate | Result |
|------|--------|
| PR CI `verify` (run `36118756472`) | **PASS** — success on `e924015` |
| Vercel preview | **PASS** |
| Main push CI after merge (run `36119048830`) | **PASS** — success on `b627a79` |
| Local `npm test` | **PASS** — 103 files / **945** tests |
| Local P1+P0 subset | **PASS** — 105 then 57 on production commit |
| Local `npm run lint` | **PASS** — 0 errors (13 pre-existing warnings) |
| Local `npm run build` | **PASS** |
| Local `npm audit --omit=dev` | **PASS** — 0 vulnerabilities |

---

## 4. P1 verification (repo + production commit)

### 4.1 Admin MFA / AAL2

| Check | Result | Evidence |
|-------|--------|----------|
| Server module present | **PASS** | `src/lib/admin-mfa.ts` — `isAdminMfaEnforced`, `evaluateAdminMfa`, AAL2 only |
| Wired into API + page guards | **PASS** | `requireApiAdmin` / `requireAdmin` call `auth.mfa.getAuthenticatorAssuranceLevel()` |
| Production default enforced | **PASS** | `ADMIN_MFA_REQUIRED` **absent** on Vercel; code defaults ON when `NODE_ENV=production` |
| Unit: aal1 denied when enforced | **PASS** | `admin-mfa.test.ts` |
| Unit: aal2 allowed when enforced | **PASS** | `admin-mfa.test.ts` |
| Direct unauthenticated API bypass | **PASS** | `GET /api/admin/analytics` → **401** `{"error":"Unauthorized"}` |
| Live admin aal1 → `MFA_REQUIRED` | **PARTIAL** | Not exercised with a live admin JWT in this run |
| Live admin aal2 success | **PARTIAL** | All production admins have **0** verified `auth.mfa_factors` — enrollment pending |

**Admin MFA overall:** **PARTIAL** (enforcement shipped; enrollment / live AAL2 success not proven)

### 4.2 Error allowlist + SSE sanitization

| Check | Result | Evidence |
|-------|--------|----------|
| Allowlist model | **PASS** | `ALLOWED_CLIENT_MESSAGES` in `api-errors.ts` |
| SQL/provider strings blocked | **PASS** | `api-errors.test.ts` |
| SSE uses `clientSafeStreamError` | **PASS** | `message/stream/route.ts` — client message sanitized; detail only in `console.error` |
| Admin voice routes | **PASS** | `sanitizeDbError` instead of raw `error.message` |
| Safe product errors still allowed | **PASS** | Allowlist includes `Unauthorized`, `MFA required`, etc. |
| Unauth responses stay product-safe | **PASS** | Production probes return allowlisted JSON only |

**Error handling overall:** **PASS**

### 4.3 Risk detection (EN / AR) + NOT_APPLICABLE / UNCERTAIN

| Check | Result | Evidence |
|-------|--------|----------|
| English risk inquiry detected | **PASS** | `education.test.ts` |
| Arabic risk inquiry detected | **PASS** | stem `هل راودتك أفكار عن الانتحار؟` |
| NOT_APPLICABLE → no auto-critical | **PASS** | `riskProfile.suicidal_ideation=none` → no `missed-risk` critical |
| UNCERTAIN for short transcripts | **PASS** | `resolveRiskInquiryStatus` when turns &lt; 3 and applicable |
| Code on production SHA | **PASS** | `b627a79` includes `session-evaluation.ts` changes |

**Risk overall:** **PASS**

### 4.4 Arabic / English Wave-3 evaluation parity

| Check | Result | Evidence |
|-------|--------|----------|
| Same dimension keys EN & AR | **PASS** | `clinical_formulation`, `differential_diagnosis`, `risk_formulation`, `educational_competency` |
| Unit parity assert | **PASS** | `report-locale.test.ts` — Wave-3 in both EN and AR |
| Native Arabic Wave-3 block | **PASS** | `أبعاد تعليمية إضافية (الموجة 3)` |

**Evaluation parity overall:** **PASS**

### 4.5 Next.js 16.3.6

| Check | Result | Evidence |
|-------|--------|----------|
| `package.json` | **PASS** | `"next": "16.3.6"` on `main` / production commit |
| Lockfile | **PASS** | `node_modules/next` → `16.3.6` |
| `npm audit --omit=dev` | **PASS** | 0 vulnerabilities |

**Dependency overall:** **PASS**

---

## 5. P0 regression (must remain intact)

| Check | Result | Evidence |
|-------|--------|----------|
| Live RPC HMAC bodies | **PASS** | `insert_assistant_message` / `insert_system_message` still `has_hmac=true`, Vault key used |
| Vault `report_write_key` | **PASS** | Present |
| Live unsigned forge | **PASS** | `_phase87_results.unsigned_forge` → `Invalid message signature` |
| Live invalid HMAC | **PASS** | `_phase87_results.invalid_hmac` → `Invalid message signature` |
| Unit message HMAC suite | **PASS** | `report-sign.test.ts` + `admin.test.ts` on production commit |
| PR did not modify P0 files | **PASS** | Empty diff for migration + `report-sign` + `admin.ts` vs pre-rebase main |

Fictional session id (marker `phase87_p1_verify`): `84882cdd-74f1-4d32-894c-edcaeb6f8df5`

**P0 overall:** **PASS**

---

## 6. Cron

| Item | Value |
|------|-------|
| Workflow | `expire-sessions.yml` (`*/15`) |
| Pre-deploy latest success | `2026-09-25T05:13:12Z` run `36097639232` on `dfe118c` |
| Post-`b627a79` scheduled run | **PASS** — run `36122904529` at `2026-09-25T10:14:35Z` |
| Event | `schedule` |
| Head SHA | `b627a795da9e991588d08808e8a800981ca64f9a` |
| Job | `expire` **success** |
| Production response | `HTTP 200` `{"ok":true,"scanned":1,"expired":0,"saturated":false}` |
| `CRON_SECRET` exposure | **PASS** — Actions log masks secret as `***`; Authorization header redacted |
| Health after cron | `GET /api/health` → **200** |
| Manual cron change | **Not performed** |

**Cron status:** **PASS**

---

## 7. Residual risks

1. **Admin MFA enrollment gap** — enforcement is ON in production by default, but **zero** verified MFA factors exist for admin profiles. Admins must enroll TOTP (Supabase Auth MFA) before AAL2 sessions can succeed. Until then, admin UI/API correctly deny with `MFA_REQUIRED` once an authenticated admin session is presented at AAL1.
2. **Live AAL2 success path** — not proven end-to-end in this run (no enrolled factors / no admin JWT exercise).
3. **Cron** — first post-deploy scheduled run **PASS** (see §6). Ongoing schedule health remains an ops watch item given prior overnight failures on older SHAs.
4. **Risk heuristic** — bilingual stems remain formative / incomplete by nature; not clinical validation.
5. **Scores** — competency scores remain unvalidated (product limitation unchanged).

---

## 8. Gate checklist vs CLEAR criteria

| Criterion | Status |
|-----------|--------|
| 1. P1 is deployed | **PASS** (`b627a79` / `dpl_89HSgDz9RA8KuL6Gw7XW2pbw5A1G`) |
| 2. Production P1 verification passes | **PARTIAL** (MFA live AAL2 success not proven — `0/7` admins with verified factors; other P1 items PASS) |
| 3. P0 remains intact | **PASS** |
| 4. First post-deployment cron run succeeds | **PASS** (run `36122904529`) |

### FINAL STATUS: **CONDITIONAL**

Not **CLEAR** (Admin MFA enrollment / live AAL2 success still open).  
Not **BLOCKED** (no P0 regression; P1 deployed; cron green).

---

## 9. Follow-up to reach CLEAR

1. Enroll verified MFA factors for at least one production admin; confirm `/api/admin/*` returns success at AAL2 and `403 MFA_REQUIRED` at AAL1.
2. Re-verify criterion 2 as **PASS**, then promote this document’s final status to **CLEAR**.

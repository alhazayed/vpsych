# Phase 8.3 — P1 Security Remediation

**Date:** 2026-09-25  
**Based on:** `docs/PHASE8_P0_P1_VERIFICATION.md`  
**Branch:** builds on Phase 8.2 message HMAC remediation

## Summary table

| Finding | Severity | Status after this phase |
|---------|----------|-------------------------|
| Error leakage (`clientSafeError` denylist) | P1 | **FIXED** — allowlist model |
| SSE raw `err.message` | P1 | **FIXED** |
| Admin MFA not enforced | P1 | **FIXED** (AAL2 when enforced; default on in production) |
| Risk detection EN-only / auto-critical | P1 | **FIXED** — AR stems + status enum |
| Examiner Wave-3 EN/AR parity | P1 | **FIXED** |
| Next.js `< 16.3.6` ImageResponse advisory | P1 | **FIXED** — `next@16.3.6` |

---

## 1. Error leakage

**Root cause:** `clientSafeError` used a denylist; short PostgREST strings could pass. SSE catch forwarded `err.message`.

**Change:**
- `src/lib/api-errors.ts` — `ALLOWED_CLIENT_MESSAGES` allowlist; unknown → fallback
- `clientSafeStreamError` for SSE
- `src/app/api/sessions/[id]/message/stream/route.ts` — sanitize error events; server `console.error` keeps detail
- Admin voice profile routes — `sanitizeDbError` instead of raw `error.message`

**Tests:** `src/lib/api-errors.test.ts` (SQL/constraint/relation strings rejected; stream helper)

**Residual risk:** Call sites that want a new product string must add it to the allowlist deliberately.

---

## 2. SSE

**Root cause:** catch block in stream route.

**Change:** as above — never emit raw `Error.message` to the client.

**Verification:** unit coverage via `clientSafeStreamError`; route uses helper.

---

## 3. Admin MFA

**Root cause:** `requireAdmin` / `requireApiAdmin` checked `profiles.role` only. Enterprise `mfa_required` was a dashboard flag.

**Change:**
- `src/lib/admin-mfa.ts` — `isAdminMfaEnforced`, `evaluateAdminMfa`, AAL2 gate
- Wired into `src/lib/api-auth.ts` (`requireApiAdmin`) and `src/lib/auth.ts` (`requireAdmin`)
- Uses Supabase `auth.mfa.getAuthenticatorAssuranceLevel()` — not UI state
- Therapists unaffected
- Env: `ADMIN_MFA_REQUIRED` — default **on** when `NODE_ENV=production`, **off** otherwise; explicit true/false overrides
- Deny responses: JSON `{ error: "MFA required", code: "MFA_REQUIRED" }` or redirect `/login?mfa=required`

**Tests:** `src/lib/admin-mfa.test.ts`

**Residual risk:** Operators must enroll admin TOTP factors before enabling production MFA (default). Set `ADMIN_MFA_REQUIRED=false` only as a temporary break-glass. Enrollment UX is Supabase Auth / product follow-up — enforcement is server-side.

---

## 4. Arabic / English risk detection

**Root cause:** Education heuristic used English-only regex; missing inquiry always `critical`.

**Change:**
- Bilingual `RISK_INQUIRY_RE` (EN + AR stems)
- `RiskInquiryStatus`: `DETECTED | NOT_DETECTED | NOT_APPLICABLE | UNCERTAIN`
- `resolveRiskInquiryStatus` — case risk profile with SI/self-harm `none` → `NOT_APPLICABLE` (no auto-critical)
- Short transcripts → `UNCERTAIN` (minor finding, not critical)
- `evaluateSession` accepts optional `riskProfile`

**Tests:** Arabic detection + NOT_APPLICABLE cases in `education.test.ts`

**Residual risk:** Heuristic stems are incomplete by nature; LLM examiner path remains separate.

---

## 5. Evaluation parity

**Root cause:** Wave-3 educational dimension block existed only in the English examiner prompt.

**Change:** Native Arabic Wave-3 instructions in `buildExaminerSystemPrompt` (`report-locale.ts`).

**Tests:** parity assert in `report-locale.test.ts` for both languages.

---

## 6. Next.js

**Before:** `16.3.4` (affected by GHSA-vcvr-r3jv-pc5j ImageResponse RCE range `<16.3.6`).  
**After:** `16.3.6` (exact).  
**Audit:** `npm audit --omit=dev` → 0 vulnerabilities.  
App still does not import `next/og`; upgrade closes the advisory range.

---

## Verification

```bash
npm test          # 945 passed
npm run typecheck # clean
npm audit --omit=dev  # 0
```

## Residual risk (global)

- Production Vault/`REPORT_WRITE_KEY` alignment still required for Phase 8.2 message HMAC when service role is unset.
- Admin MFA enrollment UX not built in this phase — enforcement only.
- Risk heuristic remains formative, not clinically validated.

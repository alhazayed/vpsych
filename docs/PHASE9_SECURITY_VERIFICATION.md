# Phase 9 — Security Verification

**Status:** PARTIAL (code + unit/architecture gates). Production AAL2/HMAC live re-check is required before Phase 9 CLEAR.  
**Phase 8 baseline:** FROZEN — not weakened by Guided Case Builder.

## Controls preserved

| Control | Status |
|---------|--------|
| `requireApiAdmin` on case-builder routes | PASS (architecture.test) |
| Rate limits on case-builder routes | PASS |
| MFA AAL2 unchanged (`admin-mfa.ts` untouched) | PASS |
| HMAC / `prepareMessageRpc` untouched | PASS |
| No secrets in GuidedCaseBuilder client | PASS (architecture.test) |
| Audit on generate/create | PASS (code review) |
| Create uses existing avatar draft RPC path | PASS |
| RLS: no new permissive policies | PASS (no migration opening RLS) |

## Required before CLEAR

| Check | Status |
|-------|--------|
| AAL1 `GET /api/admin/analytics` → 403 MFA_REQUIRED | NOT RUN (prod) |
| AAL2 same → 200 | NOT RUN (prod) |
| P0 HMAC forgery matrix on production | NOT RUN (prod) |
| Logout invalidates admin API | NOT RUN (prod) |
| Client bundle secret scan | NOT RUN |

## Intentionally not changed

- `src/lib/auth.ts`, `api-auth.ts`, `admin-mfa.ts`
- MFA pages / middleware
- `report-sign.ts`, `supabase/admin.ts` HMAC helpers
- Applied Phase 8 HMAC migrations

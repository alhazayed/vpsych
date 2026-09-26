# Phase 8.9 — Admin MFA UX & Bootstrap Verification

**Status:** CLEAR (production verified 2026-09-26)  
**Date:** 2026-09-25 (implementation) / 2026-09-26 (production release)  
**Release record:** `docs/PHASE8_9_PRODUCTION_RELEASE.md`  
**Production commit:** `db7c16b0333485cc6f3ebe5904bbef7cdcce2f90`  
**Deployment:** `dpl_GzX1uVxRs6udXvXa2XMuqGNbTgny`

## 8.8A diagnostic (read-only) — root cause

### ROOT CAUSE

AAL1 admins denied by `requireAdmin()` were redirected to `/login?mfa=required`. Middleware then treated authenticated users on `/login` as “already signed in” and redirected them to `safeRedirectPath(next)` with **fallback `/avatars`**. Login never rendered an MFA challenge. No enrollment route existed. Result: Overview (`/admin`) → MFA deny → login → **Avatar library**, with no path to enroll or verify TOTP.

### REDIRECT SOURCE

| Step | File | Function | Behavior |
|------|------|----------|----------|
| 1 | `src/lib/auth.ts` | `requireAdmin()` | AAL ≠ `aal2` → `redirect("/login?mfa=required")` *(pre-8.9)* |
| 2 | `src/lib/supabase/middleware.ts` | `updateSession()` | `user && isAuthPage` → `safeRedirectPath(null)` → `/avatars` |
| 3 | `src/lib/safe-redirect.ts` | `safeRedirectPath()` | Default fallback `/avatars` |

### Exact routes (code of record)

| Surface | Path |
|---------|------|
| A. Avatar / Virtual Patient (therapist catalog) | `/avatars` |
| A′. Admin Virtual Patients | `/admin/avatars` |
| B. Admin Overview / Dashboard | `/admin` |
| C. Admin Dashboard (same as Overview) | `/admin` |
| D. MFA enrollment | `/auth/mfa/enroll` |
| E. MFA verification / challenge | `/auth/mfa` |
| F. Login | `/login` |
| G. Auth callback | `/auth/callback` |

### AAL/MFA CONDITION

`isAdminMfaEnforced()` defaults **on** in production (`NODE_ENV=production`). Explicit `ADMIN_MFA_REQUIRED` is unset in Vercel → enforcement active. `getAuthenticatorAssuranceLevel()` must return `currentLevel === "aal2"`.

### WHY USER RETURNS TO AVATAR

Intentional post-login fallback (`/avatars`) was **unintentionally** reused as the MFA-deny landing via the login bounce. Not role mismatch, locale, or missing session.

### MFA ENROLLMENT ROUTE (pre-8.9)

**MISSING MFA BOOTSTRAP ROUTE** — fixed in Phase 8.9.

### BOOTSTRAP DEADLOCK

**YES (pre-8.9)** — resolved by AAL1-safe `/auth/mfa` + `/auth/mfa/enroll` and MFA deny → challenge URL (not `/login`).

---

## 8.9 fix — routes & flows

### Routes

| Route | Guard | AAL2 required? | Purpose |
|-------|-------|----------------|---------|
| `/auth/mfa` | `requireAdminIdentity()` | No | Challenge existing verified TOTP |
| `/auth/mfa/enroll` | `requireAdminIdentity()` | No | First-time TOTP enroll + verify |
| `/admin/*` | `requireAdmin()` | Yes (when enforced) | Protected admin UI |
| `/api/admin/*` | `requireApiAdmin()` | Yes (when enforced) | Protected admin APIs |

### Enrollment flow

1. Authenticated admin, no verified TOTP factor  
2. `/auth/mfa/enroll` → Supabase `mfa.enroll({ factorType: "totp" })`  
3. QR + manual secret rendered in UI only (never logged)  
4. User enters 6-digit code → `challenge` + `verify`  
5. Factor verified → session AAL2 → redirect to safe `next` (default `/admin`)

### Challenge flow

1. Authenticated admin with verified factor, AAL1  
2. `/auth/mfa` → 6-digit input → `challenge` + `verify`  
3. AAL2 → safe `next`

### Login routing

After password login, `resolveAdminPostLoginPath()` sends enforced admins to enroll or challenge (not straight to `/admin` / `/avatars`).

### Legacy loop fix

- `requireAdmin` MFA deny → `adminMfaChallengeHref(path)` (`/auth/mfa?next=…`)  
- Middleware: `/login?mfa=required` → `/auth/mfa`  
- Anonymous `/auth/mfa*` → `/login?next=…`

Open redirects blocked via `safeRedirectPath` / `adminMfaReturnPath`.

---

## Security checks

| Check | Result |
|-------|--------|
| AAL1 blocked from protected admin APIs | **PASS** (live prod 403 `MFA_REQUIRED`) |
| AAL2 allowed | **PASS** (live prod 200) |
| Enrollment does not require AAL2 | `requireAdminIdentity` only |
| Non-admin cannot use MFA bootstrap | Redirect `/avatars` |
| Client role not sole auth | Server `profiles.role` + Supabase session |
| Secrets not logged | Architecture test: no `console.*` in enroll client |
| HMAC / Phase 8 P0 | **PASS** (live forgery rejects + legitimate insert) |

---

## Automated regression

| Check | Result |
|-------|--------|
| GitHub CI on PR tip / merge | SUCCESS |
| `npm test` (post-deploy) | PASS — 955 tests |
| `npm run lint` | PASS — 0 errors |
| `npm run build` | PASS — `/auth/mfa`, `/auth/mfa/enroll` |

---

## Production verification (2026-09-26)

| Item | Status |
|------|--------|
| PR #242 merged | **PASS** → `db7c16b` |
| Vercel production READY | **PASS** `dpl_GzX1uVxRs6udXvXa2XMuqGNbTgny` |
| `/api/health` | **200** |
| `/auth/mfa` no longer 404 | **PASS** (307 → login when unauthenticated) |
| MFA enrollment in production | **PASS** (Audit Admin 0→1 verified factor) |
| AAL2 after enroll | **PASS** |
| Challenge after re-login | **PASS** → `/auth/mfa` (not `/avatars`) |
| Invalid TOTP | **REJECTED** (AAL1 retained) |
| AAL1 API deny | **403 MFA_REQUIRED** |
| AAL2 API allow | **200** |
| Logout | **401** |
| Verified admin factors | **2/7** |
| P0 HMAC | **CLEAR** |
| Cron `expire-sessions` | Last 5 runs success (no code change) |

### Admin enrollment process (operators)

Each remaining admin (5/7):

1. Sign in at `/login`  
2. Complete `/auth/mfa/enroll` (or `/auth/mfa` if already enrolled)  
3. Confirm Overview `/admin` loads at AAL2  

Do **not** mint factors via service role / SQL.

---

## FINAL STATUS

**CLEAR**

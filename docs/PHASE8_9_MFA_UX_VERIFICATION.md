# Phase 8.9 — Admin MFA UX & Bootstrap Verification

**Status:** CONDITIONAL (implementation complete; live production UX verification pending deploy)

**Date:** 2026-09-25

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
| D. MFA enrollment | **MISSING pre-8.9** → now `/auth/mfa/enroll` |
| E. MFA verification / challenge | **MISSING pre-8.9** → now `/auth/mfa` |
| F. Login | `/login` |
| G. Auth callback | `/auth/callback` |

### AAL/MFA CONDITION

`isAdminMfaEnforced()` defaults **on** in production (`NODE_ENV=production`). Explicit `ADMIN_MFA_REQUIRED` is unset in Vercel → enforcement active. `getAuthenticatorAssuranceLevel()` must return `currentLevel === "aal2"`.

### WHY USER RETURNS TO AVATAR

Intentional post-login fallback (`/avatars`) was **unintentionally** reused as the MFA-deny landing via the login bounce. Not role mismatch, locale, or missing session.

### MFA ENROLLMENT ROUTE (pre-8.9)

**MISSING MFA BOOTSTRAP ROUTE** — enforcement only (Phase 8.3 / docs residual risk).

### BOOTSTRAP DEADLOCK

**YES** — all `/admin/*` pages call `requireAdmin()` (AAL2), while enrollment UI did not exist and the only MFA redirect was eaten by middleware.

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

## Security checks (design)

| Check | Result |
|-------|--------|
| AAL1 blocked from protected admin APIs | Unchanged (`requireApiAdmin` + `MFA_REQUIRED`) |
| AAL2 allowed | Unchanged |
| Enrollment does not require AAL2 | `requireAdminIdentity` only |
| Non-admin cannot use MFA bootstrap | Redirect `/avatars` |
| Client role not sole auth | Server `profiles.role` + Supabase session |
| Secrets not logged | Architecture test: no `console.*` in enroll client |
| HMAC / Phase 8 P0 | Untouched |

---

## Automated regression (this branch)

| Check | Result |
|-------|--------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (0 errors; pre-existing warnings) |
| `npm test` | PASS — 951 tests |
| `npm run build` | PASS — emits `/auth/mfa`, `/auth/mfa/enroll` |

---

## Production verification

| Item | Status |
|------|--------|
| MFA challenge usable in production | PENDING deploy of this PR |
| MFA enrollment usable in production | PENDING deploy |
| AAL1 API deny / AAL2 allow | Proven in Phase 8.8 (unchanged guards) |
| Invalid TOTP rejected | Proven in Phase 8.8; UX surfaces safe error |
| Logout | Client `signOut` on MFA pages → `/login` |
| Verified admin factors | **1/7** (unchanged — do not auto-enroll remaining six) |
| P0 HMAC | CLEAR (no change) |

### Admin enrollment process (operators)

Each remaining admin should:

1. Sign in at `/login`  
2. Complete `/auth/mfa/enroll` (or `/auth/mfa` if already enrolled)  
3. Confirm Overview `/admin` loads at AAL2  

Do **not** mint factors via service role / SQL.

---

## FINAL STATUS

**CONDITIONAL**

Implementation and automated regression are complete. Mark **CLEAR** only after production deploy proves enroll + challenge UX for a dedicated QA admin without Avatar bounce.

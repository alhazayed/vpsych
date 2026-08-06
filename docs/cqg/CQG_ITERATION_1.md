# CQG Continuous Quality Guardian — Iteration 1

**Date:** 2026-08-06  
**Branch:** `cursor/cqg-critical-high-remediation-e2e6`  
**Baseline:** `main` @ Professional Preview RC1 (`d4c4fae`)

## Bugs fixed

| Bug ID | Severity | Root cause | Fix |
|---|---|---|---|
| CQG-001 | Critical | `append_quality_ledger` EXECUTE granted to `authenticated` with no authz; SECURITY DEFINER bypasses RLS → therapists can forge Quality Ledger SSOT | Migration `20260806130513_…`: service_role gate in body + REVOKE from authenticated |
| CQG-002 | High | `log_security_event` / `log_quality_ledger_access` writable by any authenticated user → audit trail pollution | QL access → service_role only; security audit → admin or service_role; app prefers service client |
| CQG-003 | High | ACE persist used user client after scoring RLS lockdown → silent no-op | End route runs ACE with `createServiceClient()` after report |
| CQG-004 | High | `runAceAfterAssessment` awaited before report insert → hang can leave terminal session without report | Report insert/seal first; ACE fire-and-forget after |
| CQG-005 | High | `/end` returned `coachSummary` with overall score to therapists | Omit adaptive/coach payload from therapist response |
| CQG-006 | High | `QL learner read own ledgers` RLS exposed VQI/scores to therapists | DROP learner SELECT policy (admin-only) |
| CQG-007 | High | OSCE / `feedback_mode: none` still showed diagnosis in UI + create API | `shouldHideGroundTruth()` hides presentation, goals, create `diagnosis` |
| CQG-008 | High | User message inserted before patient reply; failures left orphan turns | Compensating delete via service role on reply/assistant failure |
| CQG-009 | Critical | Idle expiry marked sessions expired without invoking `/end` → no report | `EnsureSessionReport` on complete page POSTs `/end` (idempotent) |

## Files changed

- `supabase/migrations/20260806130513_cqg_harden_privileged_rpcs_ql_rls.sql`
- `supabase/migrations/20260806130749_cqg_append_ledger_body_gate.sql`
- `src/app/api/sessions/[id]/end/route.ts`
- `src/app/api/sessions/[id]/message/route.ts`
- `src/app/api/sessions/route.ts`
- `src/lib/security-audit.ts`
- `src/lib/supabase/admin.ts`
- `src/lib/exam-disclosure.ts` (+ test)
- `src/lib/architecture.test.ts`
- `src/components/EnsureSessionReport.tsx`
- `src/components/VoiceSession.tsx`
- `src/app/(app)/sessions/[id]/complete/page.tsx`
- `messages/{en,ar}.json`

## Regression tests

- `src/lib/exam-disclosure.test.ts`
- Architecture invariants for end-before-ACE, no coachSummary, OSCE hide, orphan compensation
- Existing suite (vitest / lint / typecheck / migrations / build)

## Production follow-up

1. Apply migrations `20260806130513` + `20260806130749` (already applied to prod `rrzudbkxigeavfdnidnm`) to project `rrzudbkxigeavfdnidnm`.
2. Redeploy app so end-route / UI remediations are live.
3. Smoke: therapist cannot `rpc append_quality_ledger`; OSCE session create omits `diagnosis`; complete page triggers report for expired sessions.

## Remaining (not Critical/High in this pass)

- Concurrent `/end` double-assessment cost (unique constraint prevents duplicate reports) — Medium
- Auth leaked-password protection disabled (ops dashboard) — Medium / ops
- SECURITY DEFINER helper EXECUTE advisories for intentional RPCs (`is_admin`, message inserts) — accepted with in-body authz

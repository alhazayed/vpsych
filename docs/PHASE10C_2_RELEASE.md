# Phase 10C-2 — Release Record (CLEAR)

**Phase:** 10C-2 Guided Edit / Resume  
**Date (UTC):** 2026-09-27  
**PR:** [#251](https://github.com/alhazayed/vpsych/pull/251)  
**Final status:** **CLEAR**  
**Phase 10C-3:** not started

---

## Root cause

`public.sync_avatar_flat_from_v2()` (trigger `trg_sync_avatar_flat_from_v2`) rebuilt `avatars.ideal_guidelines` as only `{ session_goals, ideal_approach }` whenever `clinical_core` was updated. Guided Edit merge correctly wrote `communication_style`, but the trigger discarded it on every `admin_update_virtual_patient` call.

## Fix

Migration `20260927092011_preserve_ideal_guidelines_extras.sql` changes the trigger to:

```sql
NEW.ideal_guidelines := existing_guidelines || jsonb_build_object(
  'session_goals', goals,
  'ideal_approach', approach
);
```

No new columns. Merge-only Guided Edit contract unchanged. Application merge path (`guided-merge.ts` → `buildRpcPayload` → RPC) was already correct.

## Migration

| Field | Value |
|---|---|
| Version | `20260927092011` |
| Name | `preserve_ideal_guidelines_extras` |
| Production Supabase | `rrzudbkxigeavfdnidnm` — present |
| Trigger live | `has_merge_concat = true`, wipe-only assignment absent |

## Merge

| Field | Value |
|---|---|
| Merge commit | `71e36f16e89329ce21b4c55981292d64b7280d78` |
| Merged at (UTC) | 2026-09-27T09:28:23Z |
| Head before merge | `9d9ac396202f79f012490e9e4e06ffd628e9a340` |
| Pre-merge CI | GREEN (`verify` SUCCESS, Vercel SUCCESS) |

## Production deployment

| Field | Value |
|---|---|
| Deployment | `dpl_3imnPZhKV6SUkuyXTR5DYQkSHgBM` |
| State | READY |
| Alias | `https://vpsych.vercel.app` |
| Commit | `71e36f16e89329ce21b4c55981292d64b7280d78` (= merge SHA) |
| `/api/health` | **200** |

## Verification (production)

Disposable fictional draft from LENA duplicate `cbc09390-718e-45d1-815d-07d1fde0d449` (+ stub fixture).

| Gate | Result |
|---|---|
| `communication_style` persists | PASS |
| Guided reload returns `communicationStyle` | PASS |
| `session_goals` / `ideal_approach` / extras preserved | PASS |
| Symptom-only merge safe | PASS |
| Context (`PHASE10C2_CONTEXT_MARKER`) byte-identical | PASS |
| Authored Arabic preserved | PASS |
| Stub Arabic remains stub | PASS |
| AI reject → no write | PASS |
| AI approve → only style | PASS |
| Published 409 immutable | PASS |
| Duplicate → draft / inactive / editable | PASS |
| Readiness (Phase 10B) consistent on save/load | PASS |
| Auth 401 / 403 / MFA_REQUIRED / AAL2 | PASS |

Evidence: `/opt/cursor/artifacts/phase10c2-release-prod-verify.json` — **44/44 PASS**.

## Automated gates (release gate re-run)

| Command | Result |
|---|---|
| `npm test` | **1044** passed / 108 files |
| `npm run lint` | 0 errors (13 warnings) |
| `npm run typecheck` | pass |
| `npm run build` | pass |
| Security focused (`architecture` + `admin-mfa` + `report-sign` + `edit-integrity` + `guided-edit`) | **129** passed |

## Security regression

Phase 8 controls unchanged in #251 (no MFA / AAL2 / HMAC / RLS / auth / rate-limit / audit / report-signing edits). Production auth matrix and focused suites PASS.

## Scope of #251

Guided Edit merge (`avatarToGuidedDraft`, change tracking, merge PATCH, UI), i18n strings, architecture/tests, docs, and the single preserve-extras migration. No Phase 10C-3 work. No secrets. No unrelated features.

## Final decision

**CLEAR**

STOP. Do not begin Phase 10C-3.

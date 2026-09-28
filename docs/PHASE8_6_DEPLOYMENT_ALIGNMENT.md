# Phase 8.6A — Deployment Alignment for Message Signing

**Date (UTC):** 2026-09-25  
**Gate:** Production application ↔ live HMAC-enforced database

Vocabulary: `PASS` | `FAIL` | `BLOCKED` | `NOT VERIFIED`

---

## PHASE 8.6A STATUS: CLEAR

Production Vercel now runs the merge of PR #234 (`prepareMessageRpc` + server signing). Live DB HMAC remains enforced. Unsigned/invalid/tampered RPC calls are rejected; legitimate signed and service-role writes succeed; report generation succeeds.

---

## Commits

| Role | SHA |
|------|-----|
| Previous production | `dfe118c` (Phase 7) |
| New production | `d4a59927cd48c2938773132ccb8cf8a17b308b4f` |
| Feature commit in merge | `9ae1a68` (Phase 8.2 fix) |

---

## PR #234

| Field | Value |
|-------|-------|
| URL | https://github.com/alhazayed/vpsych/pull/234 |
| Title | fix(security): Phase 8.2 restore message HMAC (P0 transcript integrity) |
| Base | `main` |
| Merged at (UTC) | 2026-09-25T09:07:33Z |
| Merge strategy | **Merge commit** (repo convention) |
| Pre-merge CI | CI `verify` SUCCESS · Vercel preview SUCCESS |
| Mergeable | CLEAN / MERGEABLE |
| Draft | Marked ready for review, then merged |

### Code verification (pre-merge)

| Check | Result |
|-------|--------|
| `prepareMessageRpc` present | PASS — `src/lib/supabase/admin.ts` |
| Server-side signing | PASS — `signSessionMessage` / `buildSignedMessageRpcArgs` in `src/lib/report-sign.ts` |
| HMAC secret source | `REPORT_WRITE_KEY` (server env only) |
| Browser cannot access HMAC secret | PASS — no client/component references; not `NEXT_PUBLIC_*` |
| Service-role not client-exposed | PASS — `SUPABASE_SERVICE_ROLE_KEY` server-only via `createServiceClient` |
| Unrelated changes | PASS — message signing + migration doc/tests only |

---

## CI result (post-merge)

| Check | Result |
|-------|--------|
| GitHub Actions `CI` on `main` push | **PASS** — run `36116690877` conclusion `success` |

---

## Vercel production deployment

| Field | Value |
|-------|--------|
| Deployment id | `dpl_8kJcT2Mxx1Yn1m5LALcUa67goSzY` |
| Git SHA | `d4a59927cd48c2938773132ccb8cf8a17b308b4f` |
| Target | production |
| State | **READY** |
| Alias | `vpsych.vercel.app` (among others) |
| Health | `GET /api/health` → **200** `{"ok":true,...}` |
| Auth gate | `POST /api/sessions` unauthenticated → **401** |

**Result:** PASS

---

## HMAC configuration verification

| Item | Result | Notes (no secret values) |
|------|--------|---------------------------|
| Signing env var | `REPORT_WRITE_KEY` | Present on Vercel **production**; visibility secret / server-only |
| Compatibility comment | PASS | Vercel comment: matches Vault `report_write_key` |
| Vault secret present | PASS | Confirmed Phase 8.5 (`vault_key_ready`) |
| Alternate trusted path | `SUPABASE_SERVICE_ROLE_KEY` | Present on Vercel **production**; bypasses HMAC inside SECURITY DEFINER by design |
| Client exposure | PASS | Neither key is `NEXT_PUBLIC_*` |

**Result:** PASS (not BLOCKED)

---

## Post-deployment security tests

Fictional session `79815c2c-f6e1-43c4-ad15-576598dbb778` (marker `phase86a_deploy_verify`; no real patient data). Results in `public._phase86a_results`.

| Test | Expected | Outcome |
|------|----------|---------|
| Unsigned RPC forge | REJECTED | **PASS** |
| Invalid HMAC | REJECTED | **PASS** |
| Tampered content | REJECTED | **PASS** |
| Wrong-session signature | REJECTED | **PASS** |
| Legitimate signed message | SUCCESS | **PASS** |
| Service-role app path (matches prod `messageRpcClient`) | SUCCESS | **PASS** |
| Report generation (`create_session_report`) | SUCCESS | **PASS** |
| Browser receives HMAC secret | Must not | **PASS** (architecture + env visibility) |

Live DB still reports HMAC enforcement on both message RPCs (unchanged from Phase 8.5 CLEAR).

---

## Cron verification

| Check | Result |
|-------|--------|
| Workflow file | Present — `.github/workflows/expire-sessions.yml` |
| Vercel `CRON_SECRET` | Present (production + preview); value not disclosed |
| Latest scheduled run before this deploy | **SUCCESS** — run `36097639232` (2026-09-25T08:24:59Z) |
| Manual `workflow_dispatch` from this agent | **NOT VERIFIED** — GitHub returned HTTP 403 (integration cannot dispatch) |
| Cron route on new production | Endpoint reachable; unauthenticated call does not succeed with privileged action (auth required) |

**Result:** PASS for configuration + last green schedule; post-deploy scheduled run pending next `*/15` tick (**NOT VERIFIED** for a run *after* `d4a5992` due to dispatch ACL).

---

## Local regression (on `d4a5992`)

| Command | Result |
|---------|--------|
| `npm test` | **PASS** — 102 files / **934** tests |
| `npm run lint` | **PASS** — 0 errors (13 warnings) |
| `npm run build` | **PASS** |

Note: 934 tests (not 945) because Phase 8.3 (#235) is not yet on `main`; expected for 8.6A scope (PR #234 only).

---

## Alignment summary

```
Browser
  → authenticated Route Handlers (production @ d4a5992)
  → prepareMessageRpc / messageRpcClient
       → service_role (configured) OR REPORT_WRITE_KEY HMAC p_sig
  → insert_*_message (live HMAC-enforced DB)
  → session_messages
  → evaluation / create_session_report
```

Forge via PostgREST without valid signature remains **REJECTED**.

---

## Final gate

| Criterion | Status |
|-----------|--------|
| App deploy includes prepareMessageRpc signing | PASS |
| Production SHA = merge of #234 | PASS |
| Live DB HMAC still active | PASS |
| Legitimate writes work | PASS |
| Forgery rejected | PASS |
| Report generation works | PASS |

### PHASE 8.6A STATUS: CLEAR

Safe to proceed to final certification when scheduled. Recommended non-blocking follow-ups: merge Phase 8.3 (#235) and confirm next scheduled expire-sessions run against `d4a5992`.

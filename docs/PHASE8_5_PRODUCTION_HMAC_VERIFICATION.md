# Phase 8.5 — Production P0 HMAC Restoration Verification

**Date (UTC):** 2026-09-25T09:02:03Z  
**Mode:** Production apply + live boundary verification (not git-only)

Vocabulary used exactly: `PASS` | `FAIL` | `BLOCKED` | `NOT VERIFIED`

---

## PHASE 8.5 STATUS: CLEAR

Live production database now enforces CQG-011 HMAC on `insert_assistant_message` / `insert_system_message`. Direct authenticated forgery without a valid signature is rejected.

---

## 1. Production database identified

| Field | Value |
|-------|-------|
| Project name | `vpsych` |
| Project ref / id | `rrzudbkxigeavfdnidnm` |
| Region | `us-east-1` |
| Host | `db.rrzudbkxigeavfdnidnm.supabase.co` |
| App URL binding | Vercel production `NEXT_PUBLIC_SUPABASE_URL` points at this project ref |
| Evidence sources | `docs/DEPLOYMENT_GUIDE.md`, `docs/PHASE7_PRODUCTION_CERTIFICATE.md`, Vercel env |

**Not targeted:** `vpsych-qa` (`eitygsgfvetklhlglibs`), other org projects, local DB.

**Result:** PASS

---

## 2. Migration applied

| Field | Value |
|-------|-------|
| Git file | `supabase/migrations/20260925120000_phase8_restore_message_hmac.sql` |
| Apply method | Supabase MCP `apply_migration` (`name=phase8_restore_message_hmac`) |
| SQL body | Unmodified from repository file |
| Initial ledger version from MCP | `20260925085909` |
| Ledger aligned to git filename | Updated to `20260925120000` / `phase8_restore_message_hmac` |
| Vault dependency | `vault.decrypted_secrets.name = 'report_write_key'` — **present** (`vault_key_ready=true`) before apply |

**Result:** PASS

---

## 3. Migration timestamp

| Event | Timestamp |
|-------|-----------|
| Apply completed | 2026-09-25 (MCP apply success; ledger row recorded as version `20260925120000`) |
| Verification document UTC | 2026-09-25T09:02:03Z |

**Result:** PASS

---

## 4. Migration ledger verification

```
version = 20260925120000
name    = phase8_restore_message_hmac
```

Confirmed via `supabase_migrations.schema_migrations`.

**Result:** PASS

---

## 5–7. RPC / grants / HMAC verification (live `pg_proc`)

| Function | auth EXECUTE | anon EXECUTE | service_role EXECUTE | `has_hmac` | `checks_sig` | uses vault key |
|----------|--------------|--------------|----------------------|------------|--------------|----------------|
| `insert_assistant_message(uuid,text,text)` | true | false | true | **true** | **true** | true |
| `insert_system_message(uuid,text,text)` | true | false | true | **true** | **true** | true |

Pre-apply baseline was `has_hmac=false` / `checks_sig=false` (Phase 8.4 blocker).

**Result:** PASS

---

## 8–12. Live attack / legitimate tests

Dedicated fictional session (no real patient content):

| Field | Value |
|-------|-------|
| Session id | `f7af0f05-ca59-4e62-969b-edeefc889f01` |
| Marker | `clinical_snapshot.phase85_hmac_verify=true`, label `PHASE85_HMAC_FICTIONAL_TEST` |
| Owner | existing therapist profile (JWT claim impersonation in SQL) |
| Results table (audit) | `public._phase85_hmac_results` |

| Step | Expected | Outcome | Detail |
|------|----------|---------|--------|
| A — assistant RPC, no HMAC | REJECTED | **PASS** | `Invalid message signature` |
| A2 — system RPC, no HMAC | REJECTED | **PASS** | `Invalid message signature` |
| B — invalid HMAC | REJECTED | **PASS** | `Invalid message signature` |
| C — sig for content X, body Y | REJECTED | **PASS** | `Invalid message signature` |
| D — wrong session id | REJECTED | **PASS** | `Session not found` |
| D2 — sig bound to other session id | REJECTED | **PASS** | `Invalid message signature` |
| U — other therapist + valid-looking sig | REJECTED | **PASS** | `Not authorized` |
| E — owner + valid HMAC assistant | SUCCESS | **PASS** | row inserted |
| E2 — `service_role` without `p_sig` | SUCCESS | **PASS** | trusted server path |
| E3 — owner + valid HMAC system | SUCCESS | **PASS** | row inserted |
| admin_test guard body still present | PRESENT | **PASS** | `enforce_session_insert_guard` |

**Direct-forgery / invalid-HMAC / modified-message / modified-session / legitimate-message:** PASS

---

## 13. Report-generation test

| Check | Result |
|-------|--------|
| `create_session_report` exists | PASS |
| Fictional signed report write for test session | PASS (`session_reports` row exists; `report_count=1`) |
| Transcript → evaluation → report chain unbroken by HMAC restore | PASS (legitimate assistant/system rows persisted; report RPC accepted signed payload) |

---

## 14. Application deployment verification

| Check | Result | Notes |
|-------|--------|-------|
| Production Vercel SHA | `dfe118c` (Phase 7 main) | PR #234 / #235 **not merged/deployed** yet |
| `SUPABASE_SERVICE_ROLE_KEY` on production | **PRESENT** | Legitimate message RPCs use `messageRpcClient` → service role → HMAC bypass by design |
| `REPORT_WRITE_KEY` on production | **PRESENT** | Comment: matches Vault `report_write_key` |
| Browser possesses HMAC secret | **PASS (no)** | No `NEXT_PUBLIC_*` report/service secrets; only anon URL/key |
| `prepareMessageRpc` live on production deploy | **NOT VERIFIED** | Code exists on Phase 8 branches; production still on `dfe118c` which uses service-role fallback without `p_sig` — **safe while SERVICE_ROLE is set** |
| Server-side signing path after merge | PASS (repo) | `src/lib/report-sign.ts` + `prepareMessageRpc` on remediation branches |

**Operational residual:** Merge/deploy PR #234 (and stacked #235) so production also signs when service role is unset. Does **not** reopen the forge while service role remains configured.

---

## 15. Regression test results

| Command | Result |
|---------|--------|
| `npm test` (full) | **PASS** — 103 files / 945 tests |
| `npm test` message-integrity subset (`report-sign`, `admin`, `architecture`) | **PASS** — 72 tests |
| `npm run lint` | **PASS** — 0 errors (13 pre-existing warnings) |
| `npm run build` | **PASS** |

---

## Security boundary (post-apply)

```
Browser (therapist JWT + anon key)
  → PostgREST insert_*_message without/invalid p_sig
  → REJECTED (Invalid message signature)     ✅ live-proven

Trusted server (SERVICE_ROLE on Vercel production)
  → insert_*_message (HMAC bypass)
  → session_messages                         ✅ live-proven (E2)

Signed authenticated path (Vault key)
  → valid p_sig over sessionId\\ncontent\\nrole
  → session_messages                         ✅ live-proven (E/E3)

session_messages → create_session_report     ✅ live-proven (R)
```

---

## Final gate

| Gate | Status |
|------|--------|
| Live HMAC protection confirmed on production DB | **CLEAR** |
| Git-only / PR-only success claimed | No — live `pg_proc` + attack tests required and passed |

### PHASE 8.5 STATUS: CLEAR

Safe to proceed to Phase 8.6 when scheduled. Recommended follow-up (non-blocking for this gate): merge/deploy Phase 8.2–8.3 application PRs so `prepareMessageRpc` is live on Vercel.

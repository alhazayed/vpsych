# Phase 8.2 — P0 Message Integrity Remediation

**Date:** 2026-09-25  
**Based on:** `docs/PHASE8_P0_P1_VERIFICATION.md` (P0-1 CONFIRMED VULNERABLE)  
**Branch tip:** Phase 8.2 remediation (HMAC restore)

## Original vulnerability

Authenticated session owners could call PostgREST:

```js
supabase.rpc('insert_assistant_message', { p_session_id, p_content })
supabase.rpc('insert_system_message', { p_session_id, p_content })
```

without a signature. Migration `20260806143023_restore_session_message_rpc_owner_auth_qa.sql` removed CQG-011 HMAC while keeping `EXECUTE` for `authenticated`. Forged assistant/system rows flowed into `assessSession` and were then HMAC-signed into `session_reports`.

## Root cause

- SECURITY DEFINER RPCs trusted ownership + active session (+ turn order for assistant) but not **content authenticity**.
- Browser held a usable write path (anon key + user JWT + EXECUTE grant).
- Report signing authenticates **scores**, not **transcript inputs**.

## Fix (minimum secure change)

Re-apply CQG-011 HMAC for non-`service_role` callers; sign only on the server.

1. **Migration** `supabase/migrations/20260925120000_phase8_restore_message_hmac.sql`  
   - Restores Vault `report_write_key` HMAC over `sessionId\ncontent\n(assistant|system)`.  
   - Invalid / missing `p_sig` → `Invalid message signature`.  
   - `service_role` still bypasses HMAC (trusted Route Handler / cron path).  
   - `anon` remains revoked; `authenticated` keeps EXECUTE **only with valid sig**.

2. **Server signing** in `src/lib/report-sign.ts`  
   - `signSessionMessage` / `buildSignedMessageRpcArgs` — never exposed to the client.

3. **Call-site wiring** via `prepareMessageRpc` in `src/lib/supabase/admin.ts`  
   - `POST /api/sessions` (system)  
   - `POST /api/sessions/[id]/message` (assistant)  
   - `POST /api/admin/avatars/[id]/test-session` (system)  
   - Uses service role when configured; otherwise attaches `p_sig` from `REPORT_WRITE_KEY`.  
   - Fails closed if neither service role nor `REPORT_WRITE_KEY` is set.

## Attack path before

```
Therapist JWT → PostgREST insert_assistant_message (no p_sig)
  → session_messages forged → /end → assessSession → signed report
```

## Attack path after

```
Therapist JWT → PostgREST insert_assistant_message (no/invalid p_sig)
  → RAISE 'Invalid message signature' (or key not configured)
Legitimate path:
Browser → authenticated API → prepareMessageRpc (server HMAC or service_role)
  → RPC → session_messages → assessment → report
```

## Files changed

| File | Change |
|------|--------|
| `supabase/migrations/20260925120000_phase8_restore_message_hmac.sql` | New |
| `src/lib/report-sign.ts` | Message HMAC helpers |
| `src/lib/report-sign.test.ts` | Boundary unit tests |
| `src/lib/supabase/admin.ts` | `prepareMessageRpc` |
| `src/lib/supabase/admin.test.ts` | Forge / fail-closed tests |
| `src/lib/architecture.test.ts` | Migration + prepareMessageRpc invariants |
| `src/app/api/sessions/route.ts` | Signed system insert |
| `src/app/api/sessions/[id]/message/route.ts` | Signed assistant insert |
| `src/app/api/admin/avatars/[id]/test-session/route.ts` | Signed system insert |

## Tests covering required proofs

| # | Requirement | Coverage |
|---|-------------|----------|
| 1 | Therapist cannot forge assistant | HMAC unit + migration asserts `Invalid message signature`; wrong-key ≠ valid |
| 2 | Therapist cannot forge system | Same for `role=system` |
| 3 | Invalid signature rejected | DB raises; unit proves wrong key mismatch |
| 4 | Modified message invalidates signature | `report-sign.test.ts` content tamper |
| 5 | Modified session invalidates signature | `report-sign.test.ts` sessionId tamper |
| 6 | Unauthorized session rejected | Unchanged RPC owner/`is_admin` checks (migration body) |
| 7 | Legitimate AI-generated message succeeds | Route uses `prepareMessageRpc` with server key / service role |
| 8–9 | Evaluation / report still work | Report HMAC path unchanged (`signSessionReport`) |
| 10 | Admin functionality intact | Admin test-session uses same `prepareMessageRpc` |

## Residual risk

- **Vault parity:** Live DB must have Vault secret `report_write_key` equal to app `REPORT_WRITE_KEY` when service role is unset. If both are unset, message inserts fail closed (same class of failure as unsigned report writes).
- **service_role compromise** still bypasses message HMAC by design — protect that key.
- **User-role messages** remain RLS-insertable by owners (by design); only assistant/system forge is closed.
- Migration must be **applied** to production before the vulnerability is closed live; git alone does not change grants.

## Operator steps

1. Ensure Vault `report_write_key` matches `REPORT_WRITE_KEY` (or always set `SUPABASE_SERVICE_ROLE_KEY` on the app).
2. Apply `20260925120000_phase8_restore_message_hmac.sql`.
3. Deploy app revision that calls `prepareMessageRpc`.
4. Smoke: start session → send message → end → report.

## Status

**FIXED** in repository (code + migration + regression tests), pending production migration apply + deploy for live closure.

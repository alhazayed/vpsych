# RC3 Wave 1 — Mission 04: Production API Runtime

**Verdict: PASS AFTER FIX** (W1-C1)  
**Evidence ID:** `RC3-W1-EV-20260805T1305Z` · Finding **W1-C1** · RDL-012  
**Environment:** https://vpsych.vercel.app · SHA `5bf66c0` · `dpl_5F6pBTi…`

## Anon contract

| Endpoint | Result |
|---|---|
| `GET/POST /api/sessions` | 401 JSON `{"error":"Unauthorized"}` · `Cache-Control: no-store…` |
| `GET /api/health` | 200 liveness |
| `GET /api/health/openai` | 401 |
| `POST /api/voice/tts`, `/api/voice/transcribe` | 401 JSON |
| Security headers (CSP, HSTS preload, COOP/CORP, XFO DENY, nosniff) | Present |

## Authenticated pipeline (therapist)

### Before fix — FAIL (Critical)

| Step | Result |
|---|---|
| `POST /api/sessions` (SSR cookie + synthetic cookie) | **500** `{"error":"Not authorized"}` |
| Runtime logs | `[sessions] system message failed … error: 'Not authorized'` after sessions row insert |
| Root cause | RPC body service_role-only; `messageRpcClient` fell back to user client (no/`null` service role) |

### Fix

| Field | Value |
|---|---|
| Mission ID | 04 |
| Finding ID | **W1-C1** |
| Evidence ID | `RC3-W1-EV-20260805T1305Z` |
| Release Decision Log | **RDL-012** |
| Change | Migration `20260805130453_restore_session_message_rpc_owner_auth` — restore ownership + `service_role` dual-path bodies; keep EXECUTE for `authenticated, service_role` |
| App code | Unchanged (already uses `messageRpcClient` fallback) |

### After fix — PASS

| Step | Result |
|---|---|
| `POST /api/sessions` | **200** `sessionId`, `caseInstanceId`, diagnosis minted |
| Browser retest create | **200** |
| `POST /api/sessions/:id/message` `{message}` | **200** `aiSource: gpt` |
| `POST /api/sessions/:id/end` | **200** `ok`, `reportId`, `aiSource: gpt` |
| Therapist read own report via REST | `[]` (admin-only RLS) |
| Admin read report | row present |
| Therapist `/api/health/openai` | **403** |

## Orphans

Seven active sessions from failed pre-fix creates (no system message) were marked `expired` during remediation.

## Defects open

None for Mission 04 after W1-C1.

## Sign-off

Mission 04 **PASS AFTER FIX**.

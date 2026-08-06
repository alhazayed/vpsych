# CQG Continuous Quality Guardian — Iteration 2

**Date:** 2026-08-06  
**Branch:** `cursor/cqg-critical-high-remediation-e2e6`  
**Follows:** Iteration 1 (CQG-001..009)

## Bugs fixed

| Bug ID | Severity | Root cause | Fix |
|---|---|---|---|
| CQG-010 | Critical | `enforce_session_update_guard` did not freeze `clinical_snapshot` — therapists could rewrite diagnosis mid-session | Freeze `clinical_snapshot`, `difficulty`, `therapy_modality`, `instructor_preset_id` |
| CQG-011 | Critical | Authenticated owners could forge assistant/system turns via PostgREST (assessment SSOT) | HMAC (`report_write_key`) required for non-service_role callers; app signs via `messageRpcArgs` |
| CQG-012 | High | CQG-007 only hid UI labels — RSC props still shipped snapshot/prompts | `redactForExam` on session page strips diagnosis/prompts/goals |
| CQG-013 | High | Concurrent `insert_assistant_message` raced on last-role check | `SELECT … FOR UPDATE` on session row before turn check |

## Production

- Applied: `20260806131452` (placeholder) + `20260806131604` (body) on `rrzudbkxigeavfdnidnm`
- Verified: snapshot guard text present; 3-arg message RPCs; HMAC + FOR UPDATE in body

## App contract change

`insert_assistant_message` / `insert_system_message` are now `(uuid, text, text)` with optional `p_sig`.
- **service_role:** signature optional
- **authenticated:** HMAC-SHA256 hex of `sessionId\\ncontent\\n{assistant\|system}` with vault `report_write_key` / `REPORT_WRITE_KEY`

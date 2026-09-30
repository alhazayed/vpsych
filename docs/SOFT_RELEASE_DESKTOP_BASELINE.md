# VPsych Soft Use — Desktop Release Baseline (Phase 0 FREEZE)

**Status:** FROZEN — do not merge #255 / #256 / #257 automatically.  
**Scope:** Desktop Chrome / Chromium only. iPhone / iOS Safari voice is DEFERRED.  
**Date:** 2026-09-30

## RELEASE BASELINE

| Field | Value |
|---|---|
| Release branch | `cursor/soft-release-desktop-f2a6` |
| Commit | `53682666d9b41d39fd3502f0904fa7d110baf0d5` |
| Source PR | [#256](https://github.com/alhazayed/vpsych/pull/256) (Phase 9.2 / 9.2R) — **not merged** |
| Existing preview (source tip) | `dpl_B6fxfGQWmk58cfyo7znqWG9gvBBw` |
| Production (main) | `dpl_Bss4qYyg8XBsqWY4XxfLogSuEKk9` @ `90f0e08` — **NOT the soft-release target** |
| Database | Supabase `vpsych` (`rrzudbkxigeavfdnidnm`) |

## Database migration state

- Live `insert_assistant_message` signature (verified via SQL):  
  `(p_session_id uuid, p_user_message_id uuid, p_content text, p_sig text)` — **exactly 4 args**
- Migration `20260928103000_phase91s_atomic_assistant_tip_guard` is **applied** on production DB
- 3-arg overload is **absent** on production DB
- Git on this branch includes the matching migration file

## PR overlap (do not auto-merge)

| PR | Relationship | Action |
|---|---|---|
| #255 Phase 9.1 / 9.1S | Strict subset of #256 (tip = merge-base of #256) | Do not merge separately |
| #256 Phase 9.2 / 9.2R | = `main` + Phase 9.1…9.2R; **approved soft-release baseline** | Source of this branch |
| #257 Phase 9.2S iOS forensic | #256 + diagnostic-only iOS instrumentation | **EXCLUDED** (iPhone deferred) |
| #258 4-arg RPC on main | Minimal persistence fix for broken production `main`; lacks 409/voice | Superseded for soft-release by #256 contract |

## Critical production note (not fixed by this soft-release branch alone)

Production `main@90f0e08` still calls the **old 3-arg** `insert_assistant_message` while the live DB only has the **4-arg** function. That is a production persistence outage addressed on `main` by draft #258, and already included on this soft-release baseline via Phase 9.1S.

**This soft-release work must not deploy production and must not merge to main automatically.**

## Explicit exclusions

- iPhone / iOS Safari / mobile browser voice
- WebRTC / Web Audio MSE / Realtime API redesign
- Patient Agent clinical reasoning changes
- Clinical scoring / report logic changes (unless blocker)
- Phase 9.1S atomic persistence guard modifications
- Weakening auth / RLS / rate limits / audit / session fencing

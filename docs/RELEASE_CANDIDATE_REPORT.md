# VPsych Soft-Release Candidate Report — Desktop Computer Only

**Date:** 2026-09-30  
**Release type:** Controlled SOFT USE — desktop/computer only  
**PR:** [#259](https://github.com/alhazayed/vpsych/pull/259) (`cursor/soft-release-desktop-f2a6`)  
**iPhone / iOS Safari / mobile voice:** EXPLICITLY EXCLUDED / DEFERRED

---

## 1. Baseline

| Field | Value |
|---|---|
| Release branch | `cursor/soft-release-desktop-f2a6` |
| Phase 9.2R source tip | `53682666d9b41d39fd3502f0904fa7d110baf0d5` (PR #256 — not auto-merged) |
| Soft-release HEAD (at report time) | see latest commits on #259 |
| Preview deployment verified | `dpl_2TQe6hpnPGoT2SJzBpDrSAJHmi22` @ `4ff476c` |
| Preview URL | `https://vpsych-plj9uh9ud-alhazayed-1540s-projects.vercel.app` |
| Production (NOT soft-release target) | `dpl_Bss4qYyg8XBsqWY4XxfLogSuEKk9` @ `main` `90f0e08` |
| Database | Supabase `vpsych` (`rrzudbkxigeavfdnidnm`) |

### PR overlap (frozen)

| PR | Relationship | Soft-release action |
|---|---|---|
| #255 Phase 9.1 / 9.1S | ⊂ #256 | Do not merge separately |
| #256 Phase 9.2 / 9.2R | Approved baseline source | Branched into #259 |
| #257 Phase 9.2S iOS forensic | #256 + diagnostics | **EXCLUDED** |
| #258 4-arg RPC on main | Minimal prod persistence fix | Separate from soft-release voice candidate |

See `docs/SOFT_RELEASE_DESKTOP_BASELINE.md`.

---

## 2. Changes on soft-release branch (beyond #256 tip)

1. **docs:** freeze baseline / PR overlap / exclusions  
2. **fix(deps):** `overrides.undici = ^7.30.0` — clears CI `audit:deps` high-severity gate (was 7.29.0 via `@ai-sdk/provider-utils`)  
3. **chore:** `scripts/soft-release-desktop-verify.mjs` — Chromium preview harness with Audio.play instrumentation  

No Patient Agent, scoring, report formula, RLS, rate-limit, or Phase 9.1S RPC body changes were made on this branch after the #256 baseline.

---

## 3. Tests (automated)

| Gate | Result |
|---|---|
| `npm run lint` | **PASS** — 0 errors, 13 warnings |
| `npm run typecheck` | **PASS** |
| `npm test` | **PASS** — **1128 passed / 0 failed / 0 skipped** (118 files) |
| Voice + therapy-room focused | **PASS** — **266 passed** (21 files) |
| Phase 1 RPC / architecture focused | **PASS** — **98 passed** |
| Security+voice focused subset | **PASS** — **156 passed** |
| `npm run test:migrations` | **PASS** local structure; remote parity **NOT CHECKED** (no `SUPABASE_DB_URL`) |
| `npm run test:perf-smoke` | **PASS** |
| `npm run audit:deps` | **PASS** after undici override (was FAIL on 7.29.0) |
| `npm run build` | **PASS** |

### Classification

- Unit/integration suite: **VERIFIED** for this commit family  
- Does **not** alone prove live desktop mic STT, barge-in, or audible speakers

---

## 4. Browser verification (Chromium preview)

| Item | Value |
|---|---|
| Browser | Google Chrome / puppeteer-core (desktop Chromium, headless) |
| OS | Linux cloud agent |
| Deployment | `dpl_2TQe6hpnPGoT2SJzBpDrSAJHmi22` |
| Commit on deployment | `4ff476c466a6e19e0fd8f61609e35dd373b9a649` |
| EN session | `8e9e8d98-5a21-4b29-8a74-d8615ee868e1` |
| AR session | `ae663f88-d92c-41d3-bc77-fb4e9ee30751` |
| Evidence | `/opt/cursor/artifacts/soft-release-desktop/soft-release-desktop-report.json` + screenshots |

### Observed

- Login (therapist audit account): **PASS**
- Session create → `/sessions/{id}`: **PASS**
- EN text turns `/message` **200** with assistant persistence: **PASS**
- Rapid consecutive sends: at least one **200** (harness concurrent typing can garble input text — test artifact, not claimed as product corruption)
- Desktop TTS: multiple `/api/voice/tts` **200** with `audio/mpeg` bytes (progressive multi-chunk): **PASS / PARTIALLY VERIFIED**
- `HTMLAudioElement` instrumentation: **playCalls=12, playResolved=12, playingEvents=12, playRejected=0**: **PARTIALLY VERIFIED** (play/playing confirmed; physical speaker audibility not confirmed in headless)
- Session end **200** with `reportId` + quality ledger id: **PASS**
- Arabic locale before session create, RTL `dir=rtl`, Arabic patient reply (`ar-JO`): **PASS / PARTIALLY VERIFIED**
- Arabic assistant sample persisted: includes Arabic script (e.g. ضغط شغل / ميتنغز) — **no English clinical reply observed in that AR turn**

Screenshots: `01-login` … `09-session-ended`, voice turn shows **SPEAKING** badge during patient response.

---

## 5. Voice verification summary

| Capability | Status | Evidence |
|---|---|---|
| Desktop TTS HTTP + audio bytes | **VERIFIED** (preview) | 5–18× TTS 200 with mpeg bytes |
| Progressive multi-chunk TTS | **PARTIALLY VERIFIED** | Multiple TTS per turn; unit suite for budget/concurrency |
| `Audio.play()` + `playing` | **PARTIALLY VERIFIED** | Hook counters in Chromium headless |
| Audible speakers | **NOT VERIFIED** | Headless environment |
| Desktop STT / mic | **NOT VERIFIED** | Fake media device; text path used to drive TTS |
| Latency T0–T9 breakdown | **NOT VERIFIED** | Not instrumented end-to-end in this run |

---

## 6. Barge-in verification

| Item | Status |
|---|---|
| Unit: interrupt flag, turn fence, speech-queue abort, stale turn | **VERIFIED** (automated) |
| Live desktop: VAD → stop audio → abort TTS → next turn | **NOT VERIFIED** |
| Interrupt during chunk 1 / 2+ / fetch / after play | **NOT VERIFIED** live |

**Release condition:** require a human desktop Chrome barge-in checklist before widening soft use beyond text+TTS playback confidence.

---

## 7. Arabic verification

| Item | Status |
|---|---|
| Locale set before session create | **VERIFIED** |
| Arabic UI / RTL | **PARTIALLY VERIFIED** (`dir=rtl`) |
| Arabic patient reply + persistence | **VERIFIED** (preview + network body) |
| Arabic TTS | **NOT separately asserted** in final AR turn (text-mode path) |
| Mid-session UI language rewrite of stored session language | **Known product behavior** — session language is chosen at create; UI toggle during an open session is not claimed to rewrite stored language |

---

## 8. Persistence verification

### Live DB RPC contract

```text
insert_assistant_message(
  p_session_id uuid,
  p_user_message_id uuid,
  p_content text,
  p_sig text
)
```

- Exactly **4** args on production DB — **VERIFIED** via SQL  
- Migration `20260928103000_phase91s_atomic_assistant_tip_guard` **applied**  
- App code on soft-release passes `p_user_message_id` — **VERIFIED** (source + architecture tests)  
- Superseded → HTTP **409**; genuine persist failure → **500** — **VERIFIED** in route source + unit tests  

### Session `b8cb8b0f-…` transcript (DB)

Alternating `user` / `assistant` rows; no duplicate assistants on inspected turns; report `1ef0078c-…` created.  
One garbled **user** row content came from concurrent dual-input harness typing — classify as **test artifact**, not assistant attach corruption.

### Production `main` mismatch (external to soft-release preview)

Production deployment still on `main@90f0e08` calling **3-arg** RPC while DB is **4-arg only** → assistant persist outage on production. Soft-release preview is **not** that deployment. Fix path for production remains #258 and/or merging this candidate under human approval.

---

## 9. Security verification

| Check | Result |
|---|---|
| Unauth `/message` | **401** |
| Unauth `/end` | **401** |
| Unauth `/api/admin/sessions` | **401** |
| Therapist calling `/api/admin/sessions` | **403** (expected) |
| Message to nonexistent session | non-200 (ownership/not-found path) |
| Message after session completed | non-200 |
| Public `/api/health` | **200** |
| RLS / rate limits / architecture invariants | Covered by automated suite; **no controls weakened** |

### Migration ledger drift (pre-existing)

Git contains migrations **not** listed in remote `schema_migrations`:

- `20260826143511_arabic_voice_catalog_anas_noura` — **Anas** voice row **missing** on prod catalogue  
- `20260909110000_phase1_security_integrity` — `quality_ledger_reject_mutation` still shows EXECUTE visibility inconsistent with intended revoke  

**Do not auto-apply to production from this soft-release.** Flag for human DB review.

---

## 10. Known limitations

1. Soft use is **desktop Chromium-family** only  
2. Headless verification cannot prove physical speaker audibility  
3. Live barge-in / mic STT / Therapy Room Repeat not exercised in this agent run  
4. Latency waterfall T0–T9 not collected  
5. Production `main` remains persistence-broken until approved merge  
6. Historical migration ledger drift (Anas / phase1 security integrity)  

---

## 11. Deferred iPhone issue

STT/transcript/Patient Agent may work on iPhone while patient TTS playback / barge-in remain unsafe. **Out of scope.** PR #257 forensic instrumentation is **not** included.

---

## 12. Rollback procedure

1. **Do not merge** #259 / #256 / #255 / #257 to `main` without human approval  
2. Soft-use users: stop using the preview URL; fall back to prior agreed environment  
3. If this branch were promoted and must be undone: revert the merge commit on `main` and redeploy previous production (`dpl_Bss4qYyg…` / `90f0e08`) — **note:** that production build still has the 3-arg RPC mismatch unless #258 is applied first  
4. DB: Phase 9.1S migration is already live; **do not** restore the 3-arg overload  
5. Dependency rollback: remove `undici` override only if paired with another patched resolution that keeps `audit:deps` green  

---

## 13. Deployment ID

**Verified preview:** `dpl_2TQe6hpnPGoT2SJzBpDrSAJHmi22`

---

## 14. Commit SHA

**Phase 9.2R baseline:** `53682666d9b41d39fd3502f0904fa7d110baf0d5`  
**Verified preview commit:** `4ff476c466a6e19e0fd8f61609e35dd373b9a649`  
**Branch tip:** see PR #259 HEAD after report commits

---

## Phase 17 gate checklist

| Gate | Status |
|---|---|
| database contract correct | **VERIFIED** |
| no old 3-arg RPC calls (release branch) | **VERIFIED** |
| text conversation works | **VERIFIED** (preview) |
| assistant persistence works | **VERIFIED** (preview + DB) |
| desktop STT works | **NOT VERIFIED** |
| desktop TTS works | **VERIFIED** (bytes) |
| actual desktop playback confirmed | **PARTIALLY VERIFIED** (play/playing; not speakers) |
| progressive TTS works on desktop | **PARTIALLY VERIFIED** |
| barge-in works on desktop | **NOT VERIFIED** (live) |
| stale-turn protection works | **PARTIALLY VERIFIED** (code + units; live 409 path not forced in harness) |
| repeat works OR documented blocked | **BLOCKED / NOT VERIFIED** — documented |
| Arabic desktop path works | **PARTIALLY VERIFIED** |
| session completion + reports | **VERIFIED** |
| security checks | **PARTIALLY VERIFIED** (no regression found) |
| lint / typecheck / tests / build | **VERIFIED** |
| preview runtime | **PARTIALLY VERIFIED** |
| deployment identity verified | **VERIFIED** |
| Claude adversarial review | **PENDING / attach when complete** |
| unresolved BLOCKER | **see Claude section + conditions below** |
| rollback documented | **YES** |
| iPhone excluded | **YES** |

---

## Release statement (conditional)

**Not yet unconditionally approved.**

Pending:

1. Claude adversarial review with **no unresolved BLOCKER**  
2. Human desktop Chrome confirmation of **mic STT** and **barge-in** (release-critical)  
3. Explicit human decision on whether soft use may begin with text + TTS playback while barge-in/STT remain operator-supervised  

If those conditions clear, the approved statement must be:

> VPsych is approved for controlled SOFT USE on desktop/computer environments covered by the validation performed for this release.  
> Mobile/iPhone voice support is NOT included in this release and remains deferred.  
> This is a controlled soft-use release, not a declaration of universal device/browser support.

Do **not** claim: production ready everywhere / fully supported / iOS supported / Safari supported.

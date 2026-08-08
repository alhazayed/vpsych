# Voice Turn-Taking QA Protocol

**Status:** Manual human QA — **no automatic PASS**  
**Scope:** Hands-free Therapy Room Mode only (`TherapyRoomSession`)  
**Related:** `docs/VOICE_INTERACTION_HARDENING_AUDIT.md`

## Rule

**FALSE AVATAR INTERRUPTION = FAIL**

A slightly slow avatar is acceptable. An avatar that speaks while the therapist is still formulating a question is not.

## Timing under test (defaults)

| Parameter | Default |
|-----------|---------|
| Stage-1 endpoint candidate | 1000 ms silence |
| Stage-2 confirmation | +500 ms |
| Commit quiet | ~1500 ms |
| Configurable via | `VOICE_TURN_ENDPOINT_INITIAL_MS`, `VOICE_TURN_ENDPOINT_CONFIRM_MS`, `VOICE_TURN_MAX_WAIT_MS` |

## How to run

1. Enable Therapy Room Mode (`NEXT_PUBLIC_THERAPY_ROOM_MODE=true`).
2. Start a session with `interaction_mode = therapy_room`.
3. Use headphones when possible (reduces echo false barge-in).
4. Complete **20 interviews** below (Arabic and/or English).
5. Record PASS / MINOR / FAIL per interview — never auto-fill PASS.

## Interview checklist (20)

For each interview, exercise all bullets in the “Must cover” column.

| # | Scenario | Must cover | Result | Notes |
|---|----------|------------|--------|-------|
| 1 | Short pauses | Pause ~300–500 ms mid-thought | ☐ PASS ☐ MINOR ☐ FAIL | |
| 2 | Medium pauses | Pause ~800–1000 ms without avatar reply | ☐ PASS ☐ MINOR ☐ FAIL | |
| 3 | Long pause then continue | Pause ~1.2 s then finish sentence | ☐ PASS ☐ MINOR ☐ FAIL | |
| 4 | Hesitation | “umm…”, breaths, reformulation | ☐ PASS ☐ MINOR ☐ FAIL | |
| 5 | Sentence restart | Start, stop, restart same question | ☐ PASS ☐ MINOR ☐ FAIL | |
| 6 | Long therapist response | Multi-clause clinical question | ☐ PASS ☐ MINOR ☐ FAIL | |
| 7 | Rapid speech | Fast consecutive clauses | ☐ PASS ☐ MINOR ☐ FAIL | |
| 8 | Slow speech | Deliberate slow pacing | ☐ PASS ☐ MINOR ☐ FAIL | |
| 9 | Therapist interrupts avatar | Speak over patient TTS — audio stops | ☐ PASS ☐ MINOR ☐ FAIL | |
| 10 | Avatar after true end | Clear finished question → avatar replies | ☐ PASS ☐ MINOR ☐ FAIL | |
| 11 | Arabic mid-sentence | `أريد أن أسألك عن شعورك خلال…` pause `…الأسبوع الماضي` | ☐ PASS ☐ MINOR ☐ FAIL | |
| 12 | English mid-sentence | “I want to ask about your mood during…” pause “…the last week.” | ☐ PASS ☐ MINOR ☐ FAIL | |
| 13 | Network latency | Throttle network; no stale TTS after new turn | ☐ PASS ☐ MINOR ☐ FAIL | |
| 14 | Repeated interruptions | Interrupt avatar 3× in a row | ☐ PASS ☐ MINOR ☐ FAIL | |
| 15 | Pause then genuine end | Think, then clearly finish → reply OK | ☐ PASS ☐ MINOR ☐ FAIL | |
| 16 | Emotional speech | Tearful / shaky therapist tone with pauses | ☐ PASS ☐ MINOR ☐ FAIL | |
| 17 | Short answers then pause | “Yes…” pause “…and also…” | ☐ PASS ☐ MINOR ☐ FAIL | |
| 18 | Rapid consecutive turns | Ask → listen briefly → ask again quickly | ☐ PASS ☐ MINOR ☐ FAIL | |
| 19 | Resume during “thinking” | Speak again while status shows thinking | ☐ PASS ☐ MINOR ☐ FAIL | |
| 20 | Session continuity | Pause control + resume; FSM still coherent | ☐ PASS ☐ MINOR ☐ FAIL | |

## Scoring guide

| Result | Meaning |
|--------|---------|
| **PASS** | No false avatar interruption; barge-in works; no stale audio |
| **MINOR** | Awkward delay or UI status quirk; no false interruption |
| **FAIL** | Avatar spoke during therapist pause/continuation, or stale TTS played, or barge-in failed |

## Sign-off

| Field | Value |
|-------|-------|
| Reviewer | |
| Date | |
| Environment | |
| Interviews completed | / 20 |
| FAIL count | |
| Decision | ☐ Ready for next PR (Arabic voice A/B) ☐ Needs fix |

Spoken turn-taking is **not** validated until a human completes this protocol.

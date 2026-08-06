# Evaluation Guide — Expert Path Without Documentation Dependence

**Audience:** First-time psychiatrist / psychologist / resident / supervisor / educator

You should be able to complete this path using only in-product cues. This guide is backup.

## Path

1. **Account** — Open the site → Create Account (or Sign in). Confirm email if required.  
2. **Orient** — On Patient Library, read the Professional Preview checklist; dismiss when ready.  
3. **Start patient** — Choose an active avatar → Start session. Prefer text if mic/TTS is uncertain.  
4. **Conduct session** — 8–12 therapist turns covering alliance, history, and risk inquiry. Stay in character as clinician.  
5. **End** — End session. Wait for analysis overlay (admin report is generated; you will not receive the full report).  
6. **Feedback** — On Session complete:
   - Rate six core items (1–5)
   - Optionally rate voice / EN / AR quality
   - Submit a CQI issue if something broke or distorted training
   - Submit an Educational Opportunity if you saw a teaching moment or gap  
7. **Repeat** — One English and one Arabic (or bilingual) pass if you can.

## What you will *not* see

- Full competency rubric / overall score (admin-only by design)  
- Animated facial expressions  
- Validated certification badges

## If stuck

| Symptom | Action |
|---|---|
| Cannot start session | Retry; if persistent, CQI Critical + notify Release Manager |
| Voice fails | Switch to text; CQI category `voice_tts` |
| Overlay never finishes | Refresh once; check `/sessions` for status; CQI High if stuck |
| No feedback form | You may be on an older build; notify Release Manager |

See also: `docs/REVIEWER_GUIDE.md`, `docs/KNOWN_LIMITATIONS.md`.

# Patient Training Ladder

A trainee chooses a **patient**, not a difficulty. Each program patient has a
five-level ladder; passing a level unlocks the next encounter with the same
person, and each encounter is harder to assess.

Code: `src/lib/training-ladder/` · migration
`20261007100000_training_ladder.sql` · pages `/training`, `/training/[key]` ·
result card on the session complete page.

## Levels

| Level | Case Engine difficulty | Comorbidity | Risk disclosure |
|---|---|---|---|
| 1 Easy | beginner | none | on safety assessment: honest and clear when asked |
| 2 Basic | intermediate | none | after rapport: minimises first |
| 3 Intermediate | intermediate | the patient's first authored comorbidity | after rapport: ambivalent, partial |
| 4 Advanced | advanced | significant authored comorbidity | after rapport: guarded, conflicting |
| 5 Expert | expert | several authored comorbidities where the catalogue has them | after rapport: subtle, indirect cues |

The difficulty profiles are the existing four; no new profile was added.
Comorbidities come only from `BUILTIN_COMORBIDITY_RULES` (a test checks every
level of every patient), and only where the patient's authored case file does
not rule them out. Nothing in the ladder makes a pair compatible.

## Risk on every level

`risk.ts` gives every encounter passive suicidal ideation through
`CaseGenerationRequest.riskOverlay` (Case Engine, `applyRiskOverlay`). The
overlay only raises the package's risk, sets how every suicide/self-harm
disclosure rule is answered, keeps authored notes, and never touches a
`never` rule (no method or means detail). Ideation stays passive with no plan
and no intent on every level, so difficulty comes from assessment complexity,
not from a more suicidal patient, and the in-session crisis escalation
(active ideation only, `session-practice/crisis-escalation.ts`) does not
fire. Past self-harm is added only for patients whose case file has it.

## Pass rule and unlock (server-side)

- Pass is the session report's overall score (the existing assessment,
  `weightedOverall`) **strictly greater than 55**: 55 fails, 55.01 passes.
  The overall score is a whole number today, so 56 is the lowest pass.
- `start_training_ladder_attempt` (SECURITY DEFINER) records the attempt when
  the session starts. It accepts the service role, or the trainee with an
  HMAC over `sessionId\npatientKey\nlevel` keyed by the vault
  `report_write_key`. It checks the session is the caller's, active, not a
  skill test or course session, on the patient's avatar, and that the level
  is at most one above the highest passed level. Otherwise: "Ladder level is
  locked".
- A trigger on `session_reports` (insert, or `scores` update) grades the
  attempt from the report itself. A heuristic-fallback report leaves the
  attempt "awaiting score"; when an admin regenerates it, the trigger grades
  it then.
- Trainees can select their own attempts. There are no insert, update or
  delete policies, so a browser cannot write a score, a result or a level.
- Failing never locks anything: the level stays open and can be retried
  without limit. Cleared levels can be replayed; replays do not change
  progress.

## What the trainee sees

- `/training`: patients with primary presentation, current level, levels
  cleared and status.
- `/training/[key]`: the ladder (✓ cleared, ● current, 🔒 locked), the next
  objective, start or resume, replays, and previous attempts with score and
  result.
- Session complete page: level cleared (score, next level unlocked) or not
  cleared (score, required more than 55%, level stays active).

The overall level score is shown to the trainee because the program's pass
rule depends on it. The report itself (narrative, item scores) stays
admin-only.

## Phases

1. **This version**: ladder engine, risk overlay, server-side grading and
   unlock, trainee pages. One provisional patient (Maya, MDD) so the flow can
   be tested end to end; her case file rules out the catalogue's other MDD
   comorbidities, so her levels differ by difficulty and risk only.
2. Author the program's ten patients (five female, five male, ten different
   primary disorders, EN and AR authored natively, gender-matched voices) and
   their comorbidity ladders.
3. The Patient Library becomes the program; comorbidities sealed from the
   trainee's session row (as skill tests do); admin view of trainee ladders.

## Not in this version

- The session row still carries the case snapshot, as in practice sessions,
  so a trainee who inspects network traffic could read comorbidities. The UI
  never shows them.
- Scores are not validated.

# Patient Training Ladder

A trainee chooses a **patient**, not a difficulty. Each program patient has a
five-level ladder; passing a level unlocks the next encounter with the same
person, and each encounter is harder to assess.

Code: `src/lib/training-ladder/` · migrations
`20261007100000_training_ladder.sql` (engine) and
`20261007160000_training_ladder_patients.sql` (the ten patients, generated) ·
patient files `personas/ladder/*.json` · pages `/training`, `/training/[key]` ·
result card on the session complete page.

## The ten patients

| # | Patient (EN / AR) | Primary | Comorbidities L3 → L5 |
|---|---|---|---|
| 1 | Ethan Cole / أحمد حدّاد | MDD, recurrent, moderate | GAD with panic · PTSD · PTSD + alcohol use |
| 2 | Rachel Kim / رانية صالح | GAD with panic | MDD · alcohol use · MDD + alcohol use |
| 3 | Laura Bennett / هدى خليل | PTSD | MDD · alcohol use · MDD + alcohol use |
| 4 | Tyler Grant / عمر ناصر | Adult ADHD | GAD with panic (L3–L5) |
| 5 | Karen Doyle / سميرة عودة | Alcohol use disorder | GAD with panic (L3–L5) |
| 6 | Emily Shaw / دانا قاسم | Panic disorder | none authored in the catalogue |
| 7 | Jake Moreno / كريم سعادة | Borderline personality disorder | MDD (L3–L5) |
| 8 | Nadia Price / لينا منصور | Complex PTSD | none authored in the catalogue |
| 9 | Marcus Hill / يزن حمدان | Schizophrenia | GAD with panic (L3–L5) |
| 10 | Chris Walsh / طارق عزّام | Bipolar I, current episode manic | none authored in the catalogue |

Each file in `personas/ladder/` is one person: an `en-US` and an `ar-JO`
personality authored natively (different names, cities and idioms, same
biography), human-personality traits for both, a language-neutral clinical
core for the primary disorder, gender-matched approved voices and a portrait.
The Program pages and My Sessions show the name from the personality that
matches the UI language (أحمد حدّاد in Arabic, Ethan Cole in English) via
`lib/avatars/localized-name.ts`; `avatars.name` stays the canonical English
name and is the fallback.
The persona carries the life events every level's comorbidities need, and
leaves the current state, risk disclosure and amounts to Module 1, so one
persona holds all five levels. The patient's avatar `disorder` equals the
catalogue name, so ladder cases are never treated as diagnosis overrides.

`patient-files.test.ts` mints every level in both languages through the Case
Engine and checks the publish gate, voices, sections, passive-only risk and
the absence of method words. The migration is generated from the files
(`WRITE_LADDER_PATIENTS_MIGRATION=1 npx vitest run
src/lib/training-ladder/patient-files.test.ts`) and the test fails when it
drifts. Every persona is `clinical_review: in_review` until a clinician signs
it off.

Program patients are hidden from the Patient Library, the practice and
skill-test pickers and clinic days, and `/api/sessions` refuses a session on
one that is not a ladder level (`ladder_patient_only`).

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

1. Ladder engine, risk overlay, server-side grading and unlock, trainee
   pages, with Maya Chen as a provisional patient (#285).
2. **This version**: the program's ten patients (five female, five male, ten
   different primary disorders, EN and AR authored natively, gender-matched
   voices) and their comorbidity ladders. Maya's ladder row is retired
   (inactive, slot 99); her attempts stay, and she stays in the library.
3. The Patient Library becomes the program; comorbidities sealed from the
   trainee's session row (as skill tests do); admin view of trainee ladders.

## Not in this version

- The session row still carries the case snapshot, as in practice sessions,
  so a trainee who inspects network traffic could read comorbidities. The UI
  never shows them.
- Scores are not validated.

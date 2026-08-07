# Human Personality Engine (v1)

## Objective

Transform every avatar from an LLM chatbot into a **persistent human personality**.

The Personality Engine exists **independently of GPT**. Profiles are authored,
validated, persisted, and injected into every patient turn. GPT does not invent
temperament, attachment, Big Five scores, or treatment expectations mid-session.

**Invariant:** diagnosis lives on the Case Engine; personality lives here.
Two patients with Major Depression must still feel like different people.

## Trait schema

Canonical type: `HumanPersonalityProfile` in `src/lib/personality-engine/types.ts`.  
JSON Schema: `schemas/human-personality.v1.json`.

| Field | Role |
|-------|------|
| temperament | Baseline affective style |
| attachment_style + notes | Adult attachment (+ clinician overlay) |
| intelligence | Band, strengths, thinking style (not an IQ claim) |
| education / occupation | Demographics that shape speech & concerns |
| culture / religion | Meaning frame — locale-authored, never translated |
| resilience | 1–5 |
| openness / agreeableness / conscientiousness / neuroticism | Big Five 1–5 |
| coping_style + notes | Dominant coping pattern |
| humor + notes | Presence and flavor of humor |
| trust_level + notes | Baseline clinician trust |
| emotional_regulation + notes | How affect is held / released |
| speech_style | Pace, volume, turn shape |
| vocabulary | Register, markers, avoids |
| preferred_topics / avoidant_topics | Disclosure affinity |
| memory_of_therapist | Name/prior-session memory, alliance sensitivity, rupture style |
| treatment_expectations | What this person hopes / fears from therapy |

Validation fails closed (`validateHumanPersonality`) — missing keys are rejected.

## Runtime data flow

```
resolveAvatar(avatar, locale, { caseSnapshot })
  → resolveHumanPersonality({
        avatar,
        locale,
        personality,                    // locale AvatarPersonality
        snapshotProfile: snapshot?.human_personality
     })
  → assembleSystemPrompt({ …, human_personality })
       Module 2b — HUMAN PERSONALITY (full structured block)
  → assemblePerTurnReinforcement(…)
       compact “Stay THIS personality: …” cue every therapist turn
```

Precedence (never GPT):

1. Frozen `sessions.clinical_snapshot.human_personality`
2. Persisted `avatars.human_personality[locale]`
3. Built-in catalog by avatar slug (`catalog.ts`)
4. Deterministic synthesis from locale identity fields

Case generation freezes the profile via `freezeHumanPersonalityForCase`
inside `generateCaseInstance` so traits do not drift if an admin edits the
avatar mid-assessment.

## Persistence

Migration: `supabase/migrations/20260807093000_human_personality_engine.sql`

- Adds `avatars.human_personality` jsonb (locale → profile map)
- Seeds Maya + Jordan en-US profiles
- Mirrors into `personas.traits` (`attachment_style`, `temperament`, `human_personality`)

Admin save path: `PUT /api/admin/personality` → `saveHumanPersonalityProfile`.

## Admin editor

- UI: `/admin/personality` — `PersonalityEnginePanel`
- API: `GET/PUT/POST /api/admin/personality` (rate-limited, admin-only)
- Preview renders the exact Module 2b prompt block before save

## Code layout

```
src/lib/personality-engine/
  types.ts
  validation.ts
  catalog.ts          # maya-chen, jordan-hale (+ MDD contrast fixture)
  defaults.ts         # synthesis fallback
  resolve.ts
  freeze.ts
  format-for-prompt.ts
  persist.ts
  index.ts            # public barrel
  personality-engine.test.ts
```

Import from `@/lib/personality-engine` only.

## Tests

`src/lib/personality-engine/personality-engine.test.ts`

- Schema validation (accept builtins; reject missing Big Five)
- Resolve precedence + snapshot freeze
- Prompt formatting includes every required trait
- **Maya vs MDD-contrast fixture** and **Maya vs Jordan both assigned MDD**
  remain distinct people
- `resolveAvatar` injects Module 2b + per-turn cue

## Relationship to other engines

| Engine | Owns |
|--------|------|
| Human Personality | Who the person is (stable traits) |
| Case Engine | What disorder they have *this session* |
| AvatarPersonality (Module 2) | Locale identity prose, idioms, culture vignette |
| Prompt Engine | Assembles Modules 1–4 + 2b |

On diagnosis override, personality is **kept** (like identity). Module 1 owns
current mood polarity / speech phenotype; Module 2b owns who has them.

## Backward compatibility

- Avatars without `human_personality` still resolve via builtin catalog or synthesis.
- Legacy flat avatars get a valid synthesized profile so Module 2b is never empty
  for unknown patients.

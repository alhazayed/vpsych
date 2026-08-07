# Case Model

**Owner:** Dynamic Clinical Case Engine (`src/lib/case-engine`)  
**Primary type:** `CaseInstanceSnapshot` (`case-engine/types.ts`)  
**Persistence:** `case_instances.clinical_snapshot`, `sessions.clinical_snapshot`

---

## Purpose

A **CaseInstance** is the immutable clinical truth for one training session. It binds a persona identity to a diagnosis package, difficulty, modality, frozen personality, and slim ClinicalCore — without making the persona permanently own the disorder.

---

## Runtime representation

```typescript
// Conceptual — see CaseInstanceSnapshot in case-engine/types.ts
{
  version: 2,
  assessment_id, case_instance_id?,
  persona: { id, slug, display_name, avatar_id },
  primary_diagnosis: { id, slug, name, dsm5, icd10, icd11 },
  comorbidities: [...],
  difficulty, difficulty_modifiers,
  therapy_modality, therapy_reaction_rules,
  locale, severity,
  clinical_core: ClinicalCore,        // slim Module 1
  randomized_context: RandomizedContext,
  clinical_teaching?: { differentials, rule_outs, teaching_points,
                        common_mistakes, insight_expectation,
                        judgment_expectation, speech_behavior_cue },
  clinical_fidelity?: Record,         // CFI meta
  human_personality?: HumanPersonalityProfile,
  template? / instructor_preset?,
  scientific_meta?,
  memory_scope: "case_instance",
  rubric?
}
```

### ClinicalCore (session presentation)

| Field | Role |
|-------|------|
| disorder, dsm5_code?, icd11_code? | Condition naming/coding (ICD-10 on DisorderRow/snapshot diagnosis, not ClinicalCore type) |
| age, gender | Demographics for Module 1 |
| severity, onset_duration | Course |
| symptom_profile[], disclosure_rules[] | Presentation & pacing |
| session_goals[], ideal_approach | Teaching / assessment context |
| risk_profile | Module 4 |

### RandomizedContext (non-diagnostic colour)

`recent_stressor`, `financial_situation`, `relationship_detail`, `minor_life_event`, `timeline_offset_weeks`, `occupation_variant?` — must never mutate diagnostic criteria.

### DifficultyModifiers

`insight`, `resistance`, `disclosure`, `diagnostic_ambiguity`, `alliance`, `masking`, `comorbidity_weight`.

---

## Database representation

| Table | Role |
|-------|------|
| `case_instances` | Immutable row + snapshot jsonb |
| `case_memory` | Per-case mutable sidecar (emotion/adaptation/…) |
| `disorders` | Catalog + package |
| `personas` | Identity baseline |
| `comorbidity_rules` | Compatibility tiers |
| `difficulty_profiles` / `therapy_profiles` | Catalogs |
| `clinical_templates` / `instructor_presets` | Optional generators |

---

## Lifecycle

Minted once at session start → copied onto session → **frozen** (update guard) → read every turn → never rewritten for diagnosis fields.

---

## Relationships

- **Upstream:** Avatar, Persona, Disorder, Template, Preset, Personality freeze.  
- **Downstream:** Prompt Module 1, Emotion priors (disorder slug), CBE difficulty, Humanization gates (risk), Assessment rubric, CFI, ACE adaptive focus.

---

## Validation

- Generator / validation.ts: ICD-11 required; DSM-5 optional only when `dsm5_optional`.  
- Locale must not change codes.  
- `{ ok: false, issues[] }` on invalid template/preset paths.

---

## Security

- Snapshot is authoritative for the session; clients cannot patch diagnosis via API.  
- Teaching differentials are for assessment/CFI — patient prompt forbids reciting criteria.

---

## Extension points

- New disorders → `BUILTIN_DISORDERS` / DB seed + package shape.  
- Promote authored case_file fields → extend ClinicalCore + generator merge (roadmap).  
- Do not store diagnosis on `avatars` as permanent clinical truth.

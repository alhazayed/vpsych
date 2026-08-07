# Living Environment Model

**Status:** **Thin / fragmented** — no dedicated Living Environment Engine on main.

---

## Purpose

Describe how housing, daily life, finances, and environment appear in the live implementation, and what is missing.

---

## What exists

| Concept | Representation | Owner | Prompt |
|---------|----------------|-------|--------|
| Living situation | `AvatarPersonality.identity.living_situation` string | Avatar Personality | Module 2 |
| Family context | `identity.family_context` string | Avatar Personality | Module 2 |
| Socioeconomic context | `identity.socioeconomic_context` string | Avatar Personality | Module 2 |
| Financial colour (session) | `RandomizedContext.financial_situation` | Case Generator | Not Module 1 diagnosis |
| Recent stressor / life event | `RandomizedContext.*` | Case Generator | Non-diagnostic |
| Occupation variant | `RandomizedContext.occupation_variant` | Case Generator | |
| Authored biography housing | persona `case_file.identity.living_situation` etc. | Persona library | Not snapshotted to ClinicalCore |
| Daily routine structured | Missing | — | — |
| Housing type enum / homelessness | Missing | — | — |
| Neighborhood / clinic setting as clinical env | TRM themes (UI immersion) | therapy-room | Not clinical ontology |

---

## Relationships

Living/socio strings **colour** Module 2 identity. They must **never** rewrite diagnosis codes. Randomized finances may appear in `ideal_approach` colouring at mint without changing DSM criteria (`generator` contract).

---

## Ownership recommendation (future)

| Concept | Recommended owner |
|---------|-------------------|
| Stable housing / household | Avatar Personality or new Living Environment package referenced by Case Engine |
| Session-randomized stressors | Case Generator RandomizedContext (keep) |
| TRM room ambience | therapy-room (presentation only) |

Do **not** implement in Stage 3.

---

## Gap summary

See `CLINICAL_GAP_ANALYSIS.md` items: structured housing, daily routine, occupational schedule, environmental triggers as typed objects.

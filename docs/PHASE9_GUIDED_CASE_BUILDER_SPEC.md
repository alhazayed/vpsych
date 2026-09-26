# Phase 9 — Guided Case Builder Spec

**Status:** Implemented (MVP on branch)  
**Baseline:** `b6e5e32` (Phase 8 CLEAR)  
**Related audit:** `docs/PHASE9_ADMIN_DASHBOARD_AUDIT.md`

## Product intent

Nontechnical clinical educators create **fictional training patients** through guided steps. AI suggests; the educator reviews, edits, rejects, or regenerates. Nothing publishes automatically.

## Modes

| Mode | Entry | Behaviour |
|------|-------|-----------|
| Guided (default) | `/admin/avatars/new` | Multi-step Guided Case Builder |
| Advanced | Toggle on same page | Existing `VirtualPatientWizard` |

## Steps

1. Clinical presentation (catalogue search)  
2. Patient profile  
3. Session goals (multi-select + custom)  
4. Symptoms (library + AI suggestions)  
5. Clinical context (narrative + AI structure)  
6. Therapeutic framework (controlled `TherapyModality`)  
7. Interaction / behaviour  
8. AI case generation  
9. Educator review (per-section approve)  
10. Create training patient (draft via existing RPCs)

## Data sources

- Presentations / symptoms / disclosure seeds: Case Engine `BUILTIN_DISORDERS` (11 packages)
- Goals: curated educational list + unique package goals
- Frameworks: existing `TherapyModality` enum
- Persistence: `createVirtualPatientDraft` — lifecycle `draft`

## Fictional boundary

- UI banner: “Fictional training case — not a real patient.”
- Metadata: `ideal_guidelines.case_type = "training_simulation"`
- Validation blocks obvious real-identifier patterns

## Non-claims

- Not clinically validated  
- Not a full DSM-5-TR taxonomy  
- Arabic personality remains independently authored before publish  

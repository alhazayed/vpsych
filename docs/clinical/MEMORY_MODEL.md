# Memory Model

**Owners:**  
- **Case-scoped sidecar:** `case_memory` (Emotion / Adaptation namespaces + misc)  
- **Longitudinal dyad memory:** Patient Memory Engine → `patient_long_term_memory`

---

## Purpose

Separate (1) mutable per-case runtime blobs from (2) facts the synthetic patient should remember across sessions with the same therapist.

---

## 1. Case memory (`case_memory`)

| Aspect | Detail |
|--------|--------|
| Key | `case_instance_id` |
| Column | `memory` jsonb |
| Also | `longitudinal_group_id` optional |
| Writers | Emotion → `memory.emotion`; Adaptation → `memory.patient_adaptation`; mint may seed empty `{turns, notes, scope}` |
| Readers | Owning engines; Humanization may read raw jsonb (read-only) |

**Ownership rule:** patch only your namespace. Dual-writer race is documented debt (ARCH-S2-02).

---

## 2. Longitudinal patient memory (LTM)

**Types:** `src/lib/patient-memory/types.ts`  
**Table:** `patient_long_term_memory` (therapist_id + avatar_id dyad)

### Entry categories

`previous_session` · `therapist_mistake` · `promise` · `medication` · `relationship` · `life_event` · `trauma` · `children` · `occupation` · `future_plan` · `other`

### Entry shape

`id`, `category`, `content`, `source`, `session_id`, `turn_index`, `salience` 0–1, `topics[]`, timestamps, optional `compressed_from`.

### Lifecycle hooks

| Hook | Function | Failure |
|------|----------|---------|
| Message turn | `prepareMemoryForTurn` → retrieve + inject prompt block | soft ★ |
| Session end | `runPatientMemoryAfterSession` → summarize / save | soft ★ |

### Prompt

`LONG-TERM MEMORY (facts you actually remember…)` appended after Module assembly.

---

## 3. Personality “memory of therapist”

HPE field `memory_of_therapist` (remembers_name, prior_sessions, alliance_sensitivity, rupture_style) is a **trait prior**, not the LTM store. Owner: Personality Engine.

---

## 4. What memory is not

- Not a clinical chart.  
- Not MSE.  
- Not automatic carry of Emotion/Adaptation state across new CaseInstances (those are case-scoped).  
- Not therapist private notes.

---

## Relationships

```
CaseInstance ──case_memory──► Emotion / Adaptation
Therapist × Avatar ──LTM──► cross-session facts → Module append
HPE.memory_of_therapist ──trait──► Module 2b colouring
```

---

## Security

- RLS: owner therapist; admin delete.  
- Soft-fail: missing table must not block session.  
- Do not store real PHI; synthetic educational facts only.  
- Compression/summarization must not invent clinical diagnoses.

---

## Extension points

- Structured medication list as typed objects vs free-text entries.  
- Explicit trauma narrative objects with clinical gates.  
- Longitudinal group linking multiple avatars/cases (column exists; product use thin).

# Long-Term Patient Memory (Mission 4)

Patients remember.

## Objective

Across sessions with the same therapist↔avatar dyad, the standardized patient
persists and recalls:

- previous sessions
- therapist mistakes
- promises
- medications
- relationships
- important life events
- trauma
- children
- occupation
- future plans

**Do not regenerate history.** Facts are extracted from real transcripts (and
authored persona identity seeds) and stored. Compression consolidates existing
entries; it never invents content.

Patients reference prior conversations naturally, e.g.
*"You asked me about my father last week…"*

## Modules

| Module | File | Responsibility |
|--------|------|----------------|
| Store | `store.ts` / `memory-store.ts` | Append-only facts; dyad-keyed document |
| Extract | `extract.ts` | Grounded candidates from transcript / persona |
| Retrieval | `retrieve.ts` | Relevance ranking for the current turn |
| Summarization | `summarize.ts` | Session → durable entries + summary |
| Compression | `compress.ts` | Merge when over soft cap; sticky categories kept |
| Prompt | `prompt.ts` | Inject LONG-TERM MEMORY block into system prompt |
| Persist | `persist.ts` | DB upsert + in-memory fallback |
| Session hooks | `session-hook.ts` | Message prepare + end-of-session write |

Barrel: `@/lib/patient-memory`

## Runtime flow

```
POST /api/sessions/[id]/message
  → resolveAvatar(...)
  → prepareMemoryForTurn()   // load + retrieve + inject prompt
  → generatePatientReplyDetailed({ system_prompt with memory })

POST /api/sessions/[id]/end
  → assessSession() + ACE (unchanged)
  → runPatientMemoryAfterSession()  // summarize → compress → save
  → create report (unchanged)
```

Both hooks are **best-effort and non-blocking**. Missing migration / RLS /
service role never prevents a reply or report.

## Persistence

Migration: `supabase/migrations/20260807093000_long_term_patient_memory.sql`

Table `patient_long_term_memory`:

- Unique `(therapist_id, avatar_id)` — one store per therapeutic dyad
- `memory` jsonb document (`PatientMemoryStore`)
- RLS: owner select/insert/update; admin delete only (therapists cannot wipe)

Process-local fallback mirrors Quality Ledger / ACE when the table is absent.

## Invariants

1. **Persist, don't regenerate** — duplicates are skipped; session summaries are idempotent per `session_id`.
2. **No fabrication in prompts** — the injected block lists only stored facts and instructs the model not to invent.
3. **Compression preserves content** — removed entry ids appear in `compressed_from` on survivors.
4. **Sticky categories** (trauma, medication, children, promise, therapist_mistake, occupation) resist merge when salience is high.
5. **Persona ≠ diagnosis** unchanged — memory is keyed by avatar identity + therapist, not by disorder.

## Tests

`src/lib/patient-memory/patient-memory.test.ts` covers extract, store
dedupe, retrieval/prompt cues, summarization idempotency, compression
folding, and session-hook persistence across sessions.

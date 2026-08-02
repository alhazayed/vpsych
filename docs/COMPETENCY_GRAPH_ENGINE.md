# VPsych Competency Graph Engine (CGE) v3.0

## Objective

Replace flat competency scoring with a directed acyclic competency graph so progression depends on prerequisite mastery, root-cause remediation, and personalized clinical pathways.

```
Session assessment (ACE ingest)
  → map scores onto graph nodes
  → propagate confidence downward through dependents
  → root-cause analysis (earliest assessed weak prerequisite)
  → remediation pathway from root → observed failure
  → graph-aware adaptive next case + supervisor report
```

## Compatibility

| Path | Status |
|------|--------|
| ACE tables / learner dashboard | Unchanged; CGE reads `learner_competencies` |
| Case Engine / Templates / Presets | Consumed by graph remediation recommendations |
| `POST /api/sessions/[id]/end` | Additive CGE remediation + richer coach text |
| CGE tables missing | Soft-fail; ACE still persists |

## Architecture

1. **Competency DAG** — nodes (domains) + edges (`required` / `recommended` / `optional`)
2. **Mastery model** — not_attempted → novice → developing → competent → proficient → expert; never competent on a single sample
3. **Performance propagation** — weak prerequisites lower confidence in dependents; excellence does not auto-master dependents
4. **Root-cause analysis** — walk assessed weak ancestors; remediation starts at the earliest gap
5. **Decay** — idle competencies lose confidence; history preserved
6. **AI supervisor** — post-assessment graph report (root, weakest, strongest, decay risk, next cases)
7. **Instructor controls** — lock / unlock / approve mastery / require reassessment

## Schema

Migration: `supabase/migrations/20260802210000_competency_graph_engine.sql`

| Table / view | Purpose |
|--------------|---------|
| `cge_nodes` / `competency_nodes` | Graph node metadata |
| `cge_edges` / `competency_edges` / `competency_prerequisites` | DAG edges |
| `cge_graph_versions` / `graph_versions` | Versioned snapshots |
| `cge_attempts` / `competency_attempts` | Per-attempt evidence |
| `cge_mastery_history` / `mastery_history` | Stage transitions |
| `cge_decay` / `competency_decay` | Decay events |
| `cge_remediation_plans` / `remediation_plans` | Active pathways |
| `learner_competencies` (+ columns) | `mastery_stage`, `confidence`, `locked`, … |

## TypeScript module

`src/lib/cge/`

| File | Role |
|------|------|
| `graph.ts` | Builtin DAG, cycle checks, topo, ancestors |
| `mastery.ts` | Stage calculation + prereq gates + propagation |
| `rca.ts` | Root-cause analysis |
| `remediation.ts` | Personalized pathways |
| `decay.ts` | Confidence decay |
| `supervisor.ts` | Post-assessment report |
| `ace-bridge.ts` | Graph-aware adaptive case |
| `simulate.ts` | 20k learner simulation |

## APIs

| Endpoint | Purpose |
|----------|---------|
| `GET /api/cge/graph` | Competency graph (+ learner overlay) |
| `POST /api/cge/rca` | RCA / remediation / next / supervisor |
| `GET/POST /api/cge/mastery` | Calculate / update mastery |
| `GET/PATCH /api/admin/cge` | Instructor learner graph controls |

## UI

| Route | Audience |
|-------|----------|
| `/learning/graph` | Learner interactive graph |
| `/admin/graph` | Instructor cohort controls + graph |

## Testing

```bash
npx vitest run src/lib/cge/cge.test.ts
```

Verifies: acyclic DAG, valid prerequisites, mastery gates, RCA (e.g. weak MSE → treatment planning), 20k learner simulation success criteria.

## Migration strategy

1. Deploy ACE migration first (`20260802200000_…`).
2. Apply CGE migration (`20260802210000_…`) — additive only.
3. Builtin graph in TypeScript remains the offline fallback if DB nodes are empty.
4. Session hook inserts remediation plans only when tables exist (errors soft-fail).

## Rollback strategy

1. Stop writing `cge_*` from the session hook (revert `session-hook.ts` import of CGE).
2. Drop CGE objects if needed:

```sql
DROP VIEW IF EXISTS public.graph_versions, public.competency_decay, public.mastery_history,
  public.competency_attempts, public.remediation_plans, public.competency_prerequisites,
  public.competency_edges, public.competency_nodes CASCADE;
DROP TABLE IF EXISTS public.cge_remediation_plans, public.cge_decay, public.cge_mastery_history,
  public.cge_attempts, public.cge_graph_versions, public.cge_edges, public.cge_nodes CASCADE;
ALTER TABLE public.learner_competencies
  DROP COLUMN IF EXISTS mastery_stage,
  DROP COLUMN IF EXISTS confidence,
  DROP COLUMN IF EXISTS last_practiced_at,
  DROP COLUMN IF EXISTS locked,
  DROP COLUMN IF EXISTS instructor_approved;
```

ACE flat scoring and existing sessions remain intact.

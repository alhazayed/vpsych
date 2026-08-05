# Educational Opportunity Intelligence (EOI)

**Version:** `1.0.0`  
**Branch:** `cursor/eoi-platform-0594`  
**Depends on:** Clinical Quality Intelligence (CQI) capture patterns

## Mission

Distinguish **software defects**, **clinical defects**, and **educational
opportunities**. When an expert thinks “this would be an even better teaching
case if…”, VPsych captures that idea as a permanent educational asset — never as
a bug report.

EOI is integrated with the CQI reviewer surface (shared Flag dialog) but uses a
**separate vault, ledger, statuses, and admin dashboard**.

## Architecture

| Layer | Location |
|---|---|
| Domain | `src/lib/eoi/` |
| Migration | `supabase/migrations/20260805225220_educational_opportunity_intelligence.sql` |
| Session API | `POST/GET /api/sessions/[id]/eoi` |
| Attachments | `POST /api/sessions/[id]/eoi/attachments` |
| Admin dashboard API | `GET /api/admin/eoi` |
| Educational Analyst | `POST /api/admin/eoi/analyze` |
| Research export | `GET /api/admin/eoi/export` |
| Reviewer UI | `FlagThisMoment` mode **Educational Opportunity** |
| Admin UI | `/admin/eoi` |

### Tables

- `eoi_opportunities` — teaching-idea vault (never defect statuses)
- `eoi_clusters` — curriculum clusters + backlog scores
- `eoi_attachments` — design evidence (Storage `eoi-evidence`)

### Status ledger (assets, not defects)

`open` → `under_review` → `accepted` → `scheduled` → `implemented` →
`validated` → `published` (or `declined`)

### Capture fields

- Opportunity type (teaching enhancement, clinical realism, OSCE, …)
- Educational impact ★1–★5
- Target learners (multi-select)
- Competency tags
- Idea text + optional design sketch / expected learning experience
- Annotations, voice note, file evidence
- Auto context via CQI `buildServerCaptureContext` (session, disorder, language,
  versions, transcript window)

### AI Educational Analyst

Asks **“How could this improve learning?”** — not “How do we fix this?”

Produces educational rationale, learner benefit, affected disorders/curriculum/
competencies, difficulty, effort, educational priority, research value, and a
Cursor prompt draft. **Human approval required**; no auto-PRs.

Fingerprints are salted with `eoi::` so clusters never collide with CQI defects.

### Memory fallback

If migrations are not applied, opportunities persist in process memory
(`EOI_MEMORY_FALLBACK`, default on). Production must apply the migration.

## Separation from CQI

| | CQI | EOI |
|---|---|---|
| Intent | Something is wrong | Teaching could be better |
| Tables | `cqi_*` | `eoi_*` |
| Admin | `/admin/cqi` | `/admin/eoi` |
| `is_defect` | true path | always `false` |

## Ops

1. Apply migration `20260805225220_educational_opportunity_intelligence.sql`
2. Confirm Storage bucket `eoi-evidence`
3. Optionally reuse `CQI_ENCRYPTION_KEY` / `REPORT_WRITE_KEY` for idea encryption
4. Invite experts to use **Educational opportunity** during sessions
5. Admins run Educational Analyst from `/admin/eoi`
6. Prioritize backlog; implement only after educator approval

# Admin Dashboard Usability — Phase 1 Audit & Phase 2 IA

**Branch:** `cursor/admin-dashboard-usability-46b3`  
**Date:** 2026-08-08  
**Constraint:** No RLS/authz/role-model changes. Frontend + thin admin orchestration APIs only.

## Phase 1 — Current state

### Routes (`src/app/(app)/admin/`)

| Route | Purpose | Mutates avatars? |
|-------|---------|------------------|
| `/admin/reports` | Report library | No |
| `/admin/avatars` | Read-only preset cards | No |
| `/admin/personality` | Human Personality Engine editor | Personality JSON only |
| `/admin/voices` | Voice registry + assign | `voice_profile_id` only |
| `/admin/cases` | Case engine preview | No |
| `/admin/templates` | Scenario templates | Templates only |
| `/admin/presets` | Instructor presets | Presets only |
| `/admin/curriculum` | ACE | No |
| `/admin/graph` | CGE | No |
| `/admin/research` | Scientific validation | No |
| `/admin/supervisor` | Supervisor overview | No |
| `/admin/enterprise` | Enterprise | No |
| `/admin/cidp` | CIDP ops | No |
| `/admin/feedback` | Feedback queue | No |

**No** `/admin` hub. **No** create/edit/duplicate/publish avatar wizard.

### Avatar data model (reuse)

- Table `avatars`: flat columns + `clinical_core`, `personalities`, `human_personality`, `voice_profile_id`, `is_active`
- Therapist visibility gated by `is_active` (RLS)
- Admin INSERT/UPDATE/DELETE allowed by RLS via `is_admin()` — **no Route Handlers for full CRUD today**
- Existing mutators: `PUT /api/admin/personality`, `PATCH /api/admin/avatars/[id]/voice`
- Lifecycle today: boolean `is_active` only (no draft/testing/published/archived)
- Personality clinical_review status: `draft | in_review | approved` (JSON metadata, not enforced)

### Permissions

- Edge: middleware `/admin` + `/api/admin` require `profiles.role = admin`
- Pages: `requireAdmin()`; APIs: `requireApiAdmin()` + audit on deny

### Gaps vs target UX

| Target | Gap |
|--------|-----|
| 7-section IA | 14+ technical nav items |
| VP library cards + statuses | Read-only cards; Active/Inactive only |
| Guided create wizard | Missing |
| Structured behavior rules | Missing (only free-form persona_prompt / disclosure_rules) |
| Test Patient (non-learner) | Missing |
| Duplicate / Archive / Publish | Missing for avatars |
| Hide JSON/IDs | Admin pages expose voice IDs, engine jargon |

## Phase 2 — Migration-safe IA

### Primary nav (exactly 7)

1. **Dashboard** → `/admin`
2. **Virtual Patients** → `/admin/virtual-patients`
3. **Cases & Scenarios** → `/admin/cases-scenarios` (hub → cases/templates/presets)
4. **Learners** → `/admin/learners` (hub → curriculum/graph/feedback)
5. **Assessments** → `/admin/assessments` (hub → reports/research/supervisor)
6. **Governance** → `/admin/governance` (hub → enterprise/cidp)
7. **Settings** → `/admin/settings` (voices + advanced links)

Legacy deep routes remain reachable from hubs (progressive disclosure).

### Lifecycle mapping (additive column)

| UX status | `lifecycle_status` | `is_active` (synced) |
|-----------|--------------------|----------------------|
| Draft | `draft` | `false` |
| Testing | `testing` | `false` |
| Published | `published` | `true` |
| Archived | `archived` | `false` |

Existing rows: `is_active=true` → `published`; else → `archived`.

### Orchestration APIs (new, thin)

- `GET/POST /api/admin/virtual-patients`
- `GET/PATCH /api/admin/virtual-patients/[id]`
- `POST .../duplicate`, `POST .../lifecycle`
- `POST .../test-session` — starts session flagged admin-test (no learner assessment write path abuse)

Wizard maps clinical UX fields → existing `clinical_core` + `personalities` + `human_personality` + `disclosure_rules` (behavior).

### Advanced mode

Hidden by default; deep-links to personality/voices raw panels and IDs.

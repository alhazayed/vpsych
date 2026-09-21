# Phase 5 — Governance, Tenancy Integrity & Production Operational Readiness

**Branch:** `cursor/admin-governance-tenancy-fc9c`  
**Base:** `cursor/admin-learner-session-ops-fc9c` (Phases 4–4.1)  
**Epistemic rule:** `implemented` ≠ `configured` ≠ `verified` ≠ `production operational`.

This document is the Phase 5 audit record. It does **not** authorize schema migrations,
role invention, org CRUD, charts, or session-lifecycle changes.

---

## 1. Baseline inventory (VERIFIED from code)

| Area | Finding |
|------|---------|
| Application | Next.js 16 App Router · React 19 · admin under `src/app/(app)/admin/` (26 pages) |
| Database | Supabase Postgres · migrations under `supabase/migrations/` · RLS on clinical tables |
| Authentication | Supabase Auth · `requireUser` / `requireApiUser` · middleware session refresh |
| Authorization | Platform roles only: `therapist` \| `admin` (`UserRole`) |
| RLS | Owner OR `is_admin()` on sessions/messages; reports admin-only; M23 manager policy on sessions |
| Organizations | `institutions` + `institution_memberships` (Mission 18) |
| Memberships | `is_active`, `is_primary`, `created_at` — **no** `starts_at`/`ends_at` |
| Sessions | `therapist_id`, nullable `institution_id` (M23), status active\|completed\|expired |
| Reports | `session_reports` · HMAC/`create_session_report` · CASCADE on session delete |
| Learners | Admin directory = `profiles.role = therapist` · id = `sessions.therapist_id` |
| Analytics | Platform-wide admin aggregates · session/institution derived |
| Research | Admin workspace + export · package anonymized; csv/json retain ids |
| Cron | `GET /api/cron/expire-sessions` · Bearer `CRON_SECRET` · service role |
| Logging | `console.*` structured events · no APM product |
| Deployment | Vercel · `vercel.json` has **no** crons |
| CI | `.github/workflows/ci.yml` on `push`/`pull_request` to **`main` only** |

---

## 2. Admin authorization matrix

| Surface | admin | therapist |
|---------|-------|-----------|
| `/admin` and all `/admin/*` pages | ✓ (`requireAdmin` + middleware) | ✗ redirect `/avatars` |
| `/api/admin/*` | ✓ (`requireApiAdmin` + middleware 403) | ✗ 403 |
| `/api/health/openai` | ✓ (`requireApiAdmin`) | ✗ 403 |
| `/api/cron/expire-sessions` | Bearer secret only | Bearer secret only |
| Therapist session APIs | Owner (or admin emotion GET) | Owner only |
| Session reports UI | ✓ | ✗ (no therapist report API) |

**Organization scope today:** platform `admin` is **cross-tenant by design** (RLS `is_admin()`).
There is **no** institution-scoped admin UI role. `docs/TENANT_MODEL.md` Stage 10 helpers
exist for enterprise tables; clinical admin console does not implement org-scoped admins.

**STOP (product):** True institutional admin isolation requires a new role (e.g. institution_admin).
Phase 5 does **not** invent that role.

---

## 3. API authorization highlights

| Endpoint | Auth | Tenant trust | Notes |
|----------|------|--------------|-------|
| `POST /api/sessions` | Authenticated user | `institution_id` ← profile primary (never body) | Primary + legacy insert stamp (Phase 5 fix) |
| `POST /api/sessions/[id]/{message,end,…}` | Owner | Session row | CAS on end |
| `POST /api/admin/avatars/[id]/test-session` | Admin | Admin profile primary | |
| `GET /api/admin/enterprise?organizationId=` | Admin | Client org id filters **in-memory** engine only | Not clinical RLS |
| `GET /api/admin/research/export` | Admin | Platform | `package` anonymized; `csv`/`json` include learner/session ids |
| `GET /api/cron/expire-sessions` | `CRON_SECRET` | N/A | Service role required |

---

## 4–7. Tenancy & historical ownership

### Decision (product semantics)

Historical sessions **must remain** associated with the institution under which they occurred
(`sessions.institution_id` stamp). Deriving from **current** membership would rewrite history
and corrupt educational analytics.

### Production snapshot (VERIFIED via Supabase SQL, project `rrzudbkxigeavfdnidnm`)

| Metric | Count |
|--------|------:|
| Total sessions | 603 |
| `institution_id` NULL | **603** |
| `institution_id` stamped | **0** |
| Profiles with `primary_institution_id` | **0** |
| `institution_memberships` rows | **0** |
| Institutions present | 5 |
| Membership temporal columns (`starts_at`/`ends_at`/…) | **0** |

| Backfill class | Count |
|----------------|------:|
| NULL sessions | 603 |
| Recoverable via current primary | 0 |
| Recoverable via single active membership | 0 |
| Ambiguous (multi active membership) | 0 |
| No identifiable institution | **603** |

**Conclusion:** Historical reconstruction from memberships is **impossible** today.
Backfill **must not** run until memberships/primaries exist and a product-approved source
of truth is chosen. Leaving rows NULL is correct.

### Backfill proposal (DO NOT APPLY without approval)

```text
Source of truth:        undecided — candidates below
Eligibility:            sessions.institution_id IS NULL AND exactly one recoverable source
Rows affected (today):  0 recoverable
Rows remaining NULL:    603 (all current production)
Ambiguous rows:         0 (no multi-membership)

Candidates:
  1. membership active at started_at     — IMPOSSIBLE (no temporal membership)
  2. profiles.primary_institution_id now — WEAK (rewrites history if learner moved)
  3. immutable session stamp             — CORRECT going forward (already implemented)
  4. impossible to determine             — CURRENT PRODUCTION STATE

SQL strategy:           deferred
RLS implications:       M23 manager policy only sees non-null institution_id
Indexes:                idx already on sessions(institution_id) WHERE NOT NULL (M23)
Rollback:               UPDATE … SET institution_id = NULL WHERE … (if stamped wrongly)
Validation:             counts null/stamped; sample join memberships; no orphan FKs
```

---

## 8. Session creation paths

| Path | Stamps `institution_id`? |
|------|--------------------------|
| `POST /api/sessions` primary insert | Yes |
| `POST /api/sessions` legacy fallback | Yes (Phase 5 fix) |
| Admin test-session | Yes |
| Seeds / scripts | No direct session inserts found |

---

## 9. Organization isolation

| Scenario | Status |
|----------|--------|
| Therapist cannot open `/admin/*` | VERIFIED (middleware + `requireAdmin`) |
| Therapist cannot call `/api/admin/*` | VERIFIED |
| Platform admin can read all sessions/reports | VERIFIED (intentional) |
| Institution A admin cannot see B | **NOT APPLICABLE** — no institution_admin role |
| Browser `institution_id` for auth | VERIFIED blocked on session create |

---

## 10–11. Analytics & research

- Analytics: platform-wide; groups by session `institution_id` when present; admin-only.
- Research UI disclaimer present (`workspaceDisclaimer` EN/AR).
- Export `package` strips learner UUIDs; `csv`/`json` retain identifiers (admin-only by design).
- Do not treat research export as an alternate therapist path (admin-gated).

---

## 12–15. Data classification & lifecycle

| Category | Stored | Admin UI | Export | Retention |
|----------|--------|----------|--------|-----------|
| Identity | `profiles` | Learners directory | Research csv/json | Soft retention pref only |
| Auth | Supabase Auth | — | — | Auth provider |
| Membership | `institution_memberships` | Enterprise roster | — | No temporal history |
| Sessions | `sessions` | Sessions/Learners | ids in research csv | Soft: `purge_training_sessions_older_than` (manual, unused by cron) |
| Transcripts | `session_messages` | Session detail | Not in analytics | CASCADE with session |
| Assessments/reports | `session_reports` | Reports | Aggregates / ledger | CASCADE with session; not regenerable without transcript+end path |
| Telemetry | `console` / Vercel logs | System Health / ops metrics | — | Platform log retention |
| Research | quality ledger / export | Research | package/csv/json | Product decision open (PD-3) |

**Deletion:** Session hard-delete cascades messages+reports. No soft-delete. Profile delete cascades owned sessions. Institution delete **SET NULL** on `sessions.institution_id`.

**Product decisions required:** retention TTL (PD-3/OD-2), whether passive expiry should assess, whether to populate memberships before institutional analytics.

---

## 16–19. Cron

| Aspect | Status |
|--------|--------|
| Application support | **implemented** + **verified** (auth, CAS, batch, logs) |
| Scheduler | **not configured** (Hobby; external/Pro required) |
| Secret | **documented**; production presence **not verified** in this phase |
| Observability | start/complete/failed logs sufficient to see *a* run; no pager |

Runbook: `docs/OPERATIONS_RUNBOOK.md` §9.

---

## 20–21. Secrets

- No sensitive keys on `NEXT_PUBLIC_*` (architecture + search).
- AI/TTS/STT keys used only in server libs / Route Handlers.
- `validateProductionEnv()` now surfaces `CRON_SECRET` and service-role presence (recommended).

---

## 22–28. Smoke / a11y / observability notes

- Production smoke plan: admin nav through Overview → Learners → Sessions → Reports → Analytics → Content → Enterprise → Research → Diagnostics.
- Security smoke: unauth/unauthorized admin, invalid IDs, cron without secret.
- Observability gap: operators rely on Vercel logs / admin System Health; no dedicated pager for cron miss.

---

## Acceptance answer

> Can VPsych safely operate the existing Admin Console in production across its **current** institutional model?

**Yes, as a platform-admin educational console**, with these explicit gaps before institutional-scale expansion:

1. Wire production scheduler + `CRON_SECRET` + service role for passive expiry automation.
2. Populate `institution_memberships` / `primary_institution_id` so new sessions stamp non-null.
3. Decide product policy for the 603 NULL historical sessions (leave NULL vs approved backfill — currently **zero** recoverable rows).
4. Do **not** claim institution-scoped admin isolation until a new role + RLS/UI design is approved.
5. Merge path to `main` for GitHub `verify` CI.

# Phase 6 — Production Activation + Institutional Readiness

**Branch:** `cursor/admin-production-activation-fc9c`  
**Base:** `cursor/admin-governance-tenancy-fc9c` (`f1125d6`)  
**Epistemic rule:** configured ≠ verified ≠ production-operational.

---

## A — Production cron

| Item | Status |
|------|--------|
| Endpoint code | On Phase 4+ branches; **absent from production `main`** (`5c0947e`) |
| Production unauthenticated call | `401 Unauthorized` (middleware; route not public/not present on main) |
| `CRON_SECRET` in Vercel | **VERIFIED present** (sensitive; production + preview; value not logged) |
| `SUPABASE_SERVICE_ROLE_KEY` production | **VERIFIED present** (sensitive; not logged) |
| Vercel Cron (`vercel.json`) | **NOT USED** — Hobby previously rejected crons; do not reintroduce |
| External scheduler | GitHub Actions workflow `.github/workflows/expire-sessions.yml` (**prepared**) |
| GitHub `CRON_SECRET` repo secret | **NOT VERIFIED** — agent lacks permission to set Actions secrets (HTTP 403) |
| Local cron auth matrix | **VERIFIED** — no/wrong secret → 401; correct → 200 |
| Controlled fixture expiry | **VERIFIED** — timed-out ACTIVE → EXPIRED; repeat cron → 0 changes |
| Passive expiry automated in production | **NOT VERIFIED** — blocked on (1) merge Phase 4+ to `main`, (2) Actions secret |

**STOP (scheduler):** Cannot complete end-to-end production automation until the expire-sessions route is on `main` and an operator sets repository secret `CRON_SECRET` (or upgrades to Vercel Pro Cron). Application + Vercel env are ready.

Recommended schedule once unblocked: every **15 minutes**.

### Controlled verification (local + production DB, 2026-09-21)

```text
Fixture ACTIVE started_at = now()-2h, max_duration_sec = 60
  → GET /api/cron/expire-sessions (Bearer CRON_SECRET)
  → EXPIRED, ended_at = started_at + 60s
  → second/third invocation: scanned=0 expired=0
Fixture deleted after verification.
```

---

## B — Institutions (production SQL, `rrzudbkxigeavfdnidnm`)

| Metric | Value |
|--------|------:|
| Institutions | 5 |
| Active | 5 |
| Memberships | 0 |
| Profiles with `primary_institution_id` | 0 |
| Sessions with `institution_id` | 0 / 603 |

Institutions (seed metadata):

| Name | Slug | tenant_type |
|------|------|-------------|
| VPsych Demo University | `vpsych-demo-university` | university |
| State Medical University | `state-medical-university` | university |
| Metro Teaching Hospital | `metro-teaching-hospital` | hospital |
| Harbor Private College of Medicine | `harbor-private-college` | private_organization |
| National Ministry of Health Training Program | `national-moh-training` | government |

Membership schema: `institution_memberships(id, institution_id, user_id, role enterprise_membership_role, …, is_primary, is_active, created_at, updated_at, campus_id?)` · UNIQUE `(institution_id, user_id, role)` · **no temporal columns**.

**No fake memberships created.**

---

## C — Membership source of truth

| Candidate | Status |
|-----------|--------|
| Existing enterprise records | Institutions seeded; memberships empty |
| External IdP | Not connected |
| Invitation workflow | Not implemented (out of Phase 6 scope) |
| Administrative provisioning | **Authoritative when used** (SQL / future admin tooling) |

**Authoritative source today:** none populated. Legitimate memberships must be provisioned administratively; do not invent UI CRUD in this phase.

---

## D — Primary vs historical vs session institution

| Concept | Meaning |
|---------|---------|
| Current institution | `profiles.primary_institution_id` and/or active memberships |
| Historical institution | Immutable `sessions.institution_id` at create time |
| Session institution | Same stamp; never rewritten from current membership |

`primary_institution_id`: nullable FK `ON DELETE SET NULL`. Safe for new-session stamping when set. When null → `sessions.institution_id = NULL` (explicit; no invented institution; browser id not trusted).

**Future product decision (not implemented):** whether to block session create without a primary institution.

---

## E — New session integrity

Create paths stamp from server profile (including legacy fallback). Verified in code/architecture tests.

---

## F — Historical NULL sessions — decision memo

```text
Historical sessions: 603
Recoverable: 0
Proposed default: remain NULL
Reason: no reliable historical source of truth
        (0 memberships, 0 primaries, no temporal membership history)
Action: DO NOT backfill
```

---

## G–H — Retention

| Data | Current retention | Proposed policy | Decision |
|------|-------------------|-----------------|----------|
| Sessions | no scheduled purge; manual `purge_training_sessions_older_than(p_days≥30)` admin-only | TBD | **pending** (PRODUCT DECISION) |
| Messages | CASCADE with session | follows sessions | pending |
| Assessments / reports | CASCADE with session | follows sessions | pending |
| Technical logs | provider retention | TBD | pending |

Automatic purge: **DISABLED**. Future enablement requires dry-run → count → operator confirmation → execute → verify.

---

## I–J — Roles / institution-admin

Platform roles remain `therapist` \| `admin`. No new roles.

Institution-admin preconditions checklist (all unchecked — do not implement):

```text
[ ] Membership lifecycle exists
[ ] Institution identity is authoritative
[ ] Historical tenancy policy exists
[ ] Session tenancy is reliable
[ ] Report tenancy is reliable
[ ] Analytics tenancy is reliable
[ ] RLS model is institution-aware for admin UI
[ ] Role model approved
[ ] Organization CRUD/provisioning exists
[ ] Invitation/provisioning flow exists
```

---

## Release chain

```text
main  ←  #226 Phase 1–3  ←  #227 Phase 4–4.1  ←  #228 Phase 5  ←  Phase 6 (this PR)
```

GitHub `verify` runs only on PRs to `main`. Production currently deploys `main` without Phases 1–6 admin/cron code.

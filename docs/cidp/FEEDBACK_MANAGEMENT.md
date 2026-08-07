# Feedback Management System — CIDP

**Version:** `1.0.0-rc.1`  
**Code:** `src/lib/enterprise/feedback.ts` · table `institutional_feedback`  
**UI:** `/feedback` (submit) · `/admin/feedback` (triage)

## Purpose

Collect structured institutional pilot feedback from:

- Faculty  
- Residents  
- Researchers  
- Administrators  
- IT teams  

This replaces ad-hoc off-platform-only collection for CIDP while remaining compatible with `../FEEDBACK_GUIDE.md` clinical rubrics for expert evaluation.

## Required fields

| Field | Values / notes |
|-------|----------------|
| Severity | critical · high · medium · low · wishlist · suggestion |
| Classification | Critical · High · Medium · Low · Suggestion (auto from severity) |
| Category | clinical realism / educational / simulation / assessment / curriculum / supervisor / analytics / research / auth / performance / voice / security / deployment / documentation / usability / bug / other |
| Reproducibility | always · often · sometimes · rare · unknown |
| Suggested action | Free text (optional but encouraged) |
| Priority | p0–p3 (defaulted from severity; admin may override) |
| Status | submitted · triaged · in_progress · resolved · wont_fix · duplicate |
| Institution | Name (+ optional institution_id) |
| Department | Free text |
| Version | Defaults to `1.0.0-rc.1` |
| Assigned owner | `assigned_owner_id` (profiles.id) — admin triage |
| Resolution | Free text (no PHI) |
| Audit trail | Append-only JSON events (`submit`, `admin.patch`, …) |

## PHI policy

- Application rejects obvious PHI-like tokens (MRN, “real patient”, SSN, etc.).  
- Operators must still manually reject residual re-identification risk.  
- Prefer fictional session UUIDs as references.

## APIs

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/feedback` | User (20/h) |
| GET | `/api/feedback` | User (own rows) |
| GET | `/api/admin/feedback` | Admin |
| PATCH | `/api/admin/feedback` | Admin |

## Triage SLA (recommended)

| Severity | First response | Resolution target |
|----------|----------------|-------------------|
| Critical | 4 business hours | 48 hours or workaround |
| High | 1 business day | 5 business days |
| Medium | 3 business days | Pilot window |
| Low / Wishlist | Backlog | Post-GA / v1.1 |

Critical clinical or security items escalate via `../INCIDENT_RESPONSE.md`.

## Ownership

Enterprise / ops owns the feedback store. **Never** writes `clinical_snapshot`, `case_memory`, or patient cognition tables.

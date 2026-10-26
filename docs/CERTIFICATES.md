# Training Program certificates

An educational training certificate, not a clinical licence. Every page and
printout that shows a certificate says so.

## What is recorded

Issued certificates live in `public.enterprise_certificates`
(migration `20261025220000_verifiable_training_certificates.sql`), with
`program = 'training_program'`. The printed number is `verification_code`,
formatted `VT-XXXX-XXXX-XXXX` (48 random bits, upper-case hex). The name,
institute and language are frozen when the certificate is issued.

A trainee holds at most one active Training Program certificate (partial
unique index). Revoking keeps the row and marks it `revoked` with the time,
the admin and an optional reason.

## How a certificate is issued

- **Automatically**, when the trainee passes the top level of every active
  program patient. Grading happens in the `session_reports` trigger; the
  `training_ladder_attempts_issue_certificate` trigger then issues the
  certificate. It is best effort: a failure is a database warning and never
  stops the report or the grade. An automatic certificate is issued once; after
  an admin revokes it, only an admin issues a new one.
- **By an admin** on `/admin/certificates`: choose the trainee, check the name,
  press *Issue certificate*. `POST /api/admin/certificates` calls
  `admin_issue_training_certificate`, which re-checks `is_admin()` (two-step
  login).

Revoking: the *Issued certificates* table on the same page,
`POST /api/admin/certificates/[id]/revoke` → `admin_revoke_training_certificate`.

## Verification

`/verify?code=…` is public (no sign-in) and rate limited per IP (60/hour).
It calls `verify_training_certificate`, a SECURITY DEFINER function granted to
`anon`, which returns only what the printed sheet shows: number, name,
institute, issue date, revoked or not. `GET /api/enterprise/certificates/verify`
returns the same as JSON. Numbers are matched loosely (case, spaces, missing
dashes, O/I/L for 0/1/1).

Dates are the UTC day of `issued_at`, on the printed sheet and on `/verify`.

## Before the migration is applied

`lib/certificate-registry.ts` reports `not_set_up`, and the admin page falls
back to the earlier behaviour: an unrecorded `VT-YYYYMMDD-XXXXXX` reference and
the note that numbers cannot be checked online yet. `/verify` says verification
is unavailable. If the records fail to load for another reason, printing is
paused so no unrecorded number goes out.

## Tests

- `src/lib/certificate-registry.test.ts`: number parsing, mapping, RPC calls.
- `supabase/tests/rls/10_core_rls.sql` (*training certificates*): automatic
  issue once, public verify, who may issue and revoke, no re-issue after a
  revocation.
- `e2e/certificates.spec.ts`: admin sees the automatic certificate, verifies it
  in English and Arabic, revokes it, issues a new one.

The wording printed on the sheet (heading, signatories, institute logo) is
still kept in the admin's browser (`localStorage`), not on the server.

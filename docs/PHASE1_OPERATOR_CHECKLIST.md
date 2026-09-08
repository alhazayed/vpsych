# Phase 1 Operational Security Checklist

This checklist records actions that require an accountable operator and cannot
be represented honestly as source code or test fixtures.

## Before merging the Phase 1 hardening migration

1. Review the generated SQL in staging and run the Supabase security advisor.
2. Confirm that the quality-ledger rejection function is used only as a trigger,
   then apply the migration through the normal Supabase migration workflow.
3. Run an authenticated regression test for voice-profile updates and an
   unauthenticated PostgREST/RPC probe for the quality-ledger trigger function.
4. Verify Git and supabase_migrations.schema_migrations are in parity.
   Configure SUPABASE_DB_URL in GitHub Actions before making remote parity a
   required merge gate.

## Production settings to verify

- Supabase Auth leaked-password protection is enabled.
- Production rate limiting has both Upstash variables configured.
- Vercel production has all required application secrets; never commit them.
- Supabase Auth Site URL and redirect URLs match the production domain.
- The Send Email hook has a verified sender, valid secrets, and delivery test.
- Alerting, backup/PITR restore drills, and penetration testing have real,
  dated evidence. Do not substitute synthetic evidence for these gates.

## Secret incident procedure

If a secret was ever committed, remove the file from the repository, revoke
and replace the credential at its provider, invalidate affected sessions where
appropriate, and assess repository history exposure. File deletion alone does
not invalidate a copied secret.

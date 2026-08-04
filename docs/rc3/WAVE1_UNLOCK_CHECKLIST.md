# RC3 Wave 1 unlock checklist

Do **not** re-run Waves 2–7 until this page is all green.

## RC3-C1 — Migration parity on `main`

- [ ] PR [#103](https://github.com/alhazayed/vpsych/pull/103) merged to `main`
- [ ] Record new `main` SHA: `____________`
- [ ] `git ls-tree -r --name-only origin/main -- supabase/migrations/ | wc -l` → **54**
- [ ] Production `schema_migrations` count → **54** (already)
- [ ] Version sets identical (no remote-only / no stale git-only)
- [ ] `npm run test:migrations` with `SUPABASE_DB_URL` → `ok: true`
- [ ] Update `docs/RC3_PRODUCTION_VALIDATION.md` audited SHA + clear RC3-C1

## RC3-C2 — Dedicated audit accounts

Permanent identities (not personal developer accounts):

```text
VPSYCH_AUDIT_THERAPIST_EMAIL=
VPSYCH_AUDIT_THERAPIST_PASSWORD=
VPSYCH_AUDIT_ADMIN_EMAIL=
VPSYCH_AUDIT_ADMIN_PASSWORD=
```

- [ ] Accounts created in production Supabase Auth
- [ ] Therapist role in `profiles.role`
- [ ] Admin role in `profiles.role` (`admin`)
- [ ] Secrets injected into RC3 agent / CI environment
- [ ] Login verified on `https://vpsych.vercel.app/login` (both accounts)
- [ ] Clear RC3-C2

## Wave 1 re-run (Missions 1–5 only)

- [ ] Mission 1 UI/UX
- [ ] Mission 2 AuthZ (therapist + admin)
- [ ] Mission 3 Database (post-merge parity)
- [ ] Mission 4 API runtime (authenticated session path)
- [ ] Mission 5 AI runtime (admin health + live reply `aiSource`)
- [ ] **Zero Critical and Zero High** → set `wave_1.state: passed`
- [ ] Unlock Waves 2–5

## Still locked

RC4 · RC5 · Wave 6 Executive Board · Wave 7 Public Launch

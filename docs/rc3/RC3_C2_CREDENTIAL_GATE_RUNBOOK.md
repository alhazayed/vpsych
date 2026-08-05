# RC3-C2 — Credential Gate Remediation Runbook

**Status:** **ADOPTED** as the operational recovery procedure — Executive Board, 2026-08-05
**For:** Release Manager (requires Vercel env access + network egress to production)
**Prepared by:** Independent Executive Release Auditor, 2026-08-05
**Target:** production SHA `5bf66c07f11d286c305f59398a015614d22b723b`, deployment `dpl_5F6pBTi21VrYWaxmWSRcNnCcxTA4`, Supabase `rrzudbkxigeavfdnidnm`

> **Nothing in this runbook has been executed.** Production was not modified. Every command below is for you to run in an environment that has the two capabilities this audit session lacked: Vercel environment-variable access, and network egress to `rrzudbkxigeavfdnidnm.supabase.co` and `vpsych.vercel.app`.

### Board modification, 2026-08-05

Adopted with one amendment to the post-PASS actions: **RC3 documentation is not to be merged into `main` until the full RC process (RC3–RC5) is complete and Executive Board approval has been granted.** The release package remains branch-resident until then. See "After a PASS", item 4.

---

## Verified starting state

Established read-only during the audit. Trust these; they were re-derived from production, not copied from prior reports.

| Property | Therapist | Admin |
|---|---|---|
| Email | `audit.therapist@vpsych.dev` | `audit.admin@vpsych.dev` |
| `auth.users.id` | `1ed008c2-9ac0-4343-b1ca-a16db4eabb4d` | `8545be46-2592-4de2-aaa7-4a27a022def7` |
| `profiles.role` | `therapist` ✅ | `admin` ✅ |
| Banned / deleted | no / no ✅ | no / no ✅ |
| Confirmed | 2026-08-01 ✅ | 2026-08-01 ✅ |
| Last successful sign-in | **2026-08-03 04:40:24** | **2026-08-03 16:08:45** |
| Row `updated_at` | 2026-08-03 04:40:24 (**+13 ms** — sign-in only) | **2026-08-04 14:04:15** (**+22 h** — later mutation) |
| Hash | `$2a$06$…` (60 char) | `$2a$06$…` (60 char) |

**Read this table before resetting anything.** The therapist row has not been touched since the sign-in that succeeded. Its stored hash still corresponds to a password that demonstrably worked in production. The admin row was mutated ~22 hours after its last success.

Environment prerequisites:

```bash
export SUPABASE_URL="https://rrzudbkxigeavfdnidnm.supabase.co"
export ANON_KEY="<NEXT_PUBLIC_SUPABASE_ANON_KEY from .env.production>"
export SERVICE_ROLE_KEY="<service role key — never commit, never log>"
export THERAPIST_ID="1ed008c2-9ac0-4343-b1ca-a16db4eabb4d"
export ADMIN_ID="8545be46-2592-4de2-aaa7-4a27a022def7"
```

---

## Phase 0 — Diagnose before you reset (do not skip)

**Rationale.** RDL-008 concluded "passwords do not authenticate." That is true of the values *in the environment*. It does not establish that the *stored* credentials are unknown. Because the therapist hash predates a successful sign-in and has not changed, there is a live possibility that the correct password already exists in your records and was simply never injected — in which case a reset is unnecessary and destroys evidence.

Run this **read-only** check for each password you have on record. It writes nothing.

```sql
-- Read-only. Returns true/false per account. No mutation.
select u.email,
       (u.encrypted_password = extensions.crypt('<CANDIDATE_PASSWORD>', u.encrypted_password))
         as password_matches
from auth.users u
where u.email in ('audit.therapist@vpsych.dev', 'audit.admin@vpsych.dev')
order by u.email;
```

`pgcrypto 1.3` is installed in the `extensions` schema — this was verified during the audit, including a negative control that correctly returned `false` for both accounts.

**Decision:**

| Result | Action |
|---|---|
| A candidate matches **therapist** | Do **not** reset therapist. Record the value for Phase 2. |
| A candidate matches **admin** | Do **not** reset admin. Record the value for Phase 2. |
| A candidate matches the **other** account than expected | You have found a second swap — in your records, not just the env. Note it in the RDL. |
| No candidate matches either | Proceed to Phase 1 for that account only. |

Reset only the accounts that fail Phase 0.

---

## Phase 1 — Reset password material (only where Phase 0 failed)

**Use the GoTrue Admin API, not raw SQL.** GoTrue owns the invariants around `auth.users`; a direct `UPDATE` bypasses its bookkeeping. Raw SQL is a last resort only.

```bash
# Therapist — only if Phase 0 found no match
curl -sS -X PUT "$SUPABASE_URL/auth/v1/admin/users/$THERAPIST_ID" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"password":"<NEW_THERAPIST_PASSWORD>"}' \
  -w '\nHTTP %{http_code}\n'

# Admin — only if Phase 0 found no match
curl -sS -X PUT "$SUPABASE_URL/auth/v1/admin/users/$ADMIN_ID" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"password":"<NEW_ADMIN_PASSWORD>"}' \
  -w '\nHTTP %{http_code}\n'
```

Expect `HTTP 200`. Passwords must satisfy `lib/password-policy.ts`.

Confirm the write landed (read-only):

```sql
select email, updated_at, last_sign_in_at
from auth.users
where id in ('1ed008c2-9ac0-4343-b1ca-a16db4eabb4d',
             '8545be46-2592-4de2-aaa7-4a27a022def7');
```

`updated_at` should now be within seconds of now for each account you reset.

---

## Phase 2 — Inject environment variables (the step that has failed three times)

Set all four in the Vercel project `vpsych` (`prj_qiJ1mQvX0s5lJZ9KJnpWAx4EXjNm`), **and** in whatever environment the audit agent actually runs in — RDL-007 shows these can diverge.

| Variable | Value |
|---|---|
| `VPSYCH_AUDIT_THERAPIST_EMAIL` | `audit.therapist@vpsych.dev` |
| `VPSYCH_AUDIT_THERAPIST_PASSWORD` | therapist password from Phase 0 or 1 |
| `VPSYCH_AUDIT_ADMIN_EMAIL` | `audit.admin@vpsych.dev` |
| `VPSYCH_AUDIT_ADMIN_PASSWORD` | admin password from Phase 0 or 1 |

**Three failure modes to check explicitly**, one for each way this has already gone wrong:

```bash
# 1. Present at all?           (RDL-006 failure: all four absent)
for v in VPSYCH_AUDIT_THERAPIST_EMAIL VPSYCH_AUDIT_THERAPIST_PASSWORD \
         VPSYCH_AUDIT_ADMIN_EMAIL VPSYCH_AUDIT_ADMIN_PASSWORD; do
  [ -n "${!v}" ] && echo "$v: present" || echo "$v: MISSING"
done

# 2. Value != its own key name? (RDL-007 failure: placeholder injection)
for v in VPSYCH_AUDIT_THERAPIST_EMAIL VPSYCH_AUDIT_THERAPIST_PASSWORD \
         VPSYCH_AUDIT_ADMIN_EMAIL VPSYCH_AUDIT_ADMIN_PASSWORD; do
  [ "${!v}" = "$v" ] && echo "$v: PLACEHOLDER" || echo "$v: real value"
done

# 3. Correct local part?        (RDL-008 failure: emails swapped)
echo "$VPSYCH_AUDIT_THERAPIST_EMAIL" | grep -q '^audit\.therapist@' \
  && echo "therapist email: OK" || echo "therapist email: WRONG/SWAPPED"
echo "$VPSYCH_AUDIT_ADMIN_EMAIL" | grep -q '^audit\.admin@' \
  && echo "admin email: OK" || echo "admin email: WRONG/SWAPPED"
```

All eight lines must read OK/present/real before continuing.

---

## Phase 3 — Re-run the credential gate

### 3a. Primary gate — each account with its own password

```bash
auth() {
  curl -sS -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
    -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" \
    -o /tmp/gate_resp.json -w '%{http_code}'
}

CODE=$(auth "$VPSYCH_AUDIT_THERAPIST_EMAIL" "$VPSYCH_AUDIT_THERAPIST_PASSWORD")
echo "therapist: HTTP $CODE  token=$(jq -r '.access_token != null' /tmp/gate_resp.json)"

CODE=$(auth "$VPSYCH_AUDIT_ADMIN_EMAIL" "$VPSYCH_AUDIT_ADMIN_PASSWORD")
echo "admin:     HTTP $CODE  token=$(jq -r '.access_token != null' /tmp/gate_resp.json)"
```

**Gate passes only if both report `HTTP 200` and `token=true`.**

### 3b. Full 2×2 canonical matrix — this is what caught the real problem

Run all four combinations against the **canonical** addresses. This is the test that proved the email swap was not the operative cause; keep it, because it distinguishes a mapping error from a password error.

```bash
for email in audit.therapist@vpsych.dev audit.admin@vpsych.dev; do
  for pwlabel in THERAPIST ADMIN; do
    pwvar="VPSYCH_AUDIT_${pwlabel}_PASSWORD"
    CODE=$(auth "$email" "${!pwvar}")
    echo "$email + ${pwlabel}_password -> HTTP $CODE"
  done
done
```

**Expected healthy result — exactly two passes on the diagonal:**

| Email | Therapist pw | Admin pw |
|---|---|---|
| `audit.therapist@vpsych.dev` | **200** ✅ | 400 ✅ |
| `audit.admin@vpsych.dev` | 400 ✅ | **200** ✅ |

Any other shape is a finding:

- **All four 400** → passwords still wrong. Return to Phase 0. *(This is the current state.)*
- **Anti-diagonal 200s** → credentials swapped at source, not just in env.
- **Three or four 200s** → both accounts share a password. Security finding; do not proceed.

### 3c. Role separation — authentication is necessary, not sufficient

A token proves identity, not authorization. Verify the admin gate actually discriminates:

```bash
T_TOKEN=$(curl -sS -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"audit.therapist@vpsych.dev\",\"password\":\"$VPSYCH_AUDIT_THERAPIST_PASSWORD\"}" \
  | jq -r .access_token)

A_TOKEN=$(curl -sS -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"audit.admin@vpsych.dev\",\"password\":\"$VPSYCH_AUDIT_ADMIN_PASSWORD\"}" \
  | jq -r .access_token)

# Therapist MUST be denied (expect 401/403)
curl -s -o /dev/null -w "therapist -> /api/health/openai : %{http_code}\n" \
  -H "Authorization: Bearer $T_TOKEN" https://vpsych.vercel.app/api/health/openai

# Admin MUST be admitted (expect 200)
curl -s -o /dev/null -w "admin     -> /api/health/openai : %{http_code}\n" \
  -H "Authorization: Bearer $A_TOKEN" https://vpsych.vercel.app/api/health/openai
```

Also exercise a real admin route, e.g. `/api/admin/disorders` or `/api/admin/templates` — same expectation: therapist denied, admin admitted. A therapist token returning `200` on any `/api/admin/*` path is a **release-blocking security finding**, not a credential issue.

Note that `requireApiAdmin` writes a denied row to `security_audit_events`; the therapist denial should be visible there afterwards, which doubles as confirmation the audit trail works.

### 3d. Browser confirmation

Sign in as each account at `https://vpsych.vercel.app/login`. The gate's stated definition is manual login success; the password-grant checks above are the machine-verifiable half.

---

## Gate pass criteria

All must hold:

- [ ] Phase 2: all eight environment checks report OK
- [ ] 3a: both accounts return `HTTP 200` with an access token
- [ ] 3b: matrix is exactly diagonal — two 200s, two 400s
- [ ] 3c: therapist denied on `/api/admin/*` and `/api/health/openai`; admin admitted
- [ ] 3d: browser login succeeds for both
- [ ] Production still at SHA `5bf66c0`; migrations still 54 ≡ 54

Any unchecked box → gate FAILS, Wave 1 stays closed, open a new RDL entry.

---

## After a PASS — recommended, from the audit's governance findings

1. Update `docs/AUDIT_ACCOUNTS.md`: `provisioning.status` → `ready`, and fill the `credential_verification_gate` fields with real results rather than `pending`.
2. Clear RC3-C2 in the RDL, recording the corrected root cause: **password material mismatch**, with the email swap as a secondary defect.
3. Correct the two inaccurate claims — "no commits were created" should read "no application-code commits were created" (16 docs commits exist across PRs #104/#105/#106).
4. **Do NOT merge the RC3 record to `main`.** *(Board modification, 2026-08-05.)* The RC3 documentation stays on its release-package branch until RC3–RC5 are complete **and** Executive Board approval is granted, at which point the package merges as a single unit preserving the RDL sequence. Until then the deferred-merge compensating control applies: the package must be complete and self-contained on its branch, every artifact must record the SHA it was produced against, and no artifact may depend on `main` to be interpreted.
5. Consolidate or close the competing RC3 branches (#104, #105, #106). **Not deferred** — fragmentation is independent of the merge hold, and the hold makes a single authoritative branch more important, not less.
6. Quarantine the mission reports produced against `main@52a7610` (28 migrations) so they are not mistaken for evidence at `5bf66c0`.
7. Consider enabling GoTrue audit-log retention — `auth.audit_log_entries` is currently empty, so this incident left no server-side trail.
8. Re-run Wave 1 on a **fresh** agent; existing VMs may cache stale secret values.

---

## Standing recommendation

Fold Phase 2's eight checks and Phase 3a into a single pre-flight script the Release Manager runs **before** dispatching any audit agent. All three failures to date — missing, placeholder, swapped — were detectable at injection time, and each one consumed a full agent cycle to discover.

---

*Runbook only. No production changes were made by the auditor.*

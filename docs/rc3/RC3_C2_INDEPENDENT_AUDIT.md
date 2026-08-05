# RC3-C2 — Independent Operational Audit

**Auditor role:** Independent Executive Release Auditor (external to implementation team)
**Audit date:** 2026-08-05
**Scope:** Production only — `https://vpsych.vercel.app`, GitHub `main`, Supabase `rrzudbkxigeavfdnidnm`
**Mandate:** Determine whether RC3-C2 is correctly classified as an operational prerequisite rather than an application defect.
**Constraints observed:** No code modified. No production data mutated. No repairs performed. No speculative fixes offered.

---

## 1. Executive Summary

RC3-C2 is **correctly classified as an operational prerequisite**. No application defect was found, and none is implicated by the recorded failure.

The single most important finding of this audit is that **the stated root cause in the existing RC3 record is incomplete, and the corrective action derived from it would not have unblocked the gate.**

The prior record (RDL-008) leads with "therapist/admin email variables are mapped to the wrong accounts." That email swap is real and is corroborated by the recorded evidence. But the same evidence artifact contains a `canonical_identity_matrix` in which **both canonical audit emails were tested against both environment passwords — and all four combinations failed with `invalid_credentials`.** The swap is therefore a genuine wiring error that is *not* the operative cause of the authentication failure. Correcting the email mapping alone would leave the gate exactly as failed as before.

The operative root cause is narrower and different: **the password material injected into the audit environment does not match the password material stored in `auth.users` for either audit account.** This audit found independent database corroboration for that conclusion (§6).

Critically, the failing transaction **never entered VPsych application code**. The probe authenticated directly against Supabase GoTrue at `/auth/v1/token?grant_type=password`. VPsych's own login path is a thin client that forwards raw form values to the same GoTrue endpoint without transformation. The application was not a participant in the failing operation, and therefore cannot be its cause.

Two claims in the RC3-C2 summary did not survive independent verification. **"No commits were created" is false** — sixteen commits exist across three branches, deployed as Vercel previews. And the entire RC3-C2 evidence base **does not exist on `main`**, the declared authoritative source, which makes the finding unverifiable from the source of record without consulting unmerged draft pull requests.

**Verdict: ✅ RC3-C2 VERIFIED AS OPERATIONAL PREREQUISITE**

---

## 2. Evidence Matrix

Each claim from the RC3-C2 summary, independently re-derived. "Reproduced" means this auditor obtained the result first-hand in this session; "Recorded" means the result exists only as a committed artifact this auditor could read but not re-execute.

| # | Claim under audit | Verdict | Basis |
|---|---|---|---|
| 1 | Production SHA matches `main` | **PASS** | Reproduced |
| 2 | Migration parity — git 54 ≡ production 54 | **PASS** | Reproduced (exact set equality) |
| 3 | Schema diff = 0 | **INSUFFICIENT EVIDENCE** | Ledger parity reproduced; full structural diff not reproducible |
| 4 | Audit secrets exist | **INSUFFICIENT EVIDENCE** | Not observable from any source available to this audit |
| 5 | Audit users exist | **PASS** | Reproduced |
| 6 | Therapist role correct | **PASS** | Reproduced |
| 7 | Admin role correct | **PASS** | Reproduced |
| 8 | Email variables mapped to wrong accounts | **INSUFFICIENT EVIDENCE** (recorded evidence supports) | Recorded |
| 9 | Authentication fails | **INSUFFICIENT EVIDENCE** (recorded evidence supports; DB state corroborates) | Recorded |
| 10 | No therapist access token | **INSUFFICIENT EVIDENCE** (recorded) | Recorded |
| 11 | No admin access token | **INSUFFICIENT EVIDENCE** (recorded) | Recorded |
| 12 | Credential Verification Gate FAILED | **PASS — gate correctly failed** | Analysis |
| 13 | Wave 1 never started / Missions 1–5 never executed | **PASS, with qualification** | Reproduced (see §8) |
| 14 | Engineering remained frozen | **PASS** | Reproduced — zero application code changes |
| 15 | No commits were created | **FAIL** | Reproduced — 16 commits exist |

### 2.1 Detail on reproduced items

**(1) Production SHA.** The Vercel project `vpsych` (`prj_qiJ1mQvX0s5lJZ9KJnpWAx4EXjNm`) has exactly one deployment with `target: "production"`:

```
dpl_5F6pBTi21VrYWaxmWSRcNnCcxTA4
  githubCommitRef : main
  githubCommitSha : 5bf66c07f11d286c305f59398a015614d22b723b
  state           : READY
  isRollbackCandidate: true
```

`git rev-parse origin/main` → `5bf66c07f11d286c305f59398a015614d22b723b`. **Identical. PASS.**

`https://vpsych.vercel.app/login` returns **HTTP 200** with the expected VPsych login markup. Production is live and serving.

Note for the record: six newer deployments exist, all `target: null` (preview), the most recent being `dpl_6fnDMiRDLkXFm1LcmUzXo3sDhh6q` at SHA `f76980c` on branch `cursor/wave1-reattempt-5f72`. These do not affect the production alias, but they are relevant to §7.

**(2) Migration parity.** Extracted all 54 version stamps from `supabase/migrations/` on `origin/main`, extracted all 54 rows from the production migration ledger, sorted and diffed:

```
git=54  prod=54
diff → IDENTICAL — zero drift
duplicate versions → none
range → 20260730132727 … 20260804085304
```

This is exact set equality, not merely a matching count. **PASS.**

**(3) Schema diff.** Downgraded to INSUFFICIENT EVIDENCE. Migration *ledger* parity is proven above, and a production structural inventory was captured:

| Object | Production count |
|---|---|
| `public` tables | 56 |
| RLS policies | 123 |
| `public` functions | 22 |
| Indexes | 182 |
| Columns | 666 |
| Applied migrations | 54 |

However, a defensible "schema diff = 0" requires a greenfield replay of the git migration set into a shadow database and a structural comparison against production. This audit had no local Postgres instance, and production is the only available database — which must not be mutated during a read-only audit. The prior claim is *plausible and consistent* with ledger parity, but this auditor did not reproduce it and will not certify it on inference.

**(5–7) Audit users and roles.** Queried `auth.users` joined to `public.profiles`:

| Field | `audit.therapist@vpsych.dev` | `audit.admin@vpsych.dev` |
|---|---|---|
| `auth.users.id` | `1ed008c2-9ac0-4343-b1ca-a16db4eabb4d` | `8545be46-2592-4de2-aaa7-4a27a022def7` |
| `profiles.role` | `therapist` ✅ | `admin` ✅ |
| `confirmed_at` | 2026-08-01 12:17:19 | 2026-08-01 12:19:42 |
| `banned_until` | `null` ✅ | `null` ✅ |
| `deleted_at` | `null` ✅ | `null` ✅ |
| `aud` / `role` | `authenticated` / `authenticated` | `authenticated` / `authenticated` |
| `is_sso_user` | `false` | `false` |
| password hash | `$2a$06$…`, 60 chars ✅ | `$2a$06$…`, 60 chars ✅ |
| `last_sign_in_at` | **2026-08-03 04:40:24** | **2026-08-03 16:08:45** |

Both accounts exist, carry the correct role, are confirmed, are **not banned**, are **not deleted**, and hold structurally valid bcrypt hashes. **PASS on all three claims.**

The non-null `last_sign_in_at` on both accounts is load-bearing for §6 — both accounts have successfully authenticated against production Auth in the past.

For contrast, the deliberately banned demo accounts remain correctly banned (`banned_until = 2099-01-01`): `therapist@vpsych.test`, `admin@vpsych.test`. This is the intended state per repository policy and is **not** a finding.

---

## 3. Authentication Matrix

### 3.1 Independent execution — not possible in this session

This audit could **not** execute a live authentication matrix. Two independent blockers:

1. **Network policy.** The audit environment's egress gateway rejects CONNECT to both production hosts. Verified directly against the proxy's own status endpoint:

```
connect_rejected  vpsych.vercel.app:443
connect_rejected  rrzudbkxigeavfdnidnm.supabase.co:443
```

A control host (`github.com`) resolves normally, confirming the rejection is host-scoped policy, not general network failure.

2. **No credentials.** All four `VPSYCH_AUDIT_*` variables are **absent** from this audit environment (full environment enumeration performed; none present). They are also referenced nowhere in the repository source tree.

Consequently every row below is **recorded evidence read from a committed artifact**, not a reproduced result. It is reported as such and carries INSUFFICIENT EVIDENCE for independent reproduction.

### 3.2 Recorded matrix — `wave1_login_verify_2026-08-05T1030.json`

Endpoint: `https://rrzudbkxigeavfdnidnm.supabase.co/auth/v1/token?grant_type=password`

**Environment-variable-as-supplied matrix:**

| Label | Email local part actually sent | HTTP | Result |
|---|---|---|---|
| `therapist` | `audit.admin` ⚠️ | 400 | `invalid_credentials` |
| `admin` | `audit.therapist` ⚠️ | 400 | `invalid_credentials` |
| `therapist_email_admin_password` | `audit.admin` | 400 | `invalid_credentials` |
| `admin_email_therapist_password` | `audit.therapist` | 400 | `invalid_credentials` |

The ⚠️ rows are the email swap: the variable labelled *therapist* transmitted the *admin* local part, and vice versa.

**Canonical-identity matrix — the decisive test:**

| Email identity | Password source | HTTP | Result |
|---|---|---|---|
| canonical **therapist** | therapist env password | 400 | `invalid_credentials` |
| canonical **therapist** | admin env password | 400 | `invalid_credentials` |
| canonical **admin** | therapist env password | 400 | `invalid_credentials` |
| canonical **admin** | admin env password | 400 | `invalid_credentials` |

```
primary_login_pass       : false
any_password_authenticates: false
```

**Which combinations authenticate: none — zero of eight.**

### 3.3 What this matrix actually proves

This is the analytical core of the audit.

The canonical matrix deliberately **removes the email swap as a variable** by testing the two known-correct addresses directly. All four combinations still fail. Therefore:

- The email swap is **real**, but it is **not the operative cause** of the authentication failure.
- Repairing only the email mapping — the headline remediation in the existing record — **would not produce a successful login.**
- Neither environment password matches the stored hash for *either* audit account.

The existing RC3 record does state this in its diagnosis section, but leads with the swap in its summary and gate table. For a Release Manager reading the summary and acting on it, that ordering is materially misleading. This audit elevates the password mismatch to primary root cause.

### 3.4 Evidence limitation on corroboration

`auth.audit_log_entries` in the production project contains **zero rows** (verified: count 0, no oldest/newest timestamp). GoTrue authentication attempts are not being retained in this project, so the recorded 400 responses **could not be corroborated from the server side**. This is itself an operational observation: the production Auth deployment currently retains no authentication audit trail, which limits forensic capability for this and any future credential incident.

---

## 4. Credential Wiring Verification

**Objective 7 asked whether `VPSYCH_AUDIT_THERAPIST_EMAIL` actually contains `audit.therapist@…` or `audit.admin@…`, and likewise for the admin variable.**

**This auditor could not read the values.** They are absent from the audit environment, absent from Supabase Vault, and not exposed by any available Vercel tool. The finding below therefore rests on recorded evidence.

### 4.1 Documented intent

`docs/AUDIT_ACCOUNTS.md` (present only on the unmerged PR #106 branch) defines the contract:

| Variable | Intended value |
|---|---|
| `VPSYCH_AUDIT_THERAPIST_EMAIL` | local `audit.therapist`, domain `vpsych.dev` |
| `VPSYCH_AUDIT_THERAPIST_PASSWORD` | password for `auth_user_id` `1ed008c2-…` |
| `VPSYCH_AUDIT_ADMIN_EMAIL` | local `audit.admin`, domain `vpsych.dev` |
| `VPSYCH_AUDIT_ADMIN_PASSWORD` | password for `auth_user_id` `8545be46-…` |

The document's own status field reads `accounts_ready_secrets_pending` — the implementation record already concedes the secrets side was never completed.

### 4.2 Observed wiring across three attempts

The wiring state **changed between attempts**, which is itself significant:

| Attempt | Recorded state |
|---|---|
| RDL-006 (2026-08-04) | All four `VPSYCH_AUDIT_*` variables **missing entirely** |
| RDL-007 (2026-08-05 10:19) | Variables present but **values equalled their own key names** — `email_used_equals_env_keyname: true`, `password_used_equals_env_keyname: true`, `email_looks_like_email: false`. Placeholder injection. |
| RDL-008 (2026-08-05 10:34) | Values are real addresses but **swapped** across roles; passwords authenticate nothing |

Three different wiring states in roughly 24 hours, each producing a different stated root cause. The gate correctly failed all three times, but the instability indicates the injection process itself is unverified and manual.

### 4.3 Secret storage

Supabase Vault contains exactly **one** secret:

| Name | Present |
|---|---|
| `report_write_key` | yes |

There is **no** audit credential material in Supabase Vault. The claim "audit secrets exist" could not be confirmed against any source available to this audit — hence INSUFFICIENT EVIDENCE at row 4 of the evidence matrix. If the secrets exist, they exist only in the Vercel environment or an external secrets manager not exposed to this audit.

---

## 5. Operational Findings

**OPS-1 — Password material in the environment does not match `auth.users`. (Primary root cause.)**
Neither injected password authenticates either audit account. This is the blocking condition.

**OPS-2 — Email-to-role mapping is inverted.**
`VPSYCH_AUDIT_THERAPIST_EMAIL` carries the admin local part and vice versa. Real, must be fixed, but **not** sufficient to clear the gate on its own.

**OPS-3 — Secret injection is unverified and has failed three distinct ways.**
Missing → placeholder → swapped-and-invalid, across three attempts. No post-injection validation step exists that would have caught any of the three before an audit agent consumed them.

**OPS-4 — No audit credential material in Supabase Vault.**
Only `report_write_key` is present. The vault-to-Auth synchronisation the RC3 record repeatedly refers to has no observable vault-side component.

**OPS-5 — Production Auth retains no authentication audit trail.**
`auth.audit_log_entries` is empty. Failed and successful authentications alike leave no server-side forensic record.

**OPS-6 — Audit environments lack egress to the systems under audit.**
The environment provisioned for this audit cannot reach `vpsych.vercel.app` or the Supabase host. Any audit requiring live authentication is structurally impossible under that policy, independent of credential correctness.

---

## 6. Application Findings

**No application defect was identified.** Four independent lines of reasoning support this, in descending order of strength.

**AF-1 — The failing transaction never touched VPsych application code.**
The probe authenticated directly against Supabase GoTrue's `/auth/v1/token?grant_type=password`. VPsych was not in the request path. A component absent from a failing transaction cannot be its cause.

**AF-2 — VPsych's own login path is credential-transparent.**
`src/app/login/page-client.tsx:32` forwards the raw form values to `supabase.auth.signInWithPassword({ email, password })`. There is no email rewriting, no credential transformation, no role-conditional branching ahead of authentication, and no server-side interposition. The application path and the probe path converge on the identical GoTrue endpoint with identical inputs — so the probe was representative, and the app adds no failure surface.

**AF-3 — GoTrue's response was correct.**
HTTP `400` with `error_code: invalid_credentials` is the specification-correct response to a credential mismatch. Not a `500`, not a timeout, not a misroute, not a malformed response. The authentication service behaved exactly as designed given wrong credentials.

**AF-4 — Both audit accounts have authenticated successfully in production.**
`last_sign_in_at` is non-null for both (`2026-08-03 04:40:24` therapist; `2026-08-03 16:08:45` admin). The full login path — account, role, Auth service, production deployment — has demonstrably worked end-to-end for these exact identities. Nothing in the application changed between then and the failed attempts: production has served SHA `5bf66c0` throughout.

### 6.1 Independent database corroboration of the root cause

This audit found supporting evidence in the `auth.users` row timestamps:

| Account | `last_sign_in_at` | `updated_at` | Interpretation |
|---|---|---|---|
| `audit.therapist@vpsych.dev` | 2026-08-03 04:40:24.385 | 2026-08-03 04:40:24.398 | `updated_at` is **13 ms after** sign-in — this is the sign-in itself touching the row. **No password change since.** |
| `audit.admin@vpsych.dev` | 2026-08-03 16:08:45.125 | **2026-08-04 14:04:15.835** | `updated_at` is **~22 hours after** the last successful sign-in. Consistent with a credential mutation on 08-04 that was never mirrored into the environment. |

This is consistent with, and independently supportive of, OPS-1: the admin account's stored credential was altered on 2026-08-04 without a corresponding environment update, and the therapist account's stored credential still predates 2026-08-03 — meaning the value that worked on 08-03 is still the correct one and simply is not what was injected on 08-05.

This corroboration is circumstantial — `updated_at` advances on several row mutations, not password changes alone — and is offered as supporting evidence, not proof.

---

## 7. Release Governance Findings

**GOV-1 — "No commits were created" is false.**
Sixteen commits exist on `cursor/wave1-reattempt-5f72` beyond `main`, spanning RDL-006 through RDL-010, across three branches and three open draft pull requests (#104, #105, #106). Each was built and deployed as a Vercel preview.

The *substance* of the freeze held: the diff against `main` is **2,119 insertions across 30 files, all confined to `docs/` plus `RELEASE_MANIFEST.md`**. Zero changes to `src/`, zero to `supabase/`, zero to configuration or dependencies. **Engineering was genuinely frozen** — claim 14 passes. But the blanket assertion "no commits were created" is inaccurate as written and should be restated as "no application-code commits were created."

**GOV-2 — The RC3-C2 evidence base does not exist on the declared authoritative source.**
This audit was instructed to treat `main` as authoritative. On `main` there is **no `docs/rc3/` directory at all** — no mission reports, no evidence JSON, no RDL log, no `AUDIT_ACCOUNTS.md`, no `RELEASE_GOVERNANCE.md`. Every artifact underpinning RC3-C2 lives exclusively in unmerged draft PRs. A reviewer following the stated scope would find no evidence whatsoever.

> **Adopted disposition (Executive Board, 2026-08-05):** RC3 documentation **will not** be merged into `main` until the full RC process (RC3–RC5) completes and Board approval is granted. The finding above stands as a verification-scope observation; the remediation is deliberately deferred by decision. The compensating control is that the release package must remain complete, self-contained, and reachable on its branch — see §7.1.

**GOV-3 — Fragmented, competing certification branches.**
Five pull requests are open simultaneously (#99, #101, #102, #104, #105, #106), three of them carrying overlapping and partially contradictory RC3 Wave-1 STOP documentation with divergent root-cause statements. There is no single authoritative RC3 record.

**GOV-4 — Root cause narrative drifted across attempts without reconciliation.**
RDL-006 ("variables missing"), RDL-007 ("placeholders"), RDL-008 ("swapped + invalid") each describe a different failure. They are sequential operational states, not competing diagnoses — but the record does not present them that way, and a reader of any single document would draw an incomplete conclusion.

**GOV-5 — The remediation ordering in the record is misleading.**
As established in §3.3, the record's headline emphasis on the email swap does not match its own evidence, which shows the swap is not the blocking cause.

**GOV-6 — The gate itself performed correctly.**
Notwithstanding the above, the Credential Verification Gate did what a gate is supposed to do: it detected unusable credentials, refused to proceed, and prevented five missions from producing certification evidence on an unverified basis. Halting was the right call, and the decision to stop rather than improvise around the blocker is sound release discipline.

### 7.1 Deferred-merge compensating control

Because GOV-2's remediation is deferred until Board approval, the following must hold for the deferral to remain safe:

1. The release package is **branch-resident and complete** — every artifact a reviewer needs is present, with no dependency on `main`.
2. Each evidence artifact records the **SHA it was produced against**, so superseded evidence cannot be mistaken for current (see §8).
3. The RC3 record is **consolidated**, not spread across competing branches (GOV-3 remains open and is not resolved by the deferral).
4. On Board approval, the entire package merges as a unit, preserving the RDL sequence.

---

## 8. Qualification on "Wave 1 never started"

Claim 13 passes, with one qualification the Board should be aware of.

No Wave 1 mission evidence was produced in the 2026-08-05 attempts — the gate blocked before Missions 1–5 began, and `primary_login_pass: false` confirms no authenticated session was ever established. That much is accurate.

However, `docs/rc3/M01_UI_UX.md` through `M26_M30_PUBLIC_LAUNCH.md` **do exist** on the PR branches. These originate from the earlier RC3 run (PR #104) executed against `main@52a7610` — a **different SHA with 28 migrations**, before the #103 reconciliation brought the tree to 54.

These documents must not be read as evidence for the current release candidate. They describe a superseded code state. The phrasing "Missions 1–5 never executed" is true for RC3 at `5bf66c0`, but mission-report files bearing those names exist and could be mistaken for current evidence.

---

## 9. Risk Classification

| Dimension | Rating | Rationale |
|---|---|---|
| Application correctness risk | **NONE IDENTIFIED** | App absent from failing path; login path credential-transparent; accounts previously authenticated successfully |
| Data integrity risk | **LOW** | Migration ledger parity exact; no schema drift detected; no mutations performed |
| Security posture risk | **LOW–MODERATE** | Auth correctly rejected invalid credentials. Moderated by OPS-5 (no auth audit trail) |
| Operational readiness risk | **HIGH** | Credential provisioning has failed three consecutive times with no validation step |
| Release governance risk | **HIGH** | Evidence base absent from authoritative source; competing branches; inaccurate summary claims |
| Certification completeness | **BLOCKED** | Missions 1–5 unexecuted; Waves 2–7 locked |

---

## 10. Root Cause

**Primary:** The password values injected into `VPSYCH_AUDIT_THERAPIST_PASSWORD` and `VPSYCH_AUDIT_ADMIN_PASSWORD` do not match the bcrypt hashes stored in `auth.users` for the corresponding audit accounts. Every combination of canonical email and available password fails.

**Secondary:** `VPSYCH_AUDIT_THERAPIST_EMAIL` and `VPSYCH_AUDIT_ADMIN_EMAIL` carry each other's addresses. Real, must be corrected, insufficient alone.

**Contributing:** No validation step confirms injected credentials authenticate before an audit agent consumes them — permitting three successive failed provisioning states.

**Explicitly excluded by evidence:**

| Candidate cause | Excluded because |
|---|---|
| Missing users | Both exist with correct IDs |
| Incorrect roles | `profiles.role` correct for both |
| Disabled/banned accounts | `banned_until` and `deleted_at` both null for both |
| Unconfirmed accounts | Both confirmed 2026-08-01 |
| SSO/provider misconfiguration | `is_sso_user = false`; email provider path |
| Migration or schema drift | 54 ≡ 54, exact set equality |
| Wrong deployment in production | Production SHA ≡ `main` ≡ `5bf66c0` |
| Application authentication defect | See §6, AF-1 through AF-4 |

---

## 11. Recommended Release Manager Actions

Verification steps only — no repairs performed or proposed by this audit. Execution procedure is specified in `RC3_C2_CREDENTIAL_GATE_RUNBOOK.md`.

1. **Reset both audit account passwords at source**, then inject those exact values — but run the read-only diagnostic first (runbook Phase 0). This addresses OPS-1, the actual blocker.
2. **Correct the email-to-role mapping** so `VPSYCH_AUDIT_THERAPIST_EMAIL` resolves to local part `audit.therapist` and the admin variable to `audit.admin`, both at `vpsych.dev`.
3. **Add a post-injection verification step** that performs one password-grant per account and asserts HTTP 200 with an access token — executed *by the Release Manager*, before any audit agent is dispatched. Three failed provisioning cycles were each detectable at injection time.
4. **Confirm role separation after authentication**, not merely that login succeeds: the therapist token must be denied at `/api/admin/*` and the admin token admitted.
5. **Provision audit environments with egress** to `vpsych.vercel.app` and the Supabase host (OPS-6), or live authentication verification remains structurally impossible.
6. ~~Consolidate the RC3 record onto `main`.~~ **Deferred by Board decision** — see the adopted disposition under GOV-2 and the compensating control in §7.1.
7. **Close or consolidate the competing certification PRs** (GOV-3) so a single authoritative RC3 record exists. Not affected by the deferral.
8. **Restate the RC3-C2 summary** to lead with the password mismatch rather than the email swap (GOV-5), and correct "no commits were created" to "no application-code commits were created" (GOV-1).
9. **Quarantine the superseded mission reports** produced against `main@52a7610` (§8) so they cannot be mistaken for evidence at `5bf66c0`.
10. **Consider enabling Auth audit log retention** (OPS-5) before re-running the gate, so the next attempt leaves a server-side forensic trail.

---

## 12. Final Decision

### Classification

**B) Operational prerequisite.**

RC3-C2 is a failure of credential provisioning in the release operations process. The application, its deployment, its database schema, and its authentication integration were all verified functional or found uninvolved in the failure. Every excluded cause in §10 was tested and eliminated against production.

Governance defects were also identified (§7) and are material — the evidence base is absent from the authoritative source, and two summary claims are inaccurate. But these concern how RC3-C2 was *recorded and reported*, not what *blocked* it. The blocking condition is unambiguously operational, so the primary classification remains B. The governance findings are reported for separate Board action and should not be dismissed on account of that classification.

### Statement required by Audit Objective 10

Objective 10 requested this statement conditional on authentication succeeding after operational inputs are corrected. That condition **could not be tested** in this session — no credentials were available and egress to both production hosts was blocked by network policy. This auditor will not claim a successful login that was not performed.

On the evidence that *was* obtainable — the application's absence from the failing path, the credential-transparent login implementation, GoTrue's specification-correct rejection, and both accounts' documented history of successful production authentication — the conclusion is nonetheless firm:

> **RC3-C2 is NOT an application defect.**

Final confirmation that the gate clears should come from a successful authenticated login once the Release Manager corrects the password material. This audit's finding is that no application change is required for that to succeed.

### Verdict

# ✅ RC3-C2 VERIFIED AS OPERATIONAL PREREQUISITE

---

## Appendix A — Audit Scope and Limitations

**Sources used:** production Vercel deployment metadata; production Supabase project `rrzudbkxigeavfdnidnm` (read-only); GitHub `alhazayed/vpsych` `main` and referenced branches; live fetch of `https://vpsych.vercel.app/login`.

**Sources deliberately not used:** localhost, preview deployments (except as governance observations in §2.1 and §7), feature branches as authority for application state, mocked data, assumptions in place of measurement.

**Actions not taken during the audit phase:** no code modified; no documentation altered; no database mutation of any kind — every query issued was read-only; no repairs; no speculative fixes.

**Limitations affecting this audit:**

- Network egress to `vpsych.vercel.app:443` and `rrzudbkxigeavfdnidnm.supabase.co:443` was rejected by the environment's gateway policy, preventing independent execution of the authentication matrix.
- No `VPSYCH_AUDIT_*` variables were present in the audit environment, and no tool available exposed Vercel environment variable values.
- `auth.audit_log_entries` is empty, preventing server-side corroboration of the recorded authentication attempts.
- A greenfield migration replay for a true structural schema diff was not possible without a non-production database.

Every claim in this report is labelled **Reproduced**, **Recorded**, or **Analysis**. No item marked INSUFFICIENT EVIDENCE was upgraded on inference.

---

## Appendix B — Post-audit disposition

The audit above was delivered read-only. Subsequent Board direction (2026-08-05) adopted the accompanying runbook as the operational recovery procedure, with one modification: **RC3 documentation is not to be merged into `main` until RC3–RC5 complete and Board approval is granted.** That modification is reflected in GOV-2, §7.1, and recommendation 6.

This audit report and `RC3_C2_CREDENTIAL_GATE_RUNBOOK.md` are committed to the release package branch as evidence. **No production system was modified by the auditor at any point** — the Credential Verification Gate remains FAILED and unexecuted, because the two capabilities required to execute it (Vercel environment-variable access and network egress to the production hosts) are not available in the audit environment. See the delivery note accompanying this package.

---

*Independent Executive Release Auditor — 2026-08-05*
*Audited at production SHA `5bf66c07f11d286c305f59398a015614d22b723b`, deployment `dpl_5F6pBTi21VrYWaxmWSRcNnCcxTA4`, Supabase `rrzudbkxigeavfdnidnm` (54 migrations).*

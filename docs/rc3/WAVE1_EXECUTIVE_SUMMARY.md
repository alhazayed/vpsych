# RC3 Wave 1 — Executive Summary

**One-line decision:**

# ⚠ WAVE 1 CERTIFIED WITH RECOMMENDATIONS

**Recommend:** UNLOCK WAVE 2  
**Do not start Wave 2** without Executive Board authorization.

---

Production at SHA `5bf66c0` / `dpl_5F6pBTi…` remains the only test surface. Credential Verification Gate (RC3-C2 / RDL-011) was re-proven via Vault inject + `rc3-credential-gate-preflight.mjs` **PASS**.

Missions **1, 2, and 5 PASS**. Mission **4** exposed Critical **W1-C1**: incomplete V1-C1 restore left `insert_system_message` / `insert_assistant_message` bodies service_role-only while the app falls back to the authenticated client — therapists could not start sessions (`500 Not authorized`). Fixed with migration `20260805130453_restore_session_message_rpc_owner_auth` (DB-only; app binary unchanged). Retest: create → message (`aiSource: gpt`) → end (report) **PASS**. Mission **3** parity **55 ≡ 55** after the fix; residual **RC3-H1** (HaveIBeenPwned / leaked-password protection off).

| Gate | Status |
|---|---|
| RC1 / RC2 / RC3-C2 | PASSED |
| Wave 1 Missions 1–5 | Certified with recommendations |
| Waves 2–7 · RC4 · RC5 | LOCKED pending Board unlock |

**Engineering:** remain frozen except verified Critical/High remediation (W1-C1 done). No speculative work. No Wave 2 execution in this run.

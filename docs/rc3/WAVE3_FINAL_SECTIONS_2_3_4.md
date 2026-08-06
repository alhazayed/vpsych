# Wave 3 Final — Prompt, Memory & Security Certification  
## Sections 2–4 @ production `5aae138`

**Overall:** ⚠ **CONDITIONALLY ACCEPTABLE** for Sections 2–4 as production-hardening posture — **0 Critical, 0 High unique to these sections**, multiple Mediums.  
**Does not override** educational/scientific Wave 3 FAIL (W3-C1/H1–H4).

---

## Not on production (do not certify)

Quality Ledger, CQI, EOI, PME, CVL, CFI/ERI/AVI/ALE/RRS/VQI admin APIs, research export — absent at `5aae138` (confirmed 404 / git ABSENT).

---

## Section 2 — Prompt safety

Runtime prompts: patient Modules 1–4 + per-turn (`src/lib/ai/prompt-engine.ts`); examiner EN/AR (`report-locale.ts`).

| ID | Sev | Finding |
|---|---|---|
| W3-S2-M1 | Med | No explicit runtime ban on recreating real/celebrity patients (fiction mainly in persona library) |
| W3-S2-M2 | Med | No secondary output filter after model generation |
| W3-S2-M3 | Med | Admin `persona_prompt` concatenated into system prompt |
| W3-S2-M4 | Med | Isolation is instruction-only; user turns included in history |
| W3-S2-L1 | Low | Heuristic examiner copy may mention env-adjacent labels |

**Adversarial posture:** Role-break / instruction-ignore rules present in Module 4. Board did not claim red-team completeness without dedicated adversarial suite on prod.

---

## Section 3 — Memory safety

| ID | Sev | Finding |
|---|---|---|
| W3-S3-M1 | Med | Hard CASCADE deletes; limited DSAR/recovery UX |
| W3-S3-M2 | Med | Institution managers can SELECT peer session metadata / clinical_snapshot (not messages/reports) |
| W3-S3-M3 | Med | Session end may return ACE coach summary to therapist |
| W3-S3-L1 | Low | `longitudinal_group_id` unused on prod SHA |

Cross-session patient memory engine (PME) **not present** on production — reduces cross-session leakage surface; also reduces longitudinal fidelity claims.

---

## Section 4 — Security

Production probes this run:

- Therapist → `/api/admin/presets` = **403** (PASS)
- Admin cookie auth to ACE/CGE/presets = **200** (PASS)
- Rate limit on preset preview = **429** (PASS)
- Public `/api/health` = **200**; `/api/health/openai` requires admin (401 unauth) (PASS)

| ID | Sev | Finding |
|---|---|---|
| W3-S4-M1 | Med | Message RPC EXECUTE grants vs service_role body checks — defense-in-depth landmine |
| W3-S4-M2 | Med | Some admin list routes lightly/un-throttled historically |
| W3-S4-M3 | Med | STT/TTS authenticated but not bound to a session id |
| W3-S4-M4 | Med | CSP allows `unsafe-inline` / `unsafe-eval` |
| W3-S4-L* | Low | In-memory rate limit without Upstash; public health surface |

**Privilege escalation:** No Critical escalation demonstrated this run.  
**PHI:** Reports remain admin-gated by design; therapist cannot open admin APIs.

---

## Residual risks

Provider-side retention; irreversible purge; institutional metadata visibility; prompt injection without output filter; **re-audit mandatory** when Quality Ledger / CQI / EOI / CVL merge to production.

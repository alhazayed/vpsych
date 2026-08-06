# Known Limitations — VPsych Professional Preview 1.0 (RC1)

**Audience:** Invited clinical experts and program leads  
**Baseline:** production @ `d4c4fae` / `dpl_Dpdpoy…`  
**Purpose:** Set honest expectations before evaluation. These are intentional or known gaps — not defects to “fix during review” unless Critical.

---

## Clinical & educational measurement

1. **Competency scores are not yet validated.** Assessment machinery exists; published reliability/validity coefficients are not claimed. Treat scores as formative feedback for training discussion, not high-stakes credentialing.  
2. **Admin reports only.** Therapists do not see full performance reports by design.  
3. **Heuristic fallbacks** may appear if model providers are unavailable; the UI should surface `aiSource` (including `persona_fallback`) — never treat fallback as a model reply.

---

## Simulation fidelity

4. **AI patients are synthetic / fictional.** Never real persons. Pathways are training constructs.  
5. **Conversational phenotype** varies by disorder package richness; some presentations are stronger than others.  
6. **Excellence / mind-engine / longitudinal therapy-response stacks** (PME, TRE, HCTF, CVL) remain open experimental/roadmap PRs. **Professional Preview Program (PPP)** evaluation tooling (CQI / EOI capture, Reviewer Analytics, admin preview dashboard, onboarding) ships separately for expert feedback — it does **not** change simulation behaviour.

---

## Product scope

7. **Single-tenant preview.** Institutional multi-tenant, DSAR automation, and full enterprise compliance suites are deferred (`[v1.1]` backlog).  
8. **Avatar catalog** on production may be limited to active seeded patients (evaluate what is live, not the full research library).  
9. **Session hard cap** is 40 minutes server-side.  
10. **Arabic and English** are supported; quality may differ by voice casting and personality authorship.

---

## Operations & security residuals

11. **Rate limits** apply (sessions, messages, STT, TTS). Heavy testing may hit 429.  
12. **Secrets and provider keys** are ops-managed; TTS requires a valid ElevenLabs `sk_…` Production key (fixed for Wave 3 H5).  
13. **Assessment reliability corpus** needs real clinician ratings before scientific publication claims.

---

## What evaluators should not expect

- Automated clinical decision support for real patients  
- Guaranteed identical scores across models/providers  
- Public marketing site polish beyond current app shell  
- Immediate merge of experimental excellence PRs during the preview window

If you discover a **Critical** safety or data-integrity issue in production, report it immediately through the Feedback Guide’s Critical channel — do not wait for the scheduled debrief.

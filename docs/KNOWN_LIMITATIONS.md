# Known Limitations — VPsych Professional Preview 1.0

**Audience:** Invited clinical experts and program leads  
**Baseline:** production @ `7dc9a35` / `dpl_2fxxbz…` (Mission Omega)  
**Prior freeze note:** RC1 packaging originally froze `d4c4fae`; subsequent merges #139–#143 are on the current baseline under Limited Professional Preview constraints.  
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
6. **Excellence / mind-engine / longitudinal therapy-response stacks** (PME, TRE, HCTF, CQI, EOI, CVL, HFTE, VMHC) are **not** in this preview — they remain open experimental/roadmap PRs.

---

## Product scope

7. **Single-tenant preview.** Institutional multi-tenant, DSAR automation, and full enterprise compliance suites are deferred (`[v1.1]` backlog).  
8. **Avatar catalog** on production may be limited to active seeded patients (evaluate what is live, not the full research library).  
9. **Session hard cap** is 40 minutes server-side.  
10. **Arabic and English** are supported; quality may differ by voice casting and personality authorship.  
11. **Therapy Room Mode** may exist in code but is **disabled by default** (`NEXT_PUBLIC_THERAPY_ROOM_MODE`); classic VoiceSession is the preview default.

---

## Operations & security residuals

12. **Rate limits** apply (sessions, messages, STT, TTS). Heavy testing may hit 429.  
13. **Secrets and provider keys** are ops-managed; TTS requires a valid ElevenLabs `sk_…` Production key (fixed for Wave 3 H5).  
14. **Assessment reliability corpus** needs real clinician ratings before scientific publication claims.  
15. **Supabase Auth leaked-password protection** remains disabled (ops residual).  
16. **Monitoring/APM and DR drills** are not production-certified for GA. CIDP ships in-app ops/CIDP dashboards and DR procedures; vendor APM and signed PITR drill evidence remain open.  
17. **Controlled Institutional Deployment** (`docs/cidp/`) is governed Limited Institutional Production — **not** General Availability.

---

## What evaluators should not expect

- Automated clinical decision support for real patients  
- Guaranteed identical scores across models/providers  
- Public marketing site polish beyond current app shell  
- Immediate merge of experimental excellence PRs during the preview window  
- Full expert clinical-validation completion (Mission Omega recommendation is Limited Professional Preview only)

If you discover a **Critical** safety or data-integrity issue in production, report it immediately through the Feedback Guide’s Critical channel — do not wait for the scheduled debrief.

# UX / Accessibility Audit — Section D (UXI)

**Audit:** VEA-2026-08-05 · Production SHA `5aae138` · Observational only

## Production UX evidence

| Check | Result | Evidence |
|---|---|---|
| Homepage | 200, ~1.8s cold / ~0.13s warm | `curl` timing |
| Login / signup | 200 | Live |
| Privacy / terms | 200 | Live |
| Unauth app shell | 307 → login | `/avatars`, `/admin/reports` |
| i18n / RTL | `lang`/`dir` on `<html>`; Noto Sans Arabic | Production HTML + `layout.tsx` |
| Error boundaries | Present in app router | `error.tsx`, `global-error.tsx` |
| Landing social proof | Unverified stats rendered | Production HTML: `10,000+`, `500+`, `25+`, `95%`, `Trusted by` |
| Open Graph | Absent | Homepage meta = title + description only |

---

## Dimension scores

| Dimension | Score | Notes |
|---|---:|---|
| Onboarding | 68 | Signup + password policy; legal links present |
| Navigation | 74 | AppShell sidebar + mobile bottom nav |
| Responsiveness | 72 | `md:`/`lg:` layouts; VoiceSession stacks |
| Accessibility | 55 | Some aria-labels/live regions; no WCAG suite; sparse coverage |
| Mobile | 70 | Usable shell; voice UX denser on small screens |
| Desktop | 76 | Primary design target |
| Loading | 72 | Health/home warm latency good; session AI turns slower |
| Error handling | 74 | Boundaries + client-safe API errors |
| Report readability | 70 | Admin ReportView structured; therapist incomplete view |
| Session flow | 76 | Avatar → session → voice/text → complete |
| Assessment flow | 65 | End triggers assessment; opacity for therapist |
| Overall usability | 71 | Coherent training loop |

---

## User Experience Index (UXI)

**UXI = 70 / 100**

### Trust deduction

Landing false social proof is an **ethics/UX trust defect**. It does not destroy in-app usability but harms board confidence and expert preview readiness.

---

## Findings

| ID | Sev | Finding | Root cause | Impact | Priority |
|---|---|---|---|---|---|
| UX-H1 | High | Unverified marketing stats on production landing | Hardcoded `STAT_KEYS` / copy | Expert distrust | P0 |
| UX-H2 | High | Accessibility not systematically tested | No axe/WCAG CI | Exclusion risk | P1 |
| UX-M1 | Medium | `#pricing` / `#about` style marketing anchors historically broken | Landing composition | Dead ends | P2 |
| UX-M2 | Medium | `global-error` hardcodes `lang="en"` | Oversight | AR error UX | P2 |
| UX-L1 | Low | Remember Me UI historically no-op (security cert) | Incomplete control | Confusion | P3 |

---

## Recommendations

| Rec | Impact | Priority |
|---|---|---|
| Remove or source-verify landing stats before expert invites | Trust | P0 |
| Add axe CI on critical flows (login, session, learning) | A11y | P1 |
| Therapist-facing clarity on what happens at session end | Expectation setting | P1 |
